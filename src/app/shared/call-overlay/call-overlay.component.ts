import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild, type ElementRef } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { peerOf, type ActiveCall } from '../../core/models/call.model';
import { CallService } from '../../core/services/call.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Call UI, mounted once in the application shell so an incoming call rings on any page.
 *
 * Only presentation lives here: every rule (who may call whom, one call at a time,
 * media teardown) is enforced by `CallService`.
 */
@Component({
  selector: 'app-call-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, AvatarComponent],
  template: `
    @if (calls.phase() !== 'idle' && call(); as activeCall) {
      <div class="call" role="dialog" aria-modal="true" [attr.aria-label]="'call.title' | t">
        @if (calls.phase() === 'incoming') {
          <div class="call__card call__card--incoming">
            <app-avatar [name]="peer().displayName" size="lg" />
            <p class="call__eyebrow">
              {{ (activeCall.type === 'VIDEO' ? 'call.incomingVideo' : 'call.incoming') | t }}
            </p>
            <h2 class="call__name">{{ peer().displayName }}</h2>
            <div class="call__actions">
              <button type="button" class="call-btn call-btn--accept" (click)="calls.accept()">
                <app-icon name="phone" [size]="19" />
                {{ 'call.accept' | t }}
              </button>
              <button type="button" class="call-btn call-btn--decline" (click)="calls.reject()">
                <app-icon name="phone-off" [size]="19" />
                {{ 'call.reject' | t }}
              </button>
            </div>
          </div>
        } @else {
          <div class="call__card call__card--stage">
            <header class="call__header">
              <div class="call__headline">
                <span class="call__status" role="status">{{ statusKey() | t }}</span>
                @if (calls.phase() === 'connected') {
                  <span class="call__timer">{{ duration() }}</span>
                }
              </div>
              <h2 class="call__name">{{ peer().displayName }}</h2>
            </header>

            <div class="call__stage">
              @if (activeCall.type === 'VIDEO' && calls.remoteStream()) {
                <video #remoteVideo class="call__remote" autoplay playsinline></video>
              } @else {
                <div class="call__placeholder">
                  <app-avatar [name]="peer().displayName" size="xl" />
                  <p>{{ peer().displayName }}</p>
                </div>
              }

              @if (activeCall.type === 'VIDEO' && calls.localStream() && !calls.cameraOff()) {
                <video #localVideo class="call__local" autoplay playsinline muted></video>
              }
            </div>

            @if (calls.phase() === 'ended' || calls.phase() === 'failed') {
              <p class="call__message" role="alert">{{ (calls.errorKey() ?? 'call.ended') | t }}</p>
              <button type="button" class="btn btn--outline" (click)="calls.dismiss()">
                {{ 'call.close' | t }}
              </button>
            } @else {
              <div class="call__controls">
                <button
                  type="button"
                  class="call-btn"
                  [class.call-btn--off]="calls.muted()"
                  [attr.aria-pressed]="calls.muted()"
                  [attr.aria-label]="(calls.muted() ? 'call.unmute' : 'call.mute') | t"
                  (click)="calls.toggleMute()"
                >
                  <app-icon [name]="calls.muted() ? 'mic-off' : 'mic'" [size]="20" />
                </button>

                @if (activeCall.type === 'VIDEO') {
                  <button
                    type="button"
                    class="call-btn"
                    [class.call-btn--off]="calls.cameraOff()"
                    [attr.aria-pressed]="calls.cameraOff()"
                    [attr.aria-label]="(calls.cameraOff() ? 'call.cameraOn' : 'call.cameraOff') | t"
                    (click)="calls.toggleCamera()"
                  >
                    <app-icon [name]="calls.cameraOff() ? 'video-off' : 'video'" [size]="20" />
                  </button>
                }

                <button
                  type="button"
                  class="call-btn call-btn--decline"
                  [attr.aria-label]="'call.hangUp' | t"
                  (click)="calls.hangUp()"
                >
                  <app-icon name="phone-off" [size]="20" />
                  <span class="call-btn__label">{{ 'call.hangUp' | t }}</span>
                </button>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    .call {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgb(9 22 16 / 72%);
      backdrop-filter: blur(3px);
    }

    .call__card {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      align-items: center;
      width: min(100%, 34rem);
      padding: clamp(1.2rem, 3vw, 1.8rem);
      border-radius: var(--r-xl, 1.4rem);
      background: var(--cream-50, #fff);
      box-shadow: 0 24px 60px rgb(6 20 13 / 35%);
      text-align: center;
    }

    .call__card--stage { align-items: stretch; }

    .call__header { text-align: start; }
    .call__headline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
    }
    .call__status {
      color: var(--forest-700);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .call__timer { color: var(--ink-600, var(--ink-500)); font-size: 0.85rem; font-variant-numeric: tabular-nums; }
    .call__eyebrow {
      margin: 0;
      color: var(--ink-500);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .call__name { margin: 0; color: var(--forest-900); font-size: 1.25rem; }

    .call__stage {
      position: relative;
      display: grid;
      place-items: center;
      overflow: hidden;
      min-height: min(52vh, 20rem);
      border-radius: var(--r-lg, 1rem);
      background: linear-gradient(160deg, var(--forest-850, #12496b), var(--forest-950, #072a3d));
      color: var(--cream-100, #f6f4ed);
    }
    .call__remote { width: 100%; height: min(52vh, 20rem); object-fit: cover; background: #072a3d; }
    .call__placeholder { display: grid; justify-items: center; gap: 0.6rem; padding: 1.5rem; }
    .call__placeholder p { margin: 0; font-weight: 700; }
    .call__local {
      position: absolute;
      inset-block-end: 0.7rem;
      inset-inline-end: 0.7rem;
      width: min(32%, 8.5rem);
      aspect-ratio: 3 / 4;
      border: 2px solid rgb(255 255 255 / 65%);
      border-radius: var(--r-md, 0.7rem);
      object-fit: cover;
      background: #072a3d;
    }

    .call__message { margin: 0; color: var(--ink-700); font-weight: 700; }

    .call__actions,
    .call__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      justify-content: center;
    }

    .call-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.65rem 1.1rem;
      border: 1px solid var(--line-strong, rgb(0 0 0 / 12%));
      border-radius: var(--r-pill, 999px);
      background: #fff;
      color: var(--ink-800);
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    }
    .call-btn--accept { border-color: transparent; background: var(--forest-700, #16587d); color: #fff; }
    .call-btn--decline { border-color: transparent; background: #c0453f; color: #fff; }
    .call-btn--off { background: var(--rose-50, #fdeaea); color: #8d2f2a; border-color: rgb(192 69 63 / 30%); }
    .call-btn__label { display: inline; }

    @media (max-width: 480px) {
      .call-btn__label { display: none; }
    }
  `,
})
export class CallOverlayComponent {
  protected readonly calls = inject(CallService);
  private readonly auth = inject(AuthService);

  private readonly remoteVideo = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  private readonly localVideo = viewChild<ElementRef<HTMLVideoElement>>('localVideo');

  protected readonly call = computed<ActiveCall | null>(() => this.calls.activeCall());

  protected readonly peer = computed(() => {
    const activeCall = this.call();
    return activeCall ? peerOf(activeCall, this.auth.user()?.id ?? '') : { id: '', displayName: '', avatarUrl: null };
  });

  protected readonly statusKey = computed(() => {
    switch (this.calls.phase()) {
      case 'outgoing':
        return 'call.outgoing';
      case 'connecting':
        return 'call.connecting';
      case 'connected':
        return 'call.connected';
      default:
        return this.calls.errorKey() ?? 'call.ended';
    }
  });

  protected readonly duration = computed(() => {
    const total = this.calls.elapsedSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  constructor() {
    // Open the signalling socket as soon as a session exists (and close it on sign-out),
    // so an incoming call rings regardless of which page the user is on.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.calls.connect();
      } else {
        this.calls.disconnect();
      }
    });

    // Media streams are plain DOM objects, so they must be attached imperatively.
    // Reading `phase()` too makes these effects re-run when the staged markup swaps.
    effect(() => {
      this.calls.phase();
      const element = this.remoteVideo()?.nativeElement;
      if (element) {
        element.srcObject = this.calls.remoteStream();
      }
    });

    effect(() => {
      this.calls.phase();
      const element = this.localVideo()?.nativeElement;
      if (element) {
        element.srcObject = this.calls.localStream();
      }
    });
  }
}
