import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, it, expect } from 'vitest';
import { initNoxyClient } from '@/index';

beforeAll(async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const wasmPath = path.join(dir, '..', 'src', 'kyber', 'kyber.wasm');
  const buf = await readFile(wasmPath);
  (globalThis as unknown as Record<string, ArrayBuffer>).__NOXY_KYBER_WASM_BINARY__ =
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

describe('initNoxyClient', () => {
  it('returns a NoxyPushClient', async () => {
    const client = await initNoxyClient({
      endpoint: 'https://relay.noxy.network:443',
      authToken: 'test-token',
      notificationTtlSeconds: 86400,
    });

    expect(client).toBeDefined();
    expect(typeof client.sendPush).toBe('function');
    expect(typeof client.getQuota).toBe('function');
  });
});
