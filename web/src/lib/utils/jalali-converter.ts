/**
 * Utility functions for converting between Gregorian and Jalali (Persian) dates
 * Algorithms based on accurate date conversion formulas
 */

/**
 * Convert Gregorian date string (YYYY-MM-DD) to Jalali (Persian) date string (YYYY/MM/DD)
 */
export function gregorianToJalali(dateString: string): string {
  if (!dateString) return '';
  
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  
  const gy = parseInt(parts[0], 10);
  const gm = parseInt(parts[1], 10);
  const gd = parseInt(parts[2], 10);
  
  if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return dateString;
  
  // Algorithm to convert Gregorian to Jalali (reverse of jalaliToGregorian)
  const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  
  // Check if Gregorian year is leap
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  if (isLeap) g_days_in_month[1] = 29;
  
  // Calculate Gregorian day number
  let g_day_no = gd - 1;
  for (let i = 0; i < gm - 1; i++) {
    g_day_no += g_days_in_month[i];
  }
  
  // Calculate days from 1600-01-01 (Gregorian)
  let gy2 = gy - 1600;
  let g_day_no_total = 365 * gy2 + Math.floor(gy2 / 4) - Math.floor(gy2 / 100) + Math.floor(gy2 / 400) + g_day_no;
  
  // Convert to Jalali day number (subtract 79 days difference)
  let j_day_no = g_day_no_total - 79;
  
  // Calculate Jalali year
  let jy = 979 + 33 * Math.floor(j_day_no / 12053);
  j_day_no %= 12053;
  jy += 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;
  
  if (j_day_no >= 366) {
    jy += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }
  
  // Calculate Jalali month and day
  let jm = 0;
  let jd = 0;
  for (let i = 0; i < 11; i++) {
    if (j_day_no >= j_days_in_month[i]) {
      j_day_no -= j_days_in_month[i];
      jm++;
    } else {
      break;
    }
  }
  jm += 1;
  jd = j_day_no + 1;
  
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/**
 * Convert Jalali (Persian) date string (YYYY/MM/DD or YYYY-MM-DD) to Gregorian date string (YYYY-MM-DD)
 * Based on the accurate PHP algorithm provided
 */
export function jalaliToGregorian(dateString: string): string {
  if (!dateString) return '';
  
  // Normalize separator - handle both / and -
  const parts = dateString.split(/[\/-]/);
  if (parts.length !== 3) return dateString;
  
  const j_y = parseInt(parts[0], 10);
  const j_m = parseInt(parts[1], 10);
  const j_d = parseInt(parts[2], 10);
  
  if (isNaN(j_y) || isNaN(j_m) || isNaN(j_d)) return dateString;
  
  // Exact translation from PHP algorithm
  const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  
  const jy = j_y - 979;
  const jm = j_m - 1;
  const jd = j_d - 1;
  
  // Calculate Jalali day number
  let j_day_no = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4);
  for (let i = 0; i < jm; i++) {
    j_day_no += j_days_in_month[i];
  }
  j_day_no += jd;
  
  // Convert to Gregorian day number
  let g_day_no = j_day_no + 79;
  
  // Calculate Gregorian year
  let gy = 1600 + 400 * Math.floor(g_day_no / 146097); /* 146097 = 365*400 + 400/4 - 400/100 + 400/400 */
  g_day_no = g_day_no % 146097;
  
  let leap = true;
  if (g_day_no >= 36525) /* 36525 = 365*100 + 100/4 */ {
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524); /* 36524 = 365*100 + 100/4 - 100/100 */
    g_day_no = g_day_no % 36524;
    
    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }
  
  gy += 4 * Math.floor(g_day_no / 1461); /* 1461 = 365*4 + 4/4 */
  g_day_no = g_day_no % 1461;
  
  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }
  
  // Calculate Gregorian month and day
  let gm = 0;
  let gd = 0;
  let i = 0;
  for (i = 0; g_day_no >= g_days_in_month[i] + (i === 1 && leap ? 1 : 0); i++) {
    g_day_no -= g_days_in_month[i] + (i === 1 && leap ? 1 : 0);
  }
  gm = i + 1;
  gd = g_day_no + 1;
  
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/**
 * Convert datetime-local string to Jalali format for display
 */
export function gregorianDateTimeToJalali(dateTimeString: string): string {
  if (!dateTimeString) return '';
  
  const [datePart, timePart] = dateTimeString.split('T');
  const jalaliDate = gregorianToJalali(datePart);
  
  return timePart ? `${jalaliDate}T${timePart}` : jalaliDate;
}

/**
 * Convert Jalali datetime string to Gregorian datetime-local format
 */
export function jalaliDateTimeToGregorian(dateTimeString: string): string {
  if (!dateTimeString) return '';
  
  // Handle both T separator (datetime-local format) and space separator
  let datePart = '';
  let timePart = '00:00';
  
  if (dateTimeString.includes('T')) {
    [datePart, timePart] = dateTimeString.split('T');
  } else if (dateTimeString.includes(' ')) {
    [datePart, timePart] = dateTimeString.split(' ');
  } else {
    datePart = dateTimeString;
  }
  
  const gregorianDate = jalaliToGregorian(datePart);
  return `${gregorianDate}T${timePart}`;
}
