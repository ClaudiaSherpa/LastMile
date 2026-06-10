const DATE_KEYS = new Set(['issueDate', 'expiryDate']);

/** Clean raw model output into normalized onboarding field values. */
export function normalizeOcrFields(obj: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null || v === '') continue;
    let val = String(v).trim();
    if (k === 'cedula') val = val.replace(/[.\s]/g, '');
    if (k === 'plate') val = val.toUpperCase().replace(/\s/g, '');
    if (k === 'year') val = val.match(/\d{4}/)?.[0] ?? val;
    if (DATE_KEYS.has(k)) {
      const d = val.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (d) val = d;
    }
    out[k] = val;
  }
  return out;
}

/** Tolerant JSON extraction from a model response that may wrap JSON in prose. */
export function parseOcrJson(text: string): Record<string, any> {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}
