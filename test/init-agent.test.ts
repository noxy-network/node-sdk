import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, it, expect } from 'vitest';
import { initNoxyAgentClient } from '@/index';

beforeAll(async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const wasmPath = path.join(dir, '..', 'src', 'kyber', 'kyber.wasm');
  const buf = await readFile(wasmPath);
  (globalThis as unknown as Record<string, ArrayBuffer>).__NOXY_KYBER_WASM_BINARY__ =
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

describe('initNoxyAgentClient', () => {
  it('returns a NoxyAgentClient with sendDecision and getQuota', async () => {
    const client = await initNoxyAgentClient({
      endpoint: 'https://relay.noxy.network',
      authToken: 'test-token',
      decisionTtlSeconds: 86400,
    });

    expect(client).toBeDefined();
    expect(typeof client.sendDecision).toBe('function');
    expect(typeof client.getDecisionOutcome).toBe('function');
    expect(typeof client.waitForDecisionOutcome).toBe('function');
    expect(typeof client.sendDecisionAndWaitForOutcome).toBe('function');
    expect(typeof client.getQuota).toBe('function');
  });
});
