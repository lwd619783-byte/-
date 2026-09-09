// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { APPEARANCE_KEY, AppearanceControl, AppearanceProvider, readAppearance } from "./Appearance";
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();delete document.documentElement.dataset.theme;});
describe("UI appearance isolation",()=>{
 it.each([null,"invalid","{bad}"])("defaults to neon for %s",value=>{if(value)localStorage.setItem(APPEARANCE_KEY,value);expect(readAppearance().theme).toBe("neon");});
 it("restores valid preference and preserves form and business bytes",()=>{
  localStorage.setItem(APPEARANCE_KEY,"pro");localStorage.setItem("business-fixture",'{"immutable":true}');
  render(<AppearanceProvider><AppearanceControl/><input aria-label="未提交研究" defaultValue="原始研究"/></AppearanceProvider>);
  expect(document.documentElement.dataset.theme).toBe("pro");
  const field=screen.getByLabelText("未提交研究") as HTMLInputElement;
  fireEvent.change(field,{target:{value:"编辑中的判断"}});
  for(const value of ["light","neon","pro"]){fireEvent.change(screen.getByLabelText("外观"),{target:{value}});expect(field.value).toBe("编辑中的判断");}
  expect(localStorage.getItem("business-fixture")).toBe('{"immutable":true}');
  expect(localStorage.getItem(APPEARANCE_KEY)).toBe("pro");
 });
 it("keeps session usable when storage write fails",()=>{
  render(<AppearanceProvider><AppearanceControl/></AppearanceProvider>);
  const write=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("denied");});
  fireEvent.change(screen.getByLabelText("外观"),{target:{value:"light"}});
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("status").textContent).toContain("当前会话仍可使用");
  expect(write).toHaveBeenCalledTimes(1); expect(write).toHaveBeenCalledWith(APPEARANCE_KEY,"light");
 });
 it("reports unreadable preference without preventing rendering",()=>{vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("denied");});render(<AppearanceProvider><AppearanceControl/></AppearanceProvider>);expect(screen.getByRole("status").textContent).toContain("无法读取");});
});
