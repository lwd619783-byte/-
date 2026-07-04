import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Minus, Radar } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DataSourceStatus, MacroIndicator } from "../../types";
import { ChartPanel, DashboardCard, StatusBadge } from "../common/terminal";

type MacroRowStatus = "real" | "pending" | "missing" | "stale";

type MacroIndicatorRow = {
  key: string;
  label: string;
  category: string;
  value: string | number | null;
  unit?: string;
  date?: string;
  source?: string;
  status: MacroRowStatus;
  description?: string;
  rawKey: string;
};

type MacroGroup = {
  key: string;
  title: string;
  subtitle: string;
  rows: MacroIndicatorRow[];
};

const trendIcon = {
  上行: ArrowUpRight,
  下行: ArrowDownRight,
  震荡: Minus,
  待验证: Radar,
};

const macroGroups: Array<Omit<MacroGroup, "rows">> = [
  { key: "增长与价格", title: "增长与价格", subtitle: "GDP、PMI、CPI、PPI、工业和消费数据" },
  { key: "流动性", title: "流动性", subtitle: "资金价格、市场杠杆和银行间流动性" },
  { key: "政策与利率", title: "政策与利率", subtitle: "LPR、存准和政策利率线索" },
  { key: "信用与社融", title: "信用与社融", subtitle: "M2、贷款、融资余额等信用扩张指标" },
  { key: "汇率与外部环境", title: "汇率与外部环境", subtitle: "人民币汇率与外部风险观察" },
  { key: "外贸", title: "外贸", subtitle: "出口、进口、顺差和海外需求" },
  { key: "地产", title: "地产", subtitle: "销售、开工、竣工和价格线索" },
  { key: "就业", title: "就业", subtitle: "失业率、招聘和居民收入压力" },
  { key: "风险因子", title: "风险因子", subtitle: "通胀、汇率、信用和市场拥挤度" },
];

const statusLabel: Record<MacroRowStatus, string> = {
  real: "真实",
  pending: "待验证",
  missing: "缺失",
  stale: "过期",
};

const statusBadgeStatus: Record<MacroRowStatus, DataSourceStatus> = {
  real: "real",
  pending: "mock",
  missing: "missing",
  stale: "stale",
};

export function MacroTab({ indicators }: { indicators: MacroIndicator[] }) {
  const rows = useMemo(() => buildMacroIndicatorRows(indicators), [indicators]);
  const groups = useMemo(() => buildMacroGroups(rows), [rows]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["增长与价格", "信用与社融"]));

  const totalMetricCount = rows.length;
  const realMetricCount = rows.filter((row) => row.status === "real").length;
  const missingMetricCount = rows.filter((row) => row.status === "missing").length;
  const sourceCount = new Set(rows.map((row) => row.source).filter(Boolean)).size;
  const latestUpdate = latestDateLabel(rows);
  const radarRows = buildRadarRows(rows);
  const chartData = radarRows.map((row) => ({ name: row.dimension, value: row.score }));

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan">Macro dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-textStrong">宏观数据观察台</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-textMuted">
          将 AKShare 生成的宏观指标按投研主题重排，先看覆盖度和方向，再进入分类明细；缺失项保留在明细表中，便于继续补源和校验。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MacroKpiCard label="真实指标覆盖" value={`${realMetricCount}/${totalMetricCount}`} hint="已从生成数据中读取的真实宏观指标" status="real" />
        <MacroKpiCard label="缺失 / 待补项" value={`${missingMetricCount}`} hint="保留为待接入，不用示例数替代" status={missingMetricCount > 0 ? "missing" : "real"} />
        <MacroKpiCard label="最近更新" value={latestUpdate} hint="取已接入指标中的最新数据日期" status="stale" />
        <MacroKpiCard label="数据源数量" value={`${sourceCount}`} hint="当前宏观底层接口覆盖数量" status="real" />
      </div>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const shownRows = isExpanded ? group.rows : group.rows.slice(0, 4);

              return (
                <DashboardCard key={group.key} className="min-w-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-textStrong">{group.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-textMuted">{group.subtitle}</p>
                    </div>
                    <StatusBadge status={group.rows.some((row) => row.status === "real") ? "real" : "missing"} label={`${group.rows.length}项`} />
                  </div>

                  {group.rows.length > 0 ? (
                    <div className={`mt-4 space-y-2 ${isExpanded ? "max-h-[320px] overflow-y-auto pr-1" : ""}`}>
                      {shownRows.map((row) => (
                        <MacroMetricLine key={row.key} row={row} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-dashed border-borderSoft bg-bg2/50 p-3 text-sm leading-6 text-textMuted">
                      该分类数据待接入；后续可补充对应宏观接口或手工校验字段。
                    </div>
                  )}

                  {group.rows.length > 4 ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 rounded border border-borderSoft bg-bg2 px-2.5 py-1.5 text-xs font-medium text-textMuted transition hover:border-cyan/50 hover:text-cyan"
                      onClick={() => toggleGroup(group.key, setExpandedGroups)}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "收起明细" : `查看全部 ${group.rows.length} 项`}
                    </button>
                  ) : null}
                </DashboardCard>
              );
            })}
          </div>

          <MacroDetailTable rows={rows} />
        </div>

        <ChartPanel
          title="宏观观察雷达"
          description="基于已接入指标生成的展示型聚合视图，用于快速判断增长、流动性、政策和风险方向；底层指标请以完整明细表为准。"
          legend={<span className="inline-flex items-center gap-2 text-xs text-textMuted"><Activity className="h-4 w-4 text-cyan" />真实指标 {realMetricCount} 项</span>}
        >
          <div className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 18 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#94A3B8" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#94A3B8" }} width={70} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #334155", color: "#E5E7EB" }} labelStyle={{ color: "#E5E7EB" }} />
                <Bar dataKey="value" fill="#22D3EE" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-3">
            {radarRows.map((row) => (
              <div key={row.dimension} className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-textStrong">{row.dimension}</p>
                    <p className="mt-1 text-xs text-textMuted">{row.direction}</p>
                  </div>
                  <span className="font-mono text-lg font-semibold text-cyan">{row.score}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-textMuted">{row.drivers}</p>
                <p className="mt-2 text-[11px] text-textWeak">更新：{row.updatedAt || "待接入"}</p>
              </div>
            ))}
          </div>
        </ChartPanel>
      </section>
    </section>
  );
}

function MacroKpiCard({ label, value, hint, status }: { label: string; value: string; hint: string; status: DataSourceStatus }) {
  return (
    <DashboardCard className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-textMuted">{label}</p>
        <StatusBadge status={status} />
      </div>
      <p className="mt-3 break-words font-mono text-2xl font-semibold text-textStrong">{value}</p>
      <p className="mt-2 text-xs leading-5 text-textMuted">{hint}</p>
    </DashboardCard>
  );
}

function MacroMetricLine({ row }: { row: MacroIndicatorRow }) {
  return (
    <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-5 text-textStrong">{row.label}</p>
        <StatusBadge status={statusBadgeStatus[row.status]} label={statusLabel[row.status]} />
      </div>
      <p className="mt-2 break-words font-mono text-lg font-semibold leading-6 text-textStrong">
        {displayValue(row.value)}
        {row.unit ? <span className="ml-1 text-xs font-normal text-textMuted">{row.unit}</span> : null}
      </p>
      <div className="mt-2 space-y-1 text-xs leading-5 text-textMuted">
        <p className="whitespace-normal break-words">日期：{row.date || "待接入"}</p>
        <p className="whitespace-normal break-words">来源：{row.source || "待接入"}</p>
        {row.description ? <p className="whitespace-normal break-words text-textWeak">{row.description}</p> : null}
      </div>
    </div>
  );
}

function MacroDetailTable({ rows }: { rows: MacroIndicatorRow[] }) {
  return (
    <DashboardCard className="min-w-0 p-0">
      <div className="border-b border-borderSoft p-4">
        <h3 className="text-base font-semibold text-textStrong">宏观指标完整明细</h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">所有生成指标都会出现在这里，包括缺失、过期和待验证字段；表格内部可横向滚动。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-bg1/95 text-xs uppercase tracking-[0.12em] text-textWeak">
            <tr>
              {["分类", "指标", "当前值", "单位", "数据日期", "数据来源", "状态", "原始字段"].map((header) => (
                <th key={header} className="border-b border-borderSoft px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="transition hover:bg-cyan/5">
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.category}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top font-medium text-textStrong">{row.label}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top font-mono text-textStrong">{displayValue(row.value)}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.unit || "-"}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.date || "待接入"}</td>
                <td className="max-w-[220px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.source || "待接入"}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top">
                  <StatusBadge status={statusBadgeStatus[row.status]} label={statusLabel[row.status]} />
                </td>
                <td className="max-w-[240px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top font-mono text-xs text-textWeak">{row.rawKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

export function buildMacroIndicatorRows(indicators: MacroIndicator[]): MacroIndicatorRow[] {
  return indicators.flatMap((indicator) =>
    indicator.metrics.map((metric, index) => {
      const value = normalizeValue(metric.value);
      const status = normalizeStatus(metric.status, value);

      return {
        key: `${indicator.id}-${index}-${slug(metric.label)}`,
        label: metric.label || "未命名指标",
        category: mapMacroCategory(indicator, metric.label),
        value,
        unit: inferUnit(metric.label, metric.value),
        date: metric.updatedAt || extractDate(metric.note),
        source: metric.source || indicator.dataQuality?.find((item) => item.status === "real")?.source,
        status,
        description: metric.note,
        rawKey: `${indicator.id}.${metric.label || index}`,
      };
    }),
  );
}

function buildMacroGroups(rows: MacroIndicatorRow[]): MacroGroup[] {
  return macroGroups.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.category === group.key),
  }));
}

function buildRadarRows(rows: MacroIndicatorRow[]) {
  const pick = (category: string) => rows.filter((row) => row.category === category && row.status === "real");
  const growthRows = pick("增长与价格");
  const liquidityRows = [...pick("流动性"), ...pick("信用与社融")];
  const policyRows = pick("政策与利率");
  const riskRows = [...pick("汇率与外部环境"), ...pick("风险因子")];

  return [
    {
      dimension: "增长",
      score: scoreFromRows(growthRows, 58),
      direction: growthRows.length ? "增长与价格指标已有真实覆盖" : "增长数据待接入",
      drivers: summarizeRows(growthRows, "GDP、PMI、CPI、PPI等指标用于判断盈利周期和需求强弱。"),
      updatedAt: latestDateLabel(growthRows),
    },
    {
      dimension: "流动性",
      score: scoreFromRows(liquidityRows, 66),
      direction: liquidityRows.length ? "信用与市场资金数据可跟踪" : "流动性数据待接入",
      drivers: summarizeRows(liquidityRows, "M2、贷款、SHIBOR和两融余额用于判断资金价格和风险偏好。"),
      updatedAt: latestDateLabel(liquidityRows),
    },
    {
      dimension: "政策",
      score: scoreFromRows(policyRows, 64),
      direction: policyRows.length ? "利率与存准线索已接入" : "政策数据待接入",
      drivers: summarizeRows(policyRows, "LPR、存款准备金率等指标用于观察政策宽松或收敛方向。"),
      updatedAt: latestDateLabel(policyRows),
    },
    {
      dimension: "风险",
      score: scoreFromRows(riskRows, 52),
      direction: riskRows.length ? "外部变量可辅助风险识别" : "风险因子待扩展",
      drivers: summarizeRows(riskRows, "汇率、通胀和信用变量用于识别宏观风险扰动。"),
      updatedAt: latestDateLabel(riskRows),
    },
  ];
}

function mapMacroCategory(indicator: MacroIndicator, label: string): string {
  const text = `${indicator.name} ${indicator.category} ${label}`;
  if (/GDP|PMI|CPI|PPI|工业|社零|消费|价格/.test(text)) return "增长与价格";
  if (/SHIBOR|流动性|资金价格/.test(text)) return "流动性";
  if (/LPR|存准|准备金|政策|利率/.test(text)) return "政策与利率";
  if (/M2|贷款|社融|融资|两融|信用/.test(text)) return "信用与社融";
  if (/汇率|美元|人民币|外部/.test(text)) return "汇率与外部环境";
  if (/出口|进口|外贸/.test(text)) return "外贸";
  if (/地产|房/.test(text)) return "地产";
  if (/就业|失业/.test(text)) return "就业";
  if (/风险|杠杆|通胀/.test(text)) return "风险因子";
  return indicator.category || "风险因子";
}

function inferUnit(label: string, value?: string): string | undefined {
  const text = `${label} ${value ?? ""}`;
  if (/%/.test(text) || /同比|LPR|SHIBOR|利率|CPI|PPI/.test(text)) return "%";
  if (/万亿/.test(text)) return "万亿";
  if (/亿/.test(text)) return "亿";
  if (/PMI|指数/.test(text)) return "指数";
  if (/汇率|中间价/.test(text)) return "人民币";
  return undefined;
}

function normalizeValue(value?: string): string | number | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "X" || trimmed.includes("待") || trimmed.includes("暂缺")) return null;
  return trimmed;
}

function normalizeStatus(status: DataSourceStatus | undefined, value: string | number | null): MacroRowStatus {
  if (value === null || status === "missing" || status === "error") return "missing";
  if (status === "real") return "real";
  if (status === "stale") return "stale";
  return "pending";
}

function displayValue(value: string | number | null) {
  return value === null ? "暂无" : String(value);
}

function extractDate(note?: string): string | undefined {
  const match = note?.match(/(?:日期|月份|报告期|公布)[：:]\s*([^；;,，]+)/);
  return match?.[1]?.trim();
}

function latestDateLabel(rows: MacroIndicatorRow[]) {
  const datedRows = rows
    .map((row) => ({ label: row.date, time: row.date ? toSortableTime(row.date) : 0 }))
    .filter((item): item is { label: string; time: number } => Boolean(item.label));
  datedRows.sort((a, b) => b.time - a.time);
  return datedRows[0]?.label ?? "待接入";
}

function toSortableTime(label: string) {
  const isoMatch = label.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const monthMatch = label.match(/(\d{4})年(\d{1,2})月/);
  if (monthMatch) return Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);

  const quarterMatch = label.match(/(\d{4})年第(\d)季度/);
  if (quarterMatch) return Date.UTC(Number(quarterMatch[1]), Number(quarterMatch[2]) * 3 - 1, 1);

  return 0;
}

function scoreFromRows(rows: MacroIndicatorRow[], fallback: number) {
  if (!rows.length) return fallback;
  return Math.min(88, Math.max(42, fallback + Math.min(rows.length * 3, 18)));
}

function summarizeRows(rows: MacroIndicatorRow[], fallback: string) {
  if (!rows.length) return fallback;
  return rows.slice(0, 3).map((row) => `${row.label} ${displayValue(row.value)}`).join("；");
}

function slug(text: string) {
  return text.replace(/[^\da-zA-Z\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

function toggleGroup(key: string, setExpandedGroups: Dispatch<SetStateAction<Set<string>>>) {
  setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
}
