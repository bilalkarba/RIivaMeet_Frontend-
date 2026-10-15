import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../ui/notification.service';
import type {
  ActiveCall,
  CallConfig,
  CallEnvelope,
  CallPhase,
  CallSignalEnvelope,
  CallStatus,
  CallType,
} from '../models/call.model';

interface AckResponse {
  ok: boolean;
  call?: ActiveCall;
  error?: string;
}

interface SdpPayload {
  sdp: RTCSessionDescriptionInit;
}

interface CandidatePayload {
  candidate: RTCIceCandidateInit;
}

const STUN_ONLY: CallConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  ringTimeoutMs: 45000,
};

/**
 * Audio / video calls.
 *
 * Transport: a dedicated Socket.IO connection authenticated with the same JWT as the
 * REST API (the backend validates it during the handshake). Media is peer-to-peer
 * (WebRTC); the server only relays SDP offers/answers and ICE candidates between the
 * two participants and never sees the media.
 *
 * Signal flow (the callee offers, so the caller never has to buffer an SDP before the
 * callee is ready):
 *   caller:  invite  ─────────────▶  (RINGING)
 *   callee:  accept, getUserMedia, createOffer  ──▶ caller
 *   caller:  getUserMedia, setRemote(offer), createAnswer ──▶ callee
 *   both:    trickle ICE candidates
 *
 * Responsibilities kept here, not in components:
 *  - one call at a time (a second incoming invite is auto-declined);
 *  - media lifecycle (tracks are always stopped, peer connections always closed);
 *  - permission / missing-device / connection failures mapped to translation keys.
 *
 * The service lives for the whole app session, so a call survives navigation, but no
 * stream keeps running after a call ends.
 */
@Injectable({ providedIn: 'root' })
export class CallService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  private socket: Socket | null = null;
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private config: CallConfig | null = null;
  /** ICE candidates that arrived before `setRemoteDescription`. */
  private queuedCandidates: RTCIceCandidateInit[] = [];
  private endTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private ticker: ReturnType<typeof globalThis.setInterval> | null = null;

  readonly phase = signal<CallPhase>('idle');
  readonly activeCall = signal<ActiveCall | null>(null);
  /** Translation key for the current failure/terminal message, or null. */
  readonly errorKey = signal<string | null>(null);
  readonly localStream = signal<MediaStream | null>(null);
  readonly remoteStream = signal<MediaStream | null>(null);
  readonly muted = signal(false);
  readonly cameraOff = signal(false);
  readonly elapsedSeconds = signal(0);

  /** True while the UI should show a call (ringing, connecting or connected). */
  readonly busy = computed(() => {
    const phase = this.phase();
    return phase === 'outgoing' || phase === 'incoming' || phase === 'connecting' || phase === 'connected';
  });

  constructor() {
    this.connect();
  }

  // --- Connection -----------------------------------------------------------

  /** Establish the signalling socket once a session exists. Safe to call repeatedly. */
  connect(): void {
    if (this.socket) {
      return;
    }
    const token = this.auth.token();
    if (!token) {
      return;
    }

    const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
    const socket = io(apiOrigin, { auth: { token }, path: '/socket.io' });
    this.socket = socket;

    socket.on('call:incoming', (payload: CallEnvelope) => this.onIncoming(payload.call));
    socket.on('call:accepted', (payload: CallEnvelope) => this.onAccepted(payload.call));
    socket.on('call:rejected', (payload: CallEnvelope) => this.finish(terminalKey(payload.call.status)));
    socket.on('call:ended', (payload: CallEnvelope) => this.finish(terminalKey(payload.call.status)));
    socket.on('call:signal', (payload: CallSignalEnvelope) => {
      void this.onSignal(payload);
    });
    socket.on('disconnect', () => {
      if (this.busy()) {
        this.finish('call.signallingFailed');
      }
    });
  }

  /** Drop the socket (used on sign-out). Never leaves media running. */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.finish(null);
  }

  // --- Outgoing -------------------------------------------------------------

  startAudioCall(conversationId: string): Promise<void> {
    return this.startCall(conversationId, 'AUDIO');
  }

  startVideoCall(conversationId: string): Promise<void> {
    return this.startCall(conversationId, 'VIDEO');
  }

  async startCall(conversationId: string, type: CallType): Promise<void> {
    if (this.busy()) {
      this.notifications.error('call.busy');
      return;
    }
    if (!this.isSupported()) {
      this.notifications.error('call.unsupported');
      return;
    }

    this.connect();
    if (!this.socket) {
      this.notifications.error('call.signallingFailed');
      return;
    }

    this.errorKey.set(null);
    if (!(await this.ensureConfig())) {
      return;
    }
    if (!(await this.acquireMedia(type))) {
      return;
    }

    const response = await this.emitAck<AckResponse>('call:invite', { conversationId, type });
    if (!response?.ok || !response.call) {
      this.releaseMedia();
      this.notifications.error('call.notAvailable');
      return;
    }

    this.activeCall.set(response.call);
    this.phase.set('outgoing');
  }

  // --- Incoming -------------------------------------------------------------

  private onIncoming(call: ActiveCall): void {
    if (this.busy()) {
      // Already on a call: decline politely so the caller is not left ringing.
      void this.emitAck('call:reject', { callId: call.id });
      return;
    }
    this.clearEndTimer();
    this.errorKey.set(null);
    this.activeCall.set(call);
    this.phase.set('incoming');
  }

  async accept(): Promise<void> {
    const call = this.activeCall();
    if (!call || this.phase() !== 'incoming') {
      return;
    }
    if (!this.isSupported()) {
      this.finish('call.unsupported');
      return;
    }
    if (!(await this.ensureConfig()) || !(await this.acquireMedia(call.type))) {
      return;
    }

    this.phase.set('connecting');
    const response = await this.emitAck<AckResponse>('call:accept', { callId: call.id });
    if (!response?.ok) {
      this.finish('call.signallingFailed');
      return;
    }

    // The callee offers: the caller creates its peer connection on the offer.
    await this.createPeerConnection(call);
    await this.sendOffer(call);
  }

  async reject(): Promise<void> {
    const call = this.activeCall();
    if (call) {
      await this.emitAck('call:reject', { callId: call.id });
    }
    this.finish(null);
  }

  async hangUp(): Promise<void> {
    const call = this.activeCall();
    if (call) {
      await this.emitAck('call:end', { callId: call.id });
    }
    this.finish(null);
  }

  // --- Media controls -------------------------------------------------------

  toggleMute(): void {
    const stream = this.stream;
    if (!stream) {
      return;
    }
    const next = !this.muted();
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.muted.set(next);
  }

  toggleCamera(): void {
    const stream = this.stream;
    if (!stream) {
      return;
    }
    const next = !this.cameraOff();
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.cameraOff.set(next);
  }

  // --- WebRTC ---------------------------------------------------------------

  private async sendOffer(call: ActiveCall): Promise<void> {
    const peer = this.peer;
    if (!peer) {
      this.finish('call.signallingFailed');
      return;
    }
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await this.emitAck('call:signal', { callId: call.id, kind: 'offer', data: { sdp: peer.localDescription } });
  }

  private async createPeerConnection(call: ActiveCall): Promise<void> {
    if (this.peer) {
      return;
    }
    const config = this.config ?? STUN_ONLY;
    const peer = new RTCPeerConnection({ iceServers: config.iceServers });
    this.peer = peer;

    const stream = this.stream;
    if (stream) {
      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void this.emitAck('call:signal', {
          callId: call.id,
          kind: 'candidate',
          data: { candidate: event.candidate.toJSON() },
        });
      }
    };

    peer.ontrack = (event) => {
      const [incoming] = event.streams;
      this.remoteStream.set(incoming ?? new MediaStream([event.track]));
    };

    peer.onconnectionstatechange = () => {
      switch (peer.connectionState) {
        case 'connected':
          this.phase.set('connected');
          this.startTicker();
          break;
        case 'failed':
          this.finish('call.connectionFailed');
          break;
        default:
          break;
      }
    };
  }

  private async onSignal(envelope: CallSignalEnvelope): Promise<void> {
    const call = this.activeCall();
    if (!call || envelope.callId !== call.id) {
      return;
    }

    if (!this.peer) {
      await this.createPeerConnection(call);
    }
    const peer = this.peer;
    if (!peer) {
      return;
    }

    try {
      if (envelope.kind === 'offer') {
        this.phase.set('connecting');
        const { sdp } = envelope.data as SdpPayload;
        await peer.setRemoteDescription(sdp);
        await this.flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await this.emitAck('call:signal', { callId: call.id, kind: 'answer', data: { sdp: peer.localDescription } });
        return;
      }

      if (envelope.kind === 'answer') {
        const { sdp } = envelope.data as SdpPayload;
        await peer.setRemoteDescription(sdp);
        await this.flushCandidates();
        return;
      }

      const { candidate } = envelope.data as CandidatePayload;
      if (!candidate) {
        return;
      }
      if (peer.remoteDescription) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      } else {
        this.queuedCandidates.push(candidate);
      }
    } catch {
      this.finish('call.connectionFailed');
    }
  }

  private async flushCandidates(): Promise<void> {
    const peer = this.peer;
    if (!peer) {
      return;
    }
    const queued = this.queuedCandidates;
    this.queuedCandidates = [];
    for (const candidate of queued) {
      await peer.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private onAccepted(call: ActiveCall): void {
    this.activeCall.set(call);
    this.phase.set('connecting');
  }

  // --- Setup helpers --------------------------------------------------------

  private async ensureConfig(): Promise<boolean> {
    if (this.config) {
      return true;
    }
    try {
      this.config = await firstValueFrom(this.api.getData<CallConfig>('/calls/config'));
      return true;
    } catch {
      this.notifications.error('call.signallingFailed');
      return false;
    }
  }

  private async acquireMedia(type: CallType): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints =
        type === 'VIDEO'
          ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.localStream.set(stream);
      this.muted.set(false);
      this.cameraOff.set(type !== 'VIDEO');
      return true;
    } catch (error) {
      this.phase.set('failed');
      this.errorKey.set(mediaErrorKey(error));
      return false;
    }
  }

  private releaseMedia(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.localStream.set(null);
    this.muted.set(false);
    this.cameraOff.set(false);
  }

  // --- Teardown -------------------------------------------------------------

  /** Terminal state: stop media, close the peer, show a message, then reset. */
  private finish(key: string | null): void {
    this.peer?.close();
    this.peer = null;
    this.queuedCandidates = [];
    this.releaseMedia();
    this.remoteStream.set(null);
    this.stopTicker();
    this.elapsedSeconds.set(0);

    if (key) {
      this.errorKey.set(key);
    }
    if (this.activeCall()) {
      this.phase.set('ended');
    } else {
      this.phase.set('idle');
    }

    this.clearEndTimer();
    this.endTimer = globalThis.setTimeout(() => this.dismiss(), 2500);
  }

  /** Close the call window and return to idle (also used by the UI's close button). */
  dismiss(): void {
    this.clearEndTimer();
    this.activeCall.set(null);
    this.errorKey.set(null);
    this.phase.set('idle');
  }

  private clearEndTimer(): void {
    if (this.endTimer !== null) {
      globalThis.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  private startTicker(): void {
    this.stopTicker();
    this.elapsedSeconds.set(0);
    this.ticker = globalThis.setInterval(() => this.elapsedSeconds.update((value) => value + 1), 1000);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      globalThis.clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  /**
   * Emit with an acknowledgement, resolving `null` on timeout so a dropped socket can
   * never leave the UI waiting forever.
   */
  private emitAck<T>(event: string, payload: unknown, timeoutMs = 10000): Promise<T | null> {
    const socket = this.socket;
    if (!socket) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const timer = globalThis.setTimeout(() => resolve(null), timeoutMs);
      socket.emit(event, payload, (response: T) => {
        globalThis.clearTimeout(timer);
        resolve(response);
      });
    });
  }
}

function terminalKey(status: CallStatus): string {
  switch (status) {
    case 'MISSED':
      return 'call.missed';
    case 'CANCELLED':
      return 'call.cancelled';
    case 'REJECTED':
      return 'call.declined';
    default:
      return 'call.ended';
  }
}

function mediaErrorKey(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'call.permissionDenied';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'NotReadableError':
      return 'call.deviceUnavailable';
    default:
      return 'call.mediaFailed';
  }
}
