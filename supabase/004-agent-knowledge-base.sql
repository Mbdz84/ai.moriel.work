-- ============================================================
-- Voice-AI | Single knowledge_base field on agents (cache)
-- Run in Supabase SQL Editor after the earlier migrations.
-- ============================================================

alter table agents add column if not exists knowledge_base text default '';
