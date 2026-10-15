import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export type ImageTone = 'forest' | 'lime' | 'sky' | 'sand';

/**
 * Image with a graceful fallback.
 *
 * Photography is loaded from a remote CDN, so it can be slow, blocked or unavailable.
 * Instead of showing a broken-image icon this component paints a branded gradient with
 * an optional monogram underneath, and only reveals the `<img>` once it has decoded.
 * State is keyed by source URL, which keeps the component correct if the input changes.
 */
@Component({
  selector: 'app-smart-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [style.aspect-ratio]="ratio()" [class.frame--circle]="shape() === 'circle'">
      <div class="placeholder" [attr.data-tone]="tone()" aria-hidden="true">
        @if (initials()) {
          <span class="placeholder__initials">{{ initials() }}</span>
        }
      </div>
      @if (showImage()) {
        <img
          [src]="source()!"
          [alt]="alt()"
          [class.is-loaded]="isLoaded()"
          loading="lazy"
          decoding="async"
          (load)="markLoaded()"
          (error)="markFailed()"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .frame {
      position: relative;
      overflow: hidden;
      border-radius: inherit;
      background: var(--forest-850);
      isolation: isolate;
    }

    .frame--circle {
      border-radius: 50%;
    }

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 420ms var(--ease);
    }

    img.is-loaded {
      opacity: 1;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: linear-gradient(140deg, var(--forest-800), var(--forest-950) 70%);
      border-radius: inherit;
    }

    .placeholder[data-tone='lime'] {
      background: linear-gradient(140deg, var(--lime-400), var(--lime-700));
    }

    .placeholder[data-tone='sky'] {
      background: linear-gradient(140deg, var(--lime-700), var(--forest-800));
    }

    .placeholder[data-tone='sand'] {
      background: linear-gradient(140deg, var(--cream-200), var(--cream-300));
    }

    .placeholder::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 0);
      background-size: 18px 18px;
      opacity: 0.5;
    }

    .placeholder__initials {
      position: relative;
      z-index: 1;
      font-weight: 800;
      font-size: clamp(1rem, 0.6rem + 1.4vw, 1.7rem);
      letter-spacing: 0.06em;
      color: rgba(252, 251, 247, 0.9);
    }

    .placeholder[data-tone='lime'] .placeholder__initials {
      color: var(--forest-950);
    }

    .placeholder[data-tone='sand'] .placeholder__initials {
      color: var(--forest-800);
    }
  `,
})
export class SmartImageComponent {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly ratio = input('16 / 10');
  readonly shape = input<'rounded' | 'circle'>('rounded');
  readonly tone = input<ImageTone>('forest');
  readonly initials = input<string>('');

  private readonly failedSrc = signal<string | null>(null);
  private readonly loadedSrc = signal<string | null>(null);

  protected readonly source = computed(() => this.src() ?? null);
  protected readonly showImage = computed(() => {
    const source = this.source();
    return Boolean(source) && this.failedSrc() !== source;
  });
  protected readonly isLoaded = computed(() => this.loadedSrc() === this.source());

  protected markLoaded(): void {
    this.loadedSrc.set(this.source());
  }

  protected markFailed(): void {
    this.failedSrc.set(this.source());
  }
}
