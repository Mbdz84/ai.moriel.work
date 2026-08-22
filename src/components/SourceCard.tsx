"use client";

import { useState } from "react";

export type SourceCfg = {
  label?: string | null;
  agent_name?: string | null;
  from_number?: string | null;
  extra_sms_to?: string | null;
  extra_json_url?: string | null;
  exclude_from_global?: boolean | null;
  notify_spam?: boolean | null;
  caller_sms_enabled?: boolean | null;
  caller_link?: string | null;
  caller_link_label?: string | null;
  caller_sms_template?: string | null;
};

const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
const label = "text-sm font-medium text-neutral-700";

// One source (a Vapi assistant) with all its per-source routing config.
// Field names are suffixed with the assistant id ("field::<id>") so the
// server action can read each row unambiguously.
export default function SourceCard({
  assistant,
  cfg,
  accountNumber,
  assignedNumber = "",
  assignedProvider = "",
  platform = "vapi",
}: {
  assistant: { id: string; name: string };
  cfg?: SourceCfg;
  accountNumber: string;
  assignedNumber?: string;
  assignedProvider?: string;
  platform?: "vapi" | "11labs";
}) {
  const platformLabel = platform === "11labs" ? "ElevenLabs" : "Vapi";
  const platformClass =
    platform === "11labs"
      ? "bg-violet-100 text-violet-700"
      : "bg-sky-100 text-sky-700";
  const providerLabel =
    assignedProvider === "twilio"
      ? "Twilio"
      : assignedProvider === "vapi"
      ? "Vapi"
      : assignedProvider
      ? assignedProvider
      : "";
  const id = assistant.id;
  const initialNumbers = (cfg?.extra_sms_to || "")
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const [numbers, setNumbers] = useState<string[]>(initialNumbers);
  const [showNumbers, setShowNumbers] = useState(initialNumbers.length > 0);
  const [callerOn, setCallerOn] = useState(Boolean(cfg?.caller_sms_enabled));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setNum = (i: number, v: string) =>
    setNumbers((arr) => arr.map((n, idx) => (idx === i ? v : n)));
  const addNum = () => setNumbers((arr) => [...arr, ""]);
  const removeNum = (i: number) =>
    setNumbers((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-5 space-y-4">
      {/* Read-only agent identity — bigger, bold title + platform badge */}
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold text-neutral-900 truncate">
            {assistant.name}
          </span>
          <span
            className={`rounded-full text-xs font-medium px-2 py-0.5 ${platformClass}`}
          >
            {platformLabel}
          </span>
        </div>
        <div className="text-xs text-neutral-400 truncate font-mono">{id}</div>
        <input type="hidden" name={`provider::${id}`} value={platform} />
        {assignedNumber && (
          <div className="text-sm font-medium text-indigo-700">
            📞 {assignedNumber}
            {providerLabel && (
              <span className="ml-1 text-xs font-normal text-neutral-400">
                · {providerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <input type="hidden" name="assistant_id" value={id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={label}>Source name (brand it represents)</label>
          <input
            name={`label::${id}`}
            defaultValue={cfg?.label || assistant.name}
            placeholder={assistant.name}
            className={input}
          />
          <p className="text-xs text-neutral-400">
            Shown on the dashboard and at the top of the job SMS
            (&#123;source&#125;).
          </p>
        </div>

        <div className="space-y-1">
          <label className={label}>Agent / display name</label>
          <input
            name={`agent_name::${id}`}
            defaultValue={cfg?.agent_name || ""}
            placeholder="e.g. Dispatcher"
            className={input}
          />
          <p className="text-xs text-neutral-400">
            The &#123;agent&#125; token used in this source&apos;s texts.
          </p>
        </div>

        <div className="space-y-1">
          <label className={label}>Outbound number</label>
          <input
            name={`from_number::${id}`}
            defaultValue={cfg?.from_number || ""}
            placeholder={assignedNumber || accountNumber || "+1..."}
            className={input}
          />
          <p className="text-xs text-neutral-400">
            Texts for this source are sent from here.{" "}
            {assignedNumber
              ? `This assistant's assigned number is ${assignedNumber}.`
              : ""}{" "}
            Blank uses the account default
            {accountNumber ? ` (${accountNumber})` : ""}.
          </p>
        </div>

        {/* Extra recipient numbers — hidden behind a link until needed */}
        <div className="space-y-1">
          <label className={label}>Extra recipient numbers</label>
          {!showNumbers ? (
            <button
              type="button"
              onClick={() => {
                setShowNumbers(true);
                if (numbers.length === 0) addNum();
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              + Add extra numbers
            </button>
          ) : (
            <div className="space-y-2">
              {numbers.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    name={`extra_sms_to::${id}`}
                    value={n}
                    onChange={(e) => setNum(i, e.target.value)}
                    placeholder="+1..."
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => removeNum(i)}
                    className="rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100"
                    aria-label="Remove number"
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addNum}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add another number
              </button>
            </div>
          )}
          <p className="text-xs text-neutral-400">
            Also text these numbers for this source&apos;s jobs, on top of the
            global Team dispatch list.
          </p>
        </div>
      </div>

      {/* Text the caller a link (per source) */}
      <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name={`caller_sms_enabled::${id}`}
            checked={callerOn}
            onChange={(e) => setCallerOn(e.target.checked)}
          />
          Text the caller a link after the call
        </label>
        <div className={callerOn ? "space-y-2" : "hidden"}>
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={label}>Link label</label>
                <input
                  name={`caller_link_label::${id}`}
                  defaultValue={cfg?.caller_link_label || ""}
                  placeholder="e.g. Book your appointment"
                  className={input}
                />
              </div>
              <div className="space-y-1">
                <label className={label}>Link URL</label>
                <input
                  name={`caller_link::${id}`}
                  defaultValue={cfg?.caller_link || ""}
                  placeholder="https://your-link.com"
                  className={input}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={label}>Message (optional)</label>
              <textarea
                name={`caller_sms_template::${id}`}
                defaultValue={cfg?.caller_sms_template || ""}
                placeholder="Leave blank for the default. Tokens: {business} {agent} {name} {link} {link_label}"
                className={`${input} min-h-20 font-mono`}
              />
            </div>
            <p className="text-xs text-neutral-400">
              Sent from this source&apos;s outbound number.
            </p>
          </div>
        </div>
      </div>

      {/* Spam notify (per source) */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={`notify_spam::${id}`}
          defaultChecked={Boolean(cfg?.notify_spam)}
        />
        Notify me about spam / no-intent calls for this source
      </label>

      {/* Advanced — inputs stay mounted (hidden) so a collapsed save keeps them */}
      <div className="border-t border-neutral-100 pt-3 space-y-3">
        {!showAdvanced && (
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            Advanced options
          </button>
        )}
        <div className={showAdvanced ? "space-y-3" : "hidden"}>
          <div className="space-y-1">
            <label className={label}>Extra JSON / CRM endpoint</label>
            <input
              name={`extra_json_url::${id}`}
              defaultValue={cfg?.extra_json_url || ""}
              placeholder="https://your-crm.example.com/webhook"
              className={input}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={`exclude_from_global::${id}`}
              defaultChecked={Boolean(cfg?.exclude_from_global)}
            />
            Exclude from global Team dispatch (use only this source&apos;s
            destinations)
          </label>
        </div>
      </div>
    </div>
  );
}
