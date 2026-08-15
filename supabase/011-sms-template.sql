-- ============================================================
-- 011  |  Customizable SMS template
-- Adds a per-business template that controls how the job text
-- message is formatted (see /settings/sms).
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table dispatch_targets
  add column if not exists sms_template text default '';
