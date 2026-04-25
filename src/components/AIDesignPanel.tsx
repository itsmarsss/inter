import { ImageIcon, Loader2, RotateCw, Send, TerminalSquare } from "lucide-react";
import type { MarbleResult } from "../state/types";

type AIDesignPanelProps = {
  prompt: string;
  marble: MarbleResult;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onLoadExample: () => void;
};

export function AIDesignPanel({ prompt, marble, onPromptChange, onGenerate, onLoadExample }: AIDesignPanelProps) {
  const busy = marble.status === "uploading" || marble.status === "generating";
  const hasResult = marble.status === "complete" && Boolean(marble.payload);

  return (
    <div className="grid h-full min-h-0 gap-2 p-2 md:grid-cols-[minmax(0,1fr)_8.5rem]">
      <div className="flex min-h-0 flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Turn this into a warm Scandinavian living room..."
          className="min-h-20 flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-3 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-clay)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy || !prompt.trim()}
            className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-accent-clay)] px-3 text-sm font-semibold text-[var(--color-background)] shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)] disabled:shadow-none"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : hasResult ? <RotateCw className="size-4" /> : <Send className="size-4" />}
            {busy ? "Sending to Marble" : hasResult ? "Regenerate" : "Create World"}
          </button>
          <div className="hidden h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-[11px] font-medium uppercase text-[var(--color-text-muted)] sm:flex">
            {marble.status}
          </div>
          <button
            type="button"
            onClick={onLoadExample}
            disabled={busy}
            className="hidden h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] md:block"
          >
            Sample
          </button>
        </div>
      </div>
      <aside className="hidden min-h-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] md:flex md:flex-col">
        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-[var(--color-surface)]">
          {marble.thumbnailUrl ? (
            <img src={marble.thumbnailUrl} alt="Generated room preview" className="h-full w-full object-cover" />
          ) : busy ? (
            <Loader2 className="size-6 animate-spin text-[var(--color-accent-hover)]" />
          ) : (
            <ImageIcon className="size-6 text-[var(--color-text-muted)]" />
          )}
        </div>
        <div className="border-t border-[var(--color-border)] p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
            <TerminalSquare className="size-3.5 text-[var(--color-accent-hover)]" />
            Marble
          </div>
          <p className="line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
            {busy
              ? marble.error
                ? marble.error
                : "Capturing blockout views and polling the result."
              : marble.error
                ? marble.error
                : hasResult
                  ? "Result is ready for review."
                  : "Ready for scene generation."}
          </p>
        </div>
      </aside>
    </div>
  );
}
