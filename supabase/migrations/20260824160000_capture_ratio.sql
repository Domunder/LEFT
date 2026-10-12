-- LEFT — the group films more than the film is long.
--
-- `capture_budget_for()` shipped at a ratio of 1.0 with a 60-second floor, which
-- meant a four-minute film was made from four minutes and a bit of footage. The
-- renderer could not select from that in any meaningful way; it was a trimmer
-- wearing a selector's clothes.
--
-- **This is the change that makes the film an edit.** At 2.5 a group filming a
-- four-minute film has ten minutes of takes to cut from, so `select-shots.ts` can
-- do what it exists to do: round-robin the authors so everyone is in, cap any one
-- take's contribution at six seconds, trim the fumble off each end, and leave the
-- rest out. The surplus is the whole mechanism.
--
-- **It was gated on `close_expired_events()`, and that gate is now open.**
-- `finish_event()` refuses while budget remains, so before the sweeper existed the
-- only route to a finished film was exhausting the pool. Multiply the pool by 2.5
-- and almost nobody would have exhausted it — most events would have sat at 'live'
-- forever and never produced anything. The clock now ends them, so a group that
-- films six of their ten available minutes still gets their film.
--
-- Why 2.5 and not more:
--
--   * Below about 2x the selector has too little to choose between and degenerates
--     back into a trimmer.
--   * Above about 3x the marginal quality gain flattens, while the chance that
--     some clip never finishes uploading rises with every extra minute of footage
--     — and a venue's wifi is the least reliable thing in this whole system.
--   * Render cost is not the constraint. Shotstack bills rendered minutes, not
--     source minutes, so selection *lowers* the bill: the film is shorter than the
--     footage. Storage in the `clips` bucket is what grows, and at 200 people a
--     ten-minute film now implies roughly 25 minutes of phone video.
--
-- The `+ 60` floor still binds below about ten people, where a ratio alone gives a
-- small group too little slack in absolute seconds.
--
-- **`CAPTURE_RATIO` in `mobile/src/lib/pricing.ts` mirrors this and moves with
-- it.** That mirror only quotes copy — the server derives the real number — but a
-- screen promising 30 seconds each while the pool allows 12 is a bad enough lie to
-- be worth keeping in step.
--
-- Existing events keep the budget they were created with. `budget_seconds` is
-- written once at creation and nothing recomputes it, which is correct: a group
-- part-way through their evening should not have the rules changed under them.

create or replace function public.capture_budget_for(p_film_seconds integer)
returns integer
language sql
immutable
as $$
  select greatest(p_film_seconds + 60, round(p_film_seconds * 2.5))::integer;
$$;

comment on function public.capture_budget_for(integer) is
  'Seconds a group may film, for a film of the given length. The capture ratio '
  'lives here and only here: 2.5x, floored at film + 60s. The surplus is what '
  'gives select-shots.ts something to choose between.';
