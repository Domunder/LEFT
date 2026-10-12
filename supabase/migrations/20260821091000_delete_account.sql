-- LEFT — deleting an account.
--
-- Apple's guideline 5.1.1(v) requires any app that creates an account to let a
-- user delete it from inside the app. This is the server half; the edge function
-- `delete-account` calls it, then removes the auth row itself.
--
-- ---------------------------------------------------------------------------
-- What deletion actually does, and why it is not "delete everything"
-- ---------------------------------------------------------------------------
-- The FK actions in the initial schema already encode most of this:
--
--   events.host_id            -> auth.users  ON DELETE CASCADE
--   event_members.user_id     -> auth.users  ON DELETE CASCADE
--   clips.user_id             -> auth.users  ON DELETE SET NULL   <-- deliberate
--   budget_reservations.user_id -> auth.users ON DELETE CASCADE
--   purchases.user_id         -> auth.users  ON DELETE CASCADE
--
-- **Clips a user filmed in someone else's event survive, unattributed.** That is
-- the `set null` above, and the initial schema's comment on it: "the clip is part
-- of the film". Cascading them would punch holes in other people's finished
-- films — footage they watched, and in most cases paid for — because one
-- contributor left. The user's link to the clip goes; the footage stays. The
-- privacy notice says so in as many words, and the delete confirmation repeats it
-- before anyone commits.
--
-- **Events the user hosts are destroyed for everyone**, which cascades to their
-- members, clips and reservations. That is the right call in the other direction:
-- a host's event is theirs, and there is nobody to inherit it.
--
-- ---------------------------------------------------------------------------
-- The constraint hazard this function exists to prevent
-- ---------------------------------------------------------------------------
-- `purchases` carries:
--
--   consumed_by_event_id uuid references public.events (id) on delete set null,
--   constraint purchases_consumed_together check (
--     (consumed_at is null) = (consumed_by_event_id is null))
--
-- Deleting the user cascades their hosted events away. Any purchase row pointing
-- at one of those events has `consumed_by_event_id` set to null by that cascade
-- while `consumed_at` stays non-null — which violates the check, and the whole
-- delete fails.
--
-- In practice the purchase belongs to the host themselves, whose `purchases` rows
-- cascade-delete too, so the two usually cancel out. **Usually is not a
-- guarantee**: Postgres does not promise an ordering between two independent FK
-- actions fired by the same delete, and `purchases_one_per_event_idx` does not
-- stop a row from another user pointing at this host's event either.
--
-- So the purchase rows are cleared explicitly, first, in one transaction. After
-- this runs there is nothing left for the cascade to violate.

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns table (hosted_event_ids uuid[], clip_paths text[])
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_events uuid[];
  v_paths  text[];
begin
  -- service_role only. This is called by an edge function that has already
  -- verified the caller owns this id; it must never be reachable from a client.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'you may only delete your own account' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}') into v_events
    from public.events
   where host_id = p_user_id;

  /*
    Every storage object belonging to an event this user hosts. Those events are
    about to be deleted, and no foreign key reaches into storage — without this
    the rows go and the video files stay in the bucket forever.

    Deliberately *not* the user's own clips in other people's events: that
    footage stays, per the note above, and a file deleted out from under a
    surviving clip row would leave a permanently broken tile in someone else's
    film.
  */
  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.clips
   where event_id = any(v_events)
     and storage_path is not null;

  /*
    Break the purchase -> event link before the cascade can. Both columns are
    cleared together so `purchases_consumed_together` holds at every point.

    The row itself is left alone: if it belongs to the departing user it will
    cascade away with them, and if it belongs to somebody else it is theirs to
    keep. Un-consuming it does hand a stranger's purchase back as spendable in
    the second case — which is the kinder failure, since the event it paid for is
    being destroyed by someone else's decision.
  */
  update public.purchases
     set consumed_at = null, consumed_by_event_id = null
   where consumed_by_event_id = any(v_events);

  return query select v_events, v_paths;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;

comment on function public.prepare_account_deletion(uuid) is
  'Pre-clears purchase links and reports the storage objects to remove before an '
  'auth.users row is deleted. service_role only; see delete-account.';
