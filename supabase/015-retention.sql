-- ============================================================
-- 015  |  Call retention / auto-delete
-- Per-business retention: delete old calls (and their jobs) after N days.
-- 0 = keep forever (default). Set 30 / 60 / 90 / 120 per business.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table businesses
  add column if not exists retention_days int not null default 0;

-- Deletes jobs + calls older than each business's retention window.
create or replace function purge_old_calls()
returns void language sql security definer as $$
  delete from jobs j using businesses b
    where j.business_id = b.id
      and b.retention_days > 0
      and j.created_at < now() - make_interval(days => b.retention_days);

  delete from calls c using businesses b
    where c.business_id = b.id
      and b.retention_days > 0
      and c.created_at < now() - make_interval(days => b.retention_days);
$$;

-- --- Schedule it to run daily (requires the pg_cron extension) ---
-- 1) Enable pg_cron once: Supabase Dashboard -> Database -> Extensions -> enable "pg_cron".
-- 2) Then run this (04:00 UTC daily):
--    select cron.schedule('purge-old-calls', '0 4 * * *', $$ select purge_old_calls(); $$);
--
-- To change the retention for a business (example: 90 days):
--    update businesses set retention_days = 90 where id = '<business-id>';
-- To turn it off:
--    update businesses set retention_days = 0 where id = '<business-id>';
--
-- Note: this deletes the call rows/metadata in your database. The audio files
-- themselves live in Vapi's storage and follow Vapi's own retention.
