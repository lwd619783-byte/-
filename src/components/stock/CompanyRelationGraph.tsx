import { ArrowDown, ArrowLeftRight, ArrowUp, Building2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Industry, Stock } from "../../types";

interface CompanyRelationGraphProps {
  stock: Stock;
  stocks: Stock[];
  industry?: Industry;
  onOpenStock: (stock: Stock) => void;
}

export function CompanyRelationGraph({ stock, stocks, industry, onOpenStock }: CompanyRelationGraphProps) {
  const explicit = stock.relations ?? [];
  const byId = new Map(stocks.map((item) => [item.id, item]));
  const explicitByType = (types: string[]) =>
    explicit
      .filter((relation) => types.includes(relation.relationType))
      .map((relation) => byId.get(relation.stockId))
      .filter((item): item is Stock => Boolean(item));

  const sameSegmentStocks = stocks.filter((item) => item.segmentId === stock.segmentId && item.id !== stock.id);
  const sameIndustryStocks = stocks.filter((item) => item.industryId === stock.industryId && item.id !== stock.id);
  const sameChainPositionStocks = stocks.filter((item) => item.chainPosition === stock.chainPosition && item.id !== stock.id);
  const sameThemeStocks = stocks.filter(
    (item) =>
      item.id !== stock.id &&
      item.growthDrivers?.some((driver) => stock.growthDrivers?.includes(driver)),
  );

  const upstream = uniqStocks([...explicitByType(["上游", "供应商"]), ...inferByChain(stocks, industry, stock, "上游")]).slice(0, 4);
  const downstream = uniqStocks([...explicitByType(["下游", "客户"]), ...inferByChain(stocks, industry, stock, "下游")]).slice(0, 4);
  const peers = uniqStocks([...explicitByType(["同行竞争"]), ...sameSegmentStocks, ...sameIndustryStocks]).slice(0, 5);
  const sameLink = uniqStocks([...explicitByType(["同环节"]), ...sameChainPositionStocks]).slice(0, 5);
  const theme = uniqStocks([...explicitByType(["同主题"]), ...sameThemeStocks]).slice(0, 5);
  const hasRelations = upstream.length + downstream.length + peers.length + sameLink.length + theme.length > 0;

  return (
    <div className="space-y-3">
      {!hasRelations ? (
        <div className="rounded-lg border border-dashed border-borderSoft bg-bg2/70 p-4 text-sm text-textMuted">
          关联公司待补充；当前仅保留关系图布局，后续可接入供应商、客户和可比公司数据。
        </div>
      ) : null}

      <RelationRow title="上游相关公司" icon={<ArrowUp className="h-4 w-4" />} stocks={upstream} onOpenStock={onOpenStock} emptyText="上游关系待补充" />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <RelationGroup title="同行 / 可比公司" stocks={peers} onOpenStock={onOpenStock} emptyText="同行关系待补充" />
        <div className="rounded-lg border border-cyan/50 bg-cyan/10 p-4 text-center shadow-glow">
          <Building2 className="mx-auto h-5 w-5 text-cyan" />
          <p className="mt-2 text-sm font-semibold text-textStrong">{stock.name}</p>
          <p className="mt-1 max-w-[220px] truncate text-xs text-textMuted" title={stock.chainPosition}>
            {stock.chainPosition || "产业链位置待补充"}
          </p>
        </div>
        <RelationGroup title="同环节 / 同主题" stocks={uniqStocks([...sameLink, ...theme]).slice(0, 5)} onOpenStock={onOpenStock} emptyText="同环节关系待补充" />
      </div>

      <RelationRow title="下游 / 需求相关公司" icon={<ArrowDown className="h-4 w-4" />} stocks={downstream} onOpenStock={onOpenStock} emptyText="下游关系待补充" />
    </div>
  );
}

function RelationRow({
  title,
  icon,
  stocks,
  onOpenStock,
  emptyText,
}: {
  title: string;
  icon: ReactNode;
  stocks: Stock[];
  onOpenStock: (stock: Stock) => void;
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-textStrong">
        <span className="text-cyan">{icon}</span>
        {title}
      </div>
      <NodeList stocks={stocks} onOpenStock={onOpenStock} emptyText={emptyText} />
    </div>
  );
}

function RelationGroup({
  title,
  stocks,
  onOpenStock,
  emptyText,
}: {
  title: string;
  stocks: Stock[];
  onOpenStock: (stock: Stock) => void;
  emptyText: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-borderSoft bg-bg2/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-textStrong">
        <ArrowLeftRight className="h-4 w-4 text-cyan" />
        {title}
      </div>
      <NodeList stocks={stocks} onOpenStock={onOpenStock} emptyText={emptyText} />
    </div>
  );
}

function NodeList({ stocks, onOpenStock, emptyText }: { stocks: Stock[]; onOpenStock: (stock: Stock) => void; emptyText: string }) {
  if (stocks.length === 0) return <p className="text-sm text-textMuted">{emptyText}</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {stocks.map((item) => (
        <button
          key={item.id}
          className="max-w-full rounded-md border border-borderSoft bg-surface/75 px-3 py-2 text-left transition hover:border-cyan hover:bg-cyan/10 focus:outline-none focus:ring-2 focus:ring-cyan/25"
          onClick={() => onOpenStock(item)}
          title={`${item.name} · ${item.chainPosition}`}
        >
          <span className="block truncate text-sm font-medium text-textStrong">{item.name}</span>
          <span className="block max-w-[160px] truncate text-xs text-textMuted">{item.chainPosition || "位置待补充"}</span>
        </button>
      ))}
    </div>
  );
}

function uniqStocks(items: Stock[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function inferByChain(
  stocks: Stock[],
  industry: Industry | undefined,
  current: Stock,
  stage: "上游" | "下游",
) {
  const stageItems = industry?.chain.find((item) => item.stage === stage)?.items ?? [];
  return stocks.filter(
    (item) =>
      item.id !== current.id &&
      item.industryId === current.industryId &&
      stageItems.some((chainItem) => `${item.chainPosition} ${item.segmentId}`.toLowerCase().includes(chainItem.toLowerCase())),
  );
}
