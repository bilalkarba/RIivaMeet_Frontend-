import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <section class="not-found on-dark">
      <span class="not-found__glow" aria-hidden="true"></span>

      <div class="shell not-found__inner">
        <p class="not-found__code" aria-hidden="true">{{ 'notFound.code' | t }}</p>

        <span class="not-found__ball" aria-hidden="true">
          <app-icon name="football" [size]="34" />
        </span>

        <h1 class="display-1 not-found__title">{{ 'notFound.title' | t }}</h1>
        <p class="lead not-found__text">{{ 'notFound.subtitle' | t }}</p>

        <div class="row not-found__actions">
          <a class="btn btn--primary btn--lg" routerLink="/">
            <app-icon name="arrow-right" [size]="17" class="dir-icon" />
            {{ 'notFound.home' | t }}
          </a>
          <a class="btn btn--outline-light btn--lg" routerLink="/coaches">
            <app-icon name="search" [size]="17" />
            {{ 'notFound.coaches' | t }}
          </a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .not-found {
      position: relative;
      overflow: hidden;
      display: grid;
      place-items: center;
      min-height: calc(100vh - var(--header-h));
      padding-block: clamp(3rem, 2rem + 6vw, 7rem);
      text-align: center;
      background:
        radial-gradient(100% 80% at 50% 0%, rgba(195, 240, 60, 0.14), transparent 62%),
        linear-gradient(170deg, var(--forest-850), var(--forest-950) 78%);
      color: var(--cream-100);
    }

    .not-found__glow {
      position: absolute;
      inset-block-end: -30%;
      inset-inline-start: 50%;
      translate: -50% 0;
      width: min(48rem, 90vw);
      aspect-ratio: 1;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(195, 240, 60, 0.14), transparent 65%);
      pointer-events: none;
    }

    .not-found__inner {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
    }

    .not-found__code {
      font-size: clamp(5rem, 3rem + 14vw, 12rem);
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -0.04em;
      color: transparent;
      -webkit-text-stroke: 2px rgba(195, 240, 60, 0.55);
      margin-block-end: -0.4rem;
    }

    .not-found__ball {
      display: grid;
      place-items: center;
      width: 4.25rem;
      height: 4.25rem;
      border-radius: 50%;
      background: var(--lime-500);
      color: var(--forest-950);
      box-shadow: 0 20px 40px -20px rgba(195, 240, 60, 0.7);
    }

    .not-found__title {
      color: var(--cream-50);
      max-width: 22ch;
    }

    .not-found__text {
      color: rgba(238, 245, 240, 0.72);
      max-width: 46ch;
    }

    .not-found__actions {
      justify-content: center;
      margin-block-start: 0.75rem;
    }
  `,
})
export class NotFoundPageComponent {}
