// Push agent settings from our DB to the Vapi assistant via the Vapi API.

export type AgentCfg = {
  greeting?: string | null;
  system_prompt?: string | null;
  voice_id?: string | null;
  voice_provider?: string | null;
  silence_timeout_sec?: number | null;
  max_duration_sec?: number | null;
};

export type BusinessKb = {
  kb_we_do?: string | null;
  kb_we_dont?: string | null;
  service_area?: string | null;
  pricing_notes?: string | null;
};

// Combine the base prompt with the knowledge base so the qualification
// filter (what we do / don't do) is always part of the system prompt.
export function composeSystemPrompt(agent: AgentCfg, kb: BusinessKb): string {
  const parts: string[] = [];
  if (agent.system_prompt?.trim()) parts.push(agent.system_prompt.trim());
  if (kb.kb_we_do?.trim()) parts.push(`# WHAT WE DO\n${kb.kb_we_do.trim()}`);
  if (kb.kb_we_dont?.trim())
    parts.push(`# WHAT WE DO NOT DO\n${kb.kb_we_dont.trim()}`);
  if (kb.service_area?.trim())
    parts.push(`# SERVICE AREA\n${kb.service_area.trim()}`);
  if (kb.pricing_notes?.trim())
    parts.push(`# PRICING NOTES\n${kb.pricing_notes.trim()}`);
  return parts.join("\n\n");
}

// GET the current assistant, merge our fields (preserving their model
// provider/model), then PATCH — so we never clobber unrelated settings.
export async function updateVapiAssistant(
  assistantId: string,
  agent: AgentCfg,
  kb: BusinessKb
) {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set");

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers,
  });
  if (!getRes.ok) {
    throw new Error(`Vapi GET failed (${getRes.status}): ${await getRes.text()}`);
  }
  const current = await getRes.json();

  const model = {
    ...(current.model ?? { provider: "openai", model: "gpt-4o" }),
    messages: [{ role: "system", content: composeSystemPrompt(agent, kb) }],
  };

  const body: Record<string, unknown> = {
    firstMessage: agent.greeting ?? "",
    model,
  };
  if (agent.silence_timeout_sec)
    body.silenceTimeoutSeconds = agent.silence_timeout_sec;
  if (agent.max_duration_sec) body.maxDurationSeconds = agent.max_duration_sec;
  if (agent.voice_id) {
    body.voice = {
      provider: agent.voice_provider || "11labs",
      voiceId: agent.voice_id,
    };
  }

  const patchRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!patchRes.ok) {
    throw new Error(
      `Vapi PATCH failed (${patchRes.status}): ${await patchRes.text()}`
    );
  }
  return patchRes.json();
}
