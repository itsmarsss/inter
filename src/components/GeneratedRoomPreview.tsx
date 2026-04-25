import { ExternalLink, ImageIcon, Layers3, Loader2 } from "lucide-react";
import type { MarbleResult } from "../state/types";

export function GeneratedRoomPreview({ marble }: { marble: MarbleResult }) {
  const busy = marble.status === "uploading" || marble.status === "generating";

  if (busy) {
    return (
      <div className="grid h-full place-items-center bg-slate-950 p-6 text-center">
        <div>
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-teal-300" />
          <h3 className="text-sm font-semibold text-slate-100">Marble is building the room</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            The current blockout, Meshy assets, blueprint, and prompt are being packaged into a world-generation request.
          </p>
        </div>
      </div>
    );
  }

  if (!marble.payload) {
    return (
      <div className="grid h-full place-items-center bg-slate-950 p-6 text-center">
        <div>
          <Layers3 className="mx-auto mb-3 size-8 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-100">No generated room yet</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Shape the room, generate furniture through Meshy, then send the blockout to World Labs Marble.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] gap-3 bg-slate-950 p-3">
      <div className="min-h-0 overflow-hidden rounded border border-slate-800 bg-slate-900">
        {marble.thumbnailUrl ? (
          <img src={marble.thumbnailUrl} alt="Generated room preview" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon className="size-10 text-slate-600" />
          </div>
        )}
      </div>
      <aside className="thin-scrollbar min-h-0 overflow-auto rounded border border-slate-800 bg-slate-900 p-3">
        <h3 className="text-sm font-semibold text-slate-100">Marble Result</h3>
        <div className="mt-3 grid gap-2">
          <ResultLink label="World URL" href={marble.worldUrl} />
          <ResultLink label="Pano URL" href={marble.panoUrl} />
          <ResultLink label="SPZ Asset" href={marble.spzUrl} />
          <ResultLink label="Collider Mesh" href={marble.colliderMeshUrl} />
        </div>
        {marble.error ? (
          <div className="mt-3 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-200">
            {marble.error}
          </div>
        ) : null}
        <h4 className="mt-4 text-xs font-semibold uppercase text-slate-500">Debug Payload</h4>
        <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-400">
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
      className={`flex items-center justify-between rounded border px-2 py-2 text-xs ${
        href
          ? "border-slate-700 bg-slate-950 text-slate-200 hover:border-teal-400"
          : "pointer-events-none border-slate-800 bg-slate-950/60 text-slate-600"
      }`}
    >
      <span>{label}</span>
      <ExternalLink className="size-3.5" />
    </a>
  );
}
