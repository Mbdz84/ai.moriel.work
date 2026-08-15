// Google Address Validation.
// Optional: needs GOOGLE_MAPS_API_KEY with the "Address Validation API"
// enabled in Google Cloud. When the key is missing or the call fails, this
// returns null and dispatch falls back to the raw spoken address — so the
// feature degrades gracefully instead of blocking a job.
//
// Docs: https://developers.google.com/maps/documentation/address-validation

export type ValidatedAddress = {
  // Clean single line, e.g. "9707 N Le Claire Ave, Skokie, IL 60077" (stored
  // in the DB / sent to the JSON webhook).
  oneLine: string;
  // Two-line postal format for the SMS:
  //   9707 N Le Claire Ave
  //   Skokie, IL 60077
  twoLine: string;
};

export async function validateAddress(
  raw?: string | null,
  regionCode = "US"
): Promise<ValidatedAddress | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !raw || !raw.trim()) return null;

  try {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: { regionCode, addressLines: [raw] } }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const d = await res.json();
    const addr = d?.result?.address;
    const pa = addr?.postalAddress;
    if (!pa) return null;

    const street = (pa.addressLines ?? []).join(" ").trim();
    const cityLine = [
      pa.locality,
      [pa.administrativeArea, pa.postalCode].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");

    const twoLine = [street, cityLine].filter(Boolean).join("\n");
    if (!twoLine) return null;

    const oneLine =
      (addr.formattedAddress as string | undefined)?.replace(/,?\s*USA$/, "") ||
      [street, cityLine].filter(Boolean).join(", ");

    return { oneLine, twoLine };
  } catch {
    return null;
  }
}
