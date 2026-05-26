/**
 * Logical identity the relay resolves to registered devices (`GetIdentityDevices.identity_id`),
 * and the same value passed as `identity_id` when polling human outcomes.
 *
 * Typical forms depend on how your Noxy app links users to devices — for example Web3 wallet (`0x…`),
 * email, E.164 phone number, or an opaque application `user_id`.
 */
export type NoxyIdentityId = string;

/** Relay-side delivery status after `RouteDecision` (matches proto `DeliveryStatus`). */
export enum NoxyDeliveryStatus {
  DELIVERED = 0,
  QUEUED = 1,
  NO_DEVICES = 2,
  REJECTED = 3,
  ERROR = 4,
}

/** gRPC `RouteDecisionRequest` — encrypted actionable decision payload per device. */
export interface NoxyRouteDecisionRequest {
  request_id: string;
  ciphertext: Uint8Array;
  ttl_seconds: number;
  target_device_id: string;
  kyber_ct: Uint8Array;
  nonce: Uint8Array;
  decision_id: string;
}

export type NoxySendRouteDecisionInput = Omit<NoxyRouteDecisionRequest, 'request_id'>;

/** Encrypted decision blob before it is wrapped in a full request. */
export interface NoxyEncryptedDecision {
  kyber_ct: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

/**
 * Immediate result of `RouteDecision`: relay delivery status + ids for polling human outcome.
 * Use `decision_id` with `getDecisionOutcome` / `waitForDecisionOutcome` when status allows.
 */
export interface NoxyDeliveryOutcome {
  status: NoxyDeliveryStatus;
  request_id: string;
  /** Present when the relay accepted the route; use with `identity_id` to poll human approval. */
  decision_id: string;
}

/** Human-in-the-loop resolution (matches proto `DecisionOutcome`). */
export enum NoxyHumanDecisionOutcome {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  EXPIRED = 3,
}

export interface NoxyGetDecisionOutcomeRequest {
  request_id: string;
  decision_id: string;
  identity_id: string;
}

export interface NoxyGetDecisionOutcomeResponse {
  request_id: string;
  /** True while the user has not finalized approve/reject (or decision still in flight). */
  pending: boolean;
  /**
   * Human resolution from the relay, normalized to {@link NoxyHumanDecisionOutcome}.
   * Agents typically **continue** only when `APPROVED`; **stop or branch** on `REJECTED` or `EXPIRED`.
   */
  outcome: NoxyHumanDecisionOutcome;
}

export interface NoxyGetQuotaRequest {
  request_id: string;
}

export enum NoxyQuotaStatus {
  QUOTA_ACTIVE = 0,
  QUOTA_SUSPENDED = 1,
  QUOTA_DELETED = 2,
}

export interface NoxyGetQuotaResponse {
  request_id: string;
  app_name: string;
  quota_total: number;
  quota_remaining: number;
  status: NoxyQuotaStatus;
}

export interface NoxyGetIdentityDevicesRequest {
  request_id: string;
  identity_id: string;
}

export interface NoxyIdentityDevice {
  device_id: string;
  public_key: Uint8Array;
  pq_public_key: Uint8Array;
}

export interface NoxyGetIdentityDevicesResponse {
  request_id: string;
  devices: NoxyIdentityDevice[];
}
