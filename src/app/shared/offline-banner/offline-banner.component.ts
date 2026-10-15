import { Component, inject } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OfflinePreviewService } from '../../core/offline/offline-preview.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Makes sample data impossible to mistake for live data.
 *
 * It appears only after a real connection failure, on development builds only, and
 * stays on screen until the page is reloaded — it cannot be dismissed, because the
 * sample data underneath is still sample data.
 */
@Component({
  selector: 'app-offline-banner',
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (offline.active()) {
      <div class="offline" role="status">
        <span class="offline__icon" aria-hidden="true">
          <app-icon name="alert" [size]="18" />
        </span>
        <div class="offline__body">
          <p class="offline__title">
            <strong>{{ 'errors.offline.title' | t }}</strong>
            <span class="offline__chip">DEV</span>
          </p>
          <p class="offline__text">{{ 'errors.offline.message' | t }}</p>
        </div>
        <button type="button" class="btn btn--sm offline__retry" (click)="retry()">
          <app-icon name="refresh" [size]="15" />
          {{ 'errors.offline.retry' | t }}
        </button>
      </div>
    }
  `,
  styles: `
    .offline {
      position: relative;
      z-index: 70;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.65rem clamp(1rem, 0.4rem + 2vw, 2rem);
      background: var(--amber-50);
      border-block-end: 1px solid rgba(217, 139, 15, 0.3);
      color: #7a4d05;
    }

    .offline__icon {
      display: grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 50%;
      background: rgba(217, 139, 15, 0.16);
      flex: none;
    }

    .offline__body {
      flex: 1 1 22rem;
      min-width: 0;
    }

    .offline__title {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.88rem;
    }

    .offline__chip {
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      background: rgba(217, 139, 15, 0.22);
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.1em;
    }

    .offline__text {
      font-size: 0.79rem;
      opacity: 0.9;
    }

    .offline__retry {
      --btn-bg: #fff;
      --btn-fg: #7a4d05;
      flex: none;
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly offline = inject(OfflinePreviewService);

  /** Reloading re-runs every request, which is the only way to leave preview mode. */
  protected retry(): void {
    globalThis.location?.reload();
  }
}
