import { DocumentStatus } from '@sherpa/shared';
import { computeEligibility } from './eligibility';

const approved = (over: any = {}) => ({ required: true, status: DocumentStatus.APPROVED, ...over });

describe('computeEligibility', () => {
  it('blocks when security not cleared', () => {
    expect(computeEligibility(false, [approved()]).eligible).toBe(false);
    expect(computeEligibility(false, [approved()]).reason).toBe('security_not_cleared');
  });

  it('is eligible when cleared and all required docs approved & valid', () => {
    const res = computeEligibility(true, [approved({ expiryDate: '2999-01-01' }), approved()]);
    expect(res.eligible).toBe(true);
  });

  it('blocks when a required doc is not approved', () => {
    const res = computeEligibility(true, [approved({ status: DocumentStatus.PENDING })]);
    expect(res).toEqual({ eligible: false, reason: 'required_doc_not_approved' });
  });

  it('blocks when a required doc has expired', () => {
    const res = computeEligibility(true, [approved({ expiryDate: '2000-01-01' })], new Date('2026-06-10'));
    expect(res).toEqual({ eligible: false, reason: 'required_doc_expired' });
  });

  it('ignores optional docs', () => {
    const res = computeEligibility(true, [
      approved(),
      { required: false, status: DocumentStatus.PENDING, expiryDate: '2000-01-01' },
    ]);
    expect(res.eligible).toBe(true);
  });
});
