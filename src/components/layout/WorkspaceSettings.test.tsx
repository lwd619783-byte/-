// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceSettings } from './WorkspaceSettings';
afterEach(cleanup);
it('keeps backup and source actions as rows with their material limitations visible', () => {
  const openKnowledge = vi.fn(), openSources = vi.fn();
  const { container } = render(<WorkspaceSettings openKnowledge={openKnowledge} openSources={openSources} />);
  expect(container.querySelectorAll('.workspace-setting-row')).toHaveLength(7);
  expect(screen.getByText('文章备份不包含原件。')).toBeVisible();
  expect(screen.getByText('外部编辑不会回写正式知识库。')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '管理文章备份' }));
  fireEvent.click(screen.getByRole('button', { name: '导出与目录校验' }));
  expect(openKnowledge).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: '查看与下载原件' }));
  expect(openSources).toHaveBeenCalledTimes(1);
  expect(screen.getByText('位置与迁移详情').closest('details')).not.toHaveAttribute('open');
});
