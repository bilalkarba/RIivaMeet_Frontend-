import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { BrandComponent } from '../brand/brand.component';

/** The five seeded sports, linked through the search filters the API actually accepts. */
const SPORT_SLUGS = ['fitness', 'boxing', 'swimming', 'football', 'tennis'] as const;

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TranslatePipe, IconComponent, BrandComponent, LanguageSelectorComponent],
  template: `
    <footer class="footer">
      <div class="shell footer__inner">
        <div class="footer__brand">
          <app-brand [onDark]="true" [label]="'app.name' | t" [imageLogo]="true" />
          <p class="footer__about">{{ 'footer.aboutText' | t }}</p>
          <app-language-selector [onDark]="true" />
        </div>

        <nav class="footer__col" [attr.aria-label]="'footer.exploreTitle' | t">
          <h3 class="footer__heading">{{ 'footer.exploreTitle' | t }}</h3>
          <ul>
            <li>
              <a routerLink="/">{{ 'nav.home' | t }}</a>
            </li>
            <li>
              <a routerLink="/coaches">{{ 'nav.coaches' | t }}</a>
            </li>
            <li>
              <a routerLink="/" fragment="how-it-works">{{ 'nav.howItWorks' | t }}</a>
            </li>
            <li>
              <a routerLink="/dashboard">{{ 'nav.dashboard' | t }}</a>
            </li>
          </ul>
        </nav>

        <nav class="footer__col" [attr.aria-label]="'footer.sportsTitle' | t">
          <h3 class="footer__heading">{{ 'footer.sportsTitle' | t }}</h3>
          <ul>
            @for (slug of sportSlugs; track slug) {
              <li>
                <a [routerLink]="['/coaches']" [queryParams]="{ sport: slug }">
                  {{ locale.sportName(slug) }}
                </a>
              </li>
            }
          </ul>
        </nav>

        <div class="footer__col">
          <h3 class="footer__heading">{{ 'footer.coachesTitle' | t }}</h3>
          <ul>
            <li>
              <a routerLink="/register" [queryParams]="{ role: 'COACH' }">{{
                'footer.joinAsCoach' | t
              }}</a>
            </li>
            @if (auth.user(); as user) {
              <li>
                <a routerLink="/coach/dashboard">{{ 'nav.coachDashboard' | t }}</a>
              </li>
              <li>
                <span class="footer__muted">{{ user.email }}</span>
              </li>
            } @else {
              <li>
                <a routerLink="/login">{{ 'footer.coachSignIn' | t }}</a>
              </li>
            }
            <li>
              <a [href]="apiDocsUrl" target="_blank" rel="noopener noreferrer">
                {{ 'footer.apiDocs' | t }}
                <app-icon name="external-link" [size]="13" />
              </a>
            </li>
          </ul>

          <h3 class="footer__heading footer__heading--spaced">{{ 'footer.contactTitle' | t }}</h3>
          <ul>
            <li>
              <a [href]="'mailto:' + ('footer.contactEmail' | t)">
                <app-icon name="mail" [size]="14" />
                {{ 'footer.contactEmail' | t }}
              </a>
            </li>
            <li>
              <a [href]="'tel:' + phoneHref">
                <app-icon name="phone" [size]="14" />
                {{ 'footer.contactPhone' | t }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="shell footer__bottom">
        <p>© {{ year }} {{ 'footer.aboutTitle' | t }}. {{ 'footer.rights' | t }}</p>
        <p class="footer__built">{{ 'footer.builtWith' | t }}</p>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      background: var(--forest-900);
      color: rgba(238, 245, 240, 0.78);
      padding-block: clamp(2.5rem, 1.6rem + 3vw, 4rem) 1.5rem;
    }

    .footer__inner {
      display: grid;
      grid-template-columns: minmax(220px, 1.4fr) repeat(auto-fit, minmax(160px, 1fr));
      gap: clamp(1.5rem, 1rem + 2.5vw, 3rem);
    }

    @media (max-width: 27rem) {
      .footer__inner {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .footer__brand {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.9rem;
      max-width: 26rem;
    }

    .footer__about {
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .footer__heading {
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: var(--lime-400);
      margin-block-end: 0.8rem;
    }

    [dir='rtl'] .footer__heading {
      letter-spacing: 0.03em;
    }

    .footer__heading--spaced {
      margin-block-start: 1.6rem;
    }

    .footer__col ul {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .footer__col a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.9rem;
      color: rgba(238, 245, 240, 0.78);
      transition: color var(--dur-fast) var(--ease);
    }

    .footer__col a:hover {
      color: var(--lime-400);
    }

    .footer__muted {
      font-size: 0.85rem;
      color: rgba(238, 245, 240, 0.55);
      word-break: break-all;
    }

    .footer__bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-block-start: clamp(2rem, 1.4rem + 2vw, 3rem);
      padding-block-start: 1.2rem;
      border-block-start: 1px solid var(--line-dark);
      font-size: 0.82rem;
      color: rgba(238, 245, 240, 0.6);
    }

    .footer__built {
      text-align: end;
    }
  `,
})
export class FooterComponent {
  protected readonly locale = inject(LocaleService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly sportSlugs = SPORT_SLUGS;
  protected readonly year = new Date().getFullYear();

  /** Swagger UI lives next to the API root, not under the `/api/v1` prefix. */
  protected readonly apiDocsUrl = `${this.api.baseUrl.replace(/\/api\/v1$/, '')}/docs`;

  /** Dialable form of the display phone number (spaces stripped for `tel:`). */
  protected readonly phoneHref = '+493012345678';
}
