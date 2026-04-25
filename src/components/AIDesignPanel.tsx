import { Loader2, RotateCw, Sparkles, WandSparkles, XCircle } from "lucide-react";
import type { MarbleResult } from "../state/types";

type AIDesignPanelProps = {
  prompt: string;
  marble: MarbleResult;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onCancelRun: () => void;
  onLoadExample: () => void;
};

export function AIDesignPanel({
  prompt,
  marble,
  onPromptChange,
  onGenerate,
  onCancelRun,
  onLoadExample,
}: AIDesignPanelProps) {
  const busy = marble.status === "uploading" || marble.status === "generating";
  const hasResult = marble.status === "complete" && Boolean(marble.payload);
  const canGenerate = prompt.trim().length > 0 && !busy;

  return (
    <div className="grid min-h-0 gap-2 p-2">
      <div className="flex min-h-0 flex-col gap-1.5">
        <label className="sr-only" htmlFor="style-prompt">
          Final room style prompt
        </label>
        <textarea
          id="style-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Turn this into a warm Scandinavian living room..."
          rows={2}
          className="min-h-[3.75rem] resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2.5 py-2 text-[13px] leading-5 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
        <div className="grid gap-1.5 sm:grid-cols-[minmax(9rem,1fr)_auto_auto]">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="flex h-8 min-w-0 items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-3 text-[13px] font-semibold text-white shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)] disabled:shadow-none"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : hasResult ? <RotateCw className="size-4" /> : <Sparkles className="size-4" />}
            {busy ? stageLabel(marble.status) : hasResult ? "Regenerate result" : "Generate result"}
          </button>
          <button
            type="button"
            onClick={onCancelRun}
            disabled={!busy}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-inset)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
          >
            <XCircle className="size-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onLoadExample}
            disabled={busy}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-inset)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
          >
            <WandSparkles className="size-3.5" />
            Sample
          </button>
        </div>
      </div>
      <p className="min-w-0 truncate px-0.5 text-[11px] leading-4 text-[var(--color-text-muted)]">
        {marble.error ?? statusSummary(marble.status, hasResult)}
      </p>
    </div>
  );
}

function stageLabel(status: MarbleResult["status"]) {
  if (status === "uploading") return "Preparing scene";
  if (status === "generating") return "Generating result";
  return "Generating result";
}

function statusSummary(status: MarbleResult["status"], hasResult: boolean) {
  if (status === "uploading") return "Capturing the current blockout, blueprint, furniture, and style prompt.";
  if (status === "generating") return "Waiting for the generated room operation to complete.";
  if (status === "complete" || hasResult) return "Result is ready for review.";
  if (status === "failed") return "Generation failed. Check the API response and configuration.";
  return "Ready to package the room, furniture, and style prompt.";
}
