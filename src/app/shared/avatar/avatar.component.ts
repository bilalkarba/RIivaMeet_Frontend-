import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const TONES = ['forest', 'lime', 'sky', 'sand'] as const;

/** `"Anna Schmidt"` -> `"AS"`, `"Omar"` -> `"OM"`. */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Monogram avatar.
 *
 * The API exposes no coach photo, so identity is carried by a stable, name-derived
 * gradient plus the person's initials — consistent for a given name across the app.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [attr.data-size]="size()" [attr.data-tone]="tone()" [attr.aria-hidden]="decorative()">
      <span class="avatar__initials">{{ initials() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    .avatar {
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(140deg, var(--forest-700), var(--forest-950) 75%);
      color: var(--cream-50);
      font-weight: 800;
      letter-spacing: 0.04em;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
      aspect-ratio: 1;
    }

    .avatar[data-tone='lime'] {
      background: linear-gradient(140deg, var(--lime-400), var(--lime-700));
      color: var(--forest-950);
    }

    .avatar[data-tone='sky'] {
      background: linear-gradient(140deg, var(--lime-700), var(--forest-800));
    }

    .avatar[data-tone='sand'] {
      background: linear-gradient(140deg, var(--cream-200), var(--cream-300));
      color: var(--forest-800);
    }

    .avatar[data-size='sm'] {
      width: 2rem;
      font-size: 0.72rem;
    }

    .avatar[data-size='md'] {
      width: 2.9rem;
      font-size: 0.92rem;
    }

    .avatar[data-size='lg'] {
      width: 4.2rem;
      font-size: 1.3rem;
    }

    .avatar[data-size='xl'] {
      width: clamp(4.6rem, 3rem + 6vw, 7.5rem);
      font-size: clamp(1.5rem, 1rem + 2vw, 2.4rem);
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');

  /** `true` when a neighbouring label already announces the person's name. */
  readonly decorative = input(false);

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly tone = computed(() => {
    const name = this.name().toLowerCase();
    let hash = 0;
    for (let index = 0; index < name.length; index += 1) {
      hash = (hash * 31 + name.charCodeAt(index)) % 100_000;
    }
    return TONES[hash % TONES.length];
  });
}
