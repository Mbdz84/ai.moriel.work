# Twilio "press 1" spam gate → Vapi

A Twilio Studio flow answers the call first and asks the caller to **press 1 to
be connected**. Robocallers never press 1, so they're filtered out **before**
the call reaches Vapi — no AI answer, no Vapi charge, and (unless you log them,
see below) nothing on the dashboard.

## How the routing works

```
Caller → Twilio number → Studio flow ("press 1?")
                              ├── pressed 1 → SIP → Vapi assistant  → dashboard
                              └── no press  → (optional) log as Spam → dashboard
```

The handoff to Vapi is done over **SIP**. Your assistant's SIP address:

```
sip:noys-locksmiths@sip.vapi.ai
```

## Setup (in Twilio)

1. **Point the phone number at the Studio flow, not Vapi.**
   Twilio Console → Phone Numbers → your number → Voice → "A call comes in" →
   set it to your **Studio Flow** (the press‑1 gate).

2. **In the flow, change the `connect_call_1` widget** from dialing your human
   line to dialing Vapi:
   - Connect To: **SIP**
   - SIP address: `sip:noys-locksmiths@sip.vapi.ai`
   - Caller ID: `{{contact.channel.address}}`  ← so Vapi receives the real
     caller number and `{{customer.number}}` still works on the call.

3. Update the gather text if needed (it may still say "Expert Locksmiths").

4. Turn **off** recording in the Studio connect widget — Vapi records the call,
   and that's what feeds the dashboard. Leaving both on gives you two recordings.

## Optional: log blocked (spam) callers to the dashboard

By default, a caller who never presses 1 never reaches Vapi, so they don't
appear on the dashboard at all. To still see them as **Spam** entries:

1. Set an env var on the app: `TWILIO_INGEST_KEY=<a long random secret>`.

2. In the flow's **"didn't press 1"** branch, add a **Make HTTP Request** widget:
   - Method: **POST**
   - URL: `https://ai.moriel.work/api/twilio/blocked?key=YOUR_TWILIO_INGEST_KEY`
   - Content‑Type: `application/json`
   - Body:
     ```json
     {
       "from": "{{contact.channel.address}}",
       "to": "{{trigger.call.To}}"
     }
     ```

Each blocked caller then shows on the dashboard as a **Spam** row (caller number,
"blocked" status, "no keypress (spam gate)" reason) — no recording, no Vapi cost.

## Notes

- Legit callers hear "press 1" first — a small, deliberate trade‑off that stops
  essentially all robocalls.
- On the rare robocall that *does* press 1 and reaches Vapi, the agent's spam
  handling and the dashboard's Spam flag still catch it.
- Both Vapi's inbound number and the SIP endpoint point to the same assistant,
  so the AI behavior is identical once connected.
