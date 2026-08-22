-- ============================================================
-- 019  |  Move caller-SMS + spam-notify to be per-source
-- "Text the caller a link" and "Notify me about spam calls" are now
-- configured per source (per Vapi assistant) instead of once per account.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table sources add column if not exists notify_spam         boolean not null default false;
alter table sources add column if not exists caller_sms_enabled   boolean not null default false;
alter table sources add column if not exists caller_link          text    not null default '';
alter table sources add column if not exists caller_link_label    text    not null default '';
alter table sources add column if not exists caller_sms_template  text    not null default '';

-- The matching dispatch_targets columns (caller_*, notify_spam) are left in
-- place but are no longer read/written by the app — safe to drop later.
