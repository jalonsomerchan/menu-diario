import type { WeekDay } from './types';

const fallbackDayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonday(input = new Date()) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function getWeekStartForDate(input: Date | string = new Date()) {
  const date = typeof input === 'string' ? new Date(`${input}T00:00:00`) : new Date(input);
  return toIsoDate(getMonday(date));
}

export function getDateOffset(baseDate = new Date(), offset = 0) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

export function getUpcomingDates(baseDate = new Date(), startOffset = 0, count = 7) {
  return Array.from({ length: count }, (_, index) => getDateOffset(baseDate, startOffset + index));
}

export function getWeekStartsForDates(dates: string[]) {
  return [...new Set(dates.map((date) => getWeekStartForDate(date)))];
}

export function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + amount * 7);

  return toIsoDate(date);
}

export function getWeekDays(weekStart: string, labels = fallbackDayLabels): WeekDay[] {
  const start = new Date(`${weekStart}T00:00:00`);

  return labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: toIsoDate(date),
      label,
      isoDate: toIsoDate(date),
    };
  });
}

export function formatShortDate(isoDate: string, locale = 'es-ES') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function getWeekTitle(weekStart: string, locale = 'es-ES') {
  const days = getWeekDays(weekStart);
  const first = formatShortDate(days[0].isoDate, locale);
  const last = formatShortDate(days[6].isoDate, locale);

  return `${first} - ${last}`;
}
