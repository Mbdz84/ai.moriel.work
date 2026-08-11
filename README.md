# Voice-AI

Telephony CRM + AI receptionist for locksmith businesses.
**Stack:** Next.js (App Router) · Supabase · Vapi (voice engine) · Twilio (phone + SMS) · Vercel.

Twilio owns the phone number and routes the call to Vapi. Vapi runs the whole
conversation (speech, LLM, voice, turn-taking, silence timeout, recording) and
fires an end-of-call webhook to this app, which stores the call + job and
dispatches an SMS / custom JSON.

---

## Phase status
- [x] **Phase 0** — Scaffold + accounts
- [ ] **Phase 1** — Prove one call end-to-end (Vapi assistant + Twilio number)
- [ ] **Phase 2** — Capture data (schema + webhook)  ← schema + webhook stub done
- [ ] **Phase 3** — Dispatch (Twilio SMS + custom JSON)
- [ ] **Phase 4** — Dashboard (login, live calls, recordings)
- [ ] **Phase 5** — Settings UI (voice, prompt, KB, dispatch, credentials)
- [ ] **Phase 6** — Hardening (anti-abuse, KB filter, spend caps, consent line)

---

## Local setup
```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Project Settings → API → copy the URL, anon key, and service_role key into `.env.local`.

## GitHub → Vercel (auto-deploy)
1. Create an **empty** repo on GitHub (no README).
2. From this folder:
   ```bash
   git remote add origin git@github.com:USER/voice-ai.git
   git push -u origin main
   ```
3. Vercel → New Project → import the repo.
4. Add all env vars from `.env.example` in Vercel → Project → Settings → Environment Variables.
5. Add the domain `ai.moriel.work` under Vercel → Project → Domains, then update DNS.

Every `git push` to `main` now auto-deploys.

## Vapi
- Create an assistant; set its **Server URL** to `https://ai.moriel.work/api/vapi/webhook`
  with a secret header `x-vapi-secret` = `VAPI_WEBHOOK_SECRET`.
- Connect your Twilio number to the assistant (SIP trunk or import number).
