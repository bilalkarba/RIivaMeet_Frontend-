import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { roleHome } from '../../core/guards/auth.guard';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  trimmed,
} from '../../core/validators/auth.validators';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, IconComponent, AuthLayoutComponent],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly showDevHints = environment.showDevHints;
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX_LENGTH)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)],
    }),
  });

  /**
   * Where to go after a successful sign-in.
   * Only same-origin, absolute paths are honoured so `?returnUrl=` can never be used
   * for an open redirect.
   */
  private readonly returnUrl: string | null;

  protected readonly errorKey = computed(() => {
    const failure = this.error();
    if (!failure) {
      return null;
    }
    if (failure.status === 401) {
      return 'auth.login.invalid';
    }
    if (failure.isNetworkError) {
      return 'errors.network';
    }
    return failure.messageKey;
  });

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl =
      requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : null;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.auth
      .login({ email: trimmed(email), password })
      .pipe(take(1))
      .subscribe({
        next: (user) => {
          void this.router.navigateByUrl(this.returnUrl ?? roleHome(user.role));
        },
        error: (error: unknown) => this.error.set(ApiError.fromHttpError(error)),
      });
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Development helper: the seeded database uses well-known demo accounts. */
  protected fillDemo(kind: 'client' | 'coach'): void {
    this.form.setValue({
      email: kind === 'client' ? 'client@rivameet.test' : 'anna.coach@rivameet.test',
      password: 'Passw0rd123',
    });
    this.submitted.set(false);
    this.error.set(null);
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      required: 'auth.validation.required',
      email: 'auth.validation.email',
      maxlength: 'auth.validation.emailMax',
    });
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      required: 'auth.validation.required',
      maxlength: 'auth.validation.passwordMax',
    });
  }

  /** Field-level issues reported by the API (`errors.fields.<path>`), if any. */
  protected serverError(field: string): string | null {
    return this.error()?.issueKeyFor(field) ?? null;
  }

  private visible(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  private firstError(control: AbstractControl, keys: Record<string, string>): string | null {
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    for (const [error, key] of Object.entries(keys)) {
      if (errors[error]) {
        return key;
      }
    }
    return null;
  }
}
