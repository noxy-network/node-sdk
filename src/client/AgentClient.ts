import { randomUUID } from 'node:crypto';
import { NoxyKyberProvider } from '@/client/KyberProvider';
import { createGrpcTransport, type GrpcTransport } from '@/client/transport';
import { NoxyConfig } from '@/client/config';
import { DecisionService } from '@/services/decision.service';
import { QuotaService } from '@/services/quota.service';
import { IdentityService } from '@/services/identity.service';
import type {
  NoxyIdentityAddress,
  NoxyDeliveryOutcome,
  NoxyGetQuotaResponse,
  NoxyGetDecisionOutcomeResponse,
} from '@/client/types';
import {
  parseHumanDecisionOutcome,
  waitForDecisionOutcome,
  SendDecisionAndWaitNoDecisionIdError,
  type WaitForDecisionOutcomeOptions,
  type SendDecisionAndWaitOptions,
} from '@/utils/decision-outcome';

/**
 * Client for the Noxy Decision Layer: route encrypted, actionable decisions to agent devices.
 * Intended for AI agent runtimes (tool orchestration, approvals, next-step payloads).
 */
export class NoxyAgentClient {
  private transport!: GrpcTransport;
  private decision!: DecisionService;
  private quota!: QuotaService;
  private identity!: IdentityService;

  private constructor(private config: NoxyConfig) {
    this.config = config;
  }

  static async init(config: NoxyConfig): Promise<NoxyAgentClient> {
    const client = new NoxyAgentClient(config);
    const transport = createGrpcTransport(config);
    client.transport = transport;
    const kyberProvider = await NoxyKyberProvider.create();

    client.decision = new DecisionService(transport, kyberProvider);
    client.quota = new QuotaService(transport);
    client.identity = new IdentityService(transport);

    return client;
  }

  /**
   * Route an actionable decision to all devices registered for the given Web3 identity address.
   * Returns relay **delivery** status per device (`DELIVERED`, `QUEUED`, etc.) and `decision_id` when applicable.
   * Poll {@link getDecisionOutcome} or {@link waitForDecisionOutcome} for human approve/reject/expired.
   */
  async sendDecision(
    identityAddress: NoxyIdentityAddress,
    actionableDecision: Record<string, unknown>
  ): Promise<NoxyDeliveryOutcome[]> {
    const devices = await this.identity.getDevices(identityAddress);
    return this.decision.send(devices, actionableDecision, {
      ttlSeconds: this.config.decisionTtlSeconds,
    });
  }

  /** Single poll for human-in-the-loop resolution (approved / rejected / expired). */
  async getDecisionOutcome(params: {
    decisionId: string;
    identityId: string;
  }): Promise<NoxyGetDecisionOutcomeResponse> {
    const raw = await this.transport.getDecisionOutcome({
      request_id: randomUUID(),
      decision_id: params.decisionId,
      identity_id: params.identityId,
    });
    return {
      request_id: raw.request_id,
      pending: raw.pending,
      outcome: parseHumanDecisionOutcome(raw.outcome),
    };
  }

  /**
   * Poll `GetDecisionOutcome` with exponential backoff until the human outcome is terminal
   * (approved, rejected, expired) or the relay sets `pending` to false.
   */
  async waitForDecisionOutcome(
    options: WaitForDecisionOutcomeOptions
  ): Promise<NoxyGetDecisionOutcomeResponse> {
    return waitForDecisionOutcome(
      (req) =>
        this.transport.getDecisionOutcome(req).then((raw) => ({
          request_id: raw.request_id,
          pending: raw.pending,
          outcome: parseHumanDecisionOutcome(raw.outcome),
        })),
      options
    );
  }

  /**
   * Calls {@link sendDecision} then {@link waitForDecisionOutcome} using the first delivery
   * that includes a non-empty `decision_id`. Use when a single human outcome applies to the routed batch.
   * `identityId` for polling is the same as `identityAddress`.
   */
  async sendDecisionAndWaitForOutcome(
    identityAddress: NoxyIdentityAddress,
    actionableDecision: Record<string, unknown>,
    options?: SendDecisionAndWaitOptions
  ): Promise<NoxyGetDecisionOutcomeResponse> {
    const deliveries = await this.sendDecision(identityAddress, actionableDecision);
    const withId = deliveries.find((d) => d.decision_id && d.decision_id.length > 0);
    if (!withId) {
      throw new SendDecisionAndWaitNoDecisionIdError();
    }
    return this.waitForDecisionOutcome({
      ...options,
      decisionId: withId.decision_id,
      identityId: identityAddress,
    });
  }

  /** Returns quota usage for your agent application. */
  async getQuota(): Promise<NoxyGetQuotaResponse> {
    return this.quota.get();
  }
}
