export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

export function parseDateOnly(input: string, errorMessage = "Choose a valid date."): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(errorMessage);
  }

  const date = new Date(`${input}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== input) {
    throw new Error(errorMessage);
  }

  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calendarDateParts(date: Date, timeZone: string): CalendarDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(valueByType.get("year")),
    month: Number(valueByType.get("month")),
    day: Number(valueByType.get("day"))
  };
}

export function todayDateInput(timeZone: string, now = new Date()): string {
  const { year, month, day } = calendarDateParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function currentDateOnly(timeZone: string, now = new Date()): Date {
  return parseDateOnly(todayDateInput(timeZone, now));
}

export function calendarMonthRange(timeZone: string, now = new Date(), startMonthOffset = 0) {
  const { year, month } = calendarDateParts(now, timeZone);

  return {
    start: new Date(Date.UTC(year, month - 1 + startMonthOffset, 1)),
    end: new Date(Date.UTC(year, month, 1))
  };
}
