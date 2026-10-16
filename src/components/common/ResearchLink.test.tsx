// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, expect, it } from 'vitest';
import { ResearchLink, ResearchLinkNavigation } from './ResearchLink';

afterEach(cleanup);
it('preserves the formal-mode anchor, URL, target and rel by default', () => {
  render(<ResearchLink href="https://example.invalid/source" className="underline">Synthetic source</ResearchLink>);
  const link = screen.getByRole('link');
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')).toBe('https://example.invalid/source');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noreferrer');
  expect(link.getAttribute('class')).toBe('underline');
  expect(link.textContent).toBe('Synthetic source');
});
it.each([false, true])('demo removes native navigation, including portaled links (%s)', portal => {
  const content = <ResearchLink href="https://example.invalid/source">Synthetic source</ResearchLink>;
  render(<ResearchLinkNavigation.Provider value={false}>{portal ? createPortal(content, document.body) : content}</ResearchLinkNavigation.Provider>);
  const link = screen.getByRole('link');
  expect(link.tagName).toBe('SPAN');
  expect(link.hasAttribute('href')).toBe(false);
  expect(link.hasAttribute('target')).toBe(false);
  expect(link.getAttribute('aria-disabled')).toBe('true');
  expect(link.textContent).toContain('演示不打开外链');
  expect(document.querySelectorAll('a[href]')).toHaveLength(0);
});
