-- ============================================================
-- Voice-AI  |  Multi-tenant schema
-- Run this in Supabase: SQL Editor -> paste -> Run
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- BUSINESSES (tenants)
-- ------------------------------------------------------------
create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now(),
  -- Knowledge base: what we do / don't / service area / pricing rules.
  -- Injected into the agent prompt as the qualification filter.
  kb_we_do      text default '',
  kb_we_dont    text default '',
  service_area  text default '',
  pricing_notes text default ''
);

-- ------------------------------------------------------------
-- MEMBERSHIPS  (which auth user belongs to which business)
-- Uses Supabase auth.users
-- ------------------------------------------------------------
create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner',   -- owner | staff
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

-- ------------------------------------------------------------
-- AGENTS  (voice + prompt config per business)
-- ------------------------------------------------------------
create table if not exists agents (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  vapi_assistant_id text,                       -- id of the assistant in Vapi
  display_name    text default 'Receptionist',
  voice_id        text default '',              -- Vapi/ElevenLabs voice id
  tone            text default 'friendly, professional, concise',
  greeting        text default 'Thank you for calling. This call may be recorded. How can I help you today?',
  system_prompt   text default '',              -- main instructions
  language        text default 'en',            -- default language; agent switches to Spanish on request
  silence_timeout_sec int default 10,           -- hang up after N sec of silence
  max_duration_sec    int default 600,          -- hard cap per call
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DISPATCH TARGETS  (where to send SMS / JSON when a job is captured)
-- ------------------------------------------------------------
create table if not exists dispatch_targets (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  sms_enabled   boolean default true,
  sms_to        text default '',                -- your phone number to receive the job
  json_enabled  boolean default false,
  json_url      text default '',                -- custom CRM webhook
  json_headers  jsonb default '{}'::jsonb,      -- e.g. auth headers
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CREDENTIALS  (Twilio / Vapi keys per business)
-- NOTE: store server-side only; never expose to the browser.
-- Consider Supabase Vault for real secrets in production.
-- ------------------------------------------------------------
create table if not exists credentials (
  business_id       uuid primary key references businesses(id) on delete cascade,
  twilio_account_sid text default '',
  twilio_auth_token  text default '',
  twilio_number      text default '',
  vapi_api_key       text default '',
  updated_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CALLS  (one row per phone call)
-- ------------------------------------------------------------
create table if not exists calls (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  vapi_call_id  text,
  twilio_call_sid text,
  from_number   text,
  to_number     text,
  started_at    timestamptz,
  ended_at      timestamptz,
  duration_sec  int,
  status        text default 'in_progress',     -- in_progress | completed | failed | rejected
  ended_reason  text,                           -- e.g. caller-hangup, silence-timeout
  recording_url text,
  transcript    text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- JOBS  (structured info the agent collected)
-- ------------------------------------------------------------
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  call_id       uuid references calls(id) on delete set null,
  customer_name text,
  phone         text,
  address       text,
  property_type text,                            -- car | house | business
  service_type  text,                            -- lockout | car_key_replacement | rekey | new_locks | other
  urgency       text,                            -- emergency | normal
  qualified     boolean default true,            -- false if KB rejected it (e.g. helicopter key)
  notes         text,
  dispatched_sms  boolean default false,
  dispatched_json boolean default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_calls_business on calls(business_id, created_at desc);
create index if not exists idx_jobs_business  on jobs(business_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only see rows for businesses they belong to.
-- ============================================================
alter table businesses      enable row level security;
alter table memberships     enable row level security;
alter table agents          enable row level security;
alter table dispatch_targets enable row level security;
alter table credentials     enable row level security;
alter table calls           enable row level security;
alter table jobs            enable row level security;

-- Helper: is the current user a member of a given business?
create or replace function is_member(b uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.business_id = b and m.user_id = auth.uid()
  );
$$;

-- businesses
drop policy if exists sel_businesses on businesses;
create policy sel_businesses on businesses for select using (is_member(id));
drop policy if exists upd_businesses on businesses;
create policy upd_businesses on businesses for update using (is_member(id));

-- memberships (user sees their own)
drop policy if exists sel_memberships on memberships;
create policy sel_memberships on memberships for select using (user_id = auth.uid());

-- generic member-scoped policies for the rest
drop policy if exists all_agents on agents;
create policy all_agents on agents using (is_member(business_id)) with check (is_member(business_id));
drop policy if exists all_dispatch on dispatch_targets;
create policy all_dispatch on dispatch_targets using (is_member(business_id)) with check (is_member(business_id));
drop policy if exists all_calls on calls;
create policy all_calls on calls for select using (is_member(business_id));
drop policy if exists all_jobs on jobs;
create policy all_jobs on jobs for select using (is_member(business_id));

-- credentials: readable/writable only by members (still keep server-side)
drop policy if exists all_credentials on credentials;
create policy all_credentials on credentials using (is_member(business_id)) with check (is_member(business_id));

-- NOTE: The Vapi webhook writes calls/jobs using the SERVICE ROLE key,
-- which bypasses RLS. That is intentional and server-only.
