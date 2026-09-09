// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseWorkspaceHash, useWorkspaceNavigation } from "./useWorkspaceNavigation";
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
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
});
