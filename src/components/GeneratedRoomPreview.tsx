import { CheckCircle2, ImageIcon, Layers3, Loader2 } from "lucide-react";
import type { MarbleResult } from "../state/types";

export function GeneratedRoomPreview({ marble }: { marble: MarbleResult }) {
  const busy = marble.status === "uploading" || marble.status === "generating";

  if (busy) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-background)] p-5 text-center">
        <div className="w-full max-w-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)]">
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{stageTitle(marble.status)}</h3>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--color-text-muted)]">
            {marble.error ?? "Packaging the scene, blueprint, assets, and prompt."}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-inset)]">
            <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: marble.status === "uploading" ? "35%" : "70%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!marble.payload) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-background)] p-5 text-center">
        <div>
          <Layers3 className="mx-auto mb-3 size-8 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Result will appear here</h3>
          <p className="mt-1 max-w-md text-pretty text-sm leading-relaxed text-[var(--color-text-muted)]">
            Describe the final style and run the demo generation flow to review a finished-room concept.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 bg-[var(--color-background)] p-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.8fr)]">
      <div className="relative min-h-48 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] shadow-[var(--shadow-float)]">
        {marble.thumbnailUrl ? (
          <img src={marble.thumbnailUrl} alt="Generated room preview" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon className="size-10 text-[var(--color-text-muted)]" />
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[11px] font-semibold text-white [backdrop-filter:blur(12px)]">
          Generated result
        </div>
      </div>
      <aside className="thin-scrollbar min-h-0 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Generated room</h3>
          <span className="rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-accent)]">
            Complete
          </span>
        </div>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--color-text-muted)]">
          A finished room concept is ready for review. Use this panel to inspect the generated preview and payload.
        </p>
        <div className="mt-4 grid gap-2">
          <ReviewPoint label="Layout preserved" />
          <ReviewPoint label="Furniture plan refined" />
          <ReviewPoint label="Modern apartment styling applied" />
          <ReviewPoint label="Generated preview received" />
        </div>
        {marble.error ? (
          <div className="mt-3 rounded-md border border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] p-2 text-xs text-[var(--color-warning)]">
            {marble.error}
          </div>
        ) : null}
        <details className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-2">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-text-muted)]">Demo payload</summary>
          <pre className="mt-2 max-h-44 overflow-auto text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            {JSON.stringify(marble.payload, null, 2)}
          </pre>
        </details>
      </aside>
    </div>
  );
}

function ReviewPoint({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 py-2 text-xs text-[var(--color-text-primary)]">
      <CheckCircle2 className="size-4 shrink-0 text-[var(--color-accent)]" />
      <span>{label}</span>
    </div>
  );
}

function stageTitle(status: MarbleResult["status"]) {
  if (status === "uploading") return "Preparing scene";
  if (status === "generating") return "Generating result";
  return "Building room";
}
