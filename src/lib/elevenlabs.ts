import crypto from "crypto";

// Thin client over the ElevenLabs Agents Platform, mirroring lib/vapi.ts.
// ElevenLabs is the second voice provider; a source's `provider` column
// decides which platform an agent (assistant_id) lives on.

const BASE = "https://api.elevenlabs.io/v1";

// List the org's ElevenLabs agents (id + name) for the Sources page.
export async function listElevenLabsAgents(): Promise<
  { id: string; name: string }[]
> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch(`${BASE}/convai/agents?page_size=100`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = await r.json();
    const agents = (data?.agents ?? data ?? []) as {
      agent_id?: string;
      name?: string;
    }[];
    return agents
      .filter((a) => a.agent_id)
      .map((a) => ({ id: a.agent_id as string, name: a.name ?? a.agent_id! }));
  } catch {
    return [];
  }
}

export type AssistantPhone = { number: string; provider: string };

// Map each ElevenLabs phone number to the agent it's assigned to.
export async function getElevenLabsAgentPhones(): Promise<
  Record<string, AssistantPhone>
> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return {};
  try {
    const r = await fetch(`${BASE}/convai/phone-numbers`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
    });
    if (!r.ok) return {};
    const list = await r.json();
    const arr = (Array.isArray(list) ? list : list?.phone_numbers ?? []) as Record<
      string,
      unknown
    >[];
    const map: Record<string, AssistantPhone> = {};
    for (const p of arr) {
      const assignedAgent =
        (p?.assigned_agent as { agent_id?: string } | undefined)?.agent_id ??
        (p?.agent_id as string | undefined);
      const number = (p?.phone_number ?? p?.number) as string | undefined;
      const provider = (p?.provider as string | undefined) ?? "elevenlabs";
      if (assignedAgent && number && !map[assignedAgent]) {
        map[assignedAgent] = { number, provider };
      }
    }
    return map;
  } catch {
    return {};
  }
}

// Verify the `elevenlabs-signature` header on a post-call webhook.
// Header format: "t=<unix>,v0=<hex hmac of `${t}.${rawBody}`>".
// Returns true when no secret is configured (dev) so local testing still works.
export function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return true; // no secret set -> skip verification
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    })
  ) as { t?: string; v0?: string };
  if (!parts.t || !parts.v0) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(parts.v0)
    );
  } catch {
    return false;
  }
}

// Job fields we care about (mirrors the Vapi structured output).
export type ElevenLabsJob = {
  name?: string;
  phone?: string;
  address?: string;
  property_type?: string;
  service_type?: string;
  vehicle?: string;
  qualified?: boolean;
  notes?: string;
  [key: string]: unknown;
};

// ElevenLabs data_collection_results is a map of
//   { <field>: { value, rationale, ... } }  (value may also be flat).
// Flatten it to a plain { field: value } object.
export function mapDataCollection(
  results: Record<string, unknown> | undefined | null
): ElevenLabsJob {
  const out: ElevenLabsJob = {};
  if (!results || typeof results !== "object") return out;
  for (const [k, raw] of Object.entries(results)) {
    let v: unknown = raw;
    if (raw && typeof raw === "object" && "value" in (raw as object)) {
      v = (raw as { value: unknown }).value;
    }
    if (v === null || v === undefined || v === "") continue;
    if (k === "qualified") out.qualified = v !== false && v !== "false";
    else out[k] = v;
  }
  return out;
}
