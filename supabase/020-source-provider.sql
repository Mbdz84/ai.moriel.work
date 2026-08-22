-- ============================================================
-- 020  |  Multi-provider sources (Vapi + ElevenLabs)
-- A source can run on either voice platform. assistant_id holds that
-- provider's agent id; provider says which platform it lives on.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table sources add column if not exists provider text not null default 'vapi';
alter table calls   add column if not exists provider text not null default 'vapi';

-- provider values: 'vapi' | '11labs'
