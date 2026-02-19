export type NoxyIdentityAddress = `0x${string}`;

export enum NoxyPushDeliveryStatus {
  DELIVERED = 0,
  QUEUED = 1,
  NO_DEVICES = 2,
  REJECTED = 3,
  ERROR = 4,
}

export interface NoxyPushNotificationRequest {
  request_id: string;
  ciphertext: Uint8Array;
  ttl_seconds: number;
  target_device_id: string;
  kyber_ct: Uint8Array;
  nonce: Uint8Array;
}

export type NoxySendPushInput = Omit<NoxyPushNotificationRequest, "request_id">;

export interface NoxyEncryptedNotification {
  kyber_ct: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface NoxyPushResponse {
  status: NoxyPushDeliveryStatus;
  request_id: string;
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
