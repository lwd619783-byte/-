// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEarningsExpectationComparisons } from "../services/earningsExpectationComparisonProvider";
import { Application } from "../Application";
import { createReviewFixtures } from "./fixtures";
import { readUiReview, UI_REVIEW_LABEL } from "./config";
import { loadAShareFinancial } from "../services/aShareFinancialLoader";
import { loadAShareAnnouncements } from "../services/aShareAnnouncementLoader";
const { businessImport } = vi.hoisted(()=>({ businessImport: vi.fn() }));
vi.mock("../App",()=>{businessImport();return {default:()=> <p>Ordinary business application</p>};});
vi.mock("../services/aShareFinancialLoader",()=>({loadAShareFinancial:vi.fn(()=>{throw new Error("real financial loader forbidden");})}));
vi.mock("../services/aShareAnnouncementLoader",()=>({loadAShareAnnouncements:vi.fn(()=>{throw new Error("real announcement loader forbidden");})}));
vi.mock("recharts",async()=>{const actual=await vi.importActual<typeof import("recharts")>("recharts");return {...actual,ResponsiveContainer:({children}:{children:React.ReactNode})=><div>{children}</div>};});
const storageSnapshot = () => Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
beforeEach(()=>{ window.history.replaceState(null,"","/"); localStorage.clear(); window.scrollTo=vi.fn(); });
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("explicit isolated UI review",()=>{
  it("only accepts explicit query opt-in, independently from data modes",()=>{
    for(const value of ["", "?ui-review=0", "?profile=full", "?mode=mock", "?dataMode=real", "?ui-review=true"]) expect(readUiReview(value)).toBeNull();
    expect(readUiReview("?ui-review=1")).toEqual({profile:"full"});
    expect(readUiReview("?ui-review=1&profile=bad")).toEqual({profile:"full"});
  });
  it("does not import the business application, read/write storage, call loaders or export across all profiles/pages/chapters",async()=>{
    localStorage.setItem("investment-research-dashboard.watchlist.v2",'{ "preserve": "原文\\n空白" }');
    localStorage.setItem("investment-research-dashboard.earnings-expectation.v1", "corrupted-original-do-not-migrate");
    localStorage.setItem("investment-dashboard.ui.v1.appearance","pro");
    const before=storageSnapshot();
    const read=vi.spyOn(Storage.prototype,"getItem");const write=vi.spyOn(Storage.prototype,"setItem");const remove=vi.spyOn(Storage.prototype,"removeItem");const clear=vi.spyOn(Storage.prototype,"clear");
    const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("review must not fetch"));
    render(<Application search="?ui-review=1"/>);
    await screen.findByRole("heading",{name:"首页 / 研究工作台"}, {timeout:10000});
    const nav=()=>within(screen.getByRole("navigation",{name:"主要导航"}));
    for(const profile of ["full","empty","degraded"]) {
      fireEvent.change(screen.getByLabelText("验收场景"),{target:{value:profile}});
      for(const page of ["首页","宏观","行业","个股池","观察清单","验证中心","预期证据"]) {
        fireEvent.click(nav().getByRole("button",{name:page}));
        expect(screen.getByLabelText("界面验收模式").textContent).toContain(UI_REVIEW_LABEL);
      }
      fireEvent.click(screen.getByRole("button",{name:"导出 / 快照导入"}));
      expect(screen.getAllByRole("status").some(element=>element.textContent?.includes("业务写入、导入、导出"))).toBe(true);
      fireEvent.click(nav().getByRole("button",{name:"观察清单"}));
      fireEvent.click(screen.getByRole("button",{name:"备份 / 导入"}));
      expect(screen.queryByRole("dialog")).toBeNull();
      await act(async()=>{window.history.replaceState(null,"","#/company/ui-review-company-1/overview");window.dispatchEvent(new HashChangeEvent("hashchange"));});
      for(const tab of ["研究概览","经营与财务","价格与估值","预期与验证","证据与复盘"]) {
        fireEvent.click(screen.getByRole("tab",{name:tab}));
        expect(screen.getByRole("tabpanel")).toBeTruthy();
      }
      for(const theme of ["pro","light","neon"]) fireEvent.change(screen.getByLabelText("外观"),{target:{value:theme}});
    }
    expect(businessImport).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();expect(clear).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(loadAShareFinancial).not.toHaveBeenCalled();expect(loadAShareAnnouncements).not.toHaveBeenCalled();
    read.mockRestore();expect(storageSnapshot()).toEqual(before);
    expect(screen.getByRole("link",{name:"退出界面验收"}).getAttribute("href")).toBe("/#/home");
  }, 15000);
  it("keeps fixture instances independent, empty and degraded meaningfully distinct",()=>{
    const full=createReviewFixtures("full");const before=JSON.stringify(full);const empty=createReviewFixtures("empty");const degraded=createReviewFixtures("degraded");
    expect(empty.watchItems).toHaveLength(0);expect(empty.snapshot.events).toHaveLength(0);expect(empty.companies[0].priceHistory).toHaveLength(0);
    expect(full.details[full.companies[0].id].financial?.reports).toHaveLength(4);
    const compare = buildEarningsExpectationComparisons(full.expectations, full.snapshot.events, {timeZone:"Asia/Shanghai",revisionReminderThreshold:.1,nearZeroThreshold:1e-9,roundingTolerance:1e-9});
    expect(compare.some(item=>item.comparabilityStatus==="comparable" && item.isExAnte && item.comparisonResult==="within")).toBe(true);
    expect(degraded.details[degraded.companies[0].id].status).toBe("error");expect(degraded.expectations[0].sourceVerificationStatus).toBe("pending");
    degraded.companies[0].name="changed";expect(JSON.stringify(full)).toBe(before);
    for(const stock of full.companies) {expect(stock.dataMode).toBeUndefined();expect(stock.code).toMatch(/^DEMO/);expect(stock.aShareFinancialSummary?.detailPath).toBe("");}
  });
  it("ordinary URLs render the business application without the review entry",async()=>{
    render(<Application search=""/>);await screen.findByText("Ordinary business application");expect(screen.queryByLabelText("界面验收模式")).toBeNull();
  });
});
