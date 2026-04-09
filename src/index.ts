import type { NoxyConfig } from '@/client/config';
import { NoxyAgentClient } from '@/client/AgentClient';

export type { NoxyConfig } from '@/client/config';
export { NoxyAgentClient } from '@/client/AgentClient';
export type {
  NoxyIdentityAddress,
  NoxyDeliveryOutcome,
  NoxyGetDecisionOutcomeResponse,
  NoxyGetQuotaResponse,
  NoxyIdentityDevice,
  NoxyRouteDecisionRequest,
} from '@/client/types';
export { NoxyDeliveryStatus, NoxyHumanDecisionOutcome, NoxyQuotaStatus } from '@/client/types';
export {
  waitForDecisionOutcome,
  parseHumanDecisionOutcome,
  isTerminalHumanOutcome,
  WaitForDecisionOutcomeTimeoutError,
  SendDecisionAndWaitNoDecisionIdError,
  type WaitForDecisionOutcomeOptions,
  type SendDecisionAndWaitOptions,
} from '@/utils/decision-outcome';

/** Initialize the Noxy Decision Layer client for an AI agent runtime */
export async function initNoxyAgentClient(config: NoxyConfig): Promise<NoxyAgentClient> {
  return NoxyAgentClient.init(config);
}
