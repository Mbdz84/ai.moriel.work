-- ============================================================
-- 013  |  Front-desk upgrade (Tier 1 + Tier 2)
-- Business hours, FAQ, structured detail collection, voice,
-- spam handling, caller SMS, email summaries, per-call spam flag.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

-- ---- AGENTS: hours, FAQ, details, spam guidance -------------
alter table agents add column if not exists timezone          text    default 'America/Chicago';
alter table agents add column if not exists hours_enabled      boolean default false;
-- business_hours: { "mon":[{"open":"08:00","close":"17:00"}], ... }
alter table agents add column if not exists business_hours     jsonb   default '{}'::jsonb;
alter table agents add column if not exists after_hours_prompt text    default '';
-- faqs: [{ "q":"Do you do safes?", "a":"Yes, residential safes only." }]
alter table agents add column if not exists faqs               jsonb   default '[]'::jsonb;
-- collect_fields: [{ "label":"Best callback number", "required":true }]
alter table agents add column if not exists collect_fields     jsonb   default '[]'::jsonb;
alter table agents add column if not exists spam_handling      text    default '';

-- ---- DISPATCH TARGETS: caller SMS, email, spam notify -------
alter table dispatch_targets add column if not exists caller_sms_enabled boolean default false;
alter table dispatch_targets add column if not exists caller_link        text    default '';
alter table dispatch_targets add column if not exists caller_link_label  text    default '';
alter table dispatch_targets add column if not exists caller_sms_template text   default '';
alter table dispatch_targets add column if not exists email_enabled      boolean default false;
alter table dispatch_targets add column if not exists email_to           text    default '';
alter table dispatch_targets add column if not exists notify_spam        boolean default false;

-- ---- CALLS: spam flag --------------------------------------
alter table calls add column if not exists spam boolean default false;

-- ---- JOBS: free-form extra details the agent collected ------
alter table jobs add column if not exists details jsonb default '{}'::jsonb;
