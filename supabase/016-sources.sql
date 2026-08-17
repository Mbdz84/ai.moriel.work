-- ============================================================
-- 016  |  Call sources (which assistant/brand a call came from)
-- Tag each call with a source, configurable per assistant.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table calls add column if not exists source        text;
alter table calls add column if not exists assistant_id  text;

-- Per-business source config: map a Vapi assistant -> a display label.
create table if not exists sources (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  assistant_id text not null,
  label        text not null default '',
  created_at   timestamptz not null default now(),
  unique (business_id, assistant_id)
);

alter table sources enable row level security;
drop policy if exists all_sources on sources;
create policy all_sources on sources
  using (is_member(business_id)) with check (is_member(business_id));
