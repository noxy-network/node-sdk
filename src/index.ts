import type { NoxyConfig } from '@/client/config';
import { NoxyPushClient } from '@/client/PushClient';

export async function initNoxyClient(config: NoxyConfig): Promise<NoxyPushClient> {
  const client = await NoxyPushClient.init(config);
  return client;
}