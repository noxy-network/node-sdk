import { describe, expect, it } from 'vitest';
import {
  isTerminalHumanOutcome,
  parseHumanDecisionOutcome,
} from '@/utils/decision-outcome';
import { NoxyHumanDecisionOutcome } from '@/client/types';

/** Proto-loader uses `enums: String` — relay returns these names on the wire. */
const PROTO_STRINGS = [
  ['DECISION_OUTCOME_PENDING', NoxyHumanDecisionOutcome.PENDING],
  ['DECISION_OUTCOME_APPROVED', NoxyHumanDecisionOutcome.APPROVED],
  ['DECISION_OUTCOME_REJECTED', NoxyHumanDecisionOutcome.REJECTED],
  ['DECISION_OUTCOME_EXPIRED', NoxyHumanDecisionOutcome.EXPIRED],
] as const;

describe('parseHumanDecisionOutcome', () => {
  it('maps proto enum strings (grpc proto-loader) to NoxyHumanDecisionOutcome', () => {
    for (const [raw, expected] of PROTO_STRINGS) {
      expect(parseHumanDecisionOutcome(raw)).toBe(expected);
    }
  });

  it('maps numeric wire values 0–3 to NoxyHumanDecisionOutcome', () => {
    expect(parseHumanDecisionOutcome(0)).toBe(NoxyHumanDecisionOutcome.PENDING);
    expect(parseHumanDecisionOutcome(1)).toBe(NoxyHumanDecisionOutcome.APPROVED);
    expect(parseHumanDecisionOutcome(2)).toBe(NoxyHumanDecisionOutcome.REJECTED);
    expect(parseHumanDecisionOutcome(3)).toBe(NoxyHumanDecisionOutcome.EXPIRED);
  });

  it('defaults unknown values to PENDING', () => {
    expect(parseHumanDecisionOutcome(undefined)).toBe(NoxyHumanDecisionOutcome.PENDING);
    expect(parseHumanDecisionOutcome('UNKNOWN')).toBe(NoxyHumanDecisionOutcome.PENDING);
    expect(parseHumanDecisionOutcome(99)).toBe(NoxyHumanDecisionOutcome.PENDING);
  });
});

describe('isTerminalHumanOutcome', () => {
  it('is true only for APPROVED, REJECTED, EXPIRED', () => {
    expect(isTerminalHumanOutcome(NoxyHumanDecisionOutcome.PENDING)).toBe(false);
    expect(isTerminalHumanOutcome(NoxyHumanDecisionOutcome.APPROVED)).toBe(true);
    expect(isTerminalHumanOutcome(NoxyHumanDecisionOutcome.REJECTED)).toBe(true);
    expect(isTerminalHumanOutcome(NoxyHumanDecisionOutcome.EXPIRED)).toBe(true);
  });
});
