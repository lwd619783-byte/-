import { useLayoutEffect, type ReactNode } from 'react';

export const APPEARANCE_KEY = 'investment-dashboard.ui.v1.appearance';
/** Legacy names remain accepted by chart/fixture callers, never alternate product skins. */
export type Theme = 'neon' | 'pro' | 'light';
export function readAppearance(): { theme: Theme; error: string | null } {
  return { theme: 'light', error: null };
}
export function AppearanceProvider({ children }: { children: ReactNode; persist?: boolean }) {
  useLayoutEffect(() => { document.documentElement.dataset.theme = 'light'; }, []);
  return <>{children}</>;
}
/** Compatibility boundary: no storage migration or deletion. */
export function AppearanceControl() { return null; }
