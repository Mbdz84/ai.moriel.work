// Send SMS + read balance via Twilio's REST API using fetch (no SDK).
//
// Auth: prefers a Twilio API Key (Key SID "SK..." + Secret) over the account
// Auth Token. API keys are the recommended, more secure option — they can be
// revoked/rotated independently and (as Restricted keys) scoped to just
// Messaging. The Account SID is always required (it's in the request URL).
// A legacy Auth Token is still honored as a fallback so existing setups keep
// working during the switch to keys.

export type TwilioCreds = {
  accountSid?: string | null; // AC... — used in the URL (and as the user for token auth)
  keySid?: string | null; // SK... — API key SID (preferred)
  keySecret?: string | null; // API key secret (preferred)
  authToken?: string | null; // legacy fallback
  from?: string | null;
};

type Resolved = { accountSid: string; user: string; pass: string };

// Resolve which credentials to use. Per-tenant values win; env is the fallback.
function resolveAuth(c: TwilioCreds): Resolved | null {
  const accountSid = c.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const keySid = c.keySid || process.env.TWILIO_API_KEY_SID || "";
  const keySecret = c.keySecret || process.env.TWILIO_API_KEY_SECRET || "";
  const authToken = c.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  if (!accountSid) return null;
  if (keySid && keySecret) return { accountSid, user: keySid, pass: keySecret };
  if (authToken) return { accountSid, user: accountSid, pass: authToken };
  return null;
}

// True when we have enough to authenticate (API key or auth token + account SID).
export function twilioConnected(c: TwilioCreds): boolean {
  return resolveAuth(c) !== null;
}

export async function sendSms(to: string, body: string, creds?: TwilioCreds) {
  const a = resolveAuth(creds ?? {});
  const from = creds?.from || process.env.TWILIO_FROM_NUMBER;
  if (!a || !from) {
    throw new Error(
      "Twilio credentials missing (need Account SID + API key, and a From number)"
    );
  }

  const auth = Buffer.from(`${a.user}:${a.pass}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${a.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio SMS failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Current Twilio account balance, e.g. "12.34 USD". null if unavailable.
export async function getTwilioBalance(
  creds?: TwilioCreds
): Promise<string | null> {
  const a = resolveAuth(creds ?? {});
  if (!a) return null;
  try {
    const auth = Buffer.from(`${a.user}:${a.pass}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${a.accountSid}/Balance.json`,
      { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const bal = parseFloat(d.balance);
    if (isNaN(bal)) return null;
    return `${bal.toFixed(2)} ${d.currency || "USD"}`;
  } catch {
    return null;
  }
}
