import { DocumentStatus } from '@sherpa/shared';

export interface DocLike {
  required: boolean;
  status: DocumentStatus;
  expiryDate?: string | null;
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
    if (d.expiryDate && new Date(d.expiryDate) < now) {
      return { eligible: false, reason: 'required_doc_expired' };
    }
  }
  return { eligible: true, reason: 'ok' };
}
