-- A fifth look: "Original" — the photo as the phone took it, no colour scheme
-- (1.3.0, the user, 2026-11-28). The app offers it in place of Chrome; 'chrome'
-- stays in the enum because events created with it keep it.
alter type public.film_look add value if not exists 'original';
