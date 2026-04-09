# @noxy-network/node-sdk

SDK for **AI agent runtimes** integrating with the [Noxy](https://noxy.network) **Decision Layer**: send encrypted, **actionable** decision payloads (tool proposals, approvals, next-step hints) to registered agent devices over gRPC.

**Before you integrate:** Create your app at [noxy.network](https://noxy.network). When the app is created, you receive an **app id** and an **app token** (auth token). This Node SDK authenticates with the relay using the **app token** (`authToken` in the client config). The **app id** is used by client SDKs (browser, iOS, Android, Telegram bot), not as the bearer token here.

## Overview

Use this SDK to:

- **Route decisions** to devices bound to a Web3 identity (`0x…` address) — structured JSON you define (e.g. proposed tool calls, parameters, user-visible summaries).
- **Receive delivery outcomes** from the relay (`DELIVERED`, `QUEUED`, `NO_DEVICES`, etc.) plus a **`decision_id`** when the relay accepts the route.
- **Wait for human-in-the-loop resolution** — the wallet user **approves**, **rejects**, or the decision **expires**. The usual path is **`sendDecisionAndWaitForOutcome`** (route + poll in one step). Use `getDecisionOutcome` / `waitForDecisionOutcome` alone for finer control.
- **Query quota** for your agent application on the relay.
- **Resolve identity devices** so each device receives its own encrypted copy of the decision.

The wire API uses **`agent.proto`** (`noxy.agent.AgentService`): `RouteDecision`, `GetDecisionOutcome`, `GetQuota`, `GetIdentityDevices`.

Communication is **gRPC over TLS** with Bearer authentication. Payloads are **encrypted end-to-end** (Kyber + AES-256-GCM) per device before leaving your process; the relay sees ciphertext only.

## Architecture

The **encrypted path** covers **SDK → relay** and **relay → device**: decision content is ciphertext on both hops; the relay forwards without decrypting.

```
                      Ciphertext only (E2E)                  Ciphertext only (E2E)
┌──────────────────┐     gRPC (TLS)      ┌─────────────────┐     gRPC (TLS), WSS  ┌──────────────────┐
│  AI agent /      │ ◄─────────────────► │  Noxy relay     │ ◄──────────────────► │  Agent device    │
│  orchestrator    │   RouteDecision     │  (Decision      │                      │  (human approves │
│  (this SDK)      │   GetDecisionOutcome│   Layer)        │                      │   or rejects)    │
│                  │   GetQuota          │   forwards only │                      │   decrypts       │
│                  │   GetIdentityDevices│                 │                      │                  │
└──────────────────┘                     └─────────────────┘                      └──────────────────┘
```

## Requirements

- Node.js **>= 22**
- ESM (`"type": "module"`)

## Installation

```bash
npm install @noxy-network/node-sdk
# or
pnpm add @noxy-network/node-sdk
```

## Quick start

Route a decision and wait until the user **approves**, **rejects**, or the decision **expires** (one call):

```typescript
import { initNoxyAgentClient, NoxyHumanDecisionOutcome } from '@noxy-network/node-sdk';

const client = await initNoxyAgentClient({
  endpoint: 'https://relay.noxy.network',
  authToken: 'your-api-token',
  decisionTtlSeconds: 3600,
});

const identity = '0x...';

const resolution = await client.sendDecisionAndWaitForOutcome(identity, {
  kind: 'propose_tool_call',
  tool: 'transfer_funds',
  args: { to: '0x000000000000000000000000000000000000dEaD', amountWei: '1' },
  title: 'Transfer 1 wei to the burn address',
  summary: 'The agent is requesting approval to send 1 wei to the burn address.',
});

if (resolution.outcome === NoxyHumanDecisionOutcome.APPROVED) {
  // run the proposed action
} else {
  // REJECTED, EXPIRED, or non-approved — do not run the action (optionally branch on outcome)
}
```

`resolution.outcome` is always a **`NoxyHumanDecisionOutcome`** (normalized from the relay: string enums from gRPC are mapped to `0`–`3`). **`APPROVED`** → continue; anything else → stop or fallback. Use **`isTerminalHumanOutcome(outcome)`** for “finalized vs still pending”; for one-off **`getDecisionOutcome`** polls, also read **`pending`**.

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `endpoint` | `string` | Yes | Relay gRPC endpoint (e.g. `https://relay.noxy.network`). `https://` is stripped; TLS is used. |
| `authToken` | `string` | Yes | Bearer token for relay auth (`Authorization` header). |
| `decisionTtlSeconds` | `number` | Yes | TTL for routed decisions (seconds). |

## SendDecisionAndWaitOptions

Optional third argument to **`sendDecisionAndWaitForOutcome`**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `initialPollIntervalMs` | `number` | No | Delay after the first poll before the next attempt (ms). Default `400`. |
| `maxPollIntervalMs` | `number` | No | Maximum delay between polls (ms). Default `30000`. |
| `maxWaitMs` | `number` | No | Total time budget for polling (ms). Default `900000` (15 minutes). Exceeded → `WaitForDecisionOutcomeTimeoutError`. |
| `backoffMultiplier` | `number` | No | Multiplier applied to the poll interval after each attempt. Default `1.6`. |
| `signal` | `AbortSignal` | No | When aborted, polling stops with an `AbortError`. |

## API

### `initNoxyAgentClient(config): Promise<NoxyAgentClient>`

Async init (loads Kyber WASM for post-quantum encapsulation).

### `NoxyAgentClient`

#### `sendDecision(identityAddress, actionableDecision): Promise<NoxyDeliveryOutcome[]>`

Routes an encrypted decision to every device registered for the identity.

- **Returns** per device: relay **`status`** (`DELIVERED`, `QUEUED`, `NO_DEVICES`, …), **`request_id`**, and **`decision_id`** when the relay can track human resolution (use with `GetDecisionOutcome`).

#### `getDecisionOutcome({ decisionId, identityId })`

Single poll for human-in-the-loop state (`pending` + `outcome`).

#### `sendDecisionAndWaitForOutcome(identityAddress, actionableDecision, options?)`

Runs `sendDecision`, then `waitForDecisionOutcome` using the **first** delivery that has a non-empty `decision_id`. Polling uses `identityAddress` as `identityId`. Optional `options` is `SendDecisionAndWaitOptions` (same as `WaitForDecisionOutcomeOptions` without `decisionId` or `identityId` — e.g. `maxWaitMs`, backoff, `signal`).

- **Returns** `NoxyGetDecisionOutcomeResponse` (same as `waitForDecisionOutcome`). Throws `SendDecisionAndWaitNoDecisionIdError` if no `decision_id` was returned.

#### `waitForDecisionOutcome(options)`

Polls with **exponential backoff** (configurable `initialPollIntervalMs`, `maxPollIntervalMs`, `backoffMultiplier`) until:

- `outcome` is **APPROVED**, **REJECTED**, or **EXPIRED**, or
- `pending` becomes `false`, or
- **`maxWaitMs`** is exceeded → throws `WaitForDecisionOutcomeTimeoutError`.

Options: `decisionId`, `identityId`, `initialPollIntervalMs` (default `400`), `maxPollIntervalMs` (default `30000`), `maxWaitMs` (default `900000`), `backoffMultiplier` (default `1.6`), optional `AbortSignal`.

#### `getQuota(): Promise<NoxyGetQuotaResponse>`

Quota usage for the application.

### Lower-level helpers (also exported)

- `waitForDecisionOutcome(fetch, options)` — pass your own `GetDecisionOutcome` caller if needed.
- `parseHumanDecisionOutcome`, `isTerminalHumanOutcome`
- `WaitForDecisionOutcomeTimeoutError`

### Types

- **`NoxyDeliveryStatus`**: `DELIVERED` | `QUEUED` | `NO_DEVICES` | `REJECTED` | `ERROR`
- **`NoxyHumanDecisionOutcome`**: `PENDING` | `APPROVED` | `REJECTED` | `EXPIRED`
- **`NoxyQuotaStatus`**: `QUOTA_ACTIVE` | `QUOTA_SUSPENDED` | `QUOTA_DELETED`

## Encryption (summary)

1. Kyber768 encapsulation per device `pq_public_key`.
2. HKDF-SHA256 → AES-256-GCM key; random 12-byte nonce.
3. JSON payload encrypted; only `kyber_ct`, `nonce`, `ciphertext` cross the relay.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

## License

MIT
