import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AShareFinancialData, FinancialReport } from "../../types";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { chartColors, chartTickStyle, chartTooltipStyle } from "../charts/theme";
import { ChartPanel } from "../common/ChartPanel";

type Selection = { period: "singleQuarter" | "cumulative"; scope: string };
export function CompanyFinancialHistory({ detail, selection, onSelectionChange }: { detail: AShareFinancialData | null; selection?: Selection; onSelectionChange?: (selection: Selection) => void }) {
  const [localSelection, setLocalSelection] = useState<Selection>({ period: "singleQuarter", scope: "consolidated" });
  const { period, scope } = selection ?? localSelection;
  const update = (change: Partial<Selection>) => { const next = { period, scope, ...change }; setLocalSelection(next); onSelectionChange?.(next); };
  const reports = detail?.reports ?? [];
  const scopes = [...new Set(reports.map((report) => report.statementScope))];
  const currentScope = scopes.includes(scope as typeof scopes[number]) ? scope : scopes[0];
  const scopeName = (value: string) => ({ consolidated: "合并报表", parent: "母公司报表", unknown: "范围未知" })[value] ?? value;
  const rows = reports.filter((report) => report.statementScope === currentScope).map((report) => ({
    period: report.reportPeriod,
    revenue: report.status === "conflicted" ? null : report[period]?.operatingRevenue ?? null,
    profit: report.status === "conflicted" ? null : report[period]?.netProfitAttributableToParent ?? null,
    cashFlow: report.status === "conflicted" ? null : report[period]?.netOperatingCashFlow ?? null,
  })).sort((left, right) => left.period.localeCompare(right.period));
  return <div className="space-y-4">
    {!reports.length ? <p className="rounded-lg border border-borderSoft bg-bg2 p-4 text-sm text-textMuted">完整历史尚不可用；当前财务快照和加载状态见上方。历史趋势需要连续报告数据。</p> : <>
      {reports.some((report) => report.status === "conflicted") ? <p role="alert" className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">存在冲突财务报告。原始报告保留在下方，冲突数值不进入趋势图。</p> : null}
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-textMuted">期间口径<select aria-label="财务趋势期间口径" value={period} onChange={(event) => update({ period: event.target.value as typeof period })} className="ml-2 rounded border border-control bg-bg2 p-2 text-sm text-textStrong"><option value="singleQuarter">单季度</option><option value="cumulative">年初至报告期累计</option></select></label>
        <label className="text-xs text-textMuted">报表范围<select aria-label="财务趋势报表范围" value={currentScope} onChange={(event) => update({ scope: event.target.value })} className="ml-2 rounded border border-control bg-bg2 p-2 text-sm text-textStrong">{scopes.map((value) => <option key={value} value={value}>{scopeName(value)}</option>)}</select></label>
      </div>
      <ChartPanel title="分期经营读数" description={`${period === "singleQuarter" ? "单季度" : "年初至报告期累计"} · ${scopeName(currentScope)} · CNY / 元；沿用报告原有口径，缺值保留。`}
        empty={!rows.some((row) => row.revenue !== null || row.profit !== null || row.cashFlow !== null)}
        summary={`${rows.length} 期已有报告；单季与累计、合并与母公司分别查看，缺值保留。`}
        dataTable={<table className="w-full min-w-[520px] text-xs"><thead><tr>{["报告期", "营业收入（元）", "归母净利润（元）", "经营现金流（元）"].map((label) => <th key={label} className="p-2 text-right first:text-left">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.period}-${index}`} className="border-t border-borderSoft"><td className="p-2">{row.period}</td>{[row.revenue, row.profit, row.cashFlow].map((value, key) => <td key={key} className="p-2 text-right tabular-nums">{value === null ? "暂未获取" : value}</td>)}</tr>)}</tbody></table>}>
        <div className="h-72" role="img" aria-label="分期经营柱形图，原始数值可展开数据表"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}><CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" /><XAxis dataKey="period" tick={chartTickStyle} minTickGap={28} /><YAxis tick={chartTickStyle} width={70} tickFormatter={(value: number) => formatFinancialAmount(value)} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatFinancialAmount(value)} /><Legend /><Bar dataKey="revenue" name="营业收入" fill={chartColors.primary} isAnimationActive={false} /><Bar dataKey="profit" name="归母净利润" fill={chartColors.secondary} isAnimationActive={false} /><Bar dataKey="cashFlow" name="经营现金流" fill={chartColors.info} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      </ChartPanel>
      <details className="rounded-lg border border-control bg-bg2 p-4"><summary className="cursor-pointer text-sm font-semibold text-accent">三表完整历史与原始报告（{reports.length} 期）</summary><div className="mt-4 space-y-3">{reports.map((report, index) => <details key={`${report.reportPeriod}-${index}`} className="min-w-0 rounded border border-borderSoft p-3"><summary className="cursor-pointer break-words text-sm text-textStrong">{report.reportPeriod} · {scopeName(report.statementScope)} · {report.status} · CNY / 元</summary><p className="mt-2 break-words text-xs text-textMuted">发布：{report.announcementDate ?? "未提供"} · 来源：{report.provider} · 抓取：{report.fetchedAt} · {report.isDerived ? report.derivationMethod ?? "使用已推导字段" : "报告字段"}</p>{report.sourceUrl ? <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-xs text-accent">查看报告来源</a> : null}<ReportTables report={report} /><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-textMuted">{JSON.stringify(report, null, 2)}</pre></details>)}</div></details>
    </>}
  </div>;
}

const statementLabels: Record<string, string> = {
  operatingRevenue: "营业收入", operatingCost: "营业成本", operatingProfit: "营业利润", totalProfit: "利润总额", netProfit: "净利润", netProfitAttributableToParent: "归母净利润", netProfitExcludingNonRecurring: "扣非归母净利润", researchAndDevelopmentExpense: "研发费用", sellingExpense: "销售费用", administrativeExpense: "管理费用", financialExpense: "财务费用", netOperatingCashFlow: "经营现金流净额", cashReceivedFromSales: "销售商品收到现金", cashPaidForGoodsAndServices: "购买商品支付现金", capitalExpenditure: "资本开支", netInvestingCashFlow: "投资现金流净额", netFinancingCashFlow: "筹资现金流净额", totalAssets: "总资产", totalLiabilities: "总负债", equityAttributableToParent: "归母权益", cashAndCashEquivalents: "货币资金及现金等价物", accountsReceivable: "应收账款", notesReceivable: "应收票据", contractAssets: "合同资产", inventory: "存货", accountsPayable: "应付账款", contractLiabilities: "合同负债", shortTermBorrowings: "短期借款", longTermBorrowings: "长期借款", goodwill: "商誉",
};
function ReportTables({ report }: { report: FinancialReport }) {
  return <div className="mt-3 space-y-3">
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><caption className="py-2 text-left font-semibold">利润表与现金流量表 · CNY / 元</caption><thead><tr><th className="p-2 text-left">字段</th><th className="p-2 text-right">累计</th><th className="p-2 text-right">单季度</th></tr></thead><tbody>{Object.entries(report.cumulative).map(([field, value]) => <tr key={field} className="border-t border-borderSoft"><th scope="row" className="p-2 text-left font-normal">{statementLabels[field] ?? field}</th><td className="p-2 text-right tabular-nums">{value === null ? "暂未获取" : value}</td><td className="p-2 text-right tabular-nums">{report.singleQuarter?.[field as keyof NonNullable<FinancialReport["singleQuarter"]>] ?? "暂未获取"}</td></tr>)}</tbody></table></div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><caption className="py-2 text-left font-semibold">资产负债表 · 报告期末 · CNY / 元</caption><thead><tr><th className="p-2 text-left">字段</th><th className="p-2 text-right">数值</th></tr></thead><tbody>{Object.entries(report.balanceSheet).map(([field, value]) => <tr key={field} className="border-t border-borderSoft"><th scope="row" className="p-2 text-left font-normal">{statementLabels[field] ?? field}</th><td className="p-2 text-right tabular-nums">{value === null ? "暂未获取" : value}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-textMuted">下方原始报告同时保留派生指标、字段状态、单位转换、审计与修订信息。</p>
  </div>;
}
