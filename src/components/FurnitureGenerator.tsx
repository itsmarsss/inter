import { Box, Loader2, Plus, WandSparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import type { FurnitureAsset } from "../state/types";

type FurnitureGeneratorProps = {
  assets: FurnitureAsset[];
  onGenerate: (prompt: string) => void;
};

export function FurnitureGenerator({ assets, onGenerate }: FurnitureGeneratorProps) {
  const [prompt, setPrompt] = useState("modern velvet couch");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!prompt.trim()) return;
          onGenerate(prompt.trim());
          setPrompt("");
        }}
      >
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="minimalist coffee table"
          className="h-10 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-clay)]"
        />
        <button
          type="submit"
          className="grid size-10 place-items-center rounded-md bg-[var(--color-accent-clay)] text-[var(--color-background)] shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)]"
          aria-label="Generate furniture"
        >
          <Plus className="size-4" />
        </button>
      </form>
      <div className="thin-scrollbar grid min-h-0 flex-1 content-start overflow-auto">
        {assets.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-4 text-center">
            <div>
              <Box className="mx-auto mb-2 size-7 text-[var(--color-text-muted)]" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No geometry yet</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Generate an object, then drag it into the scene.</p>
            </div>
          </div>
        ) : null}
        {assets.map((asset) => (
          <article
            key={asset.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-furniture-asset", asset.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="group flex cursor-grab gap-3 border-b border-[var(--color-border)] px-1 py-2.5 last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-inset)_52%,transparent)] active:cursor-grabbing"
          >
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-inset)]">
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt="" className="size-full object-cover" />
              ) : asset.status === "generating" || asset.status === "queued" ? (
                <Loader2 className="size-5 animate-spin text-[var(--color-accent-hover)]" />
              ) : (
                <Box className="size-6 text-[var(--color-text-muted)]" />
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{asset.name}</h3>
                <StatusPill status={asset.status} />
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--color-text-muted)]">{asset.prompt}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                <WandSparkles className="size-3.5 text-[var(--color-accent-hover)]" />
                <span>{asset.modelUrl ? "GLB ready" : "Drag placeholder into scene"}</span>
              </div>
              {asset.error ? <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-warning)]">{asset.error}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: FurnitureAsset["status"] }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        status === "ready" && "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]",
        status === "mock" && "bg-[var(--color-inset)] text-[var(--color-text-muted)]",
        (status === "queued" || status === "generating") &&
          "bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-[var(--color-warning)]",
        status === "failed" && "bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-[var(--color-danger)]",
      )}
    >
      {status}
    </span>
  );
}
