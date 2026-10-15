import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { I18nTitleStrategy } from './core/i18n/title.strategy';
import { TitleStrategy } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      // Order matters: `authInterceptor` attaches the bearer token, `sessionInterceptor`
      // then observes the response and drops the session if the API rejects it.
      withInterceptors([authInterceptor, sessionInterceptor]),
    ),
    // Page titles come from route `title` translation keys and follow the language.
    { provide: TitleStrategy, useClass: I18nTitleStrategy },
  ],
};
