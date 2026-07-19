const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const PRECISE_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/u;

export function isStrictCalendarDate(value) {
  if (typeof value !== "string") return false;
  const match = value.match(CALENDAR_DATE);
  return Boolean(match && isValidWallClockDate(Number(match[1]), Number(match[2]), Number(match[3])));
}

export function parseStrictPreciseInstant(value) {
  if (typeof value !== "string") return null;
  const match = value.match(PRECISE_INSTANT);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0"] = match;
  if (!isValidWallClockDate(Number(year), Number(month), Number(day))) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isStrictPreciseInstant(value) {
  return parseStrictPreciseInstant(value) !== null;
}

function isValidWallClockDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
