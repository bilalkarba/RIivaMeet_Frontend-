import { Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { roleHome } from '../../core/guards/auth.guard';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Role } from '../../core/models/domain.model';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  passwordStrengthValidator,
  passwordsMatchValidator,
  phoneValidator,
  trimmed,
} from '../../core/validators/auth.validators';
import { IconComponent } from '../../shared/icon/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

type SelfAssignableRole = Extract<Role, 'CLIENT' | 'COACH'>;

/**
 * Registration.
 *
 * The fields and validators mirror the backend's `registerBodySchema` exactly, including
 * the rule that only CLIENT and COACH roles can be self-assigned. The role picker is a
 * real radio group so it is keyboard navigable, and it can be pre-selected with
 * `?role=COACH` (used by the "join as a coach" calls to action).
 */
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, IconComponent, AuthLayoutComponent],
  templateUrl: './register-page.component.html',
})
export class RegisterPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(NAME_MIN_LENGTH),
          Validators.maxLength(NAME_MAX_LENGTH),
        ],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX_LENGTH)],
      }),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.minLength(PHONE_MIN_LENGTH),
          Validators.maxLength(PHONE_MAX_LENGTH),
          phoneValidator,
        ],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          Validators.maxLength(PASSWORD_MAX_LENGTH),
          passwordStrengthValidator,
        ],
      }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      role: new FormControl<SelfAssignableRole>('CLIENT', { nonNullable: true }),
    },
    { validators: passwordsMatchValidator },
  );

  protected readonly errorKey = computed(() => {
    const failure = this.error();
    if (!failure) {
      return null;
    }
    if (failure.status === 409) {
      return 'auth.register.emailTaken';
    }
    if (failure.isNetworkError) {
      return 'errors.network';
    }
    return failure.messageKey;
  });

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('role')?.toUpperCase();
    if (requested === 'COACH' || requested === 'CLIENT') {
      this.form.controls.role.setValue(requested);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const phone = trimmed(value.phone);

    this.auth
      .register({
        name: trimmed(value.name),
        email: trimmed(value.email),
        password: value.password,
        role: value.role,
        // Only send the optional field when the user actually filled it in.
        ...(phone ? { phone } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (user) => void this.router.navigateByUrl(roleHome(user.role)),
        error: (error: unknown) => this.error.set(ApiError.fromHttpError(error)),
      });
  }

  protected selectRole(role: SelfAssignableRole): void {
    this.form.controls.role.setValue(role);
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      required: 'auth.validation.required',
      minlength: 'auth.validation.nameMin',
      maxlength: 'auth.validation.nameMax',
    });
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

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      minlength: 'auth.validation.phoneMin',
      maxlength: 'auth.validation.phoneMax',
      phonePattern: 'auth.validation.phonePattern',
    });
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      required: 'auth.validation.required',
      minlength: 'auth.validation.passwordMin',
      maxlength: 'auth.validation.passwordMax',
      passwordPattern: 'auth.validation.passwordPattern',
    });
  }

  protected confirmError(): string | null {
    const control = this.form.controls.confirmPassword;
    if (!this.visible(control)) {
      return null;
    }
    return this.firstError(control, {
      required: 'auth.validation.required',
      passwordMismatch: 'auth.validation.passwordMismatch',
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
