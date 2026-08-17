-- ============================================================
-- 014  |  Twilio API Key credentials (more secure than Auth Token)
-- Store a Twilio API Key (Key SID "SK..." + Secret) per business.
-- The app prefers the API key over the Auth Token when both exist.
-- Run in Supabase: SQL Editor -> paste -> Run
-- ============================================================

alter table credentials
  add column if not exists twilio_api_key_sid    text default '';
alter table credentials
  add column if not exists twilio_api_key_secret text default '';

-- Optional cleanup once every business has switched to an API key:
--   alter table credentials drop column if exists twilio_auth_token;
