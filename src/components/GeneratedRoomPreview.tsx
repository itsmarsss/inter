import { ExternalLink, ImageIcon, Layers3, Loader2 } from "lucide-react";
import type { MarbleResult } from "../state/types";

export function GeneratedRoomPreview({ marble }: { marble: MarbleResult }) {
  const busy = marble.status === "uploading" || marble.status === "generating";

  if (busy) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-background)] p-4 text-center">
        <div>
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-[var(--color-accent-hover)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Building room</h3>
          <p className="mt-1 max-w-md text-sm text-[var(--color-text-muted)]">
            {marble.error ?? "Packaging the scene, blueprint, assets, and prompt."}
          </p>
        </div>
      </div>
    );
  }

  if (!marble.payload) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-background)] p-4 text-center">
        <div>
          <Layers3 className="mx-auto mb-3 size-8 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">No generated room yet</h3>
          <p className="mt-1 max-w-md text-sm text-[var(--color-text-muted)]">Create a world from the current blockout when the scene is ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 bg-[var(--color-background)] p-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.75fr)]">
      <div className="min-h-40 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] shadow-[var(--shadow-float)]">
        {marble.thumbnailUrl ? (
          <img src={marble.thumbnailUrl} alt="Generated room preview" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon className="size-10 text-[var(--color-text-muted)]" />
          </div>
        )}
      </div>
      <aside className="thin-scrollbar min-h-0 overflow-auto border-t border-[var(--color-border)] pt-3 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Marble Result</h3>
          <span className="rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-accent-hover)]">
            {marble.status}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          <ResultLink label="World URL" href={marble.worldUrl} />
          <ResultLink label="Pano URL" href={marble.panoUrl} />
          <ResultLink label="SPZ Asset" href={marble.spzUrl} />
          <ResultLink label="Collider Mesh" href={marble.colliderMeshUrl} />
        </div>
        {marble.error ? (
          <div className="mt-3 rounded-md border border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] p-2 text-xs text-[var(--color-warning)]">
            {marble.error}
          </div>
        ) : null}
        <h4 className="mt-4 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Debug Payload</h4>
        <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          {JSON.stringify(marble.payload, null, 2)}
        </pre>
      </aside>
    </div>
  );
}

function ResultLink({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-between rounded-md border px-2 py-2 text-xs ${
        href
          ? "border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-clay)] hover:bg-[var(--color-inset)]"
          : "pointer-events-none border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
      }`}
    >
      <span>{label}</span>
      <ExternalLink className="size-3.5" />
    </a>
  );
}
