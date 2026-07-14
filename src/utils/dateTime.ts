export type BusinessTimePrecision = "date" | "datetime";

export interface BusinessTemporalValue {
  value: string;
  precision: BusinessTimePrecision;
  calendarDate: string;
}

export interface BusinessTemporalComparison {
  order: -1 | 0 | 1;
  uncertain: boolean;
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRECISE_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function resolveTimeZone(preferred?: string | null) {
  if (preferred && isValidTimeZone(preferred)) return preferred;
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local && isValidTimeZone(local)) return local;
  } catch {
    // Use the deterministic safe fallback below.
  }
  return "UTC";
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !CALENDAR_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parsePreciseInstant(value: unknown) {
  if (typeof value !== "string" || !PRECISE_INSTANT.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isPreciseInstant(value: unknown): value is string {
  return parsePreciseInstant(value) !== null;
}

export function getCalendarDateInTimeZone(value: Date | string | number, timeZone?: string | null) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const zone = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTemporalCalendarDate(value: string, precision: BusinessTimePrecision, timeZone?: string | null) {
  if (precision === "date") return isCalendarDate(value) ? value : null;
  return isPreciseInstant(value) ? getCalendarDateInTimeZone(value, timeZone) : null;
}

export function compareCalendarDates(left: string, right: string): -1 | 0 | 1 {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function toBusinessTemporal(value: string, precision: BusinessTimePrecision, timeZone?: string | null): BusinessTemporalValue | null {
  const calendarDate = getTemporalCalendarDate(value, precision, timeZone);
  return calendarDate ? { value, precision, calendarDate } : null;
}

export function compareBusinessTemporal(
  left: BusinessTemporalValue,
  right: BusinessTemporalValue,
): BusinessTemporalComparison {
  const calendarOrder = compareCalendarDates(left.calendarDate, right.calendarDate);
  if (calendarOrder !== 0) return { order: calendarOrder, uncertain: false };
  if (left.precision === "datetime" && right.precision === "datetime") {
    const leftTime = parsePreciseInstant(left.value);
    const rightTime = parsePreciseInstant(right.value);
    if (leftTime !== null && rightTime !== null) return { order: leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1, uncertain: leftTime === rightTime };
  }
  return { order: 0, uncertain: true };
}

export function isStrictlyBeforeBusinessTemporal(left: BusinessTemporalValue, right: BusinessTemporalValue) {
  const comparison = compareBusinessTemporal(left, right);
  return comparison.order < 0 && !comparison.uncertain;
}

export function laterBusinessTemporal(left: BusinessTemporalValue, right: BusinessTemporalValue, stableTie: "left" | "right" = "right") {
  const comparison = compareBusinessTemporal(left, right);
  if (comparison.order > 0) return left;
  if (comparison.order < 0) return right;
  return stableTie === "left" ? left : right;
}

export function getCalendarToday(now: Date, timeZone?: string | null) {
  return getCalendarDateInTimeZone(now, timeZone) ?? now.toISOString().slice(0, 10);
}

/** Converts a datetime-local wall clock value in the selected IANA zone into a precise UTC instant. */
export function zonedLocalDateTimeToIso(value: string, timeZone?: string | null) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const zone = resolveTimeZone(timeZone);
  const wallClockUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? "0"));
  let candidate = wallClockUtc;
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(candidate), zone);
    if (!parts) return null;
    const representedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate = wallClockUtc - (representedUtc - candidate);
  }
  const result = new Date(candidate);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

export function isoToZonedLocalDateTime(value: string | null | undefined, timeZone?: string | null) {
  if (!isPreciseInstant(value)) return "";
  const parts = zonedParts(new Date(value), resolveTimeZone(timeZone));
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function zonedParts(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    return { year: values.year, month: values.month, day: values.day, hour: values.hour === 24 ? 0 : values.hour, minute: values.minute, second: values.second };
  } catch {
    return null;
  }
}
