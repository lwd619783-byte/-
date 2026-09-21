// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceNavigation, ResearchNavigation, WorkspaceSearch } from './WorkspaceNavigation';
import { Modal } from '../common/Modal';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('UI V2 navigation and search', () => {
  it('keeps all existing research destinations under the same research entry', () => {
    const navigate = vi.fn();
    render(<><WorkspaceNavigation page="industry" navigate={navigate} /><ResearchNavigation page="industry" navigate={navigate} /></>);
    const primary = within(screen.getByRole('navigation', { name: '主要导航' }));
    expect(primary.getByRole('link', { name: '研究' })).toHaveAttribute('aria-current', 'page');
    expect(primary.getAllByRole('link').map(link => link.textContent)).toEqual(['工作台', '研究', '知识库', '组合', '任务', '资料与连接', '设置与帮助']);
    const research = within(screen.getByRole('navigation', { name: '研究分类' }));
    expect(research.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['#/research', '#/macro', '#/industry', '#/stocks', '#/watchlist', '#/verification', '#/expectations', '#/creators']);
    fireEvent.click(research.getByRole('link', { name: '论点与观察' }));
    expect(navigate).toHaveBeenCalledWith('watchlist');
  });

  it('keeps legacy memory under knowledge and returns focus when the nonmodal menu closes', () => {
    render(<WorkspaceNavigation page="memory" navigate={vi.fn()} />);
    expect(screen.getByRole('link', { name: '知识库' })).toHaveAttribute('aria-current', 'page');
    const toggle = screen.getByRole('button', { name: '导航' });
    fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const link = screen.getByRole('link', { name: '工作台' });link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');expect(toggle).toHaveFocus();
  });

  it('opens search from the keyboard and restores trigger focus on Escape without storage or network access', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const fetch = vi.spyOn(globalThis, 'fetch');
    render(<WorkspaceSearch navigate={vi.fn()} onCompanySearch={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: '搜索' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /搜索页面或公司/ })).toHaveFocus();
    expect(read).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });

  it('passes the typed company query explicitly and never interprets it as HTML or a route', () => {
    const navigate = vi.fn(), search = vi.fn();
    render(<WorkspaceSearch navigate={navigate} onCompanySearch={search} />);
    fireEvent.click(screen.getByRole('button', { name: /搜索页面或公司/ }));
    const text = '<script>bad</script>/stock';
    fireEvent.change(screen.getByLabelText('搜索页面、公司或代码'), { target: { value: text } });
    expect(screen.getByRole('status')).toHaveTextContent('没有匹配的页面');
    expect(document.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `在公司研究池查找“${text}”` }));
    expect(search).toHaveBeenCalledTimes(1);expect(search).toHaveBeenCalledWith(text);expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open a second search dialog while another modal has focus', () => {
    render(<><WorkspaceSearch navigate={vi.fn()} onCompanySearch={vi.fn()} /><Modal title="待审核文章" onClose={vi.fn()}><textarea aria-label="审核输入" /></Modal></>);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: '搜索' })).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
