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
    <section className={cn("flex min-h-0 flex-col border border-[var(--color-border)] bg-[var(--color-overlay)]", className)}>
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
          {eyebrow ? <p className="truncate text-[11px] text-[var(--color-text-muted)]">{eyebrow}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onClose ? (
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="grid size-7 place-items-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
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
