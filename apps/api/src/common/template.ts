/** {{var}} interpolation used by notification templates (multi-language copy). */
export function interpolate(
  body: string,
  vars: Record<string, string | number> = {},
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : '',
  );
}
