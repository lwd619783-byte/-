// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { APPEARANCE_KEY, AppearanceControl, AppearanceProvider, readAppearance } from './Appearance';
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); delete document.documentElement.dataset.theme; });
describe('UI V2 single appearance', () => {
  it.each([null, 'neon', 'pro', 'light', 'invalid'])('maps %s to light without touching saved data', value => {
    if (value) localStorage.setItem(APPEARANCE_KEY, value);
    localStorage.setItem('business-fixture', '{"immutable":true}');
    const bytes = { ...localStorage };
    expect(readAppearance().theme).toBe('light');
    render(<AppearanceProvider><AppearanceControl /><input aria-label="未提交研究" defaultValue="原始研究" /></AppearanceProvider>);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.queryByLabelText('外观')).toBeNull();
    expect({ ...localStorage }).toEqual(bytes);
  });
  it('does not depend on available browser storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    render(<AppearanceProvider><p>可阅读</p></AppearanceProvider>);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByText('可阅读')).toBeTruthy();
  });
});
