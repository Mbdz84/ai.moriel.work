-- ============================================================
-- Voice-AI | Structured agent prompt fields
-- Break the single system prompt into editable question fields.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table agents add column if not exists persona text default '';
alter table agents add column if not exists ask_questions text default '';
alter table agents add column if not exists out_of_scope text default '';
