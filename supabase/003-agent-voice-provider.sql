-- ============================================================
-- Voice-AI | Agent voice provider
-- Run in Supabase SQL Editor after the earlier migrations.
-- ============================================================

-- Vapi voices need a provider + voice id. Store the provider too.
alter table agents add column if not exists voice_provider text default '11labs';
