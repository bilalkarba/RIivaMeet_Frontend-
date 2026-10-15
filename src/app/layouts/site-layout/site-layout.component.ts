import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter, map, startWith } from 'rxjs';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CallOverlayComponent } from '../../shared/call-overlay/call-overlay.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { OfflineBannerComponent } from '../../shared/offline-banner/offline-banner.component';
import { ToastHostComponent } from '../../shared/toast-host/toast-host.component';

/**
 * Application shell: skip link, offline banner, sticky header, routed page, footer and
 * the toast stack.
 *
 * The header overlays the dark hero on the home page only; elsewhere (or once the page
 * is scrolled) it becomes the solid cream bar. Scroll restoration runs on every
 * navigation so deep links and in-page anchors behave predictably.
 */
@Component({
  selector: 'app-site-layout',
  imports: [
    RouterOutlet,
    TranslatePipe,
    HeaderComponent,
    FooterComponent,
    ToastHostComponent,
    OfflineBannerComponent,
    CallOverlayComponent,
  ],
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    <a class="skip-link" href="#main-content">{{ 'nav.skipToContent' | t }}</a>

    <app-offline-banner />

    <app-header [overlay]="isHome()" [scrolled]="scrolled()" />

    <main id="main-content" [class.main--overlay]="isHome()">
      <router-outlet />
    </main>

    <app-footer />
    <app-toast-host />

    <!-- Mounted in the shell so an incoming call rings on any page. -->
    <app-call-overlay />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    main {
      flex: 1 1 auto;
      display: block;
    }

    /* The header floats over this page, so the hero has to reserve its height. */
    .main--overlay {
      margin-block-start: calc(-1 * var(--header-h));
    }
  `,
})
export class SiteLayoutComponent {
  private readonly router = inject(Router);
  private readonly scroller = inject(ViewportScroller);

  protected readonly scrolled = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isHome = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return url === '/';
  });

  private readonly fragment = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => this.router.parseUrl(event.urlAfterRedirects).fragment),
    ),
    { initialValue: null as string | null },
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      )
      .subscribe(() => {
        const fragment = this.fragment();
        if (fragment) {
          // Let the routed component render before looking the anchor up.
          globalThis.setTimeout?.(() => this.scroller.scrollToAnchor(fragment), 30);
          return;
        }
        this.scroller.scrollToPosition([0, 0]);
        this.scrolled.set(false);
      });
  }

  protected onScroll(): void {
    const offset = globalThis.scrollY ?? globalThis.document?.documentElement.scrollTop ?? 0;
    const next = offset > 12;
    if (next !== this.scrolled()) {
      this.scrolled.set(next);
    }
  }
}
