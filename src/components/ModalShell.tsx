import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const stack: HTMLElement[] = [];
let restoreBackground: (() => void) | undefined;
const selectors = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ModalShell({ title, children, onClose, footer, width = 'max-w-xl' }: {
  title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: string;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (stack.length === 0) {
      const root = document.getElementById('root');
      const wasInert = root?.inert ?? false;
      const bodyOverflow = document.body.style.overflow;
      const htmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (root) root.inert = true;
      restoreBackground = () => {
        if (root) root.inert = wasInert;
        document.body.style.overflow = bodyOverflow;
        document.documentElement.style.overflow = htmlOverflow;
      };
    }
    stack.push(element);
    element.focus();
    const top = () => stack[stack.length - 1] === element;
    const keydown = (event: KeyboardEvent) => {
      if (!top()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = [...element.querySelectorAll<HTMLElement>(selectors)]
        .filter(item => !item.closest('[hidden], [aria-hidden="true"]') && item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
        event.preventDefault(); first.focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (top() && !element.contains(event.target as Node)) element.focus();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      const index = stack.indexOf(element);
      if (index !== -1) stack.splice(index, 1);
      if (stack.length === 0) { restoreBackground?.(); restoreBackground = undefined; }
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/70 backdrop-blur-sm p-3 sm:p-6"
      onClick={event => { if (event.target === event.currentTarget && stack[stack.length - 1] === panel.current) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`surface relative flex w-full ${width} max-h-[calc(100dvh-3rem)] flex-col overflow-hidden shadow-2xl`}>
        <header className="shrink-0 flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
          <h2 id={titleId} className="font-display text-xl font-semibold text-txt-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="shrink-0 rounded-lg p-2 text-txt-muted hover:text-txt-primary focus-visible:outline focus-visible:outline-emerald-500">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line-soft px-5 py-4">{footer}</footer>}
      </div>
    </div>, document.body,
  );
}
