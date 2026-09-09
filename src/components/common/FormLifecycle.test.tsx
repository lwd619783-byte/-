// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { AppearanceProvider } from "../layout/Appearance";
import { ReviewFormModal } from "../watchlist/ReviewFormModal";
import { WatchItemFormModal } from "../watchlist/WatchItemFormModal";
import { EarningsExpectationImportModal } from "../expectation/EarningsExpectationImportModal";
import { useSubmission } from "../../hooks/useSubmission";
import type { Stock, WatchItem } from "../../types";

const stock={id:"synthetic-ui",name:"测试公司",code:"000001",market:"A股"} as Stock;
const watch:WatchItem={id:"synthetic-watch",stockId:stock.id,createdAt:"2026-06-01",updatedAt:"2026-06-01",status:"观察",priority:"high",tags:[],reason:"",thesis:"原判断",validationCriteria:[],riskCriteria:[],nextReviewAt:null,lastReviewedAt:null,archivedAt:null,source:"user",schemaVersion:2};
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();window.history.replaceState(null,"","/");});
describe("UI form lifecycle",()=>{
 it("keeps review input across appearance switches and cancelled close; submits once",async()=>{
  const submit=vi.fn();const close=vi.fn();vi.spyOn(window,"confirm").mockReturnValue(false);
  render(<AppearanceProvider><ReviewFormModal watchItem={watch} events={[]} tasks={[]} onSubmit={submit} onClose={close}/></AppearanceProvider>);
  fireEvent.change(screen.getByLabelText("本次新证据"),{target:{value:"用户填写到一半的证据"}});
  for(const theme of ["pro","light","neon"]){fireEvent.change(screen.getByLabelText("外观"),{target:{value:theme}});expect((screen.getByLabelText("本次新证据") as HTMLTextAreaElement).value).toBe("用户填写到一半的证据");}
  fireEvent.click(screen.getByText("取消"));expect(close).not.toHaveBeenCalled();
  await act(async()=>{fireEvent.click(screen.getByText("提交复盘"));});
  expect(submit).toHaveBeenCalledTimes(1);expect(submit.mock.calls[0][0].summary).toBe("用户填写到一半的证据");
 });
 it("retains failed metadata input and shows the store error inside the modal",()=>{
  const props={stocks:[stock],onCreate:vi.fn(),onUpdate:vi.fn(),onClose:vi.fn()};
  const {rerender}=render(<AppearanceProvider><WatchItemFormModal {...props}/></AppearanceProvider>);
  fireEvent.change(screen.getByLabelText("关注理由"),{target:{value:"保留输入"}});
  rerender(<AppearanceProvider><WatchItemFormModal {...props} error="本地存储写入失败"/></AppearanceProvider>);
  expect(screen.getByRole("dialog").textContent).toContain("本地存储写入失败");expect((screen.getByLabelText("关注理由") as HTMLTextAreaElement).value).toBe("保留输入");
 });
 it("blocks a second action until the first action settles",async()=>{
  let resolve!:()=>void;const action=vi.fn(()=>new Promise<void>(r=>resolve=r));
  function Harness(){const {pending,run}=useSubmission();return <button disabled={pending} onClick={()=>void run(action)}>提交</button>;}
  render(<Harness/>);fireEvent.click(screen.getByText("提交"));fireEvent.click(screen.getByText("提交"));expect(action).toHaveBeenCalledTimes(1);
  await act(async()=>resolve());expect((screen.getByText("提交") as HTMLButtonElement).disabled).toBe(false);
 });
 it("cancels navigation without losing the dirty form",()=>{
  window.history.replaceState(null,"","/#/watchlist");const close=vi.fn();vi.spyOn(window,"confirm").mockReturnValue(false);
  render(<AppearanceProvider><WatchItemFormModal stocks={[stock]} onClose={close} onCreate={vi.fn()} onUpdate={vi.fn()}/></AppearanceProvider>);
  fireEvent.change(screen.getByLabelText("关注理由"),{target:{value:"未保存"}});window.history.pushState(null,"","/#/home");window.dispatchEvent(new PopStateEvent("popstate"));
  expect(window.location.hash).toBe("#/watchlist");expect(close).not.toHaveBeenCalled();expect((screen.getByLabelText("关注理由") as HTMLTextAreaElement).value).toBe("未保存");
 });
 it("keeps invalid import text and blocks both write modes",()=>{
  const preview={ok:false,mergeAllowed:false,replaceAllowed:false,partial:false,schemaVersion:null,totalCount:0,validCount:0,addCount:0,skippedCount:0,duplicateCount:0,conflictCount:0,invalidCount:1,issues:[{row:0,code:"invalid",message:"JSON 无法解析"}],timeZoneNotes:[],snapshots:[]};
  function Harness(){const [open]=useState(true);return open?<EarningsExpectationImportModal exportJson="{}" exportCsv="" csvTemplate="" onPreviewJson={()=>preview} onPreviewCsv={()=>preview} onImport={vi.fn()} onReset={vi.fn()} onClose={vi.fn()}/>:null;}
  render(<AppearanceProvider><Harness/></AppearanceProvider>);fireEvent.change(screen.getByLabelText("导入原文"),{target:{value:"{invalid"}});
  expect((screen.getByText("合并快照") as HTMLButtonElement).disabled).toBe(true);expect((screen.getByText("替换快照") as HTMLButtonElement).disabled).toBe(true);expect((screen.getByLabelText("导入原文") as HTMLTextAreaElement).value).toBe("{invalid");
 });
});
