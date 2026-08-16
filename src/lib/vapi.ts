// Thin editor over the Vapi assistant. Vapi is the source of truth;
// we pull the live config, let the user edit script + knowledge base,
// and push it back.

const KB_HEADER = "# KNOWLEDGE BASE";

// Fetch a call from Vapi and return the first structured-output result.
// Used as a fallback because extraction can finish a few seconds AFTER the
// end-of-call webhook fires.
export async function fetchCallExtract(
  callId: string
): Promise<Record<string, unknown> | null> {
  const key = process.env.VAPI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const c = await r.json();
    const so = c?.artifact?.structuredOutputs ?? c?.analysis?.structuredOutputs ?? {};
    const first = Object.values(so)[0] as
      | { result?: Record<string, unknown> }
      | undefined;
    return first?.result ?? c?.analysis?.structuredData ?? null;
  } catch {
    return null;
  }
}

// Knowledge base is stored inside the Vapi system message, separated by a
// header so we can split it back out on load.
export function composeSystemMessage(
  systemPrompt: string,
  knowledgeBase: string
): string {
  const base = (systemPrompt || "").trim();
  const kb = (knowledgeBase || "").trim();
  return kb ? `${base}\n\n${KB_HEADER}\n${kb}` : base;
}

export function splitSystemMessage(content: string): {
  systemPrompt: string;
  knowledgeBase: string;
} {
  const idx = content.indexOf(KB_HEADER);
  if (idx === -1) return { systemPrompt: content.trim(), knowledgeBase: "" };
  return {
    systemPrompt: content.slice(0, idx).trim(),
    knowledgeBase: content.slice(idx + KB_HEADER.length).trim(),
  };
}

export type VapiVoice = { provider: string; voiceId: string };

export type AgentScript = {
  firstMessage: string;
  systemPrompt: string;
  knowledgeBase: string;
  // Optional: set the assistant's voice. Omitted -> voice left unchanged.
  voice?: VapiVoice | null;
};

type VapiMessage = { role?: string; content?: string };

// Pull the live assistant config from Vapi. Returns null if it can't.
export async function getVapiAssistant(
  assistantId: string
): Promise<AgentScript | null> {
  const key = process.env.VAPI_API_KEY;
  if (!key || !assistantId) return null;

  const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const a = await res.json();
  const firstMessage: string = a.firstMessage ?? "";
  const sysMsg: string =
    (a.model?.messages ?? ([] as VapiMessage[])).find(
      (m: VapiMessage) => m.role === "system"
    )?.content ?? "";
  const { systemPrompt, knowledgeBase } = splitSystemMessage(sysMsg);
  return { firstMessage, systemPrompt, knowledgeBase };
}

// Push script + KB (+ optional voice) back to Vapi. GET first so we preserve
// the model (provider/model) and any non-system messages.
export async function updateVapiAssistant(
  assistantId: string,
  script: AgentScript
) {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set");

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers,
    cache: "no-store",
  });
  if (!getRes.ok) {
    throw new Error(`Vapi GET failed (${getRes.status}): ${await getRes.text()}`);
  }
  const current = await getRes.json();

  const otherMessages = (current.model?.messages ?? []).filter(
    (m: VapiMessage) => m.role !== "system"
  );

  const model = {
    ...(current.model ?? { provider: "openai", model: "gpt-4o" }),
    messages: [
      {
        role: "system",
        content: composeSystemMessage(script.systemPrompt, script.knowledgeBase),
      },
      ...otherMessages,
    ],
  };

  const body: Record<string, unknown> = {
    firstMessage: script.firstMessage,
    model,
  };
  if (script.voice && script.voice.voiceId) {
    body.voice = {
      provider: script.voice.provider || "11labs",
      voiceId: script.voice.voiceId,
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
