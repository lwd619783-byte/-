import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

export const APPEARANCE_KEY = "investment-dashboard.ui.v1.appearance";
export type Theme = "neon" | "pro" | "light";
const themes: Record<Theme, string> = { neon: "霓虹科技", pro: "深色专业", light: "明亮简洁" };
export function readAppearance(): { theme: Theme; error: string | null } {
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);
    return { theme: saved === "pro" || saved === "light" ? saved : "neon", error: null };
  } catch {
    return { theme: "neon", error: "外观偏好无法读取，本次会话使用霓虹科技。" };
  }
}
const AppearanceContext = createContext({ theme: "neon" as Theme, error: null as string | null, setTheme: (_theme: Theme) => {} });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(readAppearance);
  useLayoutEffect(() => { document.documentElement.dataset.theme = appearance.theme; }, [appearance.theme]);
  const setTheme = (theme: Theme) => {
    let error: string | null = null;
    try { localStorage.setItem(APPEARANCE_KEY, theme); }
    catch { error = "外观偏好未能保存，当前会话仍可使用；业务数据不受影响。"; }
    setAppearance({ theme, error });
  };
  return <AppearanceContext.Provider value={{ ...appearance, setTheme }}>{children}</AppearanceContext.Provider>;
}

export function AppearanceControl() {
  const { theme, error, setTheme } = useContext(AppearanceContext);
  return <div className="appearance-control">
    <label className="flex items-center gap-2 text-xs text-textMuted">外观
      <select aria-label="外观" value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
        {Object.entries(themes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {error ? <p role="status" className="mt-1 max-w-xs text-xs text-warning">{error}</p> : null}
  </div>;
}
