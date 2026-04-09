import { NoxyKyberProvider } from '@/client/KyberProvider';
import { GrpcTransport } from '@/client/transport';
import type {
  NoxySendRouteDecisionInput,
  NoxyDeliveryOutcome,
  NoxyRouteDecisionRequest,
  NoxyEncryptedDecision,
  NoxyIdentityDevice,
  NoxyDeliveryStatus,
} from '@/client/types';
import { generateRequestId } from '@/utils/request-id';
import { withRetry } from '@/utils/retries';
import { JSONStringify } from 'json-with-bigint';
import { randomBytes, randomUUID, hkdfSync, createCipheriv } from 'node:crypto';

/** gRPC status codes that indicate retryable network/unavailable errors. */
const RETRYABLE_GRPC_CODES = new Set([2, 4, 8, 14]); // UNKNOWN, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, UNAVAILABLE

/** Node.js network error codes. */
const RETRYABLE_NODE_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ENETUNREACH',
  'EAI_AGAIN', 'EPIPE', 'ENETRESET', 'EHOSTUNREACH',
]);

function isRetryableNetworkError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: number | string }).code;
    if (typeof code === 'number' && RETRYABLE_GRPC_CODES.has(code)) return true;
    if (typeof code === 'string' && RETRYABLE_NODE_CODES.has(code)) return true;
  }
  return false;
}

function mapDeliveryOutcome(raw: unknown): NoxyDeliveryOutcome {
  const r = raw as Record<string, unknown>;
  return {
    status: Number(r.status ?? 0) as NoxyDeliveryStatus,
    request_id: String(r.request_id ?? ''),
    decision_id: String(r.decision_id ?? ''),
  };
}

/**
 * Encrypts and routes actionable decision payloads to devices via the Noxy Decision Layer.
 * Payloads are JSON (e.g. proposed tool calls, approvals, next-step hints for the agent runtime).
 */
export class DecisionService {
  constructor(
    private transport: GrpcTransport,
    private noxyKyberProvider: NoxyKyberProvider
  ) {}

  private async encryptDecision(devicePQPublicKey: Uint8Array, plaintext: Uint8Array): Promise<NoxyEncryptedDecision> {
    const { ciphertext: kyberCt, sharedSecret } = this.noxyKyberProvider.encapsulate(devicePQPublicKey);
    const key = Buffer.from(
      hkdfSync('sha256', Buffer.from(sharedSecret), Buffer.alloc(0), Buffer.alloc(0), 32)
    );
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

    return {
      kyber_ct: kyberCt,
      nonce: new Uint8Array(nonce),
      ciphertext: new Uint8Array(ciphertext),
    };
  }

  private async sendToNetwork(input: NoxySendRouteDecisionInput): Promise<NoxyDeliveryOutcome> {
    const request: NoxyRouteDecisionRequest = {
      request_id: generateRequestId(),
      ciphertext: Buffer.isBuffer(input.ciphertext) ? input.ciphertext : Buffer.from(input.ciphertext),
      ttl_seconds: input.ttl_seconds,
      target_device_id: input.target_device_id,
      kyber_ct: Buffer.isBuffer(input.kyber_ct) ? input.kyber_ct : Buffer.from(input.kyber_ct),
      nonce: Buffer.isBuffer(input.nonce) ? input.nonce : Buffer.from(input.nonce),
      decision_id: input.decision_id,
    };

    const raw = await withRetry(
      () => this.transport.routeDecision(request),
      3,
      isRetryableNetworkError
    );
    const mapped = mapDeliveryOutcome(raw);
    if (!mapped.decision_id && input.decision_id) {
      return { ...mapped, decision_id: input.decision_id };
    }
    return mapped;
  }

  /**
   * Route an actionable decision to every device registered for the identity.
   * `decision` should describe what the agent proposes (e.g. tools, parameters, user-visible summary).
   */
  async send(
    devices: NoxyIdentityDevice[],
    decision: Record<string, unknown>,
    { ttlSeconds }: { ttlSeconds: number }
  ): Promise<NoxyDeliveryOutcome[]> {
    const decisionId = randomUUID();
    const payloadBuffer = Buffer.from(JSONStringify(decision));
    const results: NoxyDeliveryOutcome[] = [];

    for (const device of devices) {
      const pqKey = Buffer.isBuffer(device.pq_public_key)
        ? device.pq_public_key
        : Buffer.from(device.pq_public_key as ArrayLike<number>);
      const encrypted = await this.encryptDecision(pqKey, payloadBuffer);
      const input: NoxySendRouteDecisionInput = {
        ciphertext: encrypted.ciphertext,
        ttl_seconds: ttlSeconds,
        target_device_id: device.device_id,
        kyber_ct: encrypted.kyber_ct,
        nonce: encrypted.nonce,
        decision_id: decisionId,
      };
      results.push(await this.sendToNetwork(input));
    }

    return results;
  }
}
