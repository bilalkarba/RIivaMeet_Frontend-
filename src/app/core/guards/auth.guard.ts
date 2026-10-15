import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import type { Role } from '../models/domain.model';

/** Landing route for each role. */
export function roleHome(role: Role | null): string {
  return role === 'COACH' ? '/coach/dashboard' : '/dashboard';
}

/**
 * Requires a signed-in session.
 *
 * This is a user-experience guard only: every protected API route re-verifies the JWT
 * and the caller's role on the server, so hiding a screen here is a convenience, never
 * a security boundary.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps signed-in users away from the login and registration screens. */
export const guestOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree([roleHome(auth.role())]);
};

/**
 * Restricts a route to one role (administrators may always pass).
 * Users with the other role are redirected to their own home area.
 */
export function roleGuard(allowed: Role): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.role();
    if (!role) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: router.url } });
    }
    if (role === allowed || role === 'ADMIN') {
      return true;
    }

    const target = roleHome(role);
    if (router.url.startsWith(target)) {
      return true;
    }
    return router.createUrlTree([target]);
  };
}
