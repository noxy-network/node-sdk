/**
 * Minimal agent: human approval gate via the Decision Layer.
 *
 * Run from the `examples` directory (after `pnpm run build` at repo root):
 *   NOXY_APP_TOKEN=<your bearer token> NOXY_TARGET_ADDRESS=<0x wallet address> node basic.js
 *
 * Or load a `.env` file (Node 20.6+):
 *   node --env-file=.env basic.js
 * with NOXY_APP_TOKEN and NOXY_TARGET_ADDRESS set in that file.
 */
import {
  initNoxyAgentClient,
  isTerminalHumanOutcome,
  NoxyHumanDecisionOutcome,
} from '../dist/bundle.js';

const authToken = process.env.NOXY_APP_TOKEN?.trim();
const identity = process.env.NOXY_TARGET_ADDRESS?.trim();

if (!authToken || !identity) {
  console.error(
    'Missing NOXY_APP_TOKEN or NOXY_TARGET_ADDRESS. Example:\n' +
      '  NOXY_APP_TOKEN=... NOXY_TARGET_ADDRESS=0x... node basic.js\n' +
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
  console.log('My App Quota:', quota);

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
      maxWaitMs: 300000, // 5 minutes
    });
  } catch (e) {
    error = e;
  }

  const isActionApproved = applyHumanGate(resolution, error);
  console.log('AI agent should proceed:', isActionApproved ? 'yes' : 'no');
})();

/**
 * @param {{ outcome: number; pending: boolean; request_id: string } | null} resolution
 * @param {unknown} [error] thrown by sendDecisionAndWaitForOutcome, if any
 * @returns {boolean} `true` if the human outcome is approved; `false` otherwise (rejected, error, pending, expired, etc.).
 */
function applyHumanGate(resolution, error) {
  if (error != null) {
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

  if (resolution?.outcome === NoxyHumanDecisionOutcome.APPROVED) {
    console.log('Proceeding: user approved — agent should execute the proposed tool call.');
    return true;
  }

  if (resolution?.outcome === NoxyHumanDecisionOutcome.REJECTED) {
    console.log('Abort: user rejected — agent should not execute the proposed tool call.');
    return false;
  }

  console.log('Human gate: not approved (pending, expired, or inconclusive).');
  return false;
}
