import type { AssetDescriptor, TimelineAsset, ViewportTopMonth } from '$lib/managers/timeline-manager/types';
import { locale, lang } from '$lib/stores/preferences.store';
import { getAssetRatio } from '$lib/utils/asset-utils';
import { AssetTypeEnum, type AssetResponseDto } from '@immich/sdk';
import { DateTime, type LocaleOptions } from 'luxon';
import { SvelteSet } from 'svelte/reactivity';
import { get } from 'svelte/store';

// Move type definitions to the top
export type TimelineYearMonth = {
  year: number;
  month: number;
};

export type TimelineDate = TimelineYearMonth & {
  day: number;
};

export type TimelineDateTime = TimelineDate & {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type ScrubberListener = (scrubberData: {
  scrubberMonth: ViewportTopMonth;
  overallScrollPercent: number;
  scrubberMonthScrollPercent: number;
}) => void | Promise<void>;

// used for AssetResponseDto.dateTimeOriginal, amongst others
export const fromISODateTime = (isoDateTime: string, timeZone: string): DateTime<true> => {
  const currentLang = get(lang);
  const userLocale = get(locale);
  // Only use Persian calendar if language is Persian (fa)
  const finalLocale = (currentLang === 'fa') 
    ? 'fa-IR-u-ca-persian' 
    : (userLocale || 'en');
  return DateTime.fromISO(isoDateTime, { zone: timeZone, locale: finalLocale }) as DateTime<true>;
};

export const fromISODateTimeToObject = (isoDateTime: string, timeZone: string): TimelineDateTime =>
  (fromISODateTime(isoDateTime, timeZone) as DateTime<true>).toObject();

// used for AssetResponseDto.localDateTime, amongst others
export const fromISODateTimeUTC = (isoDateTimeUtc: string) => fromISODateTime(isoDateTimeUtc, 'UTC');

export const fromISODateTimeUTCToObject = (isoDateTimeUtc: string): TimelineDateTime =>
  (fromISODateTimeUTC(isoDateTimeUtc) as DateTime<true>).toObject();

// used to create equivalent of AssetResponseDto.localDateTime in UTC, but without timezone information
export const fromISODateTimeTruncateTZToObject = (
  isoDateTimeUtc: string,
  timeZone: string | undefined,
): TimelineDateTime =>
  (
    fromISODateTime(isoDateTimeUtc, timeZone ?? 'UTC').setZone('UTC', { keepLocalTime: true }) as DateTime<true>
  ).toObject();

// Used to derive a local date time from an ISO string and a UTC offset in hours
export const fromISODateTimeWithOffsetToObject = (isoDateTimeUtc: string, utcOffsetHours: number): TimelineDateTime => {
  const utcDateTime = fromISODateTimeUTC(isoDateTimeUtc);

  // Apply the offset to get the local time
  // Note: offset is in hours (may be fractional), positive for east of UTC, negative for west
  const localDateTime = utcDateTime.plus({ hours: utcOffsetHours });

  // Return as plain object (keeping the local time but in UTC zone context)
  return (localDateTime.setZone('UTC', { keepLocalTime: true }) as DateTime<true>).toObject();
};

export const getTimes = (isoDateTimeUtc: string, localUtcOffsetHours: number) => {
  const utcDateTime = fromISODateTimeUTC(isoDateTimeUtc);
  const fileCreatedAt = (utcDateTime as DateTime<true>).toObject();

  // Apply the offset to get the local time
  // Note: offset is in hours (may be fractional), positive for east of UTC, negative for west
  const luxonLocalDateTime = utcDateTime.plus({ hours: localUtcOffsetHours });
  // Return as plain object (keeping the local time but in UTC zone context)
  const localDateTime = (luxonLocalDateTime.setZone('UTC', { keepLocalTime: true }) as DateTime<true>).toObject();

  return {
    fileCreatedAt,
    localDateTime,
  };
};

export const fromTimelinePlainDateTime = (timelineDateTime: TimelineDateTime): DateTime<true> => {
  const currentLang = get(lang);
  const userLocale = get(locale);
  // Only use Persian calendar if language is Persian (fa)
  const finalLocale = (currentLang === 'fa') 
    ? 'fa-IR-u-ca-persian' 
    : (userLocale || 'en');
  
  return DateTime.fromObject(timelineDateTime, { zone: 'local', locale: finalLocale }) as DateTime<true>;
};

export const fromTimelinePlainDate = (timelineYearMonth: TimelineDate): DateTime<true> => {
  const currentLang = get(lang);
  const userLocale = get(locale);
  // Only use Persian calendar if language is Persian (fa)
  const finalLocale = (currentLang === 'fa') 
    ? 'fa-IR-u-ca-persian' 
    : (userLocale || 'en');
  
  return DateTime.fromObject(
    { year: timelineYearMonth.year, month: timelineYearMonth.month, day: timelineYearMonth.day },
    { zone: 'local', locale: finalLocale },
  ) as DateTime<true>;
};

export const fromTimelinePlainYearMonth = (timelineYearMonth: TimelineYearMonth): DateTime<true> => {
  const currentLang = get(lang);
  const userLocale = get(locale);
  // Only use Persian calendar if language is Persian (fa)
  const finalLocale = (currentLang === 'fa') 
    ? 'fa-IR-u-ca-persian' 
    : (userLocale || 'en');
  
  return DateTime.fromObject(
    { year: timelineYearMonth.year, month: timelineYearMonth.month },
    { zone: 'local', locale: finalLocale },
  ) as DateTime<true>;
};

export const toISOYearMonthUTC = ({ year, month }: TimelineYearMonth): string => {
  const yearFull = `${year}`.padStart(4, '0');
  const monthFull = `${month}`.padStart(2, '0');
  return `${yearFull}-${monthFull}-01T00:00:00.000Z`;
};

/**
 * Get Persian year from TimelineYearMonth
 * Note: This assumes the year/month in TimelineYearMonth is already in Gregorian
 * and converts it to Persian for display
 */
/**
 * Convert Persian/Arabic digits to Latin digits
 */
function convertDigitsToLatin(str: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str;
  // Replace Persian digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), i.toString());
  }
  // Replace Arabic digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  return result;
}

/**
 * Convert Latin digits to Persian digits
 */
export function convertDigitsToPersian(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const str = num.toString();
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char >= '0' && char <= '9') {
      result += persianDigits[parseInt(char, 10)];
    } else {
      result += char;
    }
  }
  return result;
}

export function getPersianYear(timelineYearMonth: TimelineYearMonth): number {
  const currentLang = get(lang);
  // Only convert to Persian year if language is Persian (fa)
  if (currentLang === 'fa') {
    try {
      // Create a Date object in Gregorian calendar
      const gregorianDate = new Date(timelineYearMonth.year, timelineYearMonth.month - 1, 1);
      // Use Intl.DateTimeFormat to get Persian year
      const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        calendar: 'persian'
      });
      const parts = formatter.formatToParts(gregorianDate);
      const yearPart = parts.find(part => part.type === 'year');
      if (yearPart && yearPart.value) {
        // Convert Persian/Arabic digits to Latin, then parse
        const latinDigits = convertDigitsToLatin(yearPart.value);
        const persianYear = parseInt(latinDigits.replace(/[^0-9]/g, ''), 10);
        // Check if result is valid number
        if (!isNaN(persianYear) && persianYear > 0 && persianYear < 10000) {
          return persianYear;
        }
      }
    } catch (error) {
      console.warn('Error converting to Persian year:', error);
    }
    // Fallback to Gregorian year if conversion fails
    return timelineYearMonth.year;
  }
  return timelineYearMonth.year;
}

export function formatMonthGroupTitle(_date: DateTime): string {
  if (!_date.isValid) {
    return _date.toString();
  }
  const date = _date as DateTime<true>;
  const currentLang = get(lang);
  const userLocale = get(locale);
  const isPersian = currentLang === 'fa';
  const finalLocale = isPersian ? 'fa-IR-u-ca-persian' : (userLocale || 'en');
  
  return date.toLocaleString(
    {
      month: 'short',
      year: 'numeric',
      calendar: isPersian ? 'persian' : undefined,
    },
    { locale: finalLocale },
  );
}

export function formatGroupTitle(_date: DateTime): string {
  if (!_date.isValid) {
    return _date.toString();
  }
  const date = _date as DateTime<true>;
  const currentLang = get(lang);
  const userLocale = get(locale);
  const isPersian = currentLang === 'fa';
  const finalLocale = isPersian ? 'fa-IR-u-ca-persian' : (userLocale || 'en');
  
  const today = DateTime.now().setLocale(finalLocale).startOf('day');
  const dateWithLocale = date.setLocale(finalLocale);

  // Today
  if (today.hasSame(dateWithLocale, 'day')) {
    return dateWithLocale.toRelativeCalendar({ locale: finalLocale });
  }

  // Yesterday
  if (today.minus({ days: 1 }).hasSame(dateWithLocale, 'day')) {
    return dateWithLocale.toRelativeCalendar({ locale: finalLocale });
  }

  // Last week
  if (dateWithLocale >= today.minus({ days: 6 }) && dateWithLocale < today) {
    return dateWithLocale.toLocaleString(
      { 
        weekday: 'long',
        calendar: isPersian ? 'persian' : undefined,
      }, 
      { locale: finalLocale }
    );
  }

  // This year
  if (today.hasSame(dateWithLocale, 'year')) {
    return dateWithLocale.toLocaleString(
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        calendar: isPersian ? 'persian' : undefined,
      },
      { locale: finalLocale },
    );
  }

  return getDateLocaleString(date, { locale: finalLocale });
}

export const getDateLocaleString = (date: DateTime, opts?: LocaleOptions): string => {
  const currentLang = get(lang);
  const userLocale = get(locale);
  const isPersian = currentLang === 'fa';
  
  // Only use Persian calendar if language is Persian (fa)
  const finalLocale = isPersian ? 'fa-IR-u-ca-persian' : (opts?.locale || userLocale || 'en');
  
  // Build format options - don't pass calendar if not Persian
  const formatOpts: Intl.DateTimeFormatOptions = {
    ...DateTime.DATE_MED_WITH_WEEKDAY,
  };
  if (isPersian) {
    formatOpts.calendar = 'persian';
  }
  // For non-Persian, explicitly don't set calendar (use default Gregorian)
  
  const finalOpts = { 
    ...opts,
    locale: finalLocale,
  };
  
  return date.toLocaleString(formatOpts, finalOpts);
};

export const toTimelineAsset = (unknownAsset: AssetResponseDto | TimelineAsset): TimelineAsset => {
  if (isTimelineAsset(unknownAsset)) {
    return unknownAsset;
  }
  const assetResponse = unknownAsset;
  const { width, height } = getAssetRatio(assetResponse);
  const ratio = width / height;
  const city = assetResponse.exifInfo?.city;
  const country = assetResponse.exifInfo?.country;
  const people = assetResponse.people?.map((person) => person.name) || [];

  const localDateTime = fromISODateTimeUTCToObject(assetResponse.localDateTime);
  const fileCreatedAt = fromISODateTimeToObject(assetResponse.fileCreatedAt, assetResponse.exifInfo?.timeZone ?? 'UTC');

  return {
    id: assetResponse.id,
    ownerId: assetResponse.ownerId,
    ratio,
    thumbhash: assetResponse.thumbhash,
    localDateTime,
    fileCreatedAt,
    isFavorite: assetResponse.isFavorite,
    visibility: assetResponse.visibility,
    isTrashed: assetResponse.isTrashed,
    isVideo: assetResponse.type == AssetTypeEnum.Video,
    isImage: assetResponse.type == AssetTypeEnum.Image,
    stack: assetResponse.stack || null,
    duration: assetResponse.duration || null,
    projectionType: assetResponse.exifInfo?.projectionType || null,
    livePhotoVideoId: assetResponse.livePhotoVideoId || null,
    city: city || null,
    country: country || null,
    people,
    latitude: assetResponse.exifInfo?.latitude || null,
    longitude: assetResponse.exifInfo?.longitude || null,
  };
};

export const isTimelineAsset = (
  unknownAsset: AssetDescriptor | AssetResponseDto | TimelineAsset,
): unknownAsset is TimelineAsset => (unknownAsset as TimelineAsset).ratio !== undefined;

export const isAssetResponseDto = (
  unknownAsset: AssetDescriptor | AssetResponseDto | TimelineAsset,
): unknownAsset is AssetResponseDto => (unknownAsset as AssetResponseDto).type !== undefined;

export const isTimelineAssets = (assets: AssetResponseDto[] | TimelineAsset[]): assets is TimelineAsset[] =>
  assets.length === 0 || 'ratio' in assets[0];

export const plainDateTimeCompare = (ascending: boolean, a: TimelineDateTime, b: TimelineDateTime) => {
  const [aDateTime, bDateTime] = ascending ? [a, b] : [b, a];

  if (aDateTime.year !== bDateTime.year) {
    return aDateTime.year - bDateTime.year;
  }
  if (aDateTime.month !== bDateTime.month) {
    return aDateTime.month - bDateTime.month;
  }
  if (aDateTime.day !== bDateTime.day) {
    return aDateTime.day - bDateTime.day;
  }
  if (aDateTime.hour !== bDateTime.hour) {
    return aDateTime.hour - bDateTime.hour;
  }
  if (aDateTime.minute !== bDateTime.minute) {
    return aDateTime.minute - bDateTime.minute;
  }
  if (aDateTime.second !== bDateTime.second) {
    return aDateTime.second - bDateTime.second;
  }
  return aDateTime.millisecond - bDateTime.millisecond;
};

export function setDifference<T>(setA: Set<T>, setB: Set<T>): SvelteSet<T> {
  const result = new SvelteSet<T>();
  for (const value of setA) {
    if (!setB.has(value)) {
      result.add(value);
    }
  }
  return result;
}
