import type { DataQualityMeta, StockQuote } from "../types";
import { getCalendarDateInTimeZone, isCalendarDate, parsePreciseInstant } from "./dateTime";
import { statusDisplayLabel } from "./displayLabels";

export type DisplayTimeKind = "collected" | "generated" | "observation" | "publication" | "period" | "unknown";
export type DisplayTimeState = "recent" | "older" | "date_only" | "period" | "missing" | "invalid" | "future" | "unknown";
const timeLabels: Record<DisplayTimeKind, string> = {
  collected: "采集时间", generated: "文件生成时间", observation: "观测日期",
  publication: "发布时间", period: "报告期", unknown: "来源日期（语义待核验）",
};

/** Presentation only: never changes source status or supplies a missing timestamp. */
export function describeDataTime(value: string | null | undefined, kind: DisplayTimeKind, now = new Date()) {
  const raw = value?.trim() ?? "";
  const result = (state: DisplayTimeState, detail: string) => ({
    state, text: `${timeLabels[kind]}：${raw || "未知"} · ${detail}；时效待核验`,
  });
  if (!raw || ["数据暂缺", "None", "NaT", "X"].includes(raw)) return result("missing", "时间缺失");
  if (!Number.isFinite(now.getTime())) return result("unknown", "当前时间无效");
  // Compare native periods without fabricating a publication date or precise instant.
  if (kind === "period") {
    const month = raw.match(/^(\d{4})(?:年(\d{1,2})月份?|-(\d{2}))$/);
    const quarter = raw.match(/^(\d{4})(?:年第([1-4])季度|-Q([1-4]))$/);
    const today = getCalendarDateInTimeZone(now, "Asia/Shanghai")!;
    if (month) {
      const m = Number(month[2] ?? month[3]);
      if (m < 1 || m > 12) return result("invalid", "报告期无效");
      const period = `${month[1]}-${String(m).padStart(2, "0")}`;
      return period > today.slice(0, 7) ? result("future", "未来报告期") : result("period", "仅报告期，发布时间未知");
    }
    if (quarter) {
      const q = Number(quarter[2] ?? quarter[3]);
      const current = `${today.slice(0, 4)}-Q${Math.ceil(Number(today.slice(5, 7)) / 3)}`;
      return `${quarter[1]}-Q${q}` > current ? result("future", "未来报告期") : result("period", "仅报告期，发布时间未知");
    }
    if (!isCalendarDate(raw)) return result("invalid", "报告期格式待核验");
    return raw > today ? result("future", "未来报告期") : result("period", "仅报告期，发布时间未知");
  }
  const instant = parsePreciseInstant(raw);
  if (instant !== null) {
    const age = now.getTime() - instant;
    if (age < 0) return result("future", "未来时间");
    const elapsed = age < 3_600_000 ? "不足 1 小时" : age < 86_400_000 ? `${Math.floor(age / 3_600_000)} 小时` : `${Math.floor(age / 86_400_000)} 天`;
    const recent = age <= 86_400_000;
    const window = kind === "collected" || kind === "generated" ? `，${recent ? "24 小时内" : "超过 24 小时"}` : "";
    return result(kind === "unknown" ? "unknown" : recent ? "recent" : "older", `已过 ${elapsed}${window}`);
  }
  const chineseDate = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const calendarDate = chineseDate ? `${chineseDate[1]}-${chineseDate[2].padStart(2, "0")}-${chineseDate[3].padStart(2, "0")}` : raw;
  if (isCalendarDate(calendarDate)) {
    const today = getCalendarDateInTimeZone(now, "Asia/Shanghai")!;
    if (calendarDate > today) return result("future", "未来日期");
    // Calendar-day distance, not elapsed hours; never qualifies for a 24-hour update badge.
    const days = Math.round((Date.parse(today) - Date.parse(calendarDate)) / 86_400_000);
    return result("date_only", `距今 ${days} 个日历日（北京时间），无日内时间`);
  }
  return result("invalid", "时间无效或时区未知");
}

export function summarizeDataTimes(times: Array<{ value?: string | null; kind: DisplayTimeKind }>, now = new Date()) {
  const states = times.map((item) => describeDataTime(item.value, item.kind, now).state);
  const count = (state: DisplayTimeState) => states.filter((item) => item === state).length;
  return { total: times.length, recent: count("recent"), older: count("older"), dateOnly: count("date_only"),
    period: count("period"), missing: count("missing"), invalid: count("invalid"), future: count("future"), unknown: count("unknown") };
}

export function quoteHasValue(quote?: StockQuote) {
  return typeof quote?.latestPrice === "number" && Number.isFinite(quote.latestPrice);
}

export function describeQuote(quote?: StockQuote, now = new Date()) {
  // Both committed A/HK quote generators use the collection run time for updatedAt.
  // Do not substitute another module's quality.updatedAt or the manifest timestamp.
  return {
    source: `行情来源：${quote?.quality?.source || "未知"} · ${statusDisplayLabel(quote?.quality?.status ?? "unknown")}`,
    coverage: quoteHasValue(quote) ? "价格已覆盖" : "价格缺失",
    time: describeDataTime(quote?.updatedAt, "collected", now),
  };
}

export function summarizeQuotes(quotes: Array<StockQuote | undefined>, now = new Date()) {
  const total = quotes.length;
  const covered = quotes.filter(quoteHasValue).length;
  const real = quotes.filter((q) => q?.quality?.status === "real").length;
  const realCovered = quotes.filter((q) => q?.quality?.status === "real" && quoteHasValue(q)).length;
  const times = summarizeDataTimes(quotes.map((quote) => ({ value: quote?.updatedAt, kind: "collected" })), now);
  return { total, covered, real, realCovered, times,
    text: `价格覆盖 ${covered}/${total}；来源标记真实 ${real}/${total}；采集时间：24 小时内 ${times.recent}/${total}，超过 24 小时 ${times.older}/${total}，缺失 ${times.missing}/${total}，异常 ${times.invalid + times.future}/${total}，仅日期或未知 ${times.dateOnly + times.unknown}/${total}；市场观测时间未知，时效待核验。`,
  };
}

export function summarizeSourceStatuses(statuses: Array<DataQualityMeta["status"] | undefined>) {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status ?? "unknown", (counts.get(status ?? "unknown") ?? 0) + 1);
  return [...counts].map(([status, count]) => `${statusDisplayLabel(status)} ${count}/${statuses.length}`).join("；") || "来源未知（无条目）";
}
