-- An event may end up to two months ahead (was 31 days). 62 covers any
-- two calendar months; the app's day strip offers 60 days.
create or replace function public.max_event_days() returns integer
language sql immutable set search_path = '' as $$ select 62 $$;
