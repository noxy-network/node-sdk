import { NoxyKyberProvider } from '@/client/KyberProvider';
import { GrpcTransport } from '@/client/transport';
import type {
  NoxySendPushInput,
  NoxyPushResponse,
  NoxyPushNotificationRequest,
  NoxyEncryptedNotification,
  NoxyIdentityDevice,
} from '@/client/types';
import { generateRequestId } from '@/utils/request-id';
import { withRetry } from '@/utils/retries';
import { JSONStringify } from 'json-with-bigint';
import { randomBytes, hkdfSync, createCipheriv } from 'node:crypto';

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

export class PushService {
  constructor(
    private transport: GrpcTransport,
    private noxyKyberProvider: NoxyKyberProvider
  ) {}

  private async encryptNotification(devicePQPublicKey: Uint8Array, plaintext: Uint8Array): Promise<NoxyEncryptedNotification> {
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

  private async sendToNetwork(input: NoxySendPushInput): Promise<NoxyPushResponse> {
    const request: NoxyPushNotificationRequest = {
      request_id: generateRequestId(),
      ciphertext: Buffer.isBuffer(input.ciphertext) ? input.ciphertext : Buffer.from(input.ciphertext),
      ttl_seconds: input.ttl_seconds,
      target_device_id: input.target_device_id,
      kyber_ct: Buffer.isBuffer(input.kyber_ct) ? input.kyber_ct : Buffer.from(input.kyber_ct),
      nonce: Buffer.isBuffer(input.nonce) ? input.nonce : Buffer.from(input.nonce),
    };

    return withRetry(
      () => this.transport.pushNotification(request),
      3,
      isRetryableNetworkError
    );
  }

  async send(devices: NoxyIdentityDevice[], pushNotification: Record<string, unknown>, { ttlSeconds }: { ttlSeconds: number }): Promise<NoxyPushResponse[]> {
    const notificationBuffer = Buffer.from(JSONStringify(pushNotification));
    const results: NoxyPushResponse[] = [];

    for (const device of devices) {
      const pqKey = Buffer.isBuffer(device.pq_public_key)
        ? device.pq_public_key
        : Buffer.from(device.pq_public_key as ArrayLike<number>);
      const encryptedNotification = await this.encryptNotification(pqKey, notificationBuffer);
      const input: NoxyPushNotificationRequest = {
        request_id: generateRequestId(),
        ciphertext: encryptedNotification.ciphertext,
        ttl_seconds: ttlSeconds,
        target_device_id: device.device_id,
        kyber_ct: encryptedNotification.kyber_ct,
        nonce: encryptedNotification.nonce,
      };
      results.push(await this.sendToNetwork(input));
    }

    return results;
  }
}
