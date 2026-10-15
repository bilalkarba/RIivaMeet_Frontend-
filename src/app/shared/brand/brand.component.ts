import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Brand lockup: the RivaMeet emblem (navy tile, cyan waves, football) plus the
 * two-tone wordmark. The wordmark is a proper noun and is intentionally not
 * translated.
 */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  host: { '[class.is-dark]': 'onDark()' },
  template: `
    <a class="brand" routerLink="/" [attr.aria-label]="label()">
      <span class="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="32" height="32" role="presentation" focusable="false">
          <rect x="0" y="0" width="32" height="32" rx="9" fill="var(--mark-tile)" />
          <g fill="none" stroke="var(--mark-wave)" stroke-width="2" stroke-linecap="round">
            <path d="M4 9.5q3-3 6 0t6 0t6 0t6 0" />
            <path d="M4 15q3-3 6 0t6 0t6 0" opacity="0.72" />
          </g>
          <circle cx="23.4" cy="23" r="4.7" fill="var(--mark-ball)" />
          <path d="M23.4 20.7l2.3 1.7-.9 2.7h-2.8l-.9-2.7z" fill="var(--mark-patch)" />
        </svg>
      </span>
      <span class="brand__word"><span class="brand__word-lead">Riva</span>Meet</span>
    </a>
  `,
  styles: `
    :host {
      display: inline-flex;
      /* Emblem palette: navy tile, cyan waves, white football. */
      --mark-tile: var(--forest-900);
      --mark-wave: var(--lime-500);
      --mark-ball: #fff;
      --mark-patch: var(--forest-900);
    }

    /* On dark chrome (transparent header over the hero, footer, auth panel) the tile is
       knocked out so the mark keeps its contrast instead of merging with the panel. */
    :host(.is-dark) {
      --mark-tile: var(--cream-50);
      --mark-wave: var(--lime-700);
      --mark-ball: var(--forest-900);
      --mark-patch: var(--cream-50);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
    }

    .brand__mark {
      display: inline-flex;
      line-height: 0;
      filter: drop-shadow(0 6px 14px rgba(127, 221, 238, 0.38));
    }

    .brand__word {
      font-size: 1.24rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--forest-900);
    }

    /* Mirrors the two-tone wordmark of the emblem lockup. */
    .brand__word-lead {
      color: var(--lime-700);
    }

    :host(.is-dark) .brand__word {
      color: var(--cream-50);
    }

    :host(.is-dark) .brand__word-lead {
      color: var(--lime-400);
    }
  `,
})
export class BrandComponent {
  readonly onDark = input(false);
  readonly label = input('RivaMeet');
}
