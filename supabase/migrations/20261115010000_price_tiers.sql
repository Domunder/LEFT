-- Price tiers (decided 2026-11-15, replacing "free up to 100, one SKU").
--
--   up to 50 guests, a finite roll      free
--   up to 50 guests, the unlimited roll left_small      (~10 CHF)
--   up to 100 guests, any roll          left_medium     (~15 CHF)
--   up to 150 guests, any roll          left_large      (~20 CHF)
--   up to 200 guests, any roll          left_unlimited  (~25 CHF)
--
-- A purchase still unlocks a group size (`purchases.max_members`), and
-- create_event() still asks for one whenever the roll is unlimited or the group
-- is larger than free_max_members(), taking any unspent purchase that covers
-- the group. So only these two constants change; create_event() is untouched.
-- The amounts themselves live in the stores, not here.

create or replace function public.free_max_members() returns integer
language sql immutable set search_path = '' as $$ select 50 $$;

create or replace function public.unlock_max_members(p_product_id text)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_product_id
    when 'left_small' then 50
    when 'left_medium' then 100
    when 'left_large' then 150
    when 'left_unlimited' then 200
    else null
  end;
$$;
