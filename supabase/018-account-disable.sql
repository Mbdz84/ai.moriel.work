-- ============================================================
-- 018  |  Account (company) disable flag
-- Super admins can disable a company: a reversible lock that blocks the
-- company's non-super users from the app and stops its calls from being
-- processed. Does NOT delete anything — logins and Vapi assistants are
-- untouched, so the account can be re-enabled at any time.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table businesses add column if not exists disabled     boolean not null default false;
alter table businesses add column if not exists disabled_at   timestamptz;

-- Deleting a company (hard delete) cascades to its calls, jobs, sources,
-- dispatch_targets, credentials, agents, and memberships via the existing
-- `on delete cascade` foreign keys. Login users in auth.users are NOT
-- removed (they may belong to other companies).
