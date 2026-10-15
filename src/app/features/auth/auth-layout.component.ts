import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { LanguageSelectorComponent } from '../../shared/language-selector/language-selector.component';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, TranslatePipe, IconComponent, BrandComponent, LanguageSelectorComponent],
  template: `
    <section class="auth">
      <aside class="auth__aside on-dark">
        <span class="auth__glow" aria-hidden="true"></span>

        <div class="auth__aside-inner">
          <div class="row row--between">
            <app-brand [onDark]="true" [label]="'app.name' | t" />
            <app-language-selector [onDark]="true" />
          </div>

          <div class="stack stack-3 auth__pitch">
            <h2 class="display-3">{{ 'home.hero.title' | t }}</h2>
            <p class="auth__pitch-accent">{{ 'home.hero.titleAccent' | t }}</p>
            <p class="auth__pitch-text">{{ 'home.hero.subtitle' | t }}</p>
          </div>

          <ul class="auth__benefits">
            <li>
              <span class="auth__benefit-icon" aria-hidden="true">
                <app-icon name="star" [size]="17" />
              </span>
              <span>
                <strong>{{ 'home.trust.item1Title' | t }}</strong>
                <span>{{ 'home.trust.item1Text' | t }}</span>
              </span>
            </li>
            <li>
              <span class="auth__benefit-icon" aria-hidden="true">
                <app-icon name="calendar" [size]="17" />
              </span>
              <span>
                <strong>{{ 'home.trust.item2Title' | t }}</strong>
                <span>{{ 'home.trust.item2Text' | t }}</span>
              </span>
            </li>
          </ul>

          <p class="auth__aside-foot">
            <a routerLink="/coaches">{{ 'nav.coaches' | t }}</a>
          </p>
        </div>
      </aside>

      <div class="auth__main">
        <div class="auth__card">
          <ng-content />
        </div>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .auth {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      min-height: calc(100vh - var(--header-h));
    }

    @media (min-width: 960px) {
      .auth {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }

    .auth__aside {
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(110% 90% at 15% 5%, rgba(195, 240, 60, 0.18), transparent 58%),
        linear-gradient(165deg, var(--forest-850), var(--forest-950) 75%);
      color: var(--cream-100);
      padding: clamp(1.5rem, 1rem + 3vw, 3rem);
    }

    .auth__glow {
      position: absolute;
      inset-block-end: -25%;
      inset-inline-end: -20%;
      width: min(34rem, 80vw);
      aspect-ratio: 1;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(195, 240, 60, 0.18), transparent 65%);
      pointer-events: none;
    }

    .auth__aside-inner {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: clamp(1.5rem, 1rem + 2vw, 2.5rem);
      max-width: 34rem;
      margin-inline: auto;
      height: 100%;
    }

    .auth__pitch h2 {
      color: var(--cream-50);
    }

    .auth__pitch-accent {
      font-size: clamp(1.4rem, 1.1rem + 1.4vw, 2rem);
      font-weight: 800;
      color: var(--lime-400);
      line-height: 1.2;
      margin-block-start: -0.4rem;
    }

    .auth__pitch-text {
      color: rgba(238, 245, 240, 0.74);
      line-height: 1.7;
    }

    .auth__benefits {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-block-start: auto;
    }

    .auth__benefits li {
      display: flex;
      gap: 0.7rem;
      align-items: flex-start;
    }

    .auth__benefits span span {
      display: block;
      font-size: 0.85rem;
      color: rgba(238, 245, 240, 0.68);
      line-height: 1.55;
    }

    .auth__benefits strong {
      display: block;
      font-size: 0.9rem;
      color: var(--cream-50);
    }

    .auth__benefit-icon {
      display: grid;
      place-items: center;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: var(--r-sm);
      background: rgba(195, 240, 60, 0.16);
      color: var(--lime-400);
      flex: none;
    }

    .auth__aside-foot a {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--lime-400);
      text-decoration: underline;
    }

    .auth__main {
      display: grid;
      place-items: center;
      padding: clamp(1.5rem, 1rem + 3vw, 3.5rem) clamp(1rem, 0.6rem + 2vw, 2rem);
      background: var(--cream-100);
    }

    .auth__card {
      width: 100%;
      max-width: 27rem;
      padding: clamp(1.25rem, 1rem + 1.5vw, 2rem);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-xl);
      box-shadow: var(--shadow-md);
    }
  `,
})
export class AuthLayoutComponent {}
