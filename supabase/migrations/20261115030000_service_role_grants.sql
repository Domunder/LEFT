-- service_role needs table privileges spelled out.
--
-- The edge functions run as service_role. It bypasses RLS, but RLS is the second
-- gate: the first is the table privilege, and on current Supabase a table
-- created by a migration no longer hands service_role SELECT/INSERT/UPDATE/
-- DELETE by default. Without these grants the purchase ledger could not be
-- written at all — revenuecat-webhook and create-event's reconcile both insert
-- into public.purchases and were answered "permission denied" (found
-- 2026-11-15 while testing send-notifications; the paid path had never been
-- run end to end).
--
-- Granted on every table the server owns rather than one at a time: a
-- bypassrls role that can read some tables and not others is a trap for the
-- next function.

grant select, insert, update, delete
  on public.events,
     public.event_members,
     public.photos,
     public.purchases,
     public.push_tokens,
     public.notifications
  to service_role;
