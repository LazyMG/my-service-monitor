export enum CheckStatus {
  Up = 'UP',
  Down = 'DOWN',
}

export interface Target {
  id: number;
  name: string;
  url: string;
  checkInterval: number;
  enabled: boolean;
  createdAt: string;
}

export interface Check {
  id: number;
  targetId: number;
  checkedAt: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  certExpiresAt: string | null;
  errorMessage: string | null;
}

export type AlertType = 'cert_expiry' | 'down';

export interface Alert {
  id: number;
  targetId: number;
  type: AlertType;
  sentAt: string;
  resolvedAt: string | null;
}
