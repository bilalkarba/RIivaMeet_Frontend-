import { Pipe, PipeTransform, inject } from '@angular/core';

import { LocaleService, type TranslationParams } from './locale.service';

/**
 * `{{ 'nav.coaches' | t }}` / `{{ 'search.results' | t: { count: total } }}`
 *
 * The pipe is impure on purpose: translation output depends on the active language
 * signal rather than on its arguments, so a pure pipe would keep rendering the old
 * language after a switch. Reading the signal inside `transform` also registers the
 * dependency, which guarantees the hosting view is re-checked when the language
 * changes — even in the zoneless change-detection mode this app runs in.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(key: string, params?: TranslationParams): string {
    this.locale.language();
    return this.locale.t(key, params);
  }
}
