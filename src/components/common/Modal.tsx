import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppearanceControl } from "../layout/Appearance";
interface ModalProps {
  title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  size?: "compact" | "research" | "import" | "drawer";
}
export function Modal({ title, description, onClose, children, footer, size="research" }: ModalProps) {
  const panelRef=useRef<HTMLDivElement>(null); const onCloseRef=useRef(onClose); onCloseRef.current=onClose;
  const titleId=useId();
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel=panelRef.current; const root=document.getElementById("root"); const oldInert=root?.inert; const oldOverflow=document.body.style.overflow;
    if(root)root.inert=true; document.body.style.overflow="hidden";
    const focusables=()=>[...panel!.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],summary,[tabindex]:not([tabindex='-1'])")].filter(el=>!el.hasAttribute("disabled")&&!el.closest("[hidden]"));
    (focusables()[0] ?? panel)?.focus();
    const key=(event:KeyboardEvent)=>{
      if([...document.querySelectorAll('[data-workspace-modal]')].pop()!==panel)return;
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onCloseRef.current();}
      if(event.key!=="Tab"||!panel)return;
      const elements=focusables();const first=elements[0];const last=elements[elements.length-1];
      if(!first){event.preventDefault();panel.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("keydown",key);if(root)root.inert=oldInert ?? false;document.body.style.overflow=oldOverflow;previous?.focus({preventScroll:true});};
  },[]);
  const content = <div className={`modal-overlay modal-${size}`} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onCloseRef.current();}}>
    <div ref={panelRef} data-workspace-modal role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="modal-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borderSoft p-4">
        <div className="min-w-0 flex-1"><h2 id={titleId} className="text-lg font-semibold text-textStrong">{title}</h2>{description ? <p className="mt-1 text-sm text-textMuted">{description}</p>:null}</div>
        <button type="button" onClick={()=>onCloseRef.current()} aria-label="关闭" className="rounded-md border border-control p-2 text-textMuted hover:text-cyan"><X className="h-4 w-4"/></button>
        <div className="w-full"><AppearanceControl/></div>
      </header>
      <div className="modal-content scrollbar-thin">{children}</div>
      {footer ? <footer className="modal-footer">{footer}</footer>:null}
    </div>
  </div>;
  return typeof document === "undefined" ? content : createPortal(content,document.body);
}
