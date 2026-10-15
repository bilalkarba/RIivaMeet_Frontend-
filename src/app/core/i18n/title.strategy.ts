import { Injectable, effect, inject, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { LocaleService } from './locale.service';

/**
 * Route `title` values are translation keys (`'nav.coaches'`), so the browser tab reads
 * "Find a coach · RivaMeet" in whichever language is active — and it re-renders when the
 * language changes, because the last snapshot is re-applied on every language change.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly locale = inject(LocaleService);

  private lastSnapshot: RouterStateSnapshot | null = null;

  constructor() {
    super();
    effect(() => {
      // Re-run the title whenever the language changes.
      this.locale.language();
      untracked(() => {
        if (this.lastSnapshot) {
          this.applyTitle(this.lastSnapshot);
        }
      });
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastSnapshot = snapshot;
    this.applyTitle(snapshot);
  }

  private applyTitle(snapshot: RouterStateSnapshot): void {
    const appName = this.locale.t('app.name');
    const key = this.buildTitle(snapshot);
    this.title.setTitle(key ? `${this.locale.t(key)} · ${appName}` : appName);
  }
}
