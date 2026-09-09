import { useEffect, useRef, useState } from "react";

export const pages = { home: "首页", macro: "宏观", industry: "行业", stocks: "个股池", watchlist: "观察清单", verification: "验证中心", expectations: "预期证据" } as const;
export type PageId = keyof typeof pages;
export type MainPage = typeof pages[PageId];
export const companyTabs = ["overview", "financials", "valuation", "expectations", "evidence"] as const;
export type CompanyTab = typeof companyTabs[number];
export interface WorkspaceRoute { kind: "page" | "company" | "invalid"; page: PageId; stockId?: string; tab?: CompanyTab; industryId?: string; segmentId?: string; eventId?: string }
const validPage = (value: string | null): value is PageId => !!value && Object.prototype.hasOwnProperty.call(pages, value);
export function parseWorkspaceHash(hash: string): WorkspaceRoute {
  if (!hash || hash === "#" || hash === "#/") return { kind: "page", page: "home" };
  try {
    const [path, query] = hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").map(decodeURIComponent);
    const params = new URLSearchParams(query);
    if (parts[0] === "company") {
      const origin = params.get("from");
      const tab = parts[2] ?? "overview";
      if (!parts[1] || parts.length > 3 || !companyTabs.includes(tab as CompanyTab)) return { kind: "invalid", page: "stocks" };
      return { kind: "company", page: validPage(origin) ? origin : "stocks", stockId: parts[1], tab: tab as CompanyTab };
    }
    if (parts.length !== 1 || !validPage(parts[0])) return { kind: "invalid", page: "home" };
    return { kind: "page", page: parts[0], industryId: params.get("industry") ?? undefined, segmentId: params.get("segment") ?? undefined, eventId: params.get("event") ?? undefined };
  } catch { return { kind: "invalid", page: "home" }; }
}

/** Navigation state is presentation-only. Business records never enter URL/history. */
export function useWorkspaceNavigation() {
  const [route, setRoute] = useState(() => parseWorkspaceHash(window.location.hash));
  const routeRef = useRef(route); routeRef.current = route;
  const pageLocations = useRef<Partial<Record<PageId, string>>>({});
  if (route.kind === "page") pageLocations.current[route.page] = window.location.hash || "#/home";
  const restoreFrame = useRef(0);
  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const sync = () => {
      setRoute(parseWorkspaceHash(window.location.hash));
      cancelAnimationFrame(restoreFrame.current);
      const saved = window.history.state?.uiV1;
      restoreFrame.current = requestAnimationFrame(() => { restoreFrame.current = requestAnimationFrame(() => {
        window.scrollTo({ top: typeof saved?.scrollY === "number" ? saved.scrollY : 0, behavior: "auto" });
        if (saved?.focusStockId) [...document.querySelectorAll<HTMLElement>("[data-stock-id]")].find(el => el.dataset.stockId === saved.focusStockId && el.getClientRects().length)?.focus({ preventScroll: true });
      }); });
    };
    window.addEventListener("popstate", sync); window.addEventListener("hashchange", sync);
    return () => { cancelAnimationFrame(restoreFrame.current); window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); window.history.scrollRestoration = "auto"; };
  }, []);
  const go = (hash: string, replace = false) => {
    if (!replace) {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-stock-id]")?.dataset.stockId : undefined;
      window.history.replaceState({ ...window.history.state, uiV1: { ...window.history.state?.uiV1, scrollY: window.scrollY, focusStockId: focused } }, "");
      window.history.pushState({ uiV1: { parent: window.location.hash || "#/home", scrollY: 0 } }, "", hash);
    } else window.history.replaceState(window.history.state, "", hash);
    setRoute(parseWorkspaceHash(hash));
    if (!replace) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };
  const navigatePage = (page: MainPage) => {
    const id = (Object.keys(pages) as PageId[]).find(id => pages[id] === page)!;
    go(pageLocations.current[id] ?? `#/${id}`);
  };
  const openCompany = (stockId: string) => go(`#/company/${encodeURIComponent(stockId)}/overview?from=${routeRef.current.page}`);
  const changeCompanyTab = (tab: CompanyTab) => {
    const current = routeRef.current;
    if (current.kind === "company") go(`#/company/${encodeURIComponent(current.stockId!)}/${tab}?from=${current.page}`, true);
  };
  const back = () => { if (window.history.state?.uiV1?.parent) window.history.back(); else go(`#/${routeRef.current.page}`, true); };
  const openEvent = (eventId: string) => go(`#/verification?event=${encodeURIComponent(eventId)}`);
  const selectIndustry = ({ industryId, segmentId }: { industryId: string; segmentId: string }) => {
    if(routeRef.current.kind === "page" && routeRef.current.page === "industry") go(`#/industry?industry=${encodeURIComponent(industryId)}&segment=${encodeURIComponent(segmentId)}`, true);
  };
  return { route, navigatePage, openCompany, changeCompanyTab, back, openEvent, selectIndustry };
}
