export type BusinessTimePrecision = "date" | "datetime";

export interface BusinessTemporalValue {
  value: string;
  precision: BusinessTimePrecision;
  calendarDate: string;
}

export interface BusinessTemporalComparison {
  order: -1 | 0 | 1;
  uncertain: boolean;
  status: "before" | "after" | "equal" | "uncertain";
  reason: "date_precision" | "mixed_precision" | null;
}

export type WorkflowTemporalInputResolution =
  | { status: "empty"; value: null; precision: null; interpretedTimeZone: null }
  | { status: "date"; value: string; precision: "date"; interpretedTimeZone: null }
  | { status: "absolute"; value: string; precision: "datetime"; interpretedTimeZone: null }
  | { status: "local"; value: string; precision: "datetime"; interpretedTimeZone: string }
  | { status: "nonexistent" | "ambiguous" | "invalid"; value: null; precision: null; interpretedTimeZone: string | null; message: string };

export type ImportedTemporalResolution =
  | { status: "empty"; value: null; precision: null; resolution: null; interpretedTimeZone: null; usedDeclaredTimeZone: false; note: null }
  | { status: "date"; value: string; precision: "date"; resolution: "date"; interpretedTimeZone: null; usedDeclaredTimeZone: false; note: null }
  | { status: "absolute"; value: string; precision: "datetime"; resolution: "absolute"; interpretedTimeZone: null; usedDeclaredTimeZone: false; note: string | null }
  | { status: "local"; value: string; precision: "datetime"; resolution: "workflow_time_zone"; interpretedTimeZone: string; usedDeclaredTimeZone: boolean; note: string }
  | { status: "unresolved_legacy"; value: string; precision: "datetime"; resolution: "unresolved_legacy"; interpretedTimeZone: null; usedDeclaredTimeZone: false; note: string }
  | { status: "nonexistent" | "ambiguous" | "invalid"; value: null; precision: null; resolution: null; interpretedTimeZone: string | null; usedDeclaredTimeZone: boolean; note: null; message: string };

export interface ImportedTemporalInputOptions {
  rawValue: string | null | undefined;
  declaredResolution?: string | null;
  declaredTimeZone?: string | null;
  fallbackTimeZone?: string | null;
}

export interface ImportedFormedAtOptions extends ImportedTemporalInputOptions {
  asOfDate: string;
}

export type ZonedLocalDateTimeResolution =
  | { status: "valid"; instant: string; offsetMinutes: number }
  | { status: "nonexistent"; candidates: [] }
  | { status: "ambiguous"; candidates: Array<{ instant: string; offsetMinutes: number }> }
  | { status: "invalid"; reason: string };

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRECISE_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
export const DEFAULT_WORKFLOW_TIME_ZONE = "Asia/Shanghai";

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

/** Import paths must never inherit the browser or Node process time zone. */
export function resolveSafeWorkflowTimeZone(preferred?: string | null) {
  return preferred && isValidTimeZone(preferred) ? preferred : DEFAULT_WORKFLOW_TIME_ZONE;
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
  if (calendarOrder !== 0) return { order: calendarOrder, uncertain: false, status: calendarOrder < 0 ? "before" : "after", reason: null };
  if (left.precision === "datetime" && right.precision === "datetime") {
    const leftTime = parsePreciseInstant(left.value);
    const rightTime = parsePreciseInstant(right.value);
    if (leftTime !== null && rightTime !== null) {
      if (leftTime === rightTime) return { order: 0, uncertain: false, status: "equal", reason: null };
      return { order: leftTime < rightTime ? -1 : 1, uncertain: false, status: leftTime < rightTime ? "before" : "after", reason: null };
    }
  }
  return {
    order: 0,
    uncertain: true,
    status: "uncertain",
    reason: left.precision === right.precision ? "date_precision" : "mixed_precision",
  };
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

/** Parses user/import source times without consulting the machine-local time zone. */
export function resolveWorkflowTemporalInput(value: string | null | undefined, timeZone?: string | null): WorkflowTemporalInputResolution {
  const input = value?.trim() ?? "";
  if (!input) return { status: "empty", value: null, precision: null, interpretedTimeZone: null };
  if (isCalendarDate(input)) return { status: "date", value: input, precision: "date", interpretedTimeZone: null };
  if (isPreciseInstant(input)) {
    const timestamp = parsePreciseInstant(input);
    return timestamp === null
      ? { status: "invalid", value: null, precision: null, interpretedTimeZone: null, message: "带时区的来源时间无效。" }
      : { status: "absolute", value: new Date(timestamp).toISOString(), precision: "datetime", interpretedTimeZone: null };
  }
  if (!LOCAL_DATE_TIME.test(input)) {
    return { status: "invalid", value: null, precision: null, interpretedTimeZone: null, message: "来源时间必须是 YYYY-MM-DD、带偏移的 ISO 时间或不带偏移的本地时间。" };
  }
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : null;
  if (!zone) return { status: "invalid", value: null, precision: null, interpretedTimeZone: null, message: "解析无偏移来源时间需要有效的工作流 IANA 时区。" };
  const resolved = resolveZonedLocalDateTime(input, zone);
  if (resolved.status === "valid") return { status: "local", value: resolved.instant, precision: "datetime", interpretedTimeZone: zone };
  if (resolved.status === "nonexistent") return { status: "nonexistent", value: null, precision: null, interpretedTimeZone: zone, message: `该来源时间在 ${zone} 因夏令时跳转不存在，请改用带偏移的 ISO 时间或日期精度。` };
  if (resolved.status === "ambiguous") return { status: "ambiguous", value: null, precision: null, interpretedTimeZone: zone, message: `该来源时间在 ${zone} 因夏令时回拨存在两个可能时刻，请改用带偏移的 ISO 时间或日期精度。` };
  return { status: "invalid", value: null, precision: null, interpretedTimeZone: zone, message: resolved.reason };
}

/**
 * Resolves imported source publication time with record-declared IANA time zone taking precedence.
 * The returned interpretedTimeZone is the exact zone used to turn an unzoned wall clock into an instant.
 */
export function resolveImportedSourcePublishedAt(options: ImportedTemporalInputOptions): ImportedTemporalResolution {
  const input = options.rawValue?.trim() ?? "";
  if (!input) return { status: "empty", value: null, precision: null, resolution: null, interpretedTimeZone: null, usedDeclaredTimeZone: false, note: null };
  if (options.declaredResolution === "unresolved_legacy" && isUnzonedLocalDateTime(input)) {
    return {
      status: "unresolved_legacy",
      value: input,
      precision: "datetime",
      resolution: "unresolved_legacy",
      interpretedTimeZone: null,
      usedDeclaredTimeZone: false,
      note: "历史无时区时间保留原值，未重新解释为绝对时刻。",
    };
  }
  const declared = options.declaredTimeZone?.trim() ?? "";
  if (declared && !isValidTimeZone(declared)) {
    return { status: "invalid", value: null, precision: null, resolution: null, interpretedTimeZone: null, usedDeclaredTimeZone: false, note: null, message: `记录声明的 IANA 时区无效：${declared}` };
  }
  const fallback = resolveSafeWorkflowTimeZone(options.fallbackTimeZone);
  const interpretationZone = declared || fallback;
  const resolved = resolveWorkflowTemporalInput(input, interpretationZone);
  if (resolved.status === "empty") return { status: "empty", value: null, precision: null, resolution: null, interpretedTimeZone: null, usedDeclaredTimeZone: false, note: null };
  if (resolved.status === "date") return { status: "date", value: resolved.value, precision: "date", resolution: "date", interpretedTimeZone: null, usedDeclaredTimeZone: false, note: null };
  if (resolved.status === "absolute") {
    const note = declared ? `输入已包含偏移或 Z，按绝对时刻保存；记录时区 ${declared} 未参与重新解释。` : null;
    return { status: "absolute", value: resolved.value, precision: "datetime", resolution: "absolute", interpretedTimeZone: null, usedDeclaredTimeZone: false, note };
  }
  if (resolved.status === "local") {
    const usedDeclaredTimeZone = Boolean(declared);
    return {
      status: "local",
      value: resolved.value,
      precision: "datetime",
      resolution: "workflow_time_zone",
      interpretedTimeZone: resolved.interpretedTimeZone,
      usedDeclaredTimeZone,
      note: usedDeclaredTimeZone
        ? resolved.interpretedTimeZone === fallback
          ? `使用记录声明且与工作流一致的时区 ${resolved.interpretedTimeZone} 解释。`
          : `使用记录时区 ${resolved.interpretedTimeZone} 解释，而非当前工作流时区 ${fallback}。`
        : `使用工作流时区 ${resolved.interpretedTimeZone} 解释。`,
    };
  }
  return { ...resolved, resolution: null, usedDeclaredTimeZone: Boolean(declared), note: null };
}

/** Uses the same deterministic contract for manual, Store, JSON and CSV formedAt values. */
export function resolveImportedFormedAt(options: ImportedFormedAtOptions): ImportedTemporalResolution {
  const resolved = resolveImportedSourcePublishedAt(options);
  if (resolved.status === "empty") return { ...resolved, precision: null, resolution: null };
  if (resolved.status === "unresolved_legacy") return resolved;
  if (resolved.status === "date") {
    return { status: "invalid", value: null, precision: null, resolution: null, interpretedTimeZone: null, usedDeclaredTimeZone: false, note: null, message: "formedAt 必须是精确日期时间；日期精度请留空并使用 asOfDate。" };
  }
  if (resolved.status === "nonexistent" || resolved.status === "ambiguous" || resolved.status === "invalid") return resolved;
  if (!isCalendarDate(options.asOfDate)) {
    return { status: "invalid", value: null, precision: null, resolution: null, interpretedTimeZone: resolved.interpretedTimeZone, usedDeclaredTimeZone: resolved.usedDeclaredTimeZone, note: null, message: "校验 formedAt 前必须提供有效的 asOfDate。" };
  }
  const preservesWorkflowProvenance = resolved.status === "absolute"
    && options.declaredResolution === "workflow_time_zone"
    && isValidTimeZone(options.declaredTimeZone);
  const validationZone = resolved.status === "local"
    ? resolved.interpretedTimeZone
    : preservesWorkflowProvenance
      ? options.declaredTimeZone as string
      : resolveSafeWorkflowTimeZone(options.fallbackTimeZone);
  if (!resolved.value || !validationZone) {
    return { status: "invalid", value: null, precision: null, resolution: null, interpretedTimeZone: resolved.interpretedTimeZone, usedDeclaredTimeZone: resolved.usedDeclaredTimeZone, note: null, message: "formedAt 无法解析为可核验的精确时间。" };
  }
  const calendarDate = getCalendarDateInTimeZone(resolved.value, validationZone);
  if (calendarDate !== options.asOfDate) {
    return {
      status: "invalid",
      value: null,
      precision: null,
      resolution: null,
      interpretedTimeZone: resolved.interpretedTimeZone,
      usedDeclaredTimeZone: resolved.usedDeclaredTimeZone,
      note: null,
      message: `formedAt 在 ${validationZone} 的日历日期 ${calendarDate ?? "无效"} 必须与 asOfDate ${options.asOfDate} 一致。`,
    };
  }
  return resolved;
}

export function isUnzonedLocalDateTime(value: unknown): value is string {
  return typeof value === "string" && LOCAL_DATE_TIME.test(value);
}

export function getCalendarToday(now: Date, timeZone?: string | null) {
  return getCalendarDateInTimeZone(now, timeZone) ?? now.toISOString().slice(0, 10);
}

/** Resolves a datetime-local wall clock without silently normalizing DST gaps or overlaps. */
export function resolveZonedLocalDateTime(value: string, timeZone?: string | null): ZonedLocalDateTimeResolution {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { status: "invalid", reason: "本地日期时间格式无效" };
  if (!timeZone || !isValidTimeZone(timeZone)) return { status: "invalid", reason: "IANA 时区无效" };
  const wall = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  if (!isValidWallClock(wall)) return { status: "invalid", reason: "本地日期时间无效" };
  const wallClockUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const offsets = new Set<number>();
  for (let sample = wallClockUtc - 36 * 60 * 60 * 1000; sample <= wallClockUtc + 36 * 60 * 60 * 1000; sample += 30 * 60 * 1000) {
    const offset = zonedOffsetMinutes(new Date(sample), timeZone);
    if (offset !== null) offsets.add(offset);
  }
  const candidates = [...offsets]
    .map((offsetMinutes) => ({ instantMs: wallClockUtc - offsetMinutes * 60_000, offsetMinutes }))
    .filter(({ instantMs }) => sameWallClock(zonedParts(new Date(instantMs), timeZone), wall))
    .sort((left, right) => left.instantMs - right.instantMs)
    .map(({ instantMs, offsetMinutes }) => ({ instant: new Date(instantMs).toISOString(), offsetMinutes }));
  if (candidates.length === 0) return { status: "nonexistent", candidates: [] };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "valid", ...candidates[0] };
}

/** Compatibility wrapper: only uniquely resolvable wall clocks are converted. */
export function zonedLocalDateTimeToIso(value: string, timeZone?: string | null) {
  const resolved = resolveZonedLocalDateTime(value, timeZone);
  return resolved.status === "valid" ? resolved.instant : null;
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

function zonedOffsetMinutes(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  if (!parts) return null;
  return (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime()) / 60_000;
}

function isValidWallClock(value: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  if (value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59 || value.second < 0 || value.second > 59) return false;
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  return date.getUTCFullYear() === value.year
    && date.getUTCMonth() + 1 === value.month
    && date.getUTCDate() === value.day
    && date.getUTCHours() === value.hour
    && date.getUTCMinutes() === value.minute
    && date.getUTCSeconds() === value.second;
}

function sameWallClock(
  actual: ReturnType<typeof zonedParts>,
  expected: { year: number; month: number; day: number; hour: number; minute: number; second: number },
) {
  return Boolean(actual
    && actual.year === expected.year
    && actual.month === expected.month
    && actual.day === expected.day
    && actual.hour === expected.hour
    && actual.minute === expected.minute
    && actual.second === expected.second);
}
