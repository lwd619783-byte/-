import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, description, onClose, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panel) return;
      const elements = [...panel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.hasAttribute("disabled"));
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-borderGlow/50 bg-bg2 shadow-2xl sm:rounded-xl">
        <header className="flex items-start justify-between gap-4 border-b border-borderSoft p-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold text-textStrong">{title}</h2>
            {description ? <p className="mt-1 text-sm text-textMuted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-md border border-borderSoft p-2 text-textMuted hover:border-cyan hover:text-cyan"><X className="h-4 w-4" /></button>
        </header>
        <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-borderSoft p-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
