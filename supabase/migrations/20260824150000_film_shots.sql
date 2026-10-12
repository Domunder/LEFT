-- LEFT — the film becomes an edit, and the edit is written down.
--
-- Until now the render was concatenation: every uploaded clip, at its charged
-- length, end to end. That made the film only as good as its worst take — twenty
-- seconds of somebody's shoes is twenty seconds of shoes in the finished film,
-- and there was no mechanism that could save it.
--
-- Once `budget_seconds` exceeds `film_seconds` the renderer has more footage than
-- it needs, so it can *choose*. That is the difference between a highlight film
-- and a concatenation script, and it is the thing the photo-sharing apps this
-- competes with cannot follow into.
--
-- **The edit is persisted rather than recomputed.** The obvious alternative is a
-- pure function both sides run — but `hooks/use-clip-playlist.ts` derives every
-- chapter offset and the grid highlight from where each clip sits in the film, so
-- the app and the renderer must agree *exactly*. Two implementations in two
-- languages agreeing exactly is a promise nobody can keep. One table, written by
-- the thing that built the timeline, read by everything else.
--
-- Two consequences worth knowing before reading the schema:
--
--   * **A clip may appear more than once.** Round-robin gives everyone a shot
--     before anyone gets a second, so a small group with a long film comes back
--     around. That alone is why the client's clip list can no longer be 1:1 with
--     the timeline, and why there is no unique index on `clip_id`.
--   * **A clip may appear not at all.** That is the point of selecting. Nothing
--     downstream may treat a missing clip as evidence the edit is stale.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
create table public.film_shots (
  event_id uuid not null references public.events (id) on delete cascade,
  /*
    `on delete cascade`, which technically lets a deleted clip punch a hole in a
    timeline this migration otherwise insists is gapless. Clips are only ever
    deleted with their event, so the hole cannot occur in practice — and a shot
    row pointing at a clip that no longer exists would be worse, since the render
    it describes could never be reproduced.
  */
  clip_id  uuid not null references public.clips (id) on delete cascade,
  /*
    Named `shot_index` rather than `position`, which is a SQL keyword and a
    Postgres function. It works quoted and reads badly everywhere else.
  */
  shot_index     integer not null check (shot_index >= 0),
  start_seconds  numeric(8, 2) not null check (start_seconds >= 0),
  /** Where in the clip's own file this shot begins — Shotstack's `trim`. */
  in_seconds     numeric(8, 2) not null check (in_seconds >= 0),
  length_seconds numeric(8, 2) not null check (length_seconds > 0),
  primary key (event_id, shot_index)
);

comment on table public.film_shots is
  'The edit decisions behind one rendered film: which clip, from where, for how '
  'long, at what offset. Written by render-film as it builds the timeline; read '
  'by 17 so the app''s chapter offsets are the render''s own, not a recomputation.';

alter table public.film_shots enable row level security;

create policy "film_shots: members can read"
  on public.film_shots for select to authenticated
  using (public.is_event_member(event_id, (select auth.uid())));

-- Read-only to clients. Only `record_film_shots()` writes, as the service role.
grant select on public.film_shots to authenticated;


-- ---------------------------------------------------------------------------
-- 2. record_film_shots() — the edit is validated, not trusted
-- ---------------------------------------------------------------------------
-- The caller is `render-film`, which is our own code, so this is not defending
-- against an attacker. It is defending against **a bug in the selection
-- algorithm**, which is a much likelier problem and a far quieter one: a timeline
-- with a gap in it renders fine and then makes the app's chapter highlight drift
-- silently out of sync with the picture, which nobody would trace back to here.
--
-- Gaplessness is the invariant worth spending a check on, because `entryAt()` in
-- `use-clip-playlist.ts` assumes it outright — it maps a playback time onto a
-- shot by walking starts, and a gap makes that answer wrong rather than absent.
create or replace function public.record_film_shots(p_event_id uuid, p_shots jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count    integer;
  v_expected numeric := 0;
  r          record;
begin
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if p_shots is null or jsonb_typeof(p_shots) <> 'array' or jsonb_array_length(p_shots) = 0 then
    raise exception 'an edit must be a non-empty array of shots' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_shots);

  /*
    Walked in the order given, which must also be `shot_index` order — the
    ordinality check below is what makes those the same thing, and the running
    `v_expected` is what makes the timeline gapless.
  */
  for r in
    select
      (s.value ->> 'clipId')::uuid        as clip_id,
      (s.ord - 1)::integer                as ordinal,
      (s.value ->> 'shotIndex')::integer  as shot_index,
      (s.value ->> 'startSeconds')::numeric  as start_seconds,
      (s.value ->> 'inSeconds')::numeric     as in_seconds,
      (s.value ->> 'lengthSeconds')::numeric as length_seconds
    from jsonb_array_elements(p_shots) with ordinality as s(value, ord)
    order by s.ord
  loop
    if r.shot_index is distinct from r.ordinal then
      raise exception 'shot indexes must be 0..n-1 in order (got % at position %)',
        r.shot_index, r.ordinal using errcode = '22023';
    end if;

    if r.length_seconds is null or r.length_seconds <= 0 then
      raise exception 'shot % has no length', r.ordinal using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.clips c
       where c.id = r.clip_id and c.event_id = p_event_id and c.status = 'uploaded'
    ) then
      raise exception 'shot % names a clip that is not an uploaded clip of this event',
        r.ordinal using errcode = '22023';
    end if;

    /*
      A hundredth of a second of tolerance, because these numbers are built by
      floating-point arithmetic in Deno and stored as numeric(8,2). Anything
      larger than rounding is a real gap.
    */
    if abs(coalesce(r.start_seconds, -1) - v_expected) > 0.01 then
      raise exception 'shot % starts at % but the timeline is at % — edits must be gapless',
        r.ordinal, r.start_seconds, v_expected using errcode = '22023';
    end if;

    v_expected := v_expected + r.length_seconds;
  end loop;

  /*
    Replace wholesale. A re-render (the clean 4K pass after an unlock) builds its
    own edit, and half of the previous one surviving beside it would describe a
    film that never existed.
  */
  delete from public.film_shots where event_id = p_event_id;

  insert into public.film_shots (event_id, clip_id, shot_index, start_seconds, in_seconds, length_seconds)
  select
    p_event_id,
    (s.value ->> 'clipId')::uuid,
    (s.value ->> 'shotIndex')::integer,
    (s.value ->> 'startSeconds')::numeric,
    (s.value ->> 'inSeconds')::numeric,
    (s.value ->> 'lengthSeconds')::numeric
  from jsonb_array_elements(p_shots) as s(value);

  return v_count;
end;
$$;

-- Service role only: this is render-film's private bookkeeping, and a client that
-- could write it could make 17 describe a film that does not exist.
revoke all on function public.record_film_shots(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_film_shots(uuid, jsonb) to service_role;

comment on function public.record_film_shots(uuid, jsonb) is
  'Replaces an event''s edit with the given shots, refusing anything that is not '
  'a gapless 0..n-1 timeline over uploaded clips of that event. Called by '
  'render-film as it submits, before the render can come back.';
