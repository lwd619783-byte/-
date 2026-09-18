import type { ReviewTask } from "../types";

export function dataModeDisplayLabel(value: string) {
  return ({ mock: "模拟数据", mixed: "混合数据", real: "真实数据", "Mock Data": "模拟数据", "Mixed Data": "混合数据", "Real Data": "真实数据" } as Record<string, string>)[value] ?? value;
}

export function localizeDataSourceNote(value: string) {
  return value
    .split("Real Data").join("真实数据")
    .split("Mixed Data").join("混合数据")
    .split("Mock Data").join("模拟数据")
    .split("A Stock Data").join("A 股数据")
    .split("missing").join("缺失")
    .split("stale").join("过期")
    .split("unsupported").join("不支持");
}

export function statusDisplayLabel(value: string) {
  return ({
    error: "错误", conflicted: "冲突", source_unavailable: "来源不可用", stale: "过期",
    not_implemented: "未实现", missing: "缺失", partial: "部分可用", manual_unverified: "手工未核验",
    inferred: "推断", unknown: "未确认", manual_verified: "手工已核验", generated_real: "已生成真实数据",
    real: "真实数据", static_reference: "静态参考", mock: "模拟数据", placeholder: "占位数据",
    supported: "已支持", realish: "真实数据", unsupported_market: "当前市场不支持",
    parse_success: "解析成功", parse_partial: "部分解析", metadata_only: "仅元数据",
    parse_unavailable: "无法解析", not_applicable: "不适用", verified: "已核验", unverified: "未核验",
    pending: "待核验", invalid: "无效", success: "成功", empty: "空数据", idle: "未开始",
    loading: "加载中", failed: "失败", date: "日期", datetime: "精确时间",
    exact_duplicate: "完全重复", metadata_difference: "元数据不同", content_conflict: "内容冲突", independent: "独立记录",
    "Provider 只读": "数据提供方只读", "与官方 Provider 记录重复": "与官方数据记录重复",
    absolute: "绝对时间", workflow_time_zone: "工作流时区", unresolved_legacy: "旧记录时区未解析",
    calendar_date: "日历日期", source_calendar_date: "来源日历日期",
    NOT_ADMITTED: "尚未准入", not_admitted: "尚未准入", ADMITTED: "已准入", UNKNOWN: "未确认",
    PARTIAL: "部分可用", STALE: "过期", FRESH: "新鲜", blocked: "暂不可用", unavailable: "暂不可用",
    missing_evidence: "证据缺失", UNPROVED: "未证明", PROVEN: "已证明", NOT_READY: "尚未就绪",
    NOT_IMPLEMENTED: "未实现", RESOLVED: "已解析", UNRESOLVED: "未解析",
    high: "高", medium: "中", low: "低", acknowledged: "已确认", dismissed: "已忽略", snoozed: "稍后处理",
    consolidated: "合并报表", parent: "母公司报表", singleQuarter: "单季度", cumulative: "累计",
    single_quarter: "单季度", monthly: "月度", weekly: "周度", week_ending: "周末", annual: "年度",
    interim: "中期", quarterly: "季度", year_to_date: "年内累计", candidate: "候选证据", current: "本期记录", previous: "前期记录",
    PRC_GAAP: "中国企业会计准则", IFRS: "国际财务报告准则（IFRS）", half_year: "半年度", first_three_quarters: "前三季度累计", ttm: "最近十二个月（TTM）", gaap: "通用会计准则", non_gaap: "非通用会计准则", net_profit_attributable: "归母净利润",
    sourcePublishedAt: "来源发布时间", formedAt: "形成时间", asOfDate: "截至日期", full_year: "全年",
    billion: "十亿", million: "百万", thousand: "千", annual_report: "年报",
    semi_annual_report: "半年报", quarterly_report: "季报", fresh: "新鲜",
  } as Record<string, string>)[value] ?? value;
}

/** Review reminders are pending action, not pending source verification. */
export function reviewTaskStatusDisplayLabel(value: ReviewTask["status"]) {
  return value === "pending" ? "待处理" : statusDisplayLabel(value);
}

/** Presentation only: never write these labels back to data owners. */
export function unitDisplayLabel(value: string) {
  return ({ "Thousand Barrels": "千桶", CNY: "人民币", HKD: "港元", USD: "美元", percent: "%", ratio: "比率", yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" } as Record<string, string>)[value] ?? value;
}

export function financialMetricLabel(value: string) {
  return ({ PE: "市盈率（PE）", PB: "市净率（PB）", PS: "市销率（PS）", FCF: "自由现金流（FCF）",
    attributable_net_profit: "归母净利润", attributable_net_profit_excluding_non_recurring: "扣非归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益（EPS）", operating_cash_flow: "经营现金流", net_profit: "净利润", net_profit_excluding_non_recurring: "扣非净利润", revenue: "营业收入",
    operatingRevenue: "营业收入", netProfitAttributableToParent: "归母净利润", netOperatingCashFlow: "经营活动现金流净额",
  } as Record<string, string>)[value] ?? value;
}

/** Localize known display vocabulary; callers retain original audit payloads separately. */
export function auditDisplayText(value: string): string {
  const phrases: Record<string, string> = {
    'U.S. Energy Information Administration': '美国能源信息署（EIA）',
    '更新oil-shipping ': '更新油运行业 ',
    'U.S. Ending Stocks excluding SPR of Crude Oil; commercial stocks excluding lease stock': '美国商业原油期末库存（不含战略石油储备及租赁库存）',
    'Thousand Barrels': '千桶', '未提供 / unknown': '未提供 / 未确认',
    'Evidence Graph / revision continuity': '证据关联 / 修订连续性',
    '只读来源核对；沿用 Metric 准入和候选 Evidence，不创建正式 Evidence / ResearchEvent / Entity；无景气或交易判断': '只读来源核对；沿用指标准入与候选证据，不生成正式证据、研究事件或研究对象；不作景气或交易判断',
  };
  let result = value;
  for (const [source, label] of Object.entries(phrases)) result = result.split(source).join(label);
  return result.replace(/\b[A-Za-z][A-Za-z_]*\b/g, token => ({
    freshness: '数据新鲜度', releaseAvailableAt: '公开可得时间', publicationDateTime: '页面标注发布时间',
    PIT: '历史时点可得性（PIT）', close: '收盘价', reportType: '报告类型',
  } as Record<string, string>)[token] ?? financialMetricLabel(unitDisplayLabel(statusDisplayLabel(token))));
}
