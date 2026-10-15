import { TestBed } from '@angular/core/testing';

import { LocaleService, pluralCategory } from './locale.service';

const LANGUAGE_KEY = 'rivameet.language';

describe('LocaleService', () => {
  /**
   * Builds a fresh service. The module is reset first so a test can also verify what a
   * *new* instance reads back from storage.
   */
  function create(): LocaleService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(LocaleService);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  it('defaults to Arabic with right-to-left direction', () => {
    const locale = create();

    expect(locale.language()).toBe('ar');
    expect(locale.direction()).toBe('rtl');
    expect(locale.isRtl()).toBe(true);
    expect(locale.activeOption().label).toBe('العربية');
  });

  it('translates the same key into all three languages', () => {
    const locale = create();

    expect(locale.t('nav.coaches')).toBe('ابحث عن مدرب');

    locale.setLanguage('fr');
    expect(locale.t('nav.coaches')).toBe('Trouver un coach');

    locale.setLanguage('en');
    expect(locale.t('nav.coaches')).toBe('Find a coach');
  });

  it('switches direction and persists the choice', () => {
    const locale = create();

    locale.setLanguage('fr');
    expect(locale.direction()).toBe('ltr');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('fr');

    // A fresh instance must pick the stored language up again.
    const reloaded = create();
    expect(reloaded.language()).toBe('fr');
    expect(reloaded.direction()).toBe('ltr');

    reloaded.setLanguage('ar');
    expect(reloaded.direction()).toBe('rtl');
  });

  it('selects the right plural category per language', () => {
    expect(pluralCategory(0, 'ar')).toBe('zero');
    expect(pluralCategory(1, 'ar')).toBe('one');
    expect(pluralCategory(2, 'ar')).toBe('two');
    expect(pluralCategory(5, 'ar')).toBe('few');
    expect(pluralCategory(42, 'ar')).toBe('many');
    expect(pluralCategory(200, 'ar')).toBe('other');

    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
    // French treats 0 and 1 as singular.
    expect(pluralCategory(0, 'fr')).toBe('one');
    expect(pluralCategory(3, 'fr')).toBe('other');
  });

  it('renders counted strings with the correct Arabic form and interpolation', () => {
    const locale = create();

    expect(locale.t('common.reviewCount', { count: 0 })).toBe('لا توجد تقييمات');
    expect(locale.t('common.reviewCount', { count: 1 })).toBe('تقييم واحد');
    expect(locale.t('common.reviewCount', { count: 2 })).toBe('تقييمان');
    expect(locale.t('common.reviewCount', { count: 5 })).toBe('5 تقييمات');

    locale.setLanguage('en');
    expect(locale.t('common.reviewCount', { count: 1 })).toBe('1 review');
    expect(locale.t('common.reviewCount', { count: 4 })).toBe('4 reviews');
  });

  it('maps sport slugs and enum values, and falls back to the API value', () => {
    const locale = create();

    expect(locale.sportName('boxing', 'Boxing')).toBe('الملاكمة');
    expect(locale.enumLabel('status', 'PENDING')).toBe('قيد الانتظار');
    // Unknown slugs keep the canonical name returned by the API.
    expect(locale.sportName('kayaking', 'Kayaking')).toBe('Kayaking');
    expect(locale.enumLabel('status', null)).toBe('—');
  });

  it('returns the key itself when a translation is missing', () => {
    const locale = create();
    expect(locale.t('nope.not.here')).toBe('nope.not.here');
  });

  it('formats money and date ranges with the active locale', () => {
    const locale = create();

    // Money arrives from the API as a 2-decimal string.
    const money = locale.formatMoney('45.00');
    expect(money).toContain('45');

    const range = locale.formatRange('2026-06-01T09:00:00.000Z', '2026-06-01T12:00:00.000Z');
    expect(range).toContain('–');

    locale.setLanguage('en');
    expect(locale.formatMoney('38.50')).toContain('38.5');
  });
});
