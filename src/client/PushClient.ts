import { PushService } from '@/services/push.service';
import { QuotaService } from '@/services/quota.service';
import { IdentityService } from '@/services/identity.service';
import { NoxyKyberProvider } from '@/client/KyberProvider';
import { createGrpcTransport } from '@/client/transport';
import { NoxyConfig } from '@/client/config';
import type { NoxyIdentityAddress, NoxyPushResponse, NoxyGetQuotaResponse } from '@/client/types';

export class NoxyPushClient {
  private push!: PushService;
  private quota!: QuotaService;
  private identity!: IdentityService;

  private constructor(private config: NoxyConfig) {
    this.config = config;
  }

  static async init(config: NoxyConfig): Promise<NoxyPushClient> {
    const client = new NoxyPushClient(config);
    const transport = createGrpcTransport(config);
    const kyberProvider = await NoxyKyberProvider.create();

    client.push = new PushService(transport, kyberProvider);
    client.quota = new QuotaService(transport);
    client.identity = new IdentityService(transport);

    return client;
  }

  async sendPush(identityAddress: NoxyIdentityAddress, pushNotification: Record<string, unknown>): Promise<NoxyPushResponse[]> {
    const devices = await this.identity.getDevices(identityAddress);
    return this.push.send(devices, pushNotification, { ttlSeconds: this.config.notificationTtlSeconds });
  }

  async getQuota(): Promise<NoxyGetQuotaResponse> {
    return this.quota.get();
  }
}
