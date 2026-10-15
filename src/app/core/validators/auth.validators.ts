import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Client-side validators that mirror the backend Zod schema in `src/schemas/auth.schema.ts`.
 *
 * They exist to give immediate, translated feedback. They are never a substitute for the
 * server: the API re-validates every payload and its `details` are mapped back onto the
 * matching form controls.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt only reads the first 72 bytes, so the API caps the password there. */
export const PASSWORD_MAX_LENGTH = 72;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 255;
export const PHONE_MIN_LENGTH = 6;
export const PHONE_MAX_LENGTH = 30;

const LETTER = /[a-zA-Z]/;
const DIGIT = /[0-9]/;
const PHONE = /^[+]?[0-9\s().-]+$/;

/** Password must contain at least one letter and one number. */
export const passwordStrengthValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value) {
    return null;
  }
  const valid = LETTER.test(value) && DIGIT.test(value);
  return valid ? null : { passwordPattern: true };
};

/** Phone charset accepted by the API (`+`, digits, spaces, `.`, `(`, `)`, `-`). */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value) {
    return null;
  }
  return PHONE.test(value) ? null : { phonePattern: true };
};

/**
 * Group validator that flags the confirmation control when the two passwords differ.
 */
export const passwordsMatchValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const password = group.get('password')?.value as string | null;
  const confirmation = group.get('confirmPassword');
  if (!confirmation) {
    return null;
  }

  const mismatch = Boolean(password) && Boolean(confirmation.value) && password !== confirmation.value;
  if (mismatch) {
    confirmation.setErrors({ ...(confirmation.errors ?? {}), passwordMismatch: true });
    return { passwordMismatch: true };
  }

  if (confirmation.hasError('passwordMismatch')) {
    const { passwordMismatch: _removed, ...rest } = confirmation.errors ?? {};
    confirmation.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
  return null;
};

/** Trims a value before it is sent, matching the API's normalisation. */
export function trimmed(value: string | null | undefined): string {
  return (value ?? '').trim();
}
