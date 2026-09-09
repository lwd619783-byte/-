import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppearanceControl } from "../layout/Appearance";
import { FormFeedback } from "./FormField";
interface ModalProps {
  title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  size?: "compact" | "research" | "import" | "drawer";
  error?: string | null; busy?: boolean; hasUnsavedChanges?: boolean; onDiscard?: () => void;
}
export function Modal({ title, description, onClose, children, footer, size="research", error, busy=false, hasUnsavedChanges=false, onDiscard=onClose }: ModalProps) {
  const panelRef=useRef<HTMLDivElement>(null); const onCloseRef=useRef(onClose); onCloseRef.current=onClose;
  const lifecycle = useRef({ busy, hasUnsavedChanges, onDiscard }); lifecycle.current = { busy, hasUnsavedChanges, onDiscard };
  const errorRef=useRef<HTMLDivElement>(null);
  const requestClose = () => { if (!lifecycle.current.busy) onCloseRef.current(); };
  const titleId=useId();
  useEffect(()=>{ if(error) errorRef.current?.focus(); },[error]);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel=panelRef.current; const root=document.getElementById("root"); const oldInert=root?.inert; const oldOverflow=document.body.style.overflow;
    if(root)root.inert=true; document.body.style.overflow="hidden";
    const focusables=()=>[...panel!.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],summary,[tabindex]:not([tabindex='-1'])")].filter(el=>!el.hasAttribute("disabled")&&!el.closest("[hidden]")&&el.getClientRects().length>0);
    (focusables()[0] ?? panel)?.focus();
    const key=(event:KeyboardEvent)=>{
      if([...document.querySelectorAll('[data-workspace-modal]')].pop()!==panel)return;
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();requestClose();}
      if(event.key!=="Tab"||!panel)return;
      const elements=focusables();const first=elements[0];const last=elements[elements.length-1];
      if(!first){event.preventDefault();panel.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",key);
    const openingUrl=window.location.href; const openingState=window.history.state;
    const leave=(event:Event)=>{
      if(window.location.href===openingUrl)return;
      const current=lifecycle.current;
      if(current.busy || (current.hasUnsavedChanges && !window.confirm("有未保存的内容，确认丢弃并离开？"))){event.stopImmediatePropagation();window.history.pushState(openingState,"",openingUrl);}
      else current.onDiscard();
    };
    const unload=(event:BeforeUnloadEvent)=>{if(lifecycle.current.hasUnsavedChanges || lifecycle.current.busy){event.preventDefault();event.returnValue="";}};
    window.addEventListener("popstate",leave,true);window.addEventListener("hashchange",leave,true);window.addEventListener("beforeunload",unload);
    return()=>{document.removeEventListener("keydown",key);window.removeEventListener("popstate",leave,true);window.removeEventListener("hashchange",leave,true);window.removeEventListener("beforeunload",unload);if(root)root.inert=oldInert ?? false;document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const content = <div className={`modal-overlay modal-${size}`} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)requestClose();}}>
    <div ref={panelRef} data-workspace-modal role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby={titleId} tabIndex={-1} className="modal-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borderSoft p-4">
        <div className="min-w-0 flex-1"><h2 id={titleId} className="text-lg font-semibold text-textStrong">{title}</h2>{description ? <p className="mt-1 text-sm text-textMuted">{description}</p>:null}</div>
        <button type="button" disabled={busy} onClick={requestClose} aria-label="关闭" className="rounded-md border border-control p-2 text-textMuted hover:text-cyan"><X className="h-4 w-4"/></button>
        <div className="w-full"><AppearanceControl/></div>
      </header>
      <div className="modal-content scrollbar-thin"><FormFeedback.Provider value={error ?? null}>{error ? <div ref={errorRef} role="alert" tabIndex={-1} className="mb-4 rounded-md border border-danger bg-danger/10 p-3 text-sm leading-6 text-danger"><strong>操作未完成</strong><p className="break-words">{error}</p><p>当前输入已保留，请修正后重试。</p></div>:null}{children}</FormFeedback.Provider></div>
      {footer ? <footer className="modal-footer">{footer}</footer>:null}
    </div>
  </div>;
  return typeof document === "undefined" ? content : createPortal(content,document.body);
}
