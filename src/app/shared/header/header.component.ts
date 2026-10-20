import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NotificationService } from '../../core/ui/notification.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { BrandComponent } from '../brand/brand.component';
import { IconComponent } from '../icon/icon.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

interface NavLink {
  labelKey: string;
  link: string;
  fragment?: string;
}

const NAV_LINKS: readonly NavLink[] = [
  { labelKey: 'nav.home', link: '/' },
  { labelKey: 'nav.coaches', link: '/coaches' },
  { labelKey: 'nav.howItWorks', link: '/', fragment: 'how-it-works' },
  { labelKey: 'nav.forCoaches', link: '/', fragment: 'for-coaches' },
];

/**
 * Site header.
 *
 * `overlay` makes it transparent and light-on-dark while it sits over the home hero; it
 * switches to the solid cream treatment as soon as the page scrolls (or on any other
 * page). Contains the brand, primary navigation, the language selector and the account
 * area. On small screens the navigation collapses into a panel, and every control
 * remains keyboard reachable with a visible focus ring.
 */
@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    BrandComponent,
    AvatarComponent,
    LanguageSelectorComponent,
  ],
  host: {
    '[class.is-overlay]': 'overlay() && !scrolled()',
    '(document:click)': 'closeMenus()',
  },
  template: `
    <header class="header">
      <div class="shell header__inner">
        <app-brand [onDark]="darkChrome()" [label]="'app.name' | t" [imageLogo]="true" />

        <nav class="header__nav" [attr.aria-label]="'nav.menu' | t">
          <ul>
            @for (link of links; track link.labelKey) {
              <li>
                <a
                  class="header__link"
                  [class.is-active]="isActive(link)"
                  [routerLink]="link.link"
                  [fragment]="link.fragment"
                >
                  {{ link.labelKey | t }}
                </a>
              </li>
            }
          </ul>
        </nav>

        <div class="header__actions">
          <app-language-selector [onDark]="darkChrome()" />

          @if (auth.user(); as user) {
            <div class="account">
              <button
                type="button"
                class="account__trigger"
                [attr.aria-expanded]="accountOpen()"
                aria-haspopup="menu"
                (click)="toggleAccount($event)"
              >
                <app-avatar [name]="user.name" size="sm" [decorative]="true" />
                <span class="account__name">{{ user.name }}</span>
                <app-icon name="chevron-down" [size]="15" />
              </button>

              @if (accountOpen()) {
                <div class="account__menu" role="menu">
                  <p class="account__meta">
                    <span class="account__meta-label">{{ 'auth.signedInAs' | t }}</span>
                    <span class="account__meta-value">{{ user.email }}</span>
                    <span class="chip chip--neutral">{{
                      locale.enumLabel('role', user.role)
                    }}</span>
                  </p>

                  <a
                    class="account__item"
                    role="menuitem"
                    routerLink="/dashboard"
                    (click)="closeMenus()"
                  >
                    <app-icon name="calendar" [size]="17" />
                    {{ 'nav.dashboard' | t }}
                  </a>
                  @if (auth.role() === 'ADMIN') {
                    <a
                      class="account__item"
                      role="menuitem"
                      routerLink="/admin/verifications"
                      (click)="closeMenus()"
                    >
                      <app-icon name="shield" [size]="17" />
                      {{ 'nav.adminVerifications' | t }}
                    </a>
                  }
                  @if (auth.isCoach()) {
                    <a
                      class="account__item"
                      role="menuitem"
                      routerLink="/coach/dashboard"
                      (click)="closeMenus()"
                    >
                      <app-icon name="dashboard" [size]="17" />
                      {{ 'nav.coachDashboard' | t }}
                    </a>
                  } @else {
                    <a
                      class="account__item"
                      role="menuitem"
                      routerLink="/register"
                      [queryParams]="{ role: 'COACH' }"
                      (click)="closeMenus()"
                    >
                      <app-icon name="sparkles" [size]="17" />
                      {{ 'nav.forCoaches' | t }}
                    </a>
                  }

                  <span class="account__divider" role="separator"></span>

                  <button
                    type="button"
                    class="account__item account__item--danger"
                    role="menuitem"
                    (click)="logout()"
                  >
                    <app-icon name="log-out" [size]="17" />
                    {{ 'nav.logout' | t }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <a class="header__signin" routerLink="/login">{{ 'nav.login' | t }}</a>
            <a class="btn btn--primary btn--sm" routerLink="/register">{{ 'nav.register' | t }}</a>
          }

          <button
            type="button"
            class="header__burger"
            [attr.aria-expanded]="mobileOpen()"
            [attr.aria-label]="'nav.menu' | t"
            (click)="toggleMobile($event)"
          >
            <app-icon [name]="mobileOpen() ? 'close' : 'menu'" [size]="22" />
          </button>
        </div>
      </div>

      @if (mobileOpen()) {
        <div class="header__mobile">
          <div class="shell stack stack-4">
            <nav [attr.aria-label]="'nav.menu' | t">
              <ul class="stack stack-2">
                @for (link of links; track link.labelKey) {
                  <li>
                    <a
                      class="header__mobile-link"
                      [routerLink]="link.link"
                      [fragment]="link.fragment"
                      (click)="closeMenus()"
                    >
                      {{ link.labelKey | t }}
                    </a>
                  </li>
                }
              </ul>
            </nav>

            <div class="header__mobile-actions">
              @if (auth.user(); as user) {
                <a
                  class="btn btn--outline btn--block"
                  routerLink="/dashboard"
                  (click)="closeMenus()"
                >
                  {{ 'nav.dashboard' | t }}
                </a>
                @if (auth.isCoach()) {
                  <a
                    class="btn btn--outline btn--block"
                    routerLink="/coach/dashboard"
                    (click)="closeMenus()"
                  >
                    {{ 'nav.coachDashboard' | t }}
                  </a>
                }
                <button type="button" class="btn btn--danger btn--block" (click)="logout()">
                  {{ 'nav.logout' | t }}
                </button>
              } @else {
                <a class="btn btn--outline btn--block" routerLink="/login" (click)="closeMenus()">
                  {{ 'nav.login' | t }}
                </a>
                <a
                  class="btn btn--primary btn--block"
                  routerLink="/register"
                  (click)="closeMenus()"
                >
                  {{ 'nav.register' | t }}
                </a>
              }
            </div>
          </div>
        </div>
      }
    </header>
  `,
  styles: `
    :host {
      position: sticky;
      inset-block-start: 0;
      z-index: 50;
      display: block;
    }

    .header {
      background: rgba(252, 251, 247, 0.92);
      backdrop-filter: blur(14px);
      border-block-end: 1px solid var(--line);
      transition:
        background-color var(--dur) var(--ease),
        border-color var(--dur) var(--ease),
        box-shadow var(--dur) var(--ease);
    }

    :host(.is-overlay) .header {
      position: absolute;
      inset-inline: 0;
      background: transparent;
      backdrop-filter: none;
      border-block-end-color: transparent;
    }

    :host(.is-overlay) {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 0;
    }

    .header__inner {
      display: flex;
      align-items: center;
      gap: 1.15rem;
      min-height: var(--header-h);
      padding-block: 0.55rem;
    }

    .header__nav {
      margin-inline-start: 0.5rem;
    }

    .header__nav ul {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .header__link {
      display: inline-block;
      padding: 0.5rem 0.75rem;
      border-radius: var(--r-pill);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--ink-700);
      transition:
        background-color var(--dur-fast) var(--ease),
        color var(--dur-fast) var(--ease);
    }

    .header__link:hover {
      background: var(--cream-200);
      color: var(--forest-800);
    }

    .header__link.is-active {
      color: var(--forest-800);
      background: var(--forest-50);
    }

    .header__actions {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin-inline-start: auto;
    }

    .header__signin {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--ink-800);
      padding: 0.45rem 0.6rem;
      border-radius: var(--r-pill);
    }

    .header__signin:hover {
      background: var(--cream-200);
    }

    .header__burger {
      display: none;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: var(--r-pill);
      border: 1px solid var(--line-strong);
      background: #fff;
      color: var(--ink-800);
      cursor: pointer;
    }

    /* --- Account menu --------------------------------------------------- */
    .account {
      position: relative;
    }

    .account__trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.3rem 0.6rem 0.3rem 0.35rem;
      border-radius: var(--r-pill);
      border: 1px solid var(--line-strong);
      background: #fff;
      cursor: pointer;
      font-size: 0.87rem;
      font-weight: 700;
      color: var(--ink-800);
    }

    [dir='rtl'] .account__trigger {
      padding: 0.3rem 0.35rem 0.3rem 0.6rem;
    }

    .account__name {
      max-width: 9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account__menu {
      position: absolute;
      z-index: 60;
      inset-block-start: calc(100% + 0.5rem);
      inset-inline-end: 0;
      width: min(17rem, calc(100vw - 2rem));
      padding: 0.4rem;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      box-shadow: var(--shadow-lg);
    }

    .account__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      padding: 0.6rem 0.7rem;
      border-radius: var(--r-sm);
      background: var(--cream-100);
      margin-block-end: 0.3rem;
    }

    .account__meta-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--ink-400);
    }

    .account__meta-value {
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--ink-900);
      word-break: break-all;
    }

    .account__item {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      width: 100%;
      padding: 0.55rem 0.7rem;
      border: 0;
      border-radius: var(--r-xs);
      background: transparent;
      color: var(--ink-800);
      font-size: 0.89rem;
      font-weight: 600;
      text-align: start;
      cursor: pointer;
    }

    .account__item:hover {
      background: var(--cream-100);
    }

    .account__item--danger {
      color: var(--rose-500);
    }

    .account__item--danger:hover {
      background: var(--rose-50);
    }

    .account__divider {
      display: block;
      height: 1px;
      margin: 0.25rem 0.4rem;
      background: var(--line);
    }

    /* --- Mobile --------------------------------------------------------- */
    .header__mobile {
      background: var(--cream-50);
      border-block-start: 1px solid var(--line);
      box-shadow: var(--shadow-md);
      padding-block: 1rem 1.25rem;
    }

    .header__mobile-link {
      display: block;
      padding: 0.65rem 0.25rem;
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--ink-900);
      border-block-end: 1px solid var(--line);
    }

    .header__mobile-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-block-start: 0.75rem;
    }

    /* --- Overlay (dark hero) ------------------------------------------- */
    :host(.is-overlay) .header__link {
      color: rgba(252, 251, 247, 0.82);
    }

    :host(.is-overlay) .header__link:hover,
    :host(.is-overlay) .header__link.is-active {
      background: rgba(255, 255, 255, 0.12);
      color: var(--cream-50);
    }

    :host(.is-overlay) .header__signin {
      color: var(--cream-50);
    }

    :host(.is-overlay) .header__signin:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    :host(.is-overlay) .header__burger {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.28);
      color: var(--cream-50);
    }

    :host(.is-overlay) .account__trigger {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.28);
      color: var(--cream-50);
    }

    @media (max-width: 960px) {
      .header__nav {
        display: none;
      }

      .header__signin {
        display: none;
      }

      .header__burger {
        display: grid;
      }

      .account__name {
        display: none;
      }
    }

    @media (max-width: 560px) {
      .header__actions > .btn {
        display: none;
      }
    }
  `,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly locale = inject(LocaleService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly overlay = input(false);
  readonly scrolled = input(false);

  protected readonly links = NAV_LINKS;
  protected readonly mobileOpen = signal(false);
  protected readonly accountOpen = signal(false);

  /** Light chrome (cream text, frosted controls) only while over the dark hero. */
  protected readonly darkChrome = computed(() => this.overlay() && !this.scrolled());

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    // Never leave a panel open after a navigation.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMenus());
  }

  protected isActive(link: NavLink): boolean {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    if (link.fragment) {
      return false;
    }
    if (link.link === '/coaches') {
      return url.startsWith('/coaches');
    }
    return url === '/';
  }

  protected toggleAccount(event: Event): void {
    event.stopPropagation();
    this.accountOpen.update((open) => !open);
    this.mobileOpen.set(false);
  }

  protected toggleMobile(event: Event): void {
    event.stopPropagation();
    this.mobileOpen.update((open) => !open);
    this.accountOpen.set(false);
  }

  protected closeMenus(): void {
    this.accountOpen.set(false);
    this.mobileOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.closeMenus();
    this.notifications.success('auth.logoutSuccess');
    void this.router.navigate(['/']);
  }
}
