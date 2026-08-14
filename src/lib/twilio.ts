// Send SMS via Twilio's REST API using fetch (no SDK dependency).
// Credentials come from env for now; Phase 5 moves them to the
// per-business `credentials` table.

export type TwilioCreds = {
  sid?: string | null;
  token?: string | null;
  from?: string | null;
};

// Per-tenant credentials (from the DB) take priority; env is the fallback.
export async function sendSms(to: string, body: string, creds?: TwilioCreds) {
  const sid = creds?.sid || process.env.TWILIO_ACCOUNT_SID;
  const token = creds?.token || process.env.TWILIO_AUTH_TOKEN;
  const from = creds?.from || process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    throw new Error("Twilio credentials missing (SID / AUTH_TOKEN / FROM_NUMBER)");
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
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
  sid?: string | null,
  token?: string | null
): Promise<string | null> {
  const s = sid || process.env.TWILIO_ACCOUNT_SID;
  const t = token || process.env.TWILIO_AUTH_TOKEN;
  if (!s || !t) return null;
  try {
    const auth = Buffer.from(`${s}:${t}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${s}/Balance.json`,
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

