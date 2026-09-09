import { useRef, useState } from "react";

/** Serializes UI submits without changing the synchronous store transaction. */
export function useSubmission() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const run = async (action: () => unknown) => {
    if (locked.current) return;
    locked.current = true; setPending(true);
    try { await action(); } finally { locked.current = false; setPending(false); }
  };
  return { pending, run };
}
