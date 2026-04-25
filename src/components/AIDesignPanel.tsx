import { CheckCircle2, Loader2, RotateCw, Sparkles, XCircle } from "lucide-react";
import type { MarbleResult, ProjectVisibility, WorkflowStepId } from "../state/types";

type AIDesignPanelProps = {
  prompt: string;
  marble: MarbleResult;
  workflowStep?: WorkflowStepId;
  visibility?: ProjectVisibility;
  panoramaOpacity?: number;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onCancelRun: () => void;
  onLoadExample: () => void;
  onWorkflowStepChange?: (workflowStep: WorkflowStepId) => void;
  onVisibilityChange?: (visibility: ProjectVisibility) => void;
  onPanoramaOpacityChange?: (panoramaOpacity: number) => void;
};

const stages = [
  { id: "preparing", label: "Preparing scene" },
  { id: "composing", label: "Composing room" },
  { id: "rendering", label: "Rendering result" },
] as const;

export function AIDesignPanel({
  prompt,
  marble,
  workflowStep = "world",
  visibility = "private",
  panoramaOpacity = 0.72,
  onPromptChange,
  onGenerate,
  onCancelRun,
  onLoadExample,
  onWorkflowStepChange,
  onVisibilityChange,
  onPanoramaOpacityChange,
}: AIDesignPanelProps) {
  const busy = marble.status === "uploading" || marble.status === "generating";
  const hasResult = marble.status === "complete" && Boolean(marble.payload);
  const canGenerate = prompt.trim().length > 0 && !busy;

  return (
    <div className="grid h-full min-h-0 gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Describe final style</h2>
          <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--color-text-muted)]">
            Package the room, furniture, and style prompt into a generated-room request.
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
          {workflowStep}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(["chisel", "panorama", "draft", "world"] as WorkflowStepId[]).map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onWorkflowStepChange?.(step)}
            aria-pressed={workflowStep === step}
            className={`h-8 rounded-md text-[11px] font-semibold ${
              workflowStep === step
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-inset)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {step}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-col gap-2">
        <label className="sr-only" htmlFor="style-prompt">
          Final room style prompt
        </label>
        <textarea
          id="style-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Turn this into a warm Scandinavian living room..."
          className="min-h-28 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-3 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)] disabled:shadow-none"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : hasResult ? <RotateCw className="size-4" /> : <Sparkles className="size-4" />}
            {busy ? stageLabel(marble.status) : hasResult ? "Regenerate result" : "Generate result"}
          </button>
          <button
            type="button"
            onClick={onCancelRun}
            disabled={!busy}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-inset)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
          >
            <XCircle className="size-4" />
            Cancel
          </button>
          <div className="flex h-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text-muted)]">
            {hasResult ? "Ready to review" : marble.status}
          </div>
        </div>
        <button
          type="button"
          onClick={onLoadExample}
          disabled={busy}
          className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-inset)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
        >
          Load sample result
        </button>
      </div>
      <div className="grid gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <button
          type="button"
          onClick={() => onVisibilityChange?.(visibility === "private" ? "public" : "private")}
          className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
        >
          {visibility}
        </button>
        <label className="text-xs font-medium text-[var(--color-text-muted)]">
          Panorama opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={panoramaOpacity}
            onChange={(event) => onPanoramaOpacityChange?.(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
        </label>
      </div>
      <div className="grid gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        {stages.map((stage) => {
          const done = stageDone(stage.id, marble.status, hasResult);
          const active = stageActive(stage.id, marble.status);
          return (
            <div key={stage.id} className="flex items-center gap-2 text-xs">
              <span className={`grid size-5 place-items-center rounded-full ${done ? "bg-[var(--color-accent)] text-white" : active ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "bg-[var(--color-inset)] text-[var(--color-text-muted)]"}`}>
                {active ? <Loader2 className="size-3 animate-spin" /> : done ? <CheckCircle2 className="size-3.5" /> : null}
              </span>
              <span className={active || done ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>{stage.label}</span>
            </div>
          );
        })}
        <p className="text-pretty border-t border-[var(--color-border)] pt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {marble.error ?? statusSummary(marble.status)}
        </p>
      </div>
    </div>
  );
}

function stageLabel(status: MarbleResult["status"]) {
  if (status === "uploading") return "Preparing scene";
  if (status === "generating") return "Generating result";
  return "Generating result";
}

function stageDone(
  stage: (typeof stages)[number]["id"],
  status: MarbleResult["status"],
  hasResult: boolean,
) {
  if (hasResult) return true;
  if (stage === "preparing") return status === "generating";
  return false;
}

function stageActive(stage: (typeof stages)[number]["id"], status: MarbleResult["status"]) {
  if (stage === "preparing") return status === "uploading";
  if (stage === "composing") return status === "generating";
  return false;
}

function statusSummary(status: MarbleResult["status"]) {
  if (status === "uploading") return "Capturing the current blockout, blueprint, furniture, and style prompt.";
  if (status === "generating") return "Waiting for the generated room operation to complete.";
  if (status === "complete") return "Result is ready for review.";
  if (status === "failed") return "Generation failed. Check the API response and configuration.";
  return "Ready to package the room, furniture, and style prompt.";
}
