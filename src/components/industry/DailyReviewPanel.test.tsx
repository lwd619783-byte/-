// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { DailyReviewCard, DailyReviewPanel } from './DailyReviewPanel';
import type { ReviewRead } from '../../../shared/daily-review.mjs';
import { reviewFixture } from '../../../scripts/tests/daily-review.fixture.mjs';

const state = (): ReviewRead => ({ record: { schemaVersion:'daily-review.v1',reviewId:'industry:oil-shipping:'+reviewFixture().reviewDate, revision:1, createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'AI_PUBLISHED', content:reviewFixture(),contentDigest:'a'.repeat(64),previousRevision:null,audit:{actor:'ai',action:'publish',owner:'personal-owner',workspace:'test',scope:'synthetic'}},effectiveStatus:'AI_PUBLISHED',isCurrent:true,scope:'synthetic' });
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()});
describe('Daily Review UI',()=>{
  it('StrictMode removes poll/focus handlers and aborts outstanding requests after disconnect/unmount',async()=>{
    vi.useFakeTimers();
    const add=vi.spyOn(window,'addEventListener'),remove=vi.spyOn(window,'removeEventListener');
    const signals:AbortSignal[]=[];let pending=false;
    const fetch=vi.fn((_url:string,init:RequestInit)=>{
      const signal=init.signal as AbortSignal;signals.push(signal);
      if(pending)return new Promise<Response>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')),{once:true}));
      return Promise.resolve(new Response(JSON.stringify(_url.includes('history')?{items:[],next:null}:state()),{status:200}));
    });vi.stubGlobal('fetch',fetch);
    const view=render(<StrictMode><DailyReviewPanel/></StrictMode>);
    fireEvent.change(screen.getByLabelText('复盘访问密钥'),{target:{value:'synthetic-secret-32-characters-long'}});
    await act(async()=>{fireEvent.click(screen.getByText('连接复盘'));await vi.advanceTimersByTimeAsync(0)});
    expect(screen.getByText('AI 复盘 / 未人工确认')).toBeTruthy();expect(vi.getTimerCount()).toBe(1);
    pending=true;await act(async()=>{window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(0)});
    const pendingSignals=signals.slice(-2);expect(pendingSignals.every(s=>!s.aborted)).toBe(true);
    await act(async()=>{fireEvent.click(screen.getByText('断开页面访问'));await vi.advanceTimersByTimeAsync(0)});
    expect(pendingSignals.every(s=>s.aborted)).toBe(true);expect(vi.getTimerCount()).toBe(0);
    const count=fetch.mock.calls.length;await act(async()=>{window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(60000)});expect(fetch).toHaveBeenCalledTimes(count);
    pending=false;fireEvent.change(screen.getByLabelText('复盘访问密钥'),{target:{value:'synthetic-secret-32-characters-long'}});
    await act(async()=>{fireEvent.click(screen.getByText('连接复盘'));await vi.advanceTimersByTimeAsync(0)});
    pending=true;await act(async()=>{fireEvent.click(screen.getByText('刷新复盘'));await vi.advanceTimersByTimeAsync(0)});
    const unmountSignals=signals.slice(-2);await act(async()=>{view.unmount();await vi.advanceTimersByTimeAsync(0)});
    expect(unmountSignals.every(s=>s.aborted)).toBe(true);expect(vi.getTimerCount()).toBe(0);
    const handlers=add.mock.calls.filter(([name])=>name==='focus').map(([,handler])=>handler);
    expect(handlers.length).toBeGreaterThan(0);for(const handler of handlers)expect(remove.mock.calls.some(([name,removed])=>name==='focus'&&removed===handler)).toBe(true);
  });
  it('distinguishes disconnected from empty and does not read without credentials',()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<DailyReviewPanel/>);
    expect(screen.getByText(/未连接时无法判断/)).toBeTruthy();expect(fetch).not.toHaveBeenCalled();expect(localStorage.getItem('reviewSecret')).toBeNull();
  });
  it('shows empty and AI published, empty supports/challenges, blocked source and formal isolation',()=>{
    const {rerender}=render(<DailyReviewCard value={{record:null,effectiveStatus:null,isCurrent:false,scope:'real'}}/>);expect(screen.getByText(/暂无每日复盘/)).toBeTruthy();
    rerender(<DailyReviewCard value={state()}/>);expect(screen.getByText('AI 复盘 / 未人工确认')).toBeTruthy();expect(screen.getAllByText('暂无新增证据')).toHaveLength(2);expect(screen.getByText(/Review 不改变/)).toBeTruthy();expect(screen.getByText(/来源日期 未知/)).toBeTruthy();
  });
  it('user confirmation preserves AI attribution and historical state',()=>{
    const value=state();value.record!.status='USER_CONFIRMED';value.effectiveStatus='USER_CONFIRMED';const {rerender}=render(<DailyReviewCard value={value}/>);expect(screen.getByText('AI 复盘 / 已人工确认')).toBeTruthy();
    value.effectiveStatus='SUPERSEDED';value.isCurrent=false;rerender(<DailyReviewCard value={value}/>);expect(screen.getByText('历史版本 / 已被后续版本替代')).toBeTruthy();
  });
  it('stale and withdrawn are explicit',()=>{
    const value=state();value.record!.content.asOf='2020-01-01T00:00:00Z';const {rerender}=render(<DailyReviewCard value={value}/>);expect(screen.getByText(/复盘已过期/)).toBeTruthy();
    value.record!.status='WITHDRAWN';value.effectiveStatus='WITHDRAWN';rerender(<DailyReviewCard value={value}/>);expect(screen.getByText(/此版本已撤回/)).toBeTruthy();expect(screen.queryByText(value.record!.content.summary)).toBeNull();
  });
  it('connect, exact history, confirmation gate, failed refresh hides stale response, disconnect clears memory',async()=>{
    let fail=false;const value=state();const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);if(fail)return new Response('{}',{status:503});return new Response(JSON.stringify(url.includes('history')?{items:[{reviewId:value.record!.reviewId,reviewDate:value.record!.content.reviewDate,revision:1,status:'AI_PUBLISHED',originalStatus:'AI_PUBLISHED',createdAt:value.record!.createdAt}],next:null}:value),{status:200});}));
    render(<DailyReviewPanel/>);fireEvent.change(screen.getByLabelText('复盘访问密钥'),{target:{value:'synthetic-secret-32-characters-long'}});fireEvent.click(screen.getByText('连接复盘'));
    await screen.findByText('AI 复盘 / 未人工确认');fireEvent.click(screen.getByText('人工确认此版本'));expect(screen.getByText('确认操作')).toBeTruthy();expect(calls.some(c=>c.includes('transition'))).toBe(false);
    fireEvent.click(screen.getByText(/v1 · AI 复盘/));await waitFor(()=>expect(calls.some(c=>c.includes('revision=1'))).toBe(true));
    fail=true;await waitFor(()=>expect(screen.getByText('刷新复盘').hasAttribute('disabled')).toBe(false));fireEvent.click(screen.getByText('刷新复盘'));await screen.findByRole('alert');expect(screen.queryByText('AI 复盘 / 未人工确认')).toBeNull();
    fireEvent.click(screen.getByText('断开页面访问'));expect((screen.getByLabelText('复盘访问密钥') as HTMLInputElement).value).toBe('');
  });
});
