import { useEffect, useState } from "react";

/** Refresh display age while a page stays open; tests may supply a fixed clock. */
export function useDisplayNow(now?: Date) {
  const [runtimeNow, setRuntimeNow] = useState(() => new Date());
  useEffect(() => {
    if (now) return;
    const timer = window.setInterval(() => setRuntimeNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [now]);
  return now ?? runtimeNow;
}
