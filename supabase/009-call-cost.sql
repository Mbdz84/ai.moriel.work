-- ============================================================
-- Voice-AI | Store per-call cost (from Vapi end-of-call-report)
-- Enables per-tenant usage/billing totals.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table calls add column if not exists cost numeric;
