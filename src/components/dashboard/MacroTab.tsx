import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Minus, Radar } from "lucide-react";
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
  sourceDisplayName: string;
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
  const firstActiveGroup = groups.find((group) => group.rows.length > 0)?.key ?? groups[0]?.key ?? "增长与价格";
  const [selectedGroupKey, setSelectedGroupKey] = useState(firstActiveGroup);

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0];
  const totalMetricCount = rows.length;
  const realMetricCount = rows.filter((row) => row.status === "real").length;
  const missingMetricCount = rows.filter((row) => row.status === "missing").length;
  const sourceCount = new Set(rows.map((row) => row.sourceDisplayName).filter(Boolean)).size;
  const latestUpdate = latestDateLabel(rows);
  const radarRows = buildRadarRows(rows);
  const chartData = radarRows.map((row) => ({ name: row.dimension, value: row.score }));

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan/80">Macro dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-textStrong">宏观数据观察台</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-textMuted">
          按投研主题组织宏观指标：上方看分类摘要，中间查看当前分类完整指标，雷达图独立解释方向，底部保留全量明细用于对账。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MacroKpiCard label="真实指标覆盖" value={`${realMetricCount}/${totalMetricCount}`} hint="已从生成数据中读取的真实宏观指标" status="real" />
        <MacroKpiCard label="缺失 / 待补项" value={`${missingMetricCount}`} hint="保留待接入状态，不用示例数替代" status={missingMetricCount > 0 ? "missing" : "real"} />
        <MacroKpiCard label="最近更新" value={latestUpdate} hint="取已接入指标中的最新数据日期" status="stale" />
        <MacroKpiCard label="可读来源" value={`${sourceCount}`} hint="主界面展示机构名称，原始接口留在明细表" status="real" />
      </div>

      <section className="space-y-3">
        <SectionTitle title="宏观分类摘要" description="每张卡片只展示核心摘要；点击卡片后，下方显示该分类完整指标。" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {groups.map((group) => (
            <MacroSummaryCard
              key={group.key}
              group={group}
              selected={group.key === selectedGroup?.key}
              onSelect={() => setSelectedGroupKey(group.key)}
            />
          ))}
        </div>
      </section>

      {selectedGroup ? <SelectedMacroGroup group={selectedGroup} /> : null}

      <ChartPanel
        title="宏观观察雷达"
        description="独立展示宏观方向判断，避免挤压分类卡片；底层指标仍以明细表为准。"
        legend={<span className="inline-flex items-center gap-2 text-xs text-textMuted"><Activity className="h-4 w-4 text-cyan" />真实指标 {realMetricCount} 项</span>}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(340px,1.1fr)]">
          <div className="h-[280px] min-w-0">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {radarRows.map((row) => (
              <div key={row.dimension} className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-textStrong">{row.dimension}</p>
                    <p className="mt-1 text-xs text-textMuted">{row.direction}</p>
                  </div>
                  <span className="font-mono text-2xl font-semibold text-cyan">{row.score}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-textMuted">驱动指标：{row.drivers}</p>
                <p className="mt-2 text-[11px] text-textWeak">更新：{row.updatedAt || "待接入"}</p>
              </div>
            ))}
          </div>
        </div>
      </ChartPanel>

      <MacroDetailTable rows={rows} />
    </section>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-textStrong">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
    </div>
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

function MacroSummaryCard({ group, selected, onSelect }: { group: MacroGroup; selected: boolean; onSelect: () => void }) {
  const visibleRows = group.rows.slice(0, 3);
  const groupStatus = group.rows.some((row) => row.status === "real") ? "real" : group.rows.length > 0 ? "stale" : "missing";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-w-0 rounded-xl border p-4 text-left transition ${
        selected ? "border-cyan/55 bg-cyan/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]" : "border-borderSoft bg-bg2/60 hover:border-cyan/35 hover:bg-bg2"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="whitespace-normal text-lg font-semibold leading-7 text-textStrong">{group.title}</h4>
          <p className="mt-1 text-xs leading-5 text-textMuted">{group.subtitle}</p>
        </div>
        <StatusBadge status={groupStatus} label={group.rows.length ? `${group.rows.length}项` : "待接入"} />
      </div>

      {visibleRows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {visibleRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 rounded-md bg-bg1/60 px-3 py-2">
              <span className="min-w-0 text-sm text-textMuted">{row.label}</span>
              <span className="shrink-0 font-mono text-sm font-semibold text-textStrong">{displayValue(row.value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-borderSoft bg-bg1/40 p-3 text-sm leading-6 text-textMuted">该分类数据待接入</p>
      )}
    </button>
  );
}

function SelectedMacroGroup({ group }: { group: MacroGroup }) {
  const Icon = group.rows.length > 0 ? BarChart3 : Radar;

  return (
    <DashboardCard className="min-w-0 p-5">
      <div className="flex flex-col gap-3 border-b border-borderSoft pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2 text-cyan">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-semibold text-textStrong">{group.title}</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-textMuted">{group.subtitle}</p>
        </div>
        <StatusBadge status={group.rows.some((row) => row.status === "real") ? "real" : "missing"} label={`${group.rows.length} 项指标`} />
      </div>

      {group.rows.length > 0 ? (
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {group.rows.map((row) => (
            <MacroMetricBlock key={row.key} row={row} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-borderSoft bg-bg2/50 p-5 text-sm leading-6 text-textMuted">
          该分类暂未接入可用指标；后续补充数据源后会自动出现在这里。
        </div>
      )}
    </DashboardCard>
  );
}

function MacroMetricBlock({ row }: { row: MacroIndicatorRow }) {
  return (
    <div className="min-w-0 rounded-lg border border-borderSoft bg-bg2/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-normal text-sm font-medium leading-5 text-textStrong">{row.label}</p>
        <StatusBadge status={statusBadgeStatus[row.status]} label={statusLabel[row.status]} />
      </div>
      <p className="mt-3 whitespace-normal break-words font-mono text-2xl font-semibold leading-8 text-textStrong">
        {displayValue(row.value)}
        {row.unit ? <span className="ml-1 text-sm font-normal text-textMuted">{row.unit}</span> : null}
      </p>
      <div className="mt-3 space-y-1 text-xs leading-5 text-textMuted">
        <p>日期：{row.date || "待接入"}</p>
        <p title={row.source || row.sourceDisplayName}>来源：{row.sourceDisplayName}</p>
      </div>
    </div>
  );
}

function MacroDetailTable({ rows }: { rows: MacroIndicatorRow[] }) {
  return (
    <DashboardCard className="min-w-0 p-0">
      <div className="border-b border-borderSoft p-4">
        <h3 className="text-base font-semibold text-textStrong">宏观指标明细表</h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">全量指标承载区。主界面展示可读来源，原始接口保留在“原始字段”中用于排查和对账。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-bg1/95 text-xs uppercase tracking-[0.12em] text-textWeak">
            <tr>
              {["分类", "指标名称", "当前值", "单位", "日期", "来源", "状态", "原始字段 key"].map((header) => (
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
                <td className="max-w-[240px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.sourceDisplayName}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top">
                  <StatusBadge status={statusBadgeStatus[row.status]} label={statusLabel[row.status]} />
                </td>
                <td className="max-w-[260px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top font-mono text-xs text-textWeak" title={row.source || row.rawKey}>
                  {row.rawKey}
                </td>
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
      const rawSource = metric.source || indicator.dataQuality?.find((item) => item.status === "real")?.source;

      return {
        key: `${indicator.id}-${index}-${slug(metric.label)}`,
        label: metric.label || "未命名指标",
        category: mapMacroCategory(indicator, metric.label),
        value,
        unit: inferUnit(metric.label, metric.value),
        date: metric.updatedAt || extractDate(metric.note),
        source: rawSource,
        sourceDisplayName: sourceDisplayName(rawSource),
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
      direction: growthRows.length ? "偏利好" : "待验证",
      drivers: summarizeLabels(growthRows, "GDP同比、制造业PMI、非制造业PMI"),
      updatedAt: latestDateLabel(growthRows),
    },
    {
      dimension: "流动性",
      score: scoreFromRows(liquidityRows, 66),
      direction: liquidityRows.length ? "偏宽松" : "待验证",
      drivers: summarizeLabels(liquidityRows, "M2同比、LPR、SHIBOR"),
      updatedAt: latestDateLabel(liquidityRows),
    },
    {
      dimension: "政策",
      score: scoreFromRows(policyRows, 64),
      direction: policyRows.length ? "中性偏积极" : "待验证",
      drivers: summarizeLabels(policyRows, "LPR、存准率、政策利率"),
      updatedAt: latestDateLabel(policyRows),
    },
    {
      dimension: "风险",
      score: scoreFromRows(riskRows, 52),
      direction: riskRows.length ? "中性" : "待扩展",
      drivers: summarizeLabels(riskRows, "价格波动、汇率、数据缺失"),
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

function sourceDisplayName(source?: string) {
  if (!source) return "待接入";
  if (/macro_china_gdp|macro_china_cpi|macro_china_ppi|macro_china_pmi|macro_china_non_man_pmi|macro_china_gyzjz|macro_china_consumer_goods_retail/.test(source)) {
    return "国家统计局 / AKShare";
  }
  if (/macro_china_money_supply|macro_china_new_financial_credit|macro_china_reserve_requirement_ratio/.test(source)) {
    return "央行 / AKShare";
  }
  if (/macro_china_lpr/.test(source)) {
    return "全国银行间同业拆借中心 / AKShare";
  }
  if (/macro_china_shibor_all/.test(source)) {
    return "上海银行间同业拆放利率 / AKShare";
  }
  if (/macro_china_rmb/.test(source)) {
    return "中国外汇交易中心 / AKShare";
  }
  if (/macro_china_market_margin/.test(source)) {
    return "交易所融资融券 / AKShare";
  }
  return source.replace(/^AKShare[:\s]*/i, "AKShare / ");
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

function summarizeLabels(rows: MacroIndicatorRow[], fallback: string) {
  if (!rows.length) return fallback;
  return rows.slice(0, 3).map((row) => row.label).join("、");
}

function slug(text: string) {
  return text.replace(/[^\da-zA-Z\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}
