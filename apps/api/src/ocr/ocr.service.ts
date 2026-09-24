import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';
import { normalizeOcrFields, parseOcrJson } from './normalize';

export interface OcrResult {
  /** false when OCR ran (or was skipped) without throwing */
  ok: boolean;
  /** true when skipped because no key / unsupported file */
  skipped: boolean;
  reason?: string;
  /** normalized fields mapped to onboarding draft keys */
  fields: Record<string, string>;
  /** raw model text, for debugging */
  raw?: string;
}

// What to pull out of each document type, expressed for the vision model.
const EXTRACTION_HINTS: Record<string, string> = {
  license:
    'Colombian driver license (licencia de conducción). Extract: name (full name), cedula (id number, digits only), licenseNumber, categories (e.g. A2,B1), issueDate, expiryDate.',
  soat:
    'Colombian SOAT mandatory insurance. Extract: plate (vehicle plate), policyNumber, insurer, issueDate, expiryDate (vigencia hasta).',
  insurance:
    'Vehicle all-risk insurance policy (póliza todo riesgo). Extract: plate, policyNumber, insurer, issueDate, expiryDate.',
  property:
    'Colombian vehicle registration card (tarjeta de propiedad). Extract: plate, brand (marca), model (línea), year (modelo año, 4 digits), color, name (owner full name), cedula (owner id).',
  id: 'Colombian national ID (cédula de ciudadanía) with selfie. Extract: name (full name), cedula (id number, digits only).',
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger('OCR');

  get enabled(): boolean {
    return !!env.ocr.apiKey;
  }

  /**
   * Run OCR auto-fill against an uploaded document. Returns normalized draft
   * fields. Never throws — degrades to { skipped } so manual entry still works.
   */
  /**
   * Read a vehicle odometer (mileage) from a photo. Returns the numeric reading
   * or null. Never throws — degrades to { value: null, skipped } for manual entry.
   */
  async readOdometer(buffer: Buffer, mimeType: string): Promise<{ value: number | null; skipped: boolean; reason?: string; raw?: string }> {
    if (!this.enabled) return { value: null, skipped: true, reason: 'no_api_key' };
    if (!mimeType.startsWith('image/')) return { value: null, skipped: true, reason: 'unsupported_mime' };
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const prompt =
      `Read the ODOMETER from this vehicle dashboard photo.\n` +
      `The odometer is the vehicle's TOTAL distance travelled — the main, non-resettable counter, ` +
      `usually 5 to 7 digits, often near a "km", "mi" or "ODO" label.\n` +
      `Do NOT read the TRIP meter (TRIP / TRIP A / TRIP B / Odo Trip): that is a smaller, resettable ` +
      `number, usually shorter and shown with a decimal point (e.g. 123.4). Also ignore speed, RPM, ` +
      `fuel, temperature and clock.\n` +
      `Read every digit carefully left to right. Give the whole-number total (drop any tenths).\n` +
      `Return ONLY compact JSON: {"odometer": <integer>, "trip": <number or null>}. ` +
      `Set "odometer" to null only if the main odometer is not legible. No prose, no markdown.`;
    try {
      const res = await fetch(`${env.ocr.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ocr.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pasarex.com',
          'X-Title': 'PasarEx LM Odometer OCR',
        },
        body: JSON.stringify({
          model: env.ocr.visionModel,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
        }),
      });
      if (!res.ok) { const b = await res.text().catch(() => ''); this.logger.warn(`odometer OCR ${res.status}: ${b.slice(0, 200)}`); return { value: null, skipped: false, reason: `http_${res.status}` }; }
      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      let value: number | null = null;
      try {
        const parsed = JSON.parse(text);
        const n = Math.round(Number(String(parsed?.odometer ?? '').replace(/[^\d.]/g, '')));
        value = Number.isFinite(n) && n > 0 ? n : null;
      } catch { value = null; }
      this.logger.log(`odometer OCR (${env.ocr.visionModel}) → ${value} · raw=${text.slice(0, 80)}`);
      return { value, skipped: false, raw: text };
    } catch (e: any) {
      this.logger.error(`odometer OCR failed: ${e.message}`);
      return { value: null, skipped: false, reason: 'exception' };
    }
  }

  async extract(buffer: Buffer, mimeType: string, docTypeKey: string): Promise<OcrResult> {
    if (!this.enabled) {
      return { ok: true, skipped: true, reason: 'no_api_key', fields: {} };
    }
    if (!mimeType.startsWith('image/')) {
      return { ok: true, skipped: true, reason: 'unsupported_mime', fields: {} };
    }

    const hint = EXTRACTION_HINTS[docTypeKey] ?? 'Extract any identity or vehicle fields you can read.';
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const prompt =
      `You are an OCR field extractor for a logistics onboarding form in Colombia.\n` +
      `Document: ${hint}\n` +
      `Return ONLY a compact JSON object with the fields you can read. ` +
      `Use these exact keys when present: name, cedula, plate, brand, model, year, color, ` +
      `licenseNumber, policyNumber, insurer, categories, issueDate, expiryDate. ` +
      `Dates must be ISO yyyy-mm-dd. Omit keys you cannot read. No prose, no markdown.`;

    try {
      const res = await fetch(`${env.ocr.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ocr.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pasarex.com',
          'X-Title': 'PasarEx LM Onboarding OCR',
        },
        body: JSON.stringify({
          model: env.ocr.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
        return { ok: false, skipped: false, reason: `http_${res.status}`, fields: {} };
      }

      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      const fields = normalizeOcrFields(parseOcrJson(text));
      this.logger.log(`extracted ${Object.keys(fields).length} fields for ${docTypeKey}`);
      return { ok: true, skipped: false, fields, raw: text };
    } catch (e: any) {
      this.logger.error(`OCR failed: ${e.message}`);
      return { ok: false, skipped: false, reason: 'exception', fields: {} };
    }
  }

}
