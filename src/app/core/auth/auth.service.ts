import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import type {
  AuthResult,
  LoginPayload,
  PublicUser,
  RegisterPayload,
  Role,
} from '../models/domain.model';
import { isTokenExpired } from '../utils/jwt';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';

interface StoredSession {
  token: string;
  user: PublicUser;
}

const SESSION_KEY = 'rivameet.session';

function readStoredSession(): StoredSession | null {
  const raw = readStorage(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user?.id) {
      return null;
    }
    // Drop sessions whose JWT is already expired instead of issuing doomed requests.
    return isTokenExpired(parsed.token) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Session state for the whole app.
 *
 * The backend is the only authority on permissions — it re-verifies the JWT on every
 * request and enforces roles server-side. This service only keeps the token for the
 * auth interceptor and exposes the signed-in user so the UI can adapt. A deleted or
 * expired account is detected by the first 401, which clears the session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly session = signal<StoredSession | null>(readStoredSession());
  private readonly pending = signal(false);

  readonly user = computed<PublicUser | null>(() => this.session()?.user ?? null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => {
    const token = this.session()?.token;
    return Boolean(token) && !isTokenExpired(token as string);
  });
  readonly isCoach = computed(() => this.role() === 'COACH');
  readonly isClient = computed(() => this.role() === 'CLIENT');
  readonly isBusy = this.pending.asReadonly();

  /** Bearer token handed to the auth interceptor, or `null` when signed out/expired. */
  token(): string | null {
    const current = this.session();
    if (!current?.token || isTokenExpired(current.token)) {
      return null;
    }
    return current.token;
  }

  login(payload: LoginPayload): Observable<PublicUser> {
    return this.authenticate('/auth/login', payload);
  }

  register(payload: RegisterPayload): Observable<PublicUser> {
    return this.authenticate('/auth/register', payload);
  }

  /**
   * Re-reads the signed-in user from `GET /auth/me`. Used on app start to confirm the
   * session is still valid and to refresh `hasCoachProfile`, which changes as soon as
   * a coach creates a profile.
   */
  loadCurrentUser(): Observable<PublicUser> {
    return this.api
      .getData<{ user: PublicUser }>('/auth/me')
      .pipe(map((response) => response.user), tap((user) => this.persistUser(user)));
  }

  logout(): void {
    this.clearSession();
  }

  /** Called by the session interceptor when the API rejects the stored token. */
  clearSession(): void {
    this.session.set(null);
    removeStorage(SESSION_KEY);
  }

  /** Patch the cached user after a local change (e.g. a coach profile was created). */
  patchUser(patch: Partial<PublicUser>): void {
    const current = this.session();
    if (!current) {
      return;
    }
    this.persistUser({ ...current.user, ...patch });
  }

  private authenticate(
    path: string,
    payload: LoginPayload | RegisterPayload,
  ): Observable<PublicUser> {
    this.pending.set(true);
    return this.api.postData<AuthResult>(path, payload).pipe(
      tap((result) => this.persist(result)),
      map((result) => result.user),
      finalize(() => this.pending.set(false)),
    );
  }

  private persist(result: AuthResult): void {
    const session: StoredSession = { token: result.accessToken, user: result.user };
    this.session.set(session);
    writeStorage(SESSION_KEY, JSON.stringify(session));
  }

  private persistUser(user: PublicUser): void {
    const current = this.session();
    if (!current) {
      return;
    }
    const session: StoredSession = { token: current.token, user };
    this.session.set(session);
    writeStorage(SESSION_KEY, JSON.stringify(session));
  }
}
