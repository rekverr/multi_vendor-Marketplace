import { DisputeStatus } from '../../generated/prisma/client.js';

const transitions: Record<DisputeStatus, readonly DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [
    DisputeStatus.UNDER_REVIEW,
    DisputeStatus.RESOLVED,
    DisputeStatus.REJECTED,
  ],
  [DisputeStatus.UNDER_REVIEW]: [
    DisputeStatus.RESOLVED,
    DisputeStatus.REJECTED,
  ],
  [DisputeStatus.RESOLVED]: [DisputeStatus.CLOSED],
  [DisputeStatus.REJECTED]: [DisputeStatus.CLOSED],
  [DisputeStatus.CLOSED]: [],
};

export function canTransitionDispute(
  current: DisputeStatus,
  target: DisputeStatus,
): boolean {
  return transitions[current].includes(target);
}
