import { X } from "lucide-react";
import { cn } from "../lib/cn";

type PanelProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  actions?: React.ReactNode;
};

export function Panel({ title, eyebrow, children, className, onClose, actions }: PanelProps) {
  return (
    <section className={cn("flex min-h-0 flex-col border border-slate-800 bg-slate-950/88", className)}>
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>
          {eyebrow ? <p className="truncate text-[11px] text-slate-500">{eyebrow}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onClose ? (
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
