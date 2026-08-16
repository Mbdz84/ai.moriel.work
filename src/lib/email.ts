// Minimal transactional email via Resend's REST API (no SDK).
// Configure RESEND_API_KEY + EMAIL_FROM (e.g. "Front Desk <desk@yourdomain.com>").
// If either is missing, emailConfigured() is false and callers skip sending.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    throw new Error("Email not configured (RESEND_API_KEY / EMAIL_FROM)");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
