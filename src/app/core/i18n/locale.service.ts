import { Injectable, computed, effect, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import ar from '../../i18n/ar.json';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { readStorage, writeStorage } from '../utils/storage';

export type LanguageCode = 'ar' | 'fr' | 'en';
export type TextDirection = 'rtl' | 'ltr';
export type TranslationParams = Record<string, string | number>;
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface LanguageOption {
  code: LanguageCode;
  /** Endonym — always shown in its own language, as language pickers should. */
  label: string;
  direction: TextDirection;
  htmlLang: string;
  /** Locale used for `Intl` formatting. Latin digits are pinned for readability. */
  intlLocale: string;
}

const STORAGE_KEY = 'rivameet.language';
const PLURAL_CATEGORIES = new Set<string>(['zero', 'one', 'two', 'few', 'many', 'other']);

export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'ar', label: 'العربية', direction: 'rtl', htmlLang: 'ar', intlLocale: 'ar-u-nu-latn' },
  { code: 'fr', label: 'Français', direction: 'ltr', htmlLang: 'fr', intlLocale: 'fr-FR' },
  { code: 'en', label: 'English', direction: 'ltr', htmlLang: 'en', intlLocale: 'en-GB' },
];

const DICTIONARIES: Record<LanguageCode, unknown> = { ar, fr, en };

type FlatDictionary = Map<string, string | Record<string, string>>;

/** A node is a plural table when all of its keys are CLDR plural categories. */
function isPluralTable(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.some((key) => PLURAL_CATEGORIES.has(key)) && keys.every((key) => PLURAL_CATEGORIES.has(key));
}

/** Flatten `{ a: { b: "x" } }` into `Map { "a.b" => "x" }`, keeping plural tables whole. */
function flatten(node: unknown, prefix: string, target: FlatDictionary): void {
  if (typeof node === 'string') {
    target.set(prefix, node);
    return;
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }
  const record = node as Record<string, unknown>;
  if (isPluralTable(record)) {
    target.set(prefix, record as Record<string, string>);
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, target);
  }
}

function buildDictionary(language: LanguageCode): FlatDictionary {
  const map: FlatDictionary = new Map();
  flatten(DICTIONARIES[language], '', map);
  return map;
}

/**
 * CLDR plural rules for the three supported languages.
 * English and French need two categories, Arabic needs six.
 */
export function pluralCategory(count: number, language: LanguageCode): PluralCategory {
  const n = Math.abs(count);
  if (language === 'ar') {
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    if (n % 100 >= 3 && n % 100 <= 10) return 'few';
    if (n % 100 >= 11 && n % 100 <= 99) return 'many';
    return 'other';
  }
  if (language === 'fr') {
    return n === 0 || n === 1 ? 'one' : 'other';
  }
  return n === 1 ? 'one' : 'other';
}

/**
 * The single source of truth for language, text direction and UI copy.
 *
 * Components never branch on the language: they call `t('some.key')` (usually through
 * the `t` pipe) and the right dictionary is picked here. Switching language updates a
 * signal, which re-renders every subscription — including live validation messages and
 * toasts — and mirrors the change onto `<html lang dir>` so the whole layout flips.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  readonly languages = LANGUAGES;

  private readonly dictionaries: Record<LanguageCode, FlatDictionary> = {
    ar: buildDictionary('ar'),
    fr: buildDictionary('fr'),
    en: buildDictionary('en'),
  };

  private readonly current = signal<LanguageCode>(readInitialLanguage());

  readonly language = this.current.asReadonly();
  readonly direction = computed<TextDirection>(() => optionFor(this.current()).direction);
  readonly isRtl = computed(() => this.direction() === 'rtl');
  readonly activeOption = computed<LanguageOption>(() => optionFor(this.current()));

  constructor() {
    // Keep the document element in sync so CSS logical properties, native controls and
    // screen readers all follow the selected language.
    effect(() => {
      const option = this.activeOption();
      const root = globalThis.document?.documentElement;
      if (!root) {
        return;
      }
      root.setAttribute('lang', option.htmlLang);
      root.setAttribute('dir', option.direction);
    });
  }

  setLanguage(code: LanguageCode): void {
    if (code === this.current()) {
      return;
    }
    this.current.set(code);
    writeStorage(STORAGE_KEY, code);
  }

  /** Translate a dot-separated key, optionally interpolating `{placeholders}`. */
  t(key: string, params?: TranslationParams): string {
    const language = this.current();
    const entry = this.dictionaries[language].get(key);

    if (typeof entry === 'string') {
      return interpolate(entry, params);
    }

    if (entry && params && typeof params['count'] === 'number') {
      const category = pluralCategory(params['count'], language);
      const picked = entry[category] ?? entry['other'] ?? entry['many'];
      if (typeof picked === 'string') {
        return interpolate(picked, params);
      }
    }

    if (!environment.production) {
      console.warn(`[i18n] Missing translation for "${key}" (${language})`);
    }
    return key;
  }

  /** Same as `t`, but returns `null` instead of the key when nothing is found. */
  tryTranslate(key: string, params?: TranslationParams): string | null {
    const value = this.t(key, params);
    return value === key ? null : value;
  }

  /**
   * Localized sport name. The API returns canonical English names, so the slug is
   * translated when a dictionary entry exists and the API name is the fallback.
   */
  sportName(slug: string, apiName?: string): string {
    return this.tryTranslate(`sports.${slug}`) ?? apiName ?? slug;
  }

  /** Localized enum label — `enumLabel('status', 'PENDING')` -> "قيد الانتظار". */
  enumLabel(group: 'status' | 'level' | 'role' | 'sort', value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    return this.tryTranslate(`enums.${group}.${value}`) ?? value;
  }

  /** Copy for a sport category card (fallback to the generic blurb). */
  sportBlurb(slug: string): string {
    return this.tryTranslate(`sports.${slug}Blurb`) ?? this.t('sports.otherBlurb');
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.activeOption().intlLocale, options).format(value);
  }

  /** Money is received as a 2-decimal string from the API. */
  formatMoney(value: string | number, currency = 'EUR'): string {
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount)) {
      return '—';
    }
    return new Intl.NumberFormat(this.activeOption().intlLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }

  formatDistance(km: number): string {
    const value = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
    return `${this.formatNumber(value, { maximumFractionDigits: 1 })} ${this.t('common.km')}`;
  }

  formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat(
      this.activeOption().intlLocale,
      options ?? { day: 'numeric', month: 'short', year: 'numeric' },
    ).format(date);
  }

  formatTime(value: string | Date): string {
    return this.formatDate(value, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatDateTime(value: string | Date): string {
    return `${this.formatDate(value)} · ${this.formatTime(value)}`;
  }

  /** Date range as `12 Jun, 09:00 – 10:00`, used by availability and bookings. */
  formatRange(startAt: string | Date, endAt: string | Date): string {
    const start = startAt instanceof Date ? startAt : new Date(startAt);
    const end = endAt instanceof Date ? endAt : new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '—';
    }
    const sameDay = start.toDateString() === end.toDateString();
    return sameDay
      ? `${this.formatDate(start)} · ${this.formatTime(start)} – ${this.formatTime(end)}`
      : `${this.formatDate(start)} ${this.formatTime(start)} – ${this.formatDate(end)} ${this.formatTime(end)}`;
  }
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

function optionFor(code: LanguageCode): LanguageOption {
  return LANGUAGES.find((option) => option.code === code) ?? LANGUAGES[0];
}

function readInitialLanguage(): LanguageCode {
  const stored = readStorage(STORAGE_KEY);
  if (stored && LANGUAGES.some((option) => option.code === stored)) {
    return stored as LanguageCode;
  }
  const fallback = environment.defaultLanguage as LanguageCode;
  return LANGUAGES.some((option) => option.code === fallback) ? fallback : 'ar';
}
