import { useMemo, useState } from "react";
import type { EarningsExpectationSnapshot, Stock } from "../../types";
import type { CreateEarningsExpectationSnapshotInput } from "../../services/earningsExpectationStore";
import { getCalendarToday, isoToZonedLocalDateTime, resolveTimeZone, resolveZonedLocalDateTime } from "../../utils/dateTime";
import { Modal } from "../common/Modal";

interface EarningsExpectationFormModalProps {
  stocks: Stock[];
  initialStockId?: string;
  correctionTarget?: EarningsExpectationSnapshot | null;
  timeZone?: string;
  now?: Date;
  onClose: () => void;
  onSubmit: (input: CreateEarningsExpectationSnapshotInput, correctsSnapshotId?: string) => void;
}

export function EarningsExpectationFormModal({ stocks, initialStockId, correctionTarget, timeZone: requestedTimeZone, now, onClose, onSubmit }: EarningsExpectationFormModalProps) {
  const timeZone = resolveTimeZone(requestedTimeZone);
  const initial = useMemo(() => formFrom(correctionTarget, initialStockId, timeZone, now ?? new Date()), [correctionTarget, initialStockId, now, timeZone]);
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [formationTimeError, setFormationTimeError] = useState<string | null>(null);
  const close = () => { if (!dirty || window.confirm("表单尚未保存，确认关闭？")) onClose(); };
  const set = (key: keyof FormState, value: string) => { setDirty(true); if (key === "formedAt") setFormationTimeError(null); setForm((current) => ({ ...current, [key]: value })); };
  const selectedStock = stocks.find((stock) => stock.id === form.stockId);
  const immutable = Boolean(correctionTarget);
  const submit = () => {
    if (!selectedStock) return;
    const sourcePublishedAt = temporalValue(form.sourcePublishedAt);
    const formation = resolveFormationInput(form.formedAt, timeZone);
    if (formation.error) { setFormationTimeError(formation.error); return; }
    const formedAt = formation.formedAt;
    const sourceVerificationStatus = form.sourceCategory === "user_estimate"
      ? "verified"
      : form.sourceCategory === "company_guidance" && !form.sourceUrl.trim()
        ? "pending"
        : form.sourceVerificationStatus as EarningsExpectationSnapshot["sourceVerificationStatus"];
    onSubmit({
      stockId: selectedStock.id,
      market: selectedStock.market,
      reportPeriod: form.reportPeriod,
      periodScope: form.periodScope as EarningsExpectationSnapshot["periodScope"],
      metric: form.metric as EarningsExpectationSnapshot["metric"],
      estimateShape: form.estimateShape as EarningsExpectationSnapshot["estimateShape"],
      value: form.estimateShape === "point" ? numberOrNull(form.value) : null,
      lowerBound: form.estimateShape === "range" ? numberOrNull(form.lowerBound) : null,
      upperBound: form.estimateShape === "range" ? numberOrNull(form.upperBound) : null,
      currency: form.currency as EarningsExpectationSnapshot["currency"],
      unit: form.unit as EarningsExpectationSnapshot["unit"],
      accountingBasis: form.accountingBasis as EarningsExpectationSnapshot["accountingBasis"],
      sourceCategory: form.sourceCategory as EarningsExpectationSnapshot["sourceCategory"],
      sourceName: form.sourceCategory === "user_estimate" ? (form.sourceName.trim() ? form.sourceName : "用户个人预测") : form.sourceName,
      sourceTitle: form.sourceTitle.trim(),
      sourceUrl: form.sourceUrl.trim() || null,
      sourcePublishedAt,
      sourcePublishedAtPrecision: sourcePublishedAt ? (sourcePublishedAt.includes("T") ? "datetime" : "date") : null,
      asOfDate: form.asOfDate,
      formedAt,
      formedAtPrecision: formation.precision,
      analystCount: integerOrNull(form.analystCount),
      institutionCount: integerOrNull(form.institutionCount),
      ingestionMethod: "manual",
      sourceVerificationStatus,
      notes: form.notes.trim() || null,
    }, correctionTarget?.id);
  };

  return (
    <Modal title={correctionTarget ? "创建纠正快照" : "添加业绩预期"} description="保存后不可原地修改；错误修正必须追加纠正快照。" onClose={close} footer={<><button type="button" onClick={close} className={buttonClass}>取消</button><button type="button" onClick={submit} className={`${buttonClass} border-cyan/50 text-cyan`}>{correctionTarget ? "保存纠正快照" : "保存不可变快照"}</button></>}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="公司"><select disabled={immutable} value={form.stockId} onChange={(event) => set("stockId", event.target.value)} className={inputClass}><option value="">请选择公司</option>{stocks.map((stock) => <option key={stock.id} value={stock.id}>{stock.name} · {stock.code}</option>)}</select></Field>
        <Field label="报告期"><input disabled={immutable} type="text" inputMode="numeric" placeholder="YYYY-MM-DD" value={form.reportPeriod} onChange={(event) => set("reportPeriod", event.target.value)} className={inputClass} /></Field>
        <Field label="期间口径"><select disabled={immutable} value={form.periodScope} onChange={(event) => set("periodScope", event.target.value)} className={inputClass}>{periodScopeOptions.map(option)}</select></Field>
        <Field label="财务指标"><select disabled={immutable} value={form.metric} onChange={(event) => { set("metric", event.target.value); if (event.target.value === "eps") set("unit", "currency_per_share"); else if (form.unit === "currency_per_share") set("unit", "yuan"); }} className={inputClass}>{metricOptions.map(option)}</select></Field>
        <Field label="预测形态"><select value={form.estimateShape} onChange={(event) => set("estimateShape", event.target.value)} className={inputClass}><option value="point">点预测</option><option value="range">区间预测</option></select></Field>
        {form.estimateShape === "point" ? <Field label="预测值"><input inputMode="decimal" value={form.value} onChange={(event) => set("value", event.target.value)} className={inputClass} placeholder="不允许空字符串、NaN 或 Infinity" /></Field> : <><Field label="区间下限"><input inputMode="decimal" value={form.lowerBound} onChange={(event) => set("lowerBound", event.target.value)} className={inputClass} /></Field><Field label="区间上限"><input inputMode="decimal" value={form.upperBound} onChange={(event) => set("upperBound", event.target.value)} className={inputClass} /></Field></>}
        <Field label="币种"><select value={form.currency} onChange={(event) => set("currency", event.target.value)} className={inputClass}><option>CNY</option><option>HKD</option><option>USD</option></select></Field>
        <Field label="单位"><select value={form.unit} onChange={(event) => set("unit", event.target.value)} className={inputClass} disabled={form.metric === "eps"}>{unitOptions.map(option)}</select></Field>
        <Field label="会计口径"><select value={form.accountingBasis} onChange={(event) => set("accountingBasis", event.target.value)} className={inputClass}><option value="PRC_GAAP">中国企业会计准则</option><option value="IFRS">IFRS</option><option value="unknown">未知（将不可比较）</option></select></Field>
        <Field label="来源类别"><select disabled={immutable} value={form.sourceCategory} onChange={(event) => set("sourceCategory", event.target.value)} className={inputClass}>{sourceCategoryOptions.map(option)}</select></Field>
        <Field label="来源主体 / 机构"><input disabled={immutable} value={form.sourceName} onChange={(event) => set("sourceName", event.target.value)} className={inputClass} placeholder={form.sourceCategory === "user_estimate" ? "默认：用户个人预测" : "公司或机构名称"} /></Field>
        <Field label="来源标题"><input value={form.sourceTitle} onChange={(event) => set("sourceTitle", event.target.value)} className={inputClass} /></Field>
        <Field label="来源链接"><input type="url" value={form.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} className={inputClass} placeholder="https://；一致预期必须填写" /></Field>
        <Field label="来源发布日期 / 时间"><input type="text" placeholder="YYYY-MM-DD 或 ISO 时间（外部已核验来源必填）" value={form.sourcePublishedAt} onChange={(event) => set("sourcePublishedAt", event.target.value)} className={inputClass} /></Field>
        <Field label="预期形成日期"><input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" value={form.asOfDate} onChange={(event) => set("asOfDate", event.target.value)} className={inputClass} /></Field>
        <Field label="精确形成时间（可选）"><input type="datetime-local" value={form.formedAt} onChange={(event) => set("formedAt", event.target.value)} className={inputClass} aria-invalid={Boolean(formationTimeError)} /><span className="mt-1 block leading-4">留空按日期精度处理；同日披露无法证明事前形成。</span>{formationTimeError ? <span role="alert" className="mt-1 block leading-4 text-danger">{formationTimeError}</span> : null}</Field>
        <Field label="分析师数量"><input type="number" min="0" step="1" value={form.analystCount} onChange={(event) => set("analystCount", event.target.value)} className={inputClass} /></Field>
        <Field label="机构数量"><input type="number" min="0" step="1" value={form.institutionCount} onChange={(event) => set("institutionCount", event.target.value)} className={inputClass} /></Field>
        <Field label="来源核验状态"><select value={form.sourceVerificationStatus} onChange={(event) => set("sourceVerificationStatus", event.target.value)} className={inputClass} disabled={form.sourceCategory === "user_estimate"}><option value="verified">已核验</option><option value="pending">待核验</option><option value="unverified">无法核验</option></select></Field>
        <label className="min-w-0 text-xs text-textMuted sm:col-span-2">备注<textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} className={`${inputClass} mt-1 min-h-24 py-2`} /></label>
      </div>
      <div className="mt-4 rounded border border-borderSoft bg-surface/60 p-3 text-xs leading-5 text-textMuted">工作流时区：<span className="font-semibold text-textStrong">{timeZone}</span>。日期校验与 datetime-local 转换均使用该时区。</div>
      <div className="mt-3 rounded border border-warning/35 bg-warning/10 p-3 text-xs leading-5 text-warning">
        {form.sourceCategory === "user_estimate" ? "当前记录会显著标记为用户个人预测，不会包装成机构预测。" : form.sourceCategory === "institution_single" ? "单家机构预测不会包装成机构一致预期。" : form.sourceCategory === "institution_consensus" ? "必须提供明确、可核验的来源主体、标题和链接。" : "公司指引应关联公司公告或明确来源；缺少链接时自动进入待核验状态。"}
      </div>
    </Modal>
  );
}

interface FormState { stockId: string; reportPeriod: string; periodScope: string; metric: string; estimateShape: string; value: string; lowerBound: string; upperBound: string; currency: string; unit: string; accountingBasis: string; sourceCategory: string; sourceName: string; sourceTitle: string; sourceUrl: string; sourcePublishedAt: string; asOfDate: string; formedAt: string; analystCount: string; institutionCount: string; sourceVerificationStatus: string; notes: string }
export function resolveFormationInput(value: string, timeZone: string): { formedAt: string | null; precision: "date" | "datetime"; error: string | null } {
  if (!value) return { formedAt: null, precision: "date", error: null };
  const resolved = resolveZonedLocalDateTime(value, timeZone);
  if (resolved.status === "valid") return { formedAt: resolved.instant, precision: "datetime", error: null };
  if (resolved.status === "nonexistent") return { formedAt: null, precision: "date", error: `该本地时间在 ${timeZone} 因夏令时跳转不存在，请调整时间或留空按日期精度保存。` };
  if (resolved.status === "ambiguous") return { formedAt: null, precision: "date", error: `该本地时间在 ${timeZone} 因夏令时回拨存在两个可能时刻，V1 暂不猜测偏移，请调整时间或留空按日期精度保存。` };
  return { formedAt: null, precision: "date", error: resolved.reason };
}
function formFrom(snapshot: EarningsExpectationSnapshot | null | undefined, stockId: string | undefined, timeZone: string, now: Date): FormState { return snapshot ? { stockId: snapshot.stockId, reportPeriod: snapshot.reportPeriod, periodScope: snapshot.periodScope, metric: snapshot.metric, estimateShape: snapshot.estimateShape, value: text(snapshot.value), lowerBound: text(snapshot.lowerBound), upperBound: text(snapshot.upperBound), currency: snapshot.currency, unit: snapshot.unit, accountingBasis: snapshot.accountingBasis, sourceCategory: snapshot.sourceCategory, sourceName: snapshot.sourceName, sourceTitle: snapshot.sourceTitle, sourceUrl: snapshot.sourceUrl ?? "", sourcePublishedAt: snapshot.sourcePublishedAt ?? "", asOfDate: snapshot.asOfDate, formedAt: isoToZonedLocalDateTime(snapshot.formedAt, timeZone), analystCount: text(snapshot.analystCount), institutionCount: text(snapshot.institutionCount), sourceVerificationStatus: snapshot.sourceVerificationStatus, notes: snapshot.notes ?? "" } : { stockId: stockId ?? "", reportPeriod: "", periodScope: "single_quarter", metric: "revenue", estimateShape: "point", value: "", lowerBound: "", upperBound: "", currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "用户个人预测", sourceTitle: "", sourceUrl: "", sourcePublishedAt: "", asOfDate: getCalendarToday(now, timeZone), formedAt: "", analystCount: "", institutionCount: "", sourceVerificationStatus: "verified", notes: "" }; }
function numberOrNull(value: string) { if (!value.trim()) return null; return Number(value); }
function integerOrNull(value: string) { if (!value.trim()) return null; return Number(value); }
function text(value: number | null) { return value === null ? "" : String(value); }
function temporalValue(value: string) { const input = value.trim(); if (!input) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input; const parsed = Date.parse(input); return Number.isNaN(parsed) ? input : new Date(parsed).toISOString(); }
function option([value, label]: [string, string]) { return <option key={value} value={value}>{label}</option>; }
const periodScopeOptions: Array<[string, string]> = [["single_quarter", "单季度"], ["year_to_date", "年初至今累计"], ["half_year", "半年度"], ["first_three_quarters", "前三季度累计"], ["full_year", "全年度"], ["ttm", "TTM"]];
const metricOptions: Array<[string, string]> = [["revenue", "营业收入"], ["attributable_net_profit", "归母净利润"], ["adjusted_net_profit", "扣非净利润"], ["eps", "每股收益"], ["operating_cash_flow", "经营现金流"]];
const unitOptions: Array<[string, string]> = [["yuan", "元"], ["ten_thousand_yuan", "万元"], ["million_yuan", "百万元"], ["hundred_million_yuan", "亿元"], ["currency_per_share", "每股币值"]];
const sourceCategoryOptions: Array<[string, string]> = [["company_guidance", "公司指引"], ["institution_single", "单家机构预测"], ["institution_consensus", "机构一致预期"], ["user_estimate", "用户个人预测"]];
const inputClass = "mt-1 h-10 w-full min-w-0 rounded border border-borderSoft bg-bg px-3 text-sm text-textStrong outline-none focus:border-cyan disabled:opacity-60";
const buttonClass = "h-9 rounded border border-borderSoft px-3 text-sm text-textStrong";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted">{label}{children}</label>; }
