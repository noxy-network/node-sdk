# @noxy-network/node-sdk

Backend SDK for Node.js servers to integrate with the [Noxy](https://noxy.network) push notification network. Send encrypted push notifications to Web3 wallet addresses via the Noxy relay infrastructure.

## Overview

This SDK enables server-side applications to:

- **Send push notifications** to users by their Web3 wallet address (EVM `0x` format)
- **Query quota usage** for your application's relay allocation
- **Resolve identity devices** to deliver notifications to all registered devices

Communication with the Noxy relay is performed over **gRPC** using Protocol Buffers. All notifications are **encrypted end-to-end** on the backend before transmission; decryption occurs only on the recipient's Noxy device. The SDK uses **post-quantum encryption** (Kyber) to protect payloads against future quantum attacks.

## Architecture

```
┌─────────────────┐     gRPC (TLS)      ┌─────────────────┐     E2E Encrypted     ┌─────────────────┐
│  Your Backend   │ ◄─────────────────► │  Noxy Relay     │ ◄──────────────────► │  Noxy Device    │
│  (this SDK)     │   PushNotification  │                 │   Ciphertext only    │  (decrypts)      │
│                 │   GetQuota          │                 │                      │                 │
│                 │   GetIdentityDevices│                 │                      │                 │
└─────────────────┘                     └─────────────────┘                      └─────────────────┘
```

- **Encryption**: Kyber (post-quantum KEM) + AES-256-GCM. Each notification is encrypted per-device using the device's post-quantum public key.
- **Transport**: gRPC over TLS with Bearer token authentication.
- **Relay**: The Noxy relay forwards ciphertext only; it cannot decrypt notification payloads.

## Requirements

- Node.js **>= 22**
- ESM modules (`"type": "module"` in package.json)

## Installation

```bash
npm install @noxy-network/node-sdk
```

## Quick Start

```typescript
import { initNoxyClient } from '@noxy-network/node-sdk';

const client = await initNoxyClient({
  endpoint: 'https://relay.noxy.network:443',
  authToken: 'your-api-token',
  notificationTtlSeconds: 3600,
});

// Send a push notification to a wallet address
const results = await client.sendPush('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', {
  title: 'New message',
  body: 'You have a new notification',
  data: { action: 'open_chat', id: '123' },
});

// Check quota usage
const quota = await client.getQuota();
console.log(`${quota.quota_remaining} remaining`);
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `endpoint` | `string` | Yes | Noxy relay gRPC endpoint (e.g. `https://relay.noxy.network:443` or `localhost:4433`). Scheme is stripped; TLS is used by default. |
| `authToken` | `string` | Yes | Bearer token for relay authentication. Sent in the `Authorization` header on every request. |
| `notificationTtlSeconds` | `number` | Yes | Time-to-live for notifications in seconds. |

## API Reference

### `initNoxyClient(config: NoxyConfig): Promise<NoxyPushClient>`

Initializes the SDK client. This is asynchronous because it loads the Kyber WASM module for post-quantum encryption.

### `NoxyPushClient`

#### `sendPush(identityAddress, pushNotification): Promise<NoxyPushResponse[]>`

Sends a push notification to all devices registered for the given Web3 identity address.

- **`identityAddress`**: EVM address in `0x` format (e.g. `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1`)
- **`pushNotification`**: Arbitrary JSON-serializable object (e.g. `{ title, body, data }`). Encrypted before transmission.
- **Returns**: Array of `NoxyPushResponse` per device, with `status` and `request_id`.

#### `getQuota(): Promise<NoxyGetQuotaResponse>`

Returns quota usage for your application.

- **Returns**: `{ request_id, app_name, quota_total, quota_remaining, status }`

### Types

- **`NoxyPushDeliveryStatus`**: `DELIVERED` \| `QUEUED` \| `NO_DEVICES` \| `REJECTED` \| `ERROR`
- **`NoxyQuotaStatus`**: `QUOTA_ACTIVE` \| `QUOTA_SUSPENDED` \| `QUOTA_DELETED`

## Encryption Details

1. **Key encapsulation**: For each device, the SDK encapsulates a shared secret using the device's Kyber post-quantum public key (`pq_public_key`).
2. **Key derivation**: The shared secret is expanded via HKDF-SHA256 to a 256-bit AES key.
3. **Payload encryption**: The notification payload (JSON) is encrypted with AES-256-GCM. The ciphertext includes the GCM auth tag appended for integrity verification.
4. **Transmission**: Only `kyber_ct`, `nonce`, and `ciphertext` are sent to the relay. The relay cannot decrypt; only the target device (with its secret key) can decrypt.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

## License

MIT
