import { GrpcTransport } from '@/client/transport';
import type { NoxyIdentityDevice, NoxyIdentityId } from '@/client/types';
import { generateRequestId } from '@/utils/request-id';

export class IdentityService {
  constructor(private transport: GrpcTransport) {}

  /** Relay `identity_id`: wallet (`0x…`), email, phone, app `user_id`, etc.—must match how devices are registered. */
  async getDevices(identityId: NoxyIdentityId): Promise<NoxyIdentityDevice[]> {
    const request = {
      request_id: generateRequestId(),
      identity_id: identityId,
    };
    const response = await this.transport.getIdentityDevices(request);
    return response.devices;
  }
}
