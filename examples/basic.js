/**
 * Minimal agent: human approval gate via the Decision Layer (`agent.proto`).
 *
 * Run from the `examples` directory (after `pnpm run build` at repo root).
 * Requires Node.js >= 22 (see package `engines`).
 *
 *   NOXY_APP_TOKEN=<relay bearer token> NOXY_IDENTITY_ID=<logical user id> node basic.js
 *
 * Use the **same identity string your Noxy app uses** when linking devices (examples: wallet `0x…`,
 * `user_id`, email, phone).
 *
 * Or load a `.env` file:
 *   node --env-file=.env basic.js
 * with NOXY_APP_TOKEN and NOXY_IDENTITY_ID set.
 */
import {
  initNoxyAgentClient,
  isTerminalHumanOutcome,
  NoxyHumanDecisionOutcome,
  SendDecisionAndWaitNoDecisionIdError,
  WaitForDecisionOutcomeTimeoutError,
} from '../dist/bundle.js';

const authToken = process.env.NOXY_APP_TOKEN?.trim();
const identity = process.env.NOXY_IDENTITY_ID?.trim();

if (!authToken || !identity) {
  console.error(
    'Missing NOXY_APP_TOKEN or NOXY_IDENTITY_ID (logical user id matching device registration).\n' +
      '  NOXY_APP_TOKEN=... NOXY_IDENTITY_ID=... node basic.js\n' +
      'Or: node --env-file=.env basic.js'
  );
  process.exit(1);
}

(async () => {
  const client = await initNoxyAgentClient({
    endpoint: 'https://relay.noxy.network',
    authToken,
    decisionTtlSeconds: 300, // 5 minutes
  });

  const quota = await client.getQuota();
  console.log('Relay quota:', {
    app: quota.app_name,
    remaining: quota.quota_remaining,
    total: quota.quota_total,
    status: quota.status,
  });

  const proposedAction = {
    kind: 'propose_tool_call',
    tool: 'transfer_funds',
    args: { to: '0x000000000000000000000000000000000000dEaD', amountWei: '1' },
    title: 'Transfer 1 wei to the burn address',
    summary: 'The agent is requesting approval to send 1 wei to the burn address.',
  };

  let resolution = null;
  let error = undefined;
  try {
    resolution = await client.sendDecisionAndWaitForOutcome(identity, proposedAction, {
      maxWaitMs: 300000, // 5 minutes — default SDK budget is 15m; shorten for the demo
    });
  } catch (e) {
    error = e;
  }

  const isActionApproved = applyHumanGate(resolution, error);
  console.log('AI agent should proceed:', isActionApproved ? 'yes' : 'no');
})();

/**
 * @param {{ request_id: string; pending: boolean; outcome: number } | null} resolution
 *   Relay human outcome (`NoxyGetDecisionOutcomeResponse`): normalized `DecisionOutcome` enum (0–3).
 * @param {unknown} [error]
 * @returns {boolean} `true` only when outcome is APPROVED.
 */
function applyHumanGate(resolution, error) {
  if (error != null) {
    if (error instanceof SendDecisionAndWaitNoDecisionIdError) {
      console.warn(
        'Human gate: no decision_id after route — check relay delivery (e.g. registered devices / NO_DEVICES).'
      );
      return false;
    }
    if (error instanceof WaitForDecisionOutcomeTimeoutError) {
      console.warn('Human gate: waited until maxWaitMs without a terminal outcome.');
      return false;
    }
    console.warn('Human gate: error.', error);
    return false;
  }

  if (resolution) {
    console.log('Human decision:', {
      outcome: resolution.outcome,
      pending: resolution.pending,
      terminal: isTerminalHumanOutcome(resolution.outcome),
    });
  }

  if (!resolution) {
    console.log('Human gate: empty resolution.');
    return false;
  }

  switch (resolution.outcome) {
    case NoxyHumanDecisionOutcome.APPROVED:
      console.log('Proceeding: user approved — agent should execute the proposed tool call.');
      return true;
    case NoxyHumanDecisionOutcome.REJECTED:
      console.log('Abort: user rejected — agent should not execute the proposed tool call.');
      return false;
    case NoxyHumanDecisionOutcome.EXPIRED:
      console.log('Abort: decision expired unanswered — agent should not execute the proposed tool call.');
      return false;
    case NoxyHumanDecisionOutcome.PENDING:
    default:
      console.log('Human gate: not approved (still pending or non-terminal outcome despite wait).');
      return false;
  }
}
