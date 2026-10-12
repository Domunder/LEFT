-- LEFT — the group size stops being a door.
--
-- `max_members` has carried three jobs at once since the initial schema: it was
-- the pricing tier, the join gate, and (through `isFreeTier`) the render-quality
-- switch. Only one of those was ever enforced, and it is the one that hurts.
--
-- Picture the enforcement working exactly as designed. It is 11pm, the host
-- guessed "about 25 people", the twenty-sixth guest scans the QR, and
-- `join_event` raises 'this group is full'. The fix is a purchase, on a phone,
-- by a host who is three drinks into their own party — and if they do not manage
-- it, someone who is standing right there is simply not in the film. That is an
-- unrecoverable moment at a real event, caused by a number the host was asked to
-- guess weeks earlier.
--
-- The economics that justified the gate are also gone. Payment is moving to
-- after the film is revealed and is priced on the roster that actually turned up,
-- so an extra guest is now *more* revenue, not less. Charging at the door was
-- taxing the group's own growth.
--
-- So `max_members` keeps exactly one job: it is the host's estimate of the group,
-- and the estimate is what sizes the shared budget. Nothing is refused.
--
-- What this does NOT change:
--
--   * The `events.max_members between 4 and 200` check stays. It bounds what a
--     host may *claim*, which is what sizes the budget and therefore the render.
--     It has never had anything to do with who may join.
--   * The re-join path stays exempt, as it already was — an existing member
--     renaming themselves never counted against the cap and still does not.
--   * The `for update` on the event row stays. It no longer serializes a
--     capacity check, but `join_event` still reads the row it inserts against.

create or replace function public.join_event(p_invite_code text, p_display_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where invite_code = upper(trim(p_invite_code))
   for update;

  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  /*
    The one refusal left. An ended event has no budget to film against and no
    film still being made, so joining it would put someone in a group they can
    do nothing with.
  */
  if v_event.ends_at <= now() then
    raise exception 'this event has already ended' using errcode = 'P0002';
  end if;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v_event.id, auth.uid(), p_display_name, 'guest')
  on conflict (event_id, user_id)
    do update set display_name = excluded.display_name;

  return v_event.id;
end;
$$;

comment on function public.join_event(text, text) is
  'Adds the caller to an event by invite code, or renames them if they are '
  'already in it. Refuses only an unknown code and an event that has ended — '
  'group size is an estimate that sizes the budget, not a capacity limit.';

comment on column public.events.max_members is
  'The host''s estimate of the group, used to size budget_seconds and to price '
  'the film unlock. NOT a capacity limit — join_event admits anyone with the code.';
