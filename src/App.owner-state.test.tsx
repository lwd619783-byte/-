// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import App from './App';
import { buildDashboardDataset } from './services/dataProvider';
import { WatchlistRepository, WATCHLIST_STORAGE_KEY } from './services/watchlistRepository';
import { WatchlistStore } from './services/watchlistStore';
import { EARNINGS_EXPECTATION_STORAGE_KEY } from './services/earningsExpectationRepository';

// Only browser primitives and asynchronous provider IO are controlled. App, its child
// components, all projection functions, both stores and repositories remain real.
const stocks = buildDashboardDataset('mixed').stocks;
const now = new Date('2026-09-22T02:00:00.000Z');
const seedWatch = () => {
  const repository = new WatchlistRepository(localStorage);
  const result = new WatchlistStore(repository, () => now).createWatchItem(repository.load().data, {
    stockId: stocks[0].id, reason: 'Synthetic owner-state regression', priority: 'high', tags: [],
    nextReviewAt: '2026-09-01', thesis: '保留的合成观察论点', validationCriteria: ['合成核验'], riskCriteria: ['合成风险'],
  });
  expect(result.ok).toBe(true);
  return result.data;
};
const route = async (hash: string) => {
  await act(async () => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); });
};
const change = (label: string, value: string) => fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(label, { exact: true }), { target: { value } });
const closeDialog = async () => { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); };
async function projection(hash: string) {
  await route(hash);
  const main = screen.getByRole('main');
  const inbox = within(main).getAllByRole('region', { name: '研究收件箱' }).find(el => !el.closest('[hidden]'))!;
  const dates = within(inbox).queryByLabelText('日期范围');
  if (dates) fireEvent.change(dates, { target: { value: 'all' } });
  return { state: inbox.getAttribute('data-state'), rows: [...inbox.querySelectorAll('[data-inbox-id]')].map(el => el.getAttribute('data-inbox-id')), observations: within(main).queryAllByRole('button', { name: `继续研究：${stocks[0].name}` }).length };
}
async function addExpectation(lower: string, upper: string, stockId = stocks[0].id) {
  await route('#/expectations');
  fireEvent.click(screen.getByRole('button', { name: '添加业绩预期' }));
  await screen.findByRole('dialog', { name: '添加业绩预期' });
  change('公司', stockId); change('报告期', '2026-12-31'); change('期间口径', 'full_year');
  change('预测形态', 'range'); change('区间下限', lower); change('区间上限', upper);
  change('来源标题', '隔离合成预测 ' + lower + '-' + upper); change('预期形成日期', '2026-09-01');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存不可变快照' }));
}
beforeEach(() => {
  localStorage.clear(); window.history.replaceState(null, '', '#/home');
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', vi.fn(async () => new Response('Synthetic provider IO unavailable', { status: 503 })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);

});

// Frozen public artifacts are replayed through the real provider loader, including
// checksum/schema validation. Only the local owner/faults are synthetic; no live IO.
async function replayPublicProvider() {
  const { readFileSync } = await vi.importActual<typeof import('node:fs')>('node:fs');
  const { webcrypto } = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const pathname = new URL(String(input), 'http://localhost').pathname;
    if (!pathname.startsWith('/data/') || pathname.includes('..')) return new Response('', { status: 404 });
    try { return new Response(new Uint8Array(readFileSync(`public${pathname}`)), { status: 200 }); }
    catch { return new Response('', { status: 404 }); }
  }));
}
const companyPath = (id = 'beigene', chapter = 'expectations') => `#/company/${id}/${chapter}?from=research`;
const companyExpectations = () => screen.getByRole('heading', { name: '业绩预期' }).closest('section')!;
async function settledCompany(id = 'beigene') {
  await route(companyPath(id));
  // A successful empty-company detail has no loading text. Workflow success is
  // independently evidenced by a retained official snapshot at fii before this.
  await waitFor(() => expect(companyExpectations()).not.toHaveTextContent('公司官方指引按需加载中'));
}
describe('UI21-P2-01 full App company expectation source health', () => {
  it.each(['corrupt', 'future', 'read-failure'] as const)('A/D: %s local owner is not a confirmed empty company', async failure => {
    await replayPublicProvider(); seedWatch(); render(<App />);
    await addExpectation('100', '200', 'beigene'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settledCompany(); expect(companyExpectations()).toHaveTextContent('100 至 200');
    cleanup();
    if (failure !== 'read-failure') localStorage.setItem(EARNINGS_EXPECTATION_STORAGE_KEY, failure === 'corrupt' ? '{synthetic broken json' : JSON.stringify({ schemaVersion: 999, synthetic: true }));
    const nativeGet = Storage.prototype.getItem, bytes = nativeGet.call(localStorage, EARNINGS_EXPECTATION_STORAGE_KEY);
    if (failure === 'read-failure') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key: string) {
      if (key === EARNINGS_EXPECTATION_STORAGE_KEY) throw new Error('Synthetic local expectation read denied');
      return nativeGet.call(this, key);
    });
    render(<App />);
    // Real loader success, not a manually injected ready prop.
    await settledCompany('fii'); await screen.findAllByText('数据提供方只读', {}, { timeout: 10000 });
    await settledCompany();
    expect.soft(companyExpectations()).toHaveTextContent('本地预期暂不可读');
    expect.soft(companyExpectations()).toHaveTextContent('当前没有可展示的已读取记录');
    expect.soft(companyExpectations()).not.toHaveTextContent('当前公司尚无可靠公司指引或用户业绩预期快照');
    expect.soft(within(companyExpectations()).getByRole('button', { name: '添加业绩预期' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '业绩验证' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '观察记录已锁定' })).toBeNull();
    await addExpectation('150', '250', 'beigene');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeVisible()); await closeDialog();
    await route(companyPath('beigene', 'financials')); await settledCompany();
    expect.soft(companyExpectations()).toHaveTextContent('本地预期暂不可读');
    expect(nativeGet.call(localStorage, EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(bytes);
    expect((await projection('#/home')).observations).toBe(1);
  }, 25000);
  it('B: official identities/comparisons/read-only survive missing local source', async () => {
    await replayPublicProvider(); render(<App />); await settledCompany('fii'); await screen.findAllByText('数据提供方只读', {}, { timeout: 10000 });
    const articles = () => [...companyExpectations().querySelectorAll('article')].map(el => el.textContent);
    const before = articles(); expect(before.length).toBeGreaterThan(0); cleanup();
    const bytes = '{synthetic unreadable local owner'; localStorage.setItem(EARNINGS_EXPECTATION_STORAGE_KEY, bytes);
    render(<App />); await settledCompany('fii'); await screen.findAllByText('数据提供方只读', {}, { timeout: 10000 });
    expect(articles()).toEqual(before);
    expect.soft(companyExpectations()).toHaveTextContent('本地预期暂不可读');
    expect.soft(companyExpectations()).toHaveTextContent('范围不完整');
    expect.soft(within(companyExpectations()).getByRole('button', { name: '添加新快照' })).toBeDisabled();
    expect(within(companyExpectations()).queryByRole('button', { name: '创建纠正快照' })).toBeNull();
    expect(localStorage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(bytes);
  }, 25000);
  it('C: healthy empty, invalid range, numeric zero and later valid write stay readable', async () => {
    await replayPublicProvider(); render(<App />); await settledCompany('fii'); await screen.findAllByText('数据提供方只读', {}, { timeout: 10000 });
    await settledCompany(); expect(companyExpectations()).toHaveTextContent('当前公司尚无可靠公司指引');
    await addExpectation('200', '100', 'beigene'); await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeVisible()); await closeDialog();
    await settledCompany(); expect(within(companyExpectations()).getByRole('button', { name: '添加业绩预期' })).toBeEnabled();
    expect(companyExpectations()).not.toHaveTextContent('本地预期暂不可读');
    await addExpectation('0', '0', 'beigene'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settledCompany(); expect(companyExpectations()).toHaveTextContent('0 至 0');
    await addExpectation('100', '200', 'beigene'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settledCompany(); expect(companyExpectations()).toHaveTextContent('100 至 200');
    expect(within(companyExpectations()).getByRole('button', { name: '添加新快照' })).toBeEnabled();
  }, 25000);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

describe('App owner health remains distinct from ordinary action rejection', () => {
  it('A/D: duplicate watch rejection preserves home/research/tasks and bytes, then a valid action succeeds', async () => {
    seedWatch(); render(<App />);
    const routes = ['#/home', '#/research', '#/tasks'];
    const before = []; for (const hash of routes) before.push(await projection(hash));
    expect(before[0].observations).toBe(1); expect(before[2].rows.length).toBeGreaterThan(0);
    const bytes = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
    change('公司', stocks[0].id);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('已经存在活跃观察项'));
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(bytes); await closeDialog();
    for (const [index, hash] of routes.entries()) expect.soft(await projection(hash), hash).toEqual(before[index]);
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(bytes);
    await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
    change('公司', stocks[1].id); change('关注理由', '后续合法合成操作');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new WatchlistRepository(localStorage).load().data.watchItems.map(item => item.stockId)).toEqual([stocks[0].id, stocks[1].id]);
    expect((await projection('#/home')).state).toBe('ready');
  }, 20000);
  it('B/D: invalid range uses the real expectation form/store, preserves owners, and permits a later valid snapshot', async () => {
    seedWatch(); render(<App />);
    await addExpectation('100', '200'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const bytes = localStorage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY), watchBytes = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const routes = ['#/home', '#/research', '#/tasks']; const before = []; for (const hash of routes) before.push(await projection(hash));
    await addExpectation('300', '200');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(/下限|上限/));
    expect(localStorage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(bytes); await closeDialog();
    for (const [index, hash] of routes.entries()) expect.soft(await projection(hash), hash).toEqual(before[index]);
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(watchBytes);
    expect(localStorage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(bytes);
    await addExpectation('150', '250'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(JSON.parse(localStorage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)!).snapshots).toHaveLength(2);
    expect((await projection('#/home')).state).toBe('ready');
  }, 20000);
  it.each([
    ['watch', 'future-schema'], ['watch', 'read-failure'],
    ['expectation', 'future-schema'], ['expectation', 'read-failure'],
  ] as const)('C: %s %s preserves owner bytes, refuses writes, and retains healthy independent views', async (owner, failure) => {
    seedWatch();
    render(<App />);
    await addExpectation('100', '200'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const healthy = await projection('#/home');
    expect(healthy.rows.length).toBeGreaterThan(0);
    cleanup();
    const key = owner === 'watch' ? WATCHLIST_STORAGE_KEY : EARNINGS_EXPECTATION_STORAGE_KEY;
    if (failure === 'future-schema') localStorage.setItem(key, JSON.stringify({ schemaVersion: 99, retained: 'Synthetic future owner bytes' }));
    const nativeGet = Storage.prototype.getItem;
    const bytes = nativeGet.call(localStorage, key);
    if (failure === 'read-failure') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, candidate: string) {
      if (candidate === key) throw new Error('Synthetic owner read failure');
      return nativeGet.call(this, candidate);
    });
    window.history.replaceState(null, '', '#/home'); render(<App />);
    const visible = await projection('#/home');
    expect.soft(visible.state).toBe('partial');
    expect.soft(visible.rows.length).toBeGreaterThan(0);
    if (owner === 'expectation') expect.soft(visible.observations).toBe(1);
    else expect.soft(visible.observations).toBe(0);
    await route('#/research');
    const context = document.querySelector('details.workspace-context')!;
    expect(context.textContent).toContain('范围不完整');
    if (owner === 'watch') {
      expect(context.textContent).toMatch(/观察项已锁定/);
      await route(`#/company/${encodeURIComponent(stocks[0].id)}/evidence?from=research`);
      expect(screen.getByRole('button', { name: '观察记录已锁定' })).toBeDisabled();
      expect(screen.queryByText('尚未加入观察清单')).toBeNull();
      expect(screen.getByText(/无法判断是否已加入观察清单/)).toBeVisible();
    } else expect(context.textContent).toContain('当前可读');
    if (owner === 'watch') {
      await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
      change('公司', stocks[1].id); change('关注理由', '不得覆盖锁定owner');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存' }));
    } else await addExpectation('150', '250');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeVisible());
    expect(nativeGet.call(localStorage, key)).toBe(bytes);
    await closeDialog();
    const after = await projection('#/home');
    expect(after.state).toBe('partial'); expect(after.rows.length).toBeGreaterThan(0);
    if (owner === 'expectation') expect(after.observations).toBe(1);
    await route('#/tasks');
    const reviewTab = screen.getByRole('tab', { name: /研究复盘/ });
    if (owner === 'watch') expect(reviewTab).toHaveTextContent('已锁定');
    else expect(reviewTab).not.toHaveTextContent('已锁定');
    expect(nativeGet.call(localStorage, key)).toBe(bytes);
  }, 20000);

  it.each(['future-schema', 'new-valid-base'] as const)('C concurrent %s cannot rebind the already loaded App base after rejection', async failure => {
    seedWatch(); render(<App />); expect((await projection('#/home')).observations).toBe(1);
    if (failure === 'future-schema') localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, retained: 'External future owner' }));
    else {
      const otherRepository = new WatchlistRepository(localStorage);
      const other = new WatchlistStore(otherRepository, () => now).createWatchItem(otherRepository.load().data, {
        stockId: stocks[1].id, reason: '另一真实repository的合成变更', priority: 'medium', tags: [], nextReviewAt: null,
        thesis: '必须保留的外部变更', validationCriteria: [], riskCriteria: [],
      }); expect(other.ok).toBe(true);
    }
    const externalBytes = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
    change('公司', stocks[2].id); change('关注理由', '旧基线不得覆盖外部写入');
    for (let attempt = 0; attempt < 2; attempt++) {
      const save = within(screen.getByRole('dialog')).getByRole('button', { name: '保存' });
      await waitFor(() => expect(save).toBeEnabled()); fireEvent.click(save);
      await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeVisible());
      expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(externalBytes);
    }
    await closeDialog(); const current = await projection('#/home');
    expect(current.state).toBe('partial'); expect(current.rows.length).toBeGreaterThan(0);
    expect(current.observations).toBe(0);
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(externalBytes);
  }, 15000);

  it('C/D quota write rejection retains readable confirmed data and can recover without reloading owners', async () => {
    seedWatch(); render(<App />); const before = await projection('#/home');
    const bytes = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const nativeSet = Storage.prototype.setItem;
    const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === WATCHLIST_STORAGE_KEY) throw new DOMException('Synthetic quota exhausted', 'QuotaExceededError');
      return nativeSet.call(this, key, value);
    });
    await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
    change('公司', stocks[1].id); change('关注理由', '配额恢复后的合法操作');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Synthetic quota exhausted'));
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(bytes); await closeDialog();

    expect(screen.getByText(/Synthetic quota exhausted/)).toBeVisible();
    expect(await projection('#/home')).toEqual(before);
    quota.mockRestore();
    await route('#/watchlist'); fireEvent.click(screen.getByRole('button', { name: '添加观察项' }));
    change('公司', stocks[1].id); change('关注理由', '配额恢复后的合法操作');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new WatchlistRepository(localStorage).load().data.watchItems).toHaveLength(2);
    expect((await projection('#/home')).state).toBe('ready');
  }, 15000);

});





