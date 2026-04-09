import { randomUUID } from 'node:crypto';
import { NoxyHumanDecisionOutcome, type NoxyGetDecisionOutcomeResponse } from '@/client/types';

/** Normalize gRPC enum value (number or proto-loader string) to `NoxyHumanDecisionOutcome`. */
export function parseHumanDecisionOutcome(raw: unknown): NoxyHumanDecisionOutcome {
  if (typeof raw === 'number' && raw >= 0 && raw <= 3) {
    return raw as NoxyHumanDecisionOutcome;
  }
  if (typeof raw === 'string') {
    const map: Record<string, NoxyHumanDecisionOutcome> = {
      DECISION_OUTCOME_PENDING: 0,
      DECISION_OUTCOME_APPROVED: 1,
      DECISION_OUTCOME_REJECTED: 2,
      DECISION_OUTCOME_EXPIRED: 3,
    };
    if (raw in map) return map[raw]!;
  }
  return 0;
}

/** True when the human has finalized (approved, rejected, or expired). */
export function isTerminalHumanOutcome(outcome: NoxyHumanDecisionOutcome): boolean {
  return (
    outcome === NoxyHumanDecisionOutcome.APPROVED ||
    outcome === NoxyHumanDecisionOutcome.REJECTED ||
    outcome === NoxyHumanDecisionOutcome.EXPIRED
  );
}

/**
 * Poll `GetDecisionOutcome` with exponential backoff until the human outcome is terminal
 * or the relay reports `pending === false`, or `maxWaitMs` elapses.
 */
export interface WaitForDecisionOutcomeOptions {
  decisionId: string;
  identityId: string;
  /** First delay after the initial fetch (ms). Default 400 */
  initialPollIntervalMs?: number;
  /** Cap between polls (ms). Default 30_000 */
  maxPollIntervalMs?: number;
  /** Total budget (ms). Default 900_000 (15 minutes) */
  maxWaitMs?: number;
  /** Backoff multiplier per iteration. Default 1.6 */
  backoffMultiplier?: number;
  signal?: AbortSignal;
}

/** Options for {@link NoxyAgentClient.sendDecisionAndWaitForOutcome} — same as {@link WaitForDecisionOutcomeOptions} without `decisionId` or `identityId` (both come from the method arguments). */
export type SendDecisionAndWaitOptions = Omit<
  WaitForDecisionOutcomeOptions,
  'decisionId' | 'identityId'
>;

export class WaitForDecisionOutcomeTimeoutError extends Error {
  constructor(message = 'waitForDecisionOutcome exceeded maxWaitMs') {
    super(message);
    this.name = 'WaitForDecisionOutcomeTimeoutError';
  }
}

/** Thrown when {@link NoxyAgentClient.sendDecisionAndWaitForOutcome} gets no `decision_id` from the relay to poll. */
export class SendDecisionAndWaitNoDecisionIdError extends Error {
  constructor(message = 'sendDecision returned no decision_id to poll; check delivery statuses') {
    super(message);
    this.name = 'SendDecisionAndWaitNoDecisionIdError';
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      },
      { once: true }
    );
  });
}

export async function waitForDecisionOutcome(
  fetchOutcome: (req: {
    request_id: string;
    decision_id: string;
    identity_id: string;
  }) => Promise<NoxyGetDecisionOutcomeResponse>,
  options: WaitForDecisionOutcomeOptions
): Promise<NoxyGetDecisionOutcomeResponse> {
  const {
    decisionId,
    identityId,
    initialPollIntervalMs = 400,
    maxPollIntervalMs = 30_000,
    maxWaitMs = 900_000,
    backoffMultiplier = 1.6,
    signal,
  } = options;

  const started = Date.now();
  let interval = initialPollIntervalMs;

  for (;;) {
    if (signal?.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
    if (Date.now() - started > maxWaitMs) {
      throw new WaitForDecisionOutcomeTimeoutError();
    }

    const raw = await fetchOutcome({
      request_id: randomUUID(),
      decision_id: decisionId,
      identity_id: identityId,
    });

    const outcome = parseHumanDecisionOutcome(raw.outcome);
    const normalized: NoxyGetDecisionOutcomeResponse = {
      request_id: raw.request_id,
      pending: raw.pending,
      outcome,
    };

    if (isTerminalHumanOutcome(outcome)) {
      return normalized;
    }
    if (!normalized.pending) {
      return normalized;
    }

    await sleep(Math.min(interval, maxPollIntervalMs), signal);
    interval = Math.min(interval * backoffMultiplier, maxPollIntervalMs);
  }
}
