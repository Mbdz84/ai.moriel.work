-- ============================================================
-- 015  |  Recording retention (keep transcript + job forever)
-- After N days, drop the call RECORDING link only. The call row,
-- transcript, and job stay in the database (they're cheap text).
-- 0 = keep recordings forever (default). Set 30 / 60 / 90 / 120 per business.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table businesses
  add column if not exists retention_days int not null default 0;

-- Clears the recording link on calls older than each business's window.
-- Keeps the call row, transcript, and job intact.
create or replace function purge_old_recordings()
returns void language sql security definer as $$
  update calls c
     set recording_url = null
    from businesses b
   where c.business_id = b.id
     and b.retention_days > 0
     and c.recording_url is not null
     and c.created_at < now() - make_interval(days => b.retention_days);
$$;

-- --- Schedule it to run daily (requires the pg_cron extension) ---
-- 1) Enable pg_cron once: Supabase Dashboard -> Database -> Extensions -> enable "pg_cron".
-- 2) Then run this (04:00 UTC daily):
--    select cron.schedule('purge-old-recordings', '0 4 * * *', $$ select purge_old_recordings(); $$);
--
-- Set a business's window (example: 90 days):  update businesses set retention_days = 90 where id = '<id>';
-- Turn off:                                    update businesses set retention_days = 0  where id = '<id>';
--
-- NOTE: this removes the recording *link* from your database so the player no
-- longer serves old recordings. The audio file itself lives in Vapi's storage
-- and follows Vapi's own retention — there's no documented API to delete an
-- individual recording. If you need the audio positively purged, ask Vapi about
-- their retention / zero-data-retention options.
