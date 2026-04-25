import { Armchair, Box, Clock3, LampFloor, Leaf, Plus, Sparkles, Table2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { cn } from "../lib/cn";
import type { FurnitureAsset } from "../state/types";

type FurnitureGeneratorProps = {
  assets: FurnitureAsset[];
  onGenerate: (prompt: string) => void;
};

export function FurnitureGenerator({ assets, onGenerate }: FurnitureGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const queuedAssets = useMemo(
    () => assets.filter((asset) => asset.status === "queued" || asset.status === "generating"),
    [assets],
  );
  const availableAssets = useMemo(
    () => assets.filter((asset) => asset.status === "ready" || asset.status === "mock"),
    [assets],
  );
  const failedAssets = useMemo(() => assets.filter((asset) => asset.status === "failed"), [assets]);

  function submitPrompt(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();
    if (!trimmed) return;
    onGenerate(trimmed);
    setPrompt("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Add furniture</h2>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--color-text-muted)]">
          Generate assets, then drag them into the room.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt();
        }}
      >
        <label className="sr-only" htmlFor="furniture-prompt">
          Furniture prompt
        </label>
        <input
          id="furniture-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="round walnut coffee table"
          className="h-10 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
        <button
          type="submit"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--color-accent)] text-white shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)]"
          disabled={!prompt.trim()}
          aria-label="Generate furniture"
        >
          <Plus className="size-4" />
        </button>
      </form>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-auto">
        {assets.length === 0 ? (
          <div className="grid min-h-48 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] px-4 text-center">
            <div>
              <Sparkles className="mx-auto mb-2 size-7 text-[var(--color-accent)]" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Generate your first Meshy</p>
              <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--color-text-muted)]">
                Describe a furniture asset above. Ready models appear here for scene placement.
              </p>
            </div>
          </div>
        ) : null}
        {queuedAssets.length > 0 ? (
          <AssetSection count={queuedAssets.length} icon={<Clock3 className="size-3.5" />} title="Queue">
            {queuedAssets.map((asset) => (
              <QueueAssetRow key={asset.id} asset={asset} />
            ))}
          </AssetSection>
        ) : null}
        {availableAssets.length > 0 ? (
          <AssetSection count={availableAssets.length} icon={<Sparkles className="size-3.5" />} title="Available Meshys">
            {availableAssets.map((asset) => (
              <AvailableAssetRow key={asset.id} asset={asset} />
            ))}
          </AssetSection>
        ) : null}
        {failedAssets.length > 0 ? (
          <AssetSection count={failedAssets.length} icon={<TriangleAlert className="size-3.5" />} title="Needs attention">
            {failedAssets.map((asset) => (
              <FailedAssetRow key={asset.id} asset={asset} />
            ))}
          </AssetSection>
        ) : null}
      </div>
    </div>
  );
}

function AssetSection({
  children,
  count,
  icon,
  title,
}: {
  children: ReactNode;
  count: number;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="grid content-start gap-2 pb-3">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-overlay)] py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-muted)]">{icon}</span>
          <h3 className="truncate">{title}</h3>
        </div>
        <span className="rounded-sm bg-[var(--color-inset)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--color-text-muted)]">
          {count}
        </span>
      </div>
      <div className="grid content-start gap-1">{children}</div>
    </section>
  );
}

function QueueAssetRow({ asset }: { asset: FurnitureAsset }) {
  const progress = typeof asset.progress === "number" ? asset.progress : undefined;

  return (
    <article className="flex gap-2 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-inset)_58%,transparent)] p-2">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-surface)]">
        <PrimitiveIcon primitive={asset.primitive} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{asset.name}</h4>
          <StatusPill status={asset.status} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">{asset.prompt}</p>
        <div className="mt-2 grid gap-1">
          <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--color-surface)]">
            <div
              className="h-full rounded-sm bg-[var(--color-warning)]"
              style={{ width: `${progress ?? 8}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-[var(--color-text-muted)]">
            <span className="truncate">{asset.taskId ? "Meshy is generating" : "Starting Meshy task"}</span>
            {progress !== undefined ? <span className="tabular-nums">{progress}%</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function AvailableAssetRow({ asset }: { asset: FurnitureAsset }) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-furniture-asset", asset.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex cursor-grab gap-3 rounded-md border border-transparent px-1 py-2.5 hover:border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-inset)_58%,transparent)] active:cursor-grabbing"
    >
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-inset)]">
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <PrimitiveIcon primitive={asset.primitive} />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{asset.name}</h4>
          <StatusPill status={asset.status} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--color-text-muted)]">{asset.prompt}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <Sparkles className="size-3.5 text-[var(--color-accent)]" />
          <span>{asset.modelUrl ? "GLB ready" : "Placeholder ready"}</span>
        </div>
        {asset.error ? <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-warning)]">{asset.error}</p> : null}
      </div>
    </article>
  );
}

function FailedAssetRow({ asset }: { asset: FurnitureAsset }) {
  return (
    <article className="rounded-md border border-[color-mix(in_srgb,var(--color-danger)_34%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{asset.name}</h4>
        <StatusPill status={asset.status} />
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">{asset.prompt}</p>
      {asset.error ? <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-danger)]">{asset.error}</p> : null}
    </article>
  );
}

function StatusPill({ status }: { status: FurnitureAsset["status"] }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        status === "ready" && "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
        status === "mock" && "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
        (status === "queued" || status === "generating") &&
          "bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-[var(--color-warning)]",
        status === "failed" && "bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-[var(--color-danger)]",
      )}
    >
      {status === "mock" ? "demo" : status}
    </span>
  );
}

function PrimitiveIcon({ primitive }: { primitive: FurnitureAsset["primitive"] }) {
  const className = "size-6 text-[var(--color-text-muted)]";
  if (primitive === "chair") return <Armchair className={className} />;
  if (primitive === "lamp") return <LampFloor className={className} />;
  if (primitive === "plant") return <Leaf className={className} />;
  if (primitive === "table") return <Table2 className={className} />;
  return <Box className={className} />;
}
