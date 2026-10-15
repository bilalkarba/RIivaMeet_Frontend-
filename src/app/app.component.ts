import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LocaleService } from './core/i18n/locale.service';

/**
 * Root component.
 *
 * It renders nothing but the router outlet, and mirrors the active language onto its own
 * host element. Reading the locale signals here also guarantees that a language switch
 * marks the whole tree for change detection — which is what makes every translated
 * string, including live form validation messages and toasts, update immediately.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  host: {
    '[attr.dir]': 'locale.direction()',
    '[attr.lang]': 'locale.activeOption().htmlLang',
  },
  template: '<router-outlet />',
})
export class App {
  protected readonly locale = inject(LocaleService);
}
