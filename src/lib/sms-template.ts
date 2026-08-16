// Shared SMS template rendering for job-dispatch texts.
// A template is plain text sprinkled with {tokens}. On render, each token is
// replaced with its value; any line whose only dynamic content was empty
// tokens is dropped, so optional fields never leave a dangling label behind.

export const SMS_TOKENS = [
  "business",
  "agent",
  "name",
  "phone",
  "caller_id",
  "address",
  "summary",
  "service",
  "property",
  "notes",
  "flag",
] as const;

export type SmsToken = (typeof SMS_TOKENS)[number];

// Human-readable hint for each token, shown in the settings editor.
export const SMS_TOKEN_HELP: Record<SmsToken, string> = {
  business: "your company name",
  agent: "your AI agent's display name",
  name: "caller's name",
  phone: "callback number (falls back to caller ID)",
  caller_id: "the number the caller dialed from",
  address: "validated job address (two lines)",
  summary: "short job line, e.g. \"2015 Mercedes-Benz C-Class key made\"",
  service: "service type",
  property: "property type (car / house / business)",
  notes: "full free-text notes",
  flag: '"(Flagged: out of scope)" when the job was rejected',
};

export const DEFAULT_SMS_TEMPLATE = [
  "New locksmith job",
  "Company: {business}",
  "Name: {name}",
  "Phone: {phone}",
  "Address: {address}",
  "Job: {summary}",
  "{flag}",
].join("\n");

// ---- Caller SMS (sent to the CALLER after the call, with a link) ----
export const CALLER_SMS_TOKENS = [
  "business",
  "agent",
  "name",
  "link",
  "link_label",
] as const;

export type CallerSmsToken = (typeof CALLER_SMS_TOKENS)[number];

export const CALLER_SMS_TOKEN_HELP: Record<CallerSmsToken, string> = {
  business: "your company name",
  agent: "your AI agent's display name",
  name: "caller's name",
  link: "the link URL you configured",
  link_label: "the label for that link",
};

export const DEFAULT_CALLER_SMS_TEMPLATE = [
  "Thanks for calling {business}! Here's the link you asked about:",
  "{link_label}: {link}",
].join("\n");

// snake_case / lower → "Title Case" for display in the text.
export function titleize(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderSmsTemplate(
  template: string,
  values: Record<string, string | undefined>
): string {
  const tokenRe = /\{(\w+)\}/g;
  const lines = (template || "").split("\n");
  const out: string[] = [];

  for (const line of lines) {
    let hadToken = false;
    let anyFilled = false;
    const rendered = line.replace(tokenRe, (_m, key: string) => {
      hadToken = true;
      const v = values[key] ?? "";
      if (v) anyFilled = true;
      return v;
    });
    // A line built entirely from empty tokens is dropped (no dangling label).
    if (hadToken && !anyFilled) continue;
    out.push(rendered);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
