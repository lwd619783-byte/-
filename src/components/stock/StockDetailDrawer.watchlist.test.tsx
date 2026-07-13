import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { industries } from "../../data/industries";
import { stocks } from "../../data/stocks";
import type { WatchItem } from "../../types";
import { StockDetailDrawer } from "./StockDetailDrawer";

describe("StockDetailDrawer watchlist linkage", () => {
  it("renders the join-watchlist action for a company without an active item", () => {
    const html = renderToStaticMarkup(<StockDetailDrawer stock={stocks[0]} stocks={stocks} industries={industries} onClose={() => undefined} />);
    expect(html).toContain("观察清单与复盘");
    expect(html).toContain("加入观察清单");
  });

  it("renders current status and review entry instead of a duplicate add action", () => {
    const item = { id: "watch-1", stockId: stocks[0].id, createdAt: "2026-07-01", updatedAt: "2026-07-01", status: "观察", priority: "high", tags: [], reason: "理由", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 } as WatchItem;
    const html = renderToStaticMarkup(<StockDetailDrawer stock={stocks[0]} stocks={stocks} industries={industries} watchItems={[item]} onClose={() => undefined} />);
    expect(html).toContain("当前观察状态");
    expect(html).toContain("开始复盘");
    expect(html).not.toContain("尚未加入观察清单");
  });
});
