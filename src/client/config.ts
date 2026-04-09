/** Configuration for the Noxy Decision Layer client (AI agent runtime). */
export interface NoxyConfig {
  /** Noxy relay gRPC endpoint (e.g. `https://relay.noxy.network`). */
  endpoint: string;
  /** Bearer token for relay authentication. */
  authToken: string;
  /** Time-to-live for routed decisions in seconds. */
  decisionTtlSeconds: number;
}
