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
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
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
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-teal-400"
        />
        <button
          type="submit"
          className="grid size-10 place-items-center rounded bg-teal-400 text-slate-950 hover:bg-teal-300"
          aria-label="Generate furniture"
        >
          <Plus className="size-4" />
        </button>
      </form>
      <div className="thin-scrollbar grid min-h-0 flex-1 content-start gap-2 overflow-auto">
        {assets.map((asset) => (
          <article
            key={asset.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-furniture-asset", asset.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="group flex cursor-grab gap-3 rounded border border-slate-800 bg-slate-900 p-2 active:cursor-grabbing"
          >
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded bg-slate-950">
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt="" className="size-full object-cover" />
              ) : asset.status === "generating" || asset.status === "queued" ? (
                <Loader2 className="size-5 animate-spin text-teal-300" />
              ) : (
                <Box className="size-6 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-slate-100">{asset.name}</h3>
                <StatusPill status={asset.status} />
              </div>
              <p className="line-clamp-2 text-xs text-slate-500">{asset.prompt}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <WandSparkles className="size-3.5 text-teal-300" />
                <span>{asset.modelUrl ? "GLB ready" : "Drag placeholder into scene"}</span>
              </div>
              {asset.error ? <p className="mt-1 line-clamp-2 text-[11px] text-amber-300">{asset.error}</p> : null}
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
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        status === "ready" && "bg-teal-400/15 text-teal-200",
        status === "mock" && "bg-slate-700 text-slate-300",
        (status === "queued" || status === "generating") && "bg-amber-400/15 text-amber-200",
        status === "failed" && "bg-red-500/15 text-red-200",
      )}
    >
      {status}
    </span>
  );
}
