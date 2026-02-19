import { GrpcTransport } from '@/client/transport';
import type { NoxyGetQuotaResponse } from '@/client/types';
import { generateRequestId } from '@/utils/request-id';

export class QuotaService {
  constructor(private transport: GrpcTransport) {}

  async get(): Promise<NoxyGetQuotaResponse> {
    const request = { request_id: generateRequestId() };
    return this.transport.getQuota(request);
  }
}
