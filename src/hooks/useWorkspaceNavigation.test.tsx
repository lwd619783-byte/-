// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseWorkspaceHash, useWorkspaceNavigation } from "./useWorkspaceNavigation";
beforeEach(()=>{vi.stubGlobal("scrollTo",vi.fn());vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callback(0);return 0;});});
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");vi.unstubAllGlobals();});
describe("workspace hash contract",()=>{
 it.each(["", "#/"])("keeps root homepage compatible",hash=>expect(parseWorkspaceHash(hash)).toEqual({kind:"page",page:"home"}));
 it("restores a company and whitelisted tab without carrying notes",()=>expect(parseWorkspaceHash("#/company/stock-a/financials?from=industry&note=ignored")).toEqual({kind:"company",page:"industry",stockId:"stock-a",tab:"financials"}));
 it.each(["#/company", "#/company/a/unknown", "#/company/%E0%A4/overview", "#/https://external", "#/constructor"])("rejects invalid routes %s",hash=>expect(parseWorkspaceHash(hash).kind).toBe("invalid"));
 it("separates filter context from navigable company state",()=>{
   window.history.replaceState(null,"","/#/stocks");
   function Harness(){const n=useWorkspaceNavigation();return <><input aria-label="筛选" defaultValue="机器人"/><p data-testid="route">{JSON.stringify(n.route)}</p><button onClick={()=>n.openCompany("a/1")}>公司</button><button onClick={()=>n.changeCompanyTab("financials")}>财务</button></>;}
   render(<Harness/>);fireEvent.click(screen.getByText("公司"));const length=window.history.length;fireEvent.click(screen.getByText("财务"));
   expect(window.location.hash).toBe("#/company/a%2F1/financials?from=stocks");expect(window.history.length).toBe(length);
   expect((screen.getByLabelText("筛选") as HTMLInputElement).value).toBe("机器人");
   expect(window.location.hash).not.toContain("机器人");
 });
 it("preserves explicit Wiki identity and view parameters, including escaped delimiters",()=>{
   expect(parseWorkspaceHash("#/knowledge?wiki=wiki%2F%E5%85%89%E9%80%9A%E4%BF%A1%3Fa%3D1&view=history&secret=ignored")).toEqual({kind:"page",page:"knowledge",wikiId:"wiki/光通信?a=1",view:"history",industryId:undefined,segmentId:undefined,eventId:undefined});
   expect(parseWorkspaceHash("#/memory?wiki=old-id&view=review")).toMatchObject({kind:"page",page:"memory",wikiId:"old-id",view:"review"});
 });
 it("retains a legacy industry deep link and its query when switching workspace entries",()=>{
   const original="#/industry?industry=optical&segment=fiber&context=preserve";
   window.history.replaceState(null,"",`/${original}`);
   function Harness(){const n=useWorkspaceNavigation();return <><button onClick={()=>n.navigatePage("知识库")}>知识库</button><button onClick={()=>n.navigatePage("行业")}>返回行业</button><button onClick={()=>n.openCompany("stock/7")}>打开公司</button></>;}
   render(<Harness/>);fireEvent.click(screen.getByText("知识库"));expect(window.location.hash).toBe("#/knowledge");
   fireEvent.click(screen.getByText("返回行业"));expect(window.location.hash).toBe(original);
   fireEvent.click(screen.getByText("打开公司"));expect(window.location.hash).toBe("#/company/stock%2F7/overview?from=industry");
   expect(window.history.state.uiV1.parent).toBe(original);
 });
});
