// Builds the full Vapi system prompt from the structured agent fields, and
// renders the spoken greeting. Both the settings save action and any future
// re-sync should go through here so the prompt stays consistent.

import { describeHours, type BusinessHours } from "./hours";

export type Faq = { q: string; a: string };
export type CollectField = { label: string; required?: boolean };

export type AgentConfig = {
  persona?: string | null;
  ask_questions?: string | null;
  collect_fields?: CollectField[] | null;
  faqs?: Faq[] | null;
  out_of_scope?: string | null;
  spam_handling?: string | null;
  hours_enabled?: boolean | null;
  business_hours?: BusinessHours | null;
  after_hours_prompt?: string | null;
  timezone?: string | null;
};

const s = (v?: string | null) => (v ?? "").trim();

export function composeSystemPrompt(a: AgentConfig): string {
  const parts: string[] = [];

  if (s(a.persona)) parts.push(s(a.persona));

  // What to ask / collect: free-text steps + the structured checklist.
  const collect = (a.collect_fields ?? []).filter((f) => s(f.label));
  if (s(a.ask_questions) || collect.length) {
    let sec = "# WHAT TO ASK / COLLECT";
    if (s(a.ask_questions)) sec += `\n${s(a.ask_questions)}`;
    if (collect.length) {
      sec += "\n\nAlways collect these details before ending the call:";
      for (const f of collect) {
        sec += `\n- ${s(f.label)}${f.required ? " (required)" : ""}`;
      }
    }
    parts.push(sec);
  }

  // FAQ: canned answers the agent can give.
  const faqs = (a.faqs ?? []).filter((f) => s(f.q) && s(f.a));
  if (faqs.length) {
    let sec =
      "# FREQUENTLY ASKED QUESTIONS\nIf a caller asks one of these, answer using the paired answer:";
    for (const f of faqs) sec += `\n\nQ: ${s(f.q)}\nA: ${s(f.a)}`;
    parts.push(sec);
  }

  // Hours + after-hours behavior.
  const hasHours =
    a.hours_enabled &&
    a.business_hours &&
    Object.keys(a.business_hours).length > 0;
  if (hasHours) {
    const tz = s(a.timezone) || "America/Chicago";
    let sec = `# BUSINESS HOURS (${tz})\n${describeHours(a.business_hours as BusinessHours)}\n\nIf a caller asks whether we are open or when we open, use these hours.`;
    if (s(a.after_hours_prompt)) {
      sec += ` When we are closed: ${s(a.after_hours_prompt)}`;
    }
    parts.push(sec);
  } else if (s(a.after_hours_prompt)) {
    parts.push(`# AFTER HOURS\n${s(a.after_hours_prompt)}`);
  }

  if (s(a.spam_handling)) parts.push(`# SPAM / ROBOCALLS\n${s(a.spam_handling)}`);
  if (s(a.out_of_scope)) parts.push(`# WHAT WE DON'T DO\n${s(a.out_of_scope)}`);

  return parts.join("\n\n");
}

// Substitute {business} / {agent} tokens in the spoken greeting.
export function renderGreeting(
  greeting: string,
  vars: { business?: string; agent?: string }
): string {
  return (greeting || "")
    .replace(/\{business\}/g, vars.business ?? "")
    .replace(/\{agent\}/g, vars.agent ?? "")
    .trim();
}
