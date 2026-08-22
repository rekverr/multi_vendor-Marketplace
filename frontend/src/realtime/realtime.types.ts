export interface RealtimeEnvelope {
  eventId: string;
  type: string;
  entityId: string;
  version: string | number;
  occurredAt: string;
  payload: unknown;
}
export type RealtimeConnection = "connecting" | "connected" | "disconnected";
