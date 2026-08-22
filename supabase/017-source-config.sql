-- ============================================================
-- 017  |  Per-source routing config
-- Each source (a Vapi assistant) becomes its own entity: its own
-- outbound number, its own agent/display name, and optional extra
-- job destinations layered on top of (or instead of) the global
-- Team dispatch settings.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

-- The {agent} name this source signs its texts with.
alter table sources add column if not exists agent_name text;

-- This source's own outbound Twilio number. When set, job/caller SMS for
-- calls handled by this assistant are sent FROM this number. Blank -> fall
-- back to the account's credentials.twilio_number.
alter table sources add column if not exists from_number text;

-- Extra job-SMS recipients for this source (comma / newline / semicolon
-- separated), layered on top of the global Team dispatch list.
alter table sources add column if not exists extra_sms_to text not null default '';

-- Extra CRM / JSON webhook for this source, in addition to the global one.
alter table sources add column if not exists extra_json_url text not null default '';

-- When true, this source ignores the global Team dispatch destinations
-- (SMS / JSON / email) and uses ONLY its own extras above.
alter table sources add column if not exists exclude_from_global boolean not null default false;

-- One-time backfill: seed each source's agent_name from the (now retired)
-- per-business agents.display_name, so texts keep signing with the same name.
update sources s
set    agent_name = a.display_name
from   agents a
where  a.business_id = s.business_id
  and  s.agent_name is null
  and  coalesce(a.display_name, '') <> '';
