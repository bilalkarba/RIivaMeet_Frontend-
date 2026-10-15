/**
 * Call models.
 *
 * These mirror the payloads produced by the backend call presenters
 * (`src/utils/presenters.ts`) exactly. A call is always scoped to one booking
 * conversation, so the client never has to work out who is allowed to call whom -
 * the API rejects an unauthorized invite.
 */

export const CALL_TYPES = ['AUDIO', 'VIDEO'] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_STATUSES = [
  'RINGING',
  'ACCEPTED',
  'REJECTED',
  'MISSED',
  'CANCELLED',
  'ENDED',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export type CallDirection = 'OUTGOING' | 'INCOMING';

export interface CallParticipant {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/** A call as the API returns it, with `direction` resolved for the current user. */
export interface ActiveCall {
  id: string;
  conversationId: string;
  type: CallType;
  status: CallStatus;
  direction: CallDirection;
  caller: CallParticipant;
  callee: CallParticipant;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedById: string | null;
}

/** `GET /calls/config` — everything `RTCPeerConnection` needs. */
export interface CallConfig {
  iceServers: RTCIceServer[];
  /** How long the callee has to answer before the API marks the call MISSED. */
  ringTimeoutMs: number;
}

/** Local UI state machine. */
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'failed';

export type CallSignalKind = 'offer' | 'answer' | 'candidate';

/** Socket event envelope for `call:incoming` / `call:accepted` / … */
export interface CallEnvelope {
  call: ActiveCall;
}

/** Socket event envelope for `call:signal`. */
export interface CallSignalEnvelope {
  callId: string;
  kind: CallSignalKind;
  /** `{ sdp }` for offer/answer, `{ candidate }` for ICE candidates. */
  data: unknown;
  from: string;
}

/** The peer shown in the call window (the other participant). */
export function peerOf(call: ActiveCall, viewerId: string): CallParticipant {
  return call.caller.id === viewerId ? call.callee : call.caller;
}
