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

/** Coerce a parsed value into a single flat field object (unwrap [ {...} ]). */
function asObject(v: any): Record<string, any> {
  if (Array.isArray(v)) return asObject(v[0] ?? {});
  return v && typeof v === 'object' ? v : {};
}

/** Tolerant JSON extraction from a model response that may wrap JSON in prose/arrays. */
export function parseOcrJson(text: string): Record<string, any> {
  try {
    return asObject(JSON.parse(text));
  } catch {
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return asObject(JSON.parse(m[0]));
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}
