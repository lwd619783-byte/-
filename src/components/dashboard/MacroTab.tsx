import { useMemo, useState } from "react";
import { BarChart3, Radar } from "lucide-react";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import { describeDataTime, summarizeDataTimes, summarizeSourceStatuses, type DisplayTimeKind } from "../../utils/dataTrustDisplay";
import type { DataSourceStatus, MacroIndicator } from "../../types";
import { DashboardCard, StatusBadge } from "../common/terminal";

type MacroRowStatus = DataSourceStatus | "unknown";

type MacroIndicatorRow = {
  key: string;
  label: string;
  category: string;
  value: string | number | null;
  unit?: string;
  date?: string;
  timeKind: DisplayTimeKind;
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

export function MacroTab({ indicators, generatedAt, now }: { indicators: MacroIndicator[]; generatedAt?: string; now?: Date }) {
  const displayNow = useDisplayNow(now);
  const rows = useMemo(() => buildMacroIndicatorRows(indicators), [indicators]);
  const groups = useMemo(() => buildMacroGroups(rows), [rows]);
  const firstActiveGroup = groups.find((group) => group.rows.length > 0)?.key ?? groups[0]?.key ?? "增长与价格";
  const [selectedGroupKey, setSelectedGroupKey] = useState(firstActiveGroup);

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0];
  const totalMetricCount = rows.length;
  const coveredCount = rows.filter((row) => row.value !== null).length;
  const realMetricCount = rows.filter((row) => row.status === "real").length;
  const times = summarizeDataTimes(rows.map((row) => ({ value: row.date, kind: row.timeKind })), displayNow);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan/80">宏观研究看板</p>
        <h2 className="mt-2 text-2xl font-semibold text-textStrong">宏观数据观察台</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-textMuted">
          按分类浏览指标观测与原始值，底部保留全量明细用于对账。正式方向模型尚未接入，数据覆盖数量不代表经济强弱。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MacroKpiCard label="数值覆盖" value={`${coveredCount}/${totalMetricCount}`} hint="按展示条目统计，重复指标未去重；仅表示有值，不表示经济强弱" />
        <MacroKpiCard label="来源标记真实" value={`${realMetricCount}/${totalMetricCount}`} hint={summarizeSourceStatuses(rows.map((row) => row.status))} />
        <MacroKpiCard label="数值缺失" value={`${totalMetricCount - coveredCount}/${totalMetricCount}`} hint="缺失保留为空，不以零或示例补齐" />
        <MacroKpiCard label="时间语义" value="时效待核验" hint={`报告期 ${times.period}；仅日期 ${times.dateOnly}；精确时间 ${times.recent + times.older}；缺失 ${times.missing}；异常 ${times.invalid + times.future}；未知 ${times.unknown}。分母 ${times.total}，逐项核验。`} />

      </div>

      <p className="break-words text-xs leading-5 text-textMuted">{describeDataTime(generatedAt, "generated", displayNow).text}。文件生成不代表全部指标已更新。</p>

      <section className="space-y-3">
        <SectionTitle title="宏观分类摘要" description="每张卡片只展示核心摘要；点击卡片后，下方显示该分类完整指标。" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {groups.map((group) => (
            <MacroSummaryCard
              key={group.key}
              group={group}
              now={displayNow}
              selected={group.key === selectedGroup?.key}
              onSelect={() => setSelectedGroupKey(group.key)}
            />
          ))}
        </div>
      </section>

      {selectedGroup ? <SelectedMacroGroup group={selectedGroup} now={displayNow} /> : null}

      <DashboardCard className="p-5">
        <h3 className="text-base font-semibold text-textStrong">宏观指标观测 · 模型尚未接入</h3>
        <p className="mt-2 text-sm leading-6 text-textMuted">当前展示仅为原始指标观测，不输出方向分或当前宏观结论。方法说明：方向判断还需验证指标口径、发布时间、修订记录与正式模型。</p>
      </DashboardCard>

      <MacroDetailTable rows={rows} now={displayNow} />
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

function MacroKpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <DashboardCard className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-textMuted">{label}</p>
      </div>
      <p className="mt-3 break-words font-mono text-2xl font-semibold text-textStrong">{value}</p>
      <p className="mt-2 text-xs leading-5 text-textMuted">{hint}</p>
    </DashboardCard>
  );
}

function MacroSummaryCard({ group, selected, onSelect, now }: { group: MacroGroup; selected: boolean; onSelect: () => void; now: Date }) {
  const visibleRows = group.rows.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-xl border p-4 text-left transition ${
        selected ? "border-cyan/55 bg-cyan/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]" : "border-borderSoft bg-bg2/60 hover:border-cyan/35 hover:bg-bg2"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="whitespace-normal text-lg font-semibold leading-7 text-textStrong">{group.title}</h4>
          <p className="mt-1 text-xs leading-5 text-textMuted">{group.subtitle}</p>
        </div>
        <span className="text-xs text-textMuted">{group.rows.length} 项观测</span>
      </div>

      <p className="mt-2 text-xs leading-5 text-textMuted">来源：{summarizeSourceStatuses(group.rows.map((row) => row.status))}；时效待核验</p>
      {visibleRows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {visibleRows.map((row) => (
            <div key={row.key} className="min-w-0 rounded-md bg-bg1/60 px-3 py-2">
              <span className="min-w-0 text-sm text-textMuted">{row.label}</span>
              <span className="ml-2 break-words font-mono text-sm font-semibold text-textStrong">{displayValue(row.value)}</span>
              <span className="mt-1 block break-words text-xs leading-5 text-textMuted">{describeDataTime(row.date, row.timeKind, now).text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-borderSoft bg-bg1/40 p-3 text-sm leading-6 text-textMuted">该分类数据待接入</p>
      )}
    </button>
  );
}

function SelectedMacroGroup({ group, now }: { group: MacroGroup; now: Date }) {
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
        <p className="text-xs leading-5 text-textMuted">来源：{summarizeSourceStatuses(group.rows.map((row) => row.status))}</p>
      </div>

      {group.rows.length > 0 ? (
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
          {group.rows.map((row) => (
            <MacroMetricBlock key={row.key} row={row} now={now} />
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

function MacroMetricBlock({ row, now }: { row: MacroIndicatorRow; now: Date }) {
  return (
    <div className="min-w-0 rounded-lg border border-borderSoft bg-bg2/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-normal text-sm font-medium leading-5 text-textStrong">{row.label}</p>
        <StatusBadge status={row.status} />
      </div>
      <p className="mt-3 whitespace-normal break-words font-mono text-2xl font-semibold leading-8 text-textStrong">
        {displayValue(row.value)}

      </p>
      <div className="mt-3 space-y-1 text-xs leading-5 text-textMuted">
        <p className="break-words">{describeDataTime(row.date, row.timeKind, now).text}</p>
        <p title={row.source || row.sourceDisplayName}>来源：{row.sourceDisplayName}</p>
        {row.description ? <p className="break-words">原始说明：{row.description}</p> : null}
      </div>
    </div>
  );
}

function MacroDetailTable({ rows, now }: { rows: MacroIndicatorRow[]; now: Date }) {
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
              {["分类", "指标名称", "观测值", "单位", "时间与时效", "来源", "来源状态", "原始字段 key"].map((header) => (
                <th key={header} className="border-b border-borderSoft px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="p-4 text-textMuted">暂无宏观指标；模型尚未接入。</td></tr> : null}
            {rows.map((row) => (
              <tr key={row.key} className="transition hover:bg-cyan/5">
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.category}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top font-medium text-textStrong">{row.label}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top font-mono text-textStrong">{displayValue(row.value)}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.unit || "未知"}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{describeDataTime(row.date, row.timeKind, now).text}</td>
                <td className="max-w-[240px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.sourceDisplayName}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top">
                  <StatusBadge status={row.status} />
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
      const status = metric.status ?? "unknown";
      const rawSource = metric.source;

      return {
        key: `${indicator.id}-${index}-${slug(metric.label)}`,
        label: metric.label || "未命名指标",
        category: mapMacroCategory(indicator, metric.label),
        value,
        unit: extractUnit(metric.value),
        date: metric.updatedAt || extractDate(metric.note),
        timeKind: macroTimeKind(metric),
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

function extractUnit(value?: string): string | undefined {
  // Only units present in the raw value; a label such as 同比 does not prove percent units.
  return value?.match(/亿美元|万亿|亿元|亿|%/)?.[0];
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
  if (!trimmed || ["X", "N/A", "NaN", "数据暂缺", "暂未获取", "暂无", "待接入"].includes(trimmed)) return null;
  return trimmed;
}

function displayValue(value: string | number | null) {
  return value === null ? "暂无" : String(value);
}

function extractDate(note?: string): string | undefined {
  const match = note?.match(/(?:日期|月份|报告期|公布)[：:]\s*([^；;,，]+)/);
  return match?.[1]?.trim();
}

function slug(text: string) {
  return text.replace(/[^\da-zA-Z\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

/** Only script-proven labels distinguish publication / period. Generic 日期 is ambiguous. */
function macroTimeKind(metric: MacroIndicator["metrics"][number]): DisplayTimeKind {
  if (/(?:月份|报告期)[：:]/.test(metric.note)) return "period";
  if (/公布[：:]/.test(metric.note)) return "publication";
  if (/macro_china_(?:shibor_all|rmb|market_margin_sh\/sz|lpr)$/.test(metric.source ?? "")) return "observation";
  return "unknown";
}
