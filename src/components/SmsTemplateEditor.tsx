"use client";

import { useState } from "react";
import {
  DEFAULT_SMS_TEMPLATE,
  renderSmsTemplate,
  SMS_TOKENS,
  SMS_TOKEN_HELP,
} from "@/lib/sms-template";

// Sample values used only to render the live preview.
const sample = (businessName: string) => ({
  business: businessName,
  name: "Ben",
  phone: "+1 847 555 0142",
  caller_id: "+1 847 555 0142",
  address: "9707 N Le Claire Ave\nSkokie, IL 60077",
  summary: "2015 Mercedes-Benz C-Class key made",
  service: "Car Key Replacement",
  property: "Car",
  notes: "Customer needs a key replacement for a 2015 Mercedes-Benz C-Class.",
  flag: "",
});

export default function SmsTemplateEditor({
  initial,
  businessName,
}: {
  initial: string;
  businessName: string;
}) {
  const [text, setText] = useState(initial);
  const preview = renderSmsTemplate(text, sample(businessName));

  const box =
    "w-full rounded border border-neutral-300 px-3 py-2 text-sm font-mono";

  function insert(token: string) {
    setText((s) => {
      const sep = s && !s.endsWith("\n") ? "\n" : "";
      return `${s}${sep}${token}`;
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Editor */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700">Template</label>
        <textarea
          name="sms_template"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${box} min-h-56 whitespace-pre`}
        />

        <div className="flex flex-wrap gap-1.5">
          {SMS_TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => insert(`{${t}}`)}
              title={SMS_TOKEN_HELP[t]}
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-mono text-neutral-600 hover:bg-neutral-100"
            >
              {`{${t}}`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setText(DEFAULT_SMS_TEMPLATE)}
          className="text-xs text-neutral-500 hover:text-black"
        >
          Reset to default
        </button>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700">Preview</span>
        <pre className="min-h-56 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm whitespace-pre-wrap font-mono text-neutral-800">
          {preview || "—"}
        </pre>
        <p className="text-xs text-neutral-500">
          Sample data. <span className="font-mono">{"{phone}"}</span> falls back
          to <span className="font-mono">{"{caller_id}"}</span> when the caller
          says to use the same number;{" "}
          <span className="font-mono">{"{address}"}</span> is validated via
          Google and <span className="font-mono">{"{summary}"}</span> is a short
          vehicle + service line.
        </p>
      </div>
    </div>
  );
}
