-- ============================================================
-- 012  |  Remove "urgency" from the flow
-- Urgency is no longer collected, dispatched, or displayed.
-- This drops the now-unused column. OPTIONAL cleanup — the app
-- works whether or not you run it (the column would just sit
-- unused). Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table jobs
  drop column if exists urgency;
