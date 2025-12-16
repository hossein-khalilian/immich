import { locale, lang } from '$lib/stores/preferences.store';
import { get } from 'svelte/store';

/**
 * Get locale with Persian calendar support if using Persian language
 */
export function getLocaleWithCalendar(): string {
  const currentLang = get(lang);
  const userLocale = get(locale);
  
  // Only use Persian calendar if language is Persian (fa)
  if (currentLang === 'fa') {
    return 'fa-IR-u-ca-persian';
  }
  
  return userLocale || 'en';
}

/**
 * Get date format options with Persian calendar support if using Persian language
 */
export function getDateFormatOptions(
  options: Intl.DateTimeFormatOptions = {}
): Intl.DateTimeFormatOptions {
  const currentLang = get(lang);
  const isPersian = currentLang === 'fa';
  
  return {
    ...options,
    calendar: isPersian ? 'persian' : undefined,
  };
}

/**
 * Format date with Persian calendar support
 */
export function formatDateWithCalendar(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const localeWithCalendar = getLocaleWithCalendar();
  const formatOptions = getDateFormatOptions(options);
  return date.toLocaleDateString(localeWithCalendar, formatOptions);
}

/**
 * Format date time with Persian calendar support
 */
export function formatDateTimeWithCalendar(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const localeWithCalendar = getLocaleWithCalendar();
  const formatOptions = getDateFormatOptions(options);
  return date.toLocaleString(localeWithCalendar, formatOptions);
}

