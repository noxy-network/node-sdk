import { loadPackageDefinition, credentials, Metadata } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { promisify } from 'node:util';
import { NoxyConfig } from '@/client/config';
import type {
  NoxyPushNotificationRequest,
  NoxyPushResponse,
  NoxyGetQuotaRequest,
  NoxyGetQuotaResponse,
  NoxyGetIdentityDevicesRequest,
  NoxyGetIdentityDevicesResponse,
} from '@/client/types';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const protoInDist = path.join(__dirname, 'proto', 'noxy.proto');
const protoInSrc = path.join(__dirname, '..', 'proto', 'noxy.proto');
const PROTO_PATH = existsSync(protoInDist) ? protoInDist : protoInSrc;

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = loadPackageDefinition(packageDefinition) as unknown as {
  noxy: { push: { PushService: new (address: string, creds: ReturnType<typeof credentials.createSsl>) => PushServiceClient } };
};

interface PushServiceClient {
  PushNotification: (req: unknown, metadata: Metadata, cb: (err: Error | null, res: unknown) => void) => unknown;
  GetQuota: (req: unknown, metadata: Metadata, cb: (err: Error | null, res: unknown) => void) => unknown;
  GetIdentityDevices: (req: unknown, metadata: Metadata, cb: (err: Error | null, res: unknown) => void) => unknown;
}

export interface GrpcTransport {
  pushNotification: (req: NoxyPushNotificationRequest) => Promise<NoxyPushResponse>;
  getQuota: (req: NoxyGetQuotaRequest) => Promise<NoxyGetQuotaResponse>;
  getIdentityDevices: (req: NoxyGetIdentityDevicesRequest) => Promise<NoxyGetIdentityDevicesResponse>;
}

function makeMetadata(authToken: string): Metadata {
  const metadata = new Metadata();
  metadata.set('authorization', `Bearer ${authToken}`);
  return metadata;
}

/** gRPC expects host:port only; strip https:// or http:// if present. */
function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function createGrpcTransport(config: NoxyConfig): GrpcTransport {
  const Client = proto.noxy.push.PushService;
  const address = normalizeEndpoint(config.endpoint);
  const channelCreds = credentials.createSsl();
  const client = new Client(address, channelCreds) as PushServiceClient;
  const metadata = makeMetadata(config.authToken);

  return {
    pushNotification: (req) =>
      promisify((r: unknown, cb: (err: Error | null, res: unknown) => void) =>
        client.PushNotification(r, metadata, cb)
      )(req) as Promise<NoxyPushResponse>,
    getQuota: (req) =>
      promisify((r: unknown, cb: (err: Error | null, res: unknown) => void) =>
        client.GetQuota(r, metadata, cb)
      )(req) as Promise<NoxyGetQuotaResponse>,
    getIdentityDevices: (req) =>
      promisify((r: unknown, cb: (err: Error | null, res: unknown) => void) =>
        client.GetIdentityDevices(r, metadata, cb)
      )(req) as Promise<NoxyGetIdentityDevicesResponse>,
  };
}
