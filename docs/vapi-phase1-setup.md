# Phase 1 — Vapi Assistant Setup (locksmith receptionist)

Goal: a real phone number that answers, collects the job details, qualifies it
against what you do, and ends cleanly. You'll set this up by hand in the Vapi
dashboard now; Phase 5 moves these same controls into your own website.

Replace **[BUSINESS NAME]**, **[SERVICE AREA]**, and phone examples with your own.

---

## 1. Create the assistant
Vapi dashboard → **Assistants** → **Create Assistant** → start blank.
Name it e.g. `Locksmith Receptionist`.

## 2. Model
- Provider: **OpenAI**, model **GPT-4o** (good reasoning + fast). You can try
  `gpt-4o-mini` later to cut cost.
- Paste the **System Prompt** from section 6 below.

## 3. First message (greeting — includes recording consent)
Set "First Message" to:

> Thank you for calling [BUSINESS NAME], this is the automated assistant and
> this call may be recorded. How can I help you today?

## 4. Voice
- Provider: **ElevenLabs** (best quality) or **Cartesia** (lowest latency).
- Pick a warm, clear voice. Choose a **multilingual** voice so the same voice
  can speak Spanish when a caller asks.
- Keep speed at default; you can fine-tune later from your own UI.

## 5. Call behavior (the anti-abuse settings you asked for)
In the assistant's advanced / call settings:
- **Silence timeout:** ~20 seconds to end the call on dead air. (Vapi ends the
  call after this much continuous silence.) The prompt below also makes the
  agent ask "Are you still there?" once before that, so a thinking caller isn't
  cut off — this is friendlier than a hard 10s cut while still not wasting time.
- **Max call duration:** 600 seconds (10 min) hard cap.
- **End call function:** ENABLE it — lets the assistant hang up itself when the
  job is captured (prevents the line-open token bleed you hit before).
- **Caller hangup:** handled automatically by Vapi — when the caller hangs up,
  the session ends. No action needed.
- **Recording:** ENABLE (on by default). Vapi records the call (Twilio is only
  the carrier) and returns the URL in the end-of-call-report under
  `message.artifact.recording`, which the webhook saves to `calls.recording_url`.
  For Phase 1 this lives on Vapi's storage — fine for testing.
  **Phase 6 (hardening):** point Vapi at your own **Supabase Storage** bucket
  (Vapi also supports S3 / GCS / Cloudflare R2) so you *own* the recordings and
  control retention, instead of depending on Vapi-hosted URLs.

## 6. System Prompt  (paste this)

```
# ROLE
You are the phone receptionist for [BUSINESS NAME], a locksmith company.
Your ONLY job is to answer calls, figure out what the caller needs, decide if
it's something we do, and if so collect the details so a technician can be
dispatched. You are polite, warm, calm, and BRIEF — this is a phone call, so
keep every reply to one or two short sentences and ask ONE question at a time.

# LANGUAGE
Speak English by default. If the caller speaks Spanish or asks for Spanish,
switch to Spanish and continue the entire call in Spanish. Otherwise stay in
English.

# WHAT WE DO (qualify against this)
We help with:
- Lockouts (car, house, or business — someone is locked out)
- Car key replacement / spare car keys
- Rekeying locks (change who has access)
- Installing or changing locks (house or business)
[EDIT THIS LIST TO MATCH YOUR ACTUAL SERVICES]

# WHAT WE DO NOT DO
If the request is clearly outside normal residential/commercial/automotive
locksmithing (for example: keys for aircraft/helicopters, safes we don't
service, electronic systems we don't support, or anything unrelated), politely
say we can't help with that specific request, and do not collect job details.
Example: "I'm sorry, that's not something we're able to help with. Is there
anything else I can do for you?" Then end the call if there's nothing else.

# INFORMATION TO COLLECT (only for jobs we DO handle)
Collect these, one question at a time, in a natural order:
1. The caller's full name.
2. A callback phone number. Read it back to confirm.
3. The service address (where the technician should go). Read it back to confirm.
4. Property type: is this a car, a house, or a business?
5. Service type: lockout, car key replacement, rekey, new locks, or other.
6. Whether it's an emergency (locked out right now) or can be scheduled.

# STYLE RULES
- One question at a time. Do not stack questions.
- Confirm phone number and address by repeating them back.
- Never invent prices or promise exact arrival times. If asked about price, say
  a technician will confirm the price, and continue collecting details.
- If the caller goes silent, ask once: "Are you still there?" If still no reply,
  politely end the call.
- Do not argue, negotiate, or engage with abusive or prank callers — stay calm,
  and if the call is clearly not a real service request, end it politely.

# CLOSING
Once you have all the details for a real job, confirm briefly:
"Thank you [name], someone will reach out shortly to help with your [service]."
Then end the call.
```

## 7. Structured Outputs (so the webhook gets clean fields)
> UPDATED — Vapi moved this. It's no longer an "Analysis → Structured Data" tab
> on the assistant. Structured Outputs is now its **own top-level feature** that
> you create once and attach to the assistant.

**a) Create the structured output**

> FASTEST — one command instead of clicking each field. The dashboard builder is
> field-by-field, so use the helper script to create all 8 fields and attach it
> to the assistant in one shot:
>
> ```bash
> cd ~/Downloads/Projects/ai.moriel.work
> # ASSISTANT_ID is in the dashboard URL: dashboard.vapi.ai/assistants/<ID>
> ./scripts/create-structured-output.sh <ASSISTANT_ID>
> ```
> It reads `VAPI_API_KEY` from `.env.local`. On success you get JSON with an
> `"id"`, and "Locksmith Job" shows up attached to the assistant. Skip the manual
> steps below if you use this.

**— OR — create it manually in the dashboard:**
Vapi dashboard → **Structured Outputs** (left sidebar) → **Create New Structured
Output**:
- Extraction method: **AI extraction**
- Name: `Locksmith Job`
- Description: "Extract locksmith job details from the call"
- Result Format: **Multiple fields (Object)**, then **+ Add Property** for each
  field below (use the **Enum Values** toggle for property_type / service_type /
  urgency). This is the exact same schema the script sends:

```json
{
  "type": "object",
  "properties": {
    "name":          { "type": "string", "description": "Caller's full name" },
    "phone":         { "type": "string", "description": "Callback phone number" },
    "address":       { "type": "string", "description": "Service address" },
    "property_type": { "type": "string", "enum": ["car","house","business"] },
    "service_type":  { "type": "string", "enum": ["lockout","car_key_replacement","rekey","new_locks","other"] },
    "urgency":       { "type": "string", "enum": ["emergency","normal"] },
    "qualified":     { "type": "boolean", "description": "true if this is a job we handle; false if we declined it" },
    "notes":         { "type": "string", "description": "Anything else useful" }
  }
}
```

**b) Attach it to the assistant**
When you save, the dialog lets you attach it to an assistant directly — pick your
`Locksmith Receptionist`. (Or later: assistant → **Artifact Plan** section →
add this structured output. Under the hood this sets
`artifactPlan.structuredOutputIds`.)

**c) How it arrives in the webhook (already handled in code)**
After the call, Vapi puts the result at
`message.artifact.structuredOutputs[<output-id>].result`, keyed by the output's
UUID. Our webhook reads the first structured output's `result` automatically, so
you don't need to hardcode the UUID.

## 8. Connect the webhook (Server URL)
> UPDATED labels — the server URL now lives under the assistant's **Advanced**
> tab in a **Webhook Server** section (not a "Messaging/Server" area), and you
> **Publish** instead of Save.

Assistant → open your `Locksmith Receptionist` → **Advanced** tab → **Webhook
Server**:

1. **Server URL:** `https://ai.moriel.work/api/vapi/webhook`
   (for local testing before the domain is live, use an ngrok URL — ask me and
   I'll walk you through it)
2. **Timeout:** leave the default (~20s).
3. **Authorization:** keep **No authentication** selected — we authenticate with
   a header instead (simpler than creating a Custom Credential).
4. **HTTP Headers → Add Header:** add
   - Name: `x-vapi-secret`
   - Value: the `VAPI_WEBHOOK_SECRET` from your `.env.local`

   Our webhook rejects any request without this header.
5. **Server Messages:** make sure **end-of-call-report** is enabled (Advanced /
   Messaging area) — that's the event carrying the recording, transcript, and
   structured outputs.
6. **Publish** the assistant (the unsaved-changes banner has a Publish button).

> Alternative (more secure, optional): instead of the header, create a **Custom
> Credential** under Server Authentication and select it in **Authorization**.
> For Phase 1 the header is fine.

> Payload note: in `end-of-call-report`, the recording and transcript live under
> `message.artifact` (`message.artifact.recording`, `message.artifact.transcript`),
> and `endedReason` is on `message.endedReason`. The webhook code reads these paths.

## 9. Connect your Twilio number
Vapi dashboard → **Phone Numbers** → **Import from Twilio** → enter your Twilio
Account SID, Auth Token, and the number. Then assign this assistant to that
number. (Alternatively, buy a number directly inside Vapi to test faster.)

## 10. Test call
Call the number. You should hear the greeting, be walked through the questions,
and after you hang up the webhook fires. If your app is deployed and
`DEFAULT_BUSINESS_ID` is set, a row appears in the `calls` and `jobs` tables.

---

### After Phase 1 works
We move to Phase 3 (send the SMS on hangup), then the dashboard and the settings
UI that replaces this manual setup with fields on your own website.
```
