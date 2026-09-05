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
    inferred: "推断", unknown: "未知", manual_verified: "手工已核验", generated_real: "已生成真实数据",
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
  } as Record<string, string>)[value] ?? value;
}
