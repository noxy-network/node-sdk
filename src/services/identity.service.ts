import { GrpcTransport } from '@/client/transport';
import type { NoxyIdentityDevice } from '@/client/types';
import { generateRequestId } from '@/utils/request-id';

export class IdentityService {
  constructor(private transport: GrpcTransport) {}

  async getDevices(identityId: string): Promise<NoxyIdentityDevice[]> {
    const request = {
      request_id: generateRequestId(),
      identity_id: identityId,
    };
    const response = await this.transport.getIdentityDevices(request);
    return response.devices;
  }
}
