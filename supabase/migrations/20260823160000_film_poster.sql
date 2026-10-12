-- LEFT — a poster frame for the rendered film.
--
-- Every cover in this app is a gradient. `lib/film-tint.ts` derives two stops
-- from an id and draws them wherever a picture belongs: the hero's idle state on
-- 17, every clip tile, every card in 16. That was never a design choice — it was
-- the honest placeholder for a stack that had no way to extract a frame from a
-- video.
--
-- The renderer already has one. Shotstack's `output.poster` captures a still at
-- a given second of the finished film and publishes it beside the mp4, at no
-- extra cost and no extra render. This migration is the storage half of picking
-- it up: one nullable column, and room in the films bucket for a jpeg.
--
-- **A poster is an upgrade on an upgrade.** The rendered film is already
-- optional — an event whose render failed plays its clips in sequence and always
-- has. A poster is optional on top of that: `film_poster_path` stays null when
-- Shotstack does not return one, when the copy back fails, and for every event
-- that rendered before this existed. Each of those falls back to the tint, which
-- is exactly where the app is today. Nothing reads this column expecting a
-- value.


alter table public.events
  -- Path in the `films` bucket: `{event_id}/poster.jpg`. Null unless a render
  -- landed *and* it came with a still we could copy.
  add column film_poster_path text;


-- The bucket was created for one mime type because it held one kind of file.
-- Widened rather than dropped and recreated: it has objects and policies on it.
--
-- No new policy is needed. "films bucket: members can read" keys on
-- `storage.foldername(name)[1]` — the event id — so `{event_id}/poster.jpg` is
-- already covered by the same membership check as `{event_id}/film.mp4`. And
-- there is still no insert policy for `authenticated`, deliberately: the
-- shotstack-callback function writes here as the service role and nothing else
-- does.
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'image/jpeg']
 where id = 'films';
