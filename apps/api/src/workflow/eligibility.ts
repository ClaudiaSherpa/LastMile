import { DocumentStatus } from '@sherpa/shared';

export interface DocLike {
  required: boolean;
  status: DocumentStatus;
  expiryDate?: string | null;
  // whether this document type tracks expiry; when false, a stored expiry date
  // (e.g. on a proof-of-address utility bill) must NOT make the driver expired.
  // Defaults to true so callers that don't pass it keep the old behaviour.
  tracksExpiry?: boolean;
}

/**
 * A driver is tender-eligible only when security clearance has passed AND every
 * required document is approved and not expired. Pure function — unit tested.
 */
export function computeEligibility(
  securityCleared: boolean,
  docs: DocLike[],
  now: Date = new Date(),
): { eligible: boolean; reason: string } {
  if (!securityCleared) return { eligible: false, reason: 'security_not_cleared' };

  const required = docs.filter((d) => d.required);
  for (const d of required) {
    if (d.status !== DocumentStatus.APPROVED) {
      return { eligible: false, reason: 'required_doc_not_approved' };
    }
    if (d.tracksExpiry !== false && d.expiryDate && new Date(d.expiryDate) < now) {
      return { eligible: false, reason: 'required_doc_expired' };
    }
  }
  return { eligible: true, reason: 'ok' };
}
