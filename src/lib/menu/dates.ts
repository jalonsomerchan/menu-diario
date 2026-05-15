import type { WeekDay } from './types';

const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getMonday(input = new Date()) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + amount * 7);

  return toIsoDate(date);
}

export function getWeekDays(weekStart: string): WeekDay[] {
  const start = new Date(`${weekStart}T00:00:00`);

  return dayLabels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: toIsoDate(date),
      label,
      isoDate: toIsoDate(date),
    };
  });
}

export function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function getWeekTitle(weekStart: string) {
  const days = getWeekDays(weekStart);
  const first = formatShortDate(days[0].isoDate);
  const last = formatShortDate(days[6].isoDate);

  return `${first} - ${last}`;
}
