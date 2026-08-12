#!/usr/bin/env bash
# ------------------------------------------------------------
# Create the "Locksmith Job" structured output in Vapi and
# attach it to an assistant — in one shot (no field-by-field
# clicking in the dashboard).
#
# Usage:
#   ./scripts/create-structured-output.sh <ASSISTANT_ID>
#
# Get <ASSISTANT_ID> from the Vapi dashboard URL:
#   dashboard.vapi.ai/assistants/<THIS-PART>
#
# Reads VAPI_API_KEY from .env.local (never hardcode secrets).
# Re-run safe: creating again just makes another output — delete
# the old one in the dashboard if you don't want duplicates.
# ------------------------------------------------------------
set -euo pipefail

ASSISTANT_ID="${1:-}"
if [ -z "$ASSISTANT_ID" ]; then
  echo "Usage: $0 <ASSISTANT_ID>"
  echo "Find it at dashboard.vapi.ai/assistants/<ASSISTANT_ID>"
  exit 1
fi

# Load VAPI_API_KEY from .env.local
if [ -f .env.local ]; then
  export "$(grep -E '^VAPI_API_KEY=' .env.local | xargs)"
fi
if [ -z "${VAPI_API_KEY:-}" ]; then
  echo "VAPI_API_KEY not found. Set it in .env.local or export it."
  exit 1
fi

curl -s -X POST https://api.vapi.ai/structured-output \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Locksmith Job",
    "description": "Extract locksmith job details from the call",
    "assistantIds": ["'"$ASSISTANT_ID"'"],
    "schema": {
      "type": "object",
      "properties": {
        "name":          {"type":"string","description":"Caller full name"},
        "phone":         {"type":"string","description":"Callback phone number"},
        "address":       {"type":"string","description":"Service address"},
        "property_type": {"type":"string","enum":["car","house","business"]},
        "service_type":  {"type":"string","enum":["lockout","car_key_replacement","rekey","new_locks","other"]},
        "urgency":       {"type":"string","enum":["emergency","normal"]},
        "qualified":     {"type":"boolean","description":"true if a job we handle; false if we declined it"},
        "notes":         {"type":"string","description":"Anything else useful the caller mentioned"}
      }
    }
  }'

echo ""
echo "Done. Look for an \"id\" in the JSON above and check the assistant in the dashboard."
