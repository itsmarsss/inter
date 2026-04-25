import { Box, Camera, Cuboid } from "lucide-react";
import { useMemo } from "react";
import { buildGeometryEntries, type GeometryEntry } from "../state/geometry";
import { cn } from "../lib/cn";
import type { CustomShape, FurnitureAsset, FurnitureAssetMap, FurnitureInstance, RoomBounds, SceneCamera, SelectedRef } from "../state/types";

type GeometryPanelProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
  onHover: (hovered: SelectedRef) => void;
};

export function GeometryPanel({ room, assets, assetById, instances, shapes, cameras, selected, onSelect, onHover }: GeometryPanelProps) {
  const entries = useMemo(
    () => buildGeometryEntries({ room, assets, assetById, instances, shapes, cameras }),
    [assetById, assets, cameras, instances, room, shapes],
  );
  const wallEntries = useMemo(() => entries.filter((entry) => entry.selectedRef.type === "wall"), [entries]);
  const furnitureEntries = useMemo(() => entries.filter((entry) => entry.selectedRef.type === "furniture"), [entries]);
  const shapeEntries = useMemo(() => entries.filter((entry) => entry.selectedRef.type === "shape"), [entries]);
  const cameraEntries = useMemo(() => entries.filter((entry) => entry.selectedRef.type === "camera"), [entries]);

  return (
    <div className="thin-scrollbar flex max-h-full min-h-0 flex-col overflow-auto">
      <div className="border-b border-[var(--color-border)] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-[var(--color-text-primary)]">Geometry</h2>
          <span className="rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
            {entries.length}
          </span>
        </div>
      </div>
      {entries.length ? (
        <div className="grid gap-2 p-1.5">
          <GeometryGroup label="Walls" entries={wallEntries} selected={selected} onSelect={onSelect} onHover={onHover} />
          <GeometryGroup label="Furniture" entries={furnitureEntries} selected={selected} onSelect={onSelect} onHover={onHover} />
          <GeometryGroup label="Custom shapes" entries={shapeEntries} selected={selected} onSelect={onSelect} onHover={onHover} />
          <GeometryGroup label="Cameras" entries={cameraEntries} selected={selected} onSelect={onSelect} onHover={onHover} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-4 text-center">
          <div className="max-w-48">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)]">
              <Cuboid className="size-4" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No placed geometry</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
              Drop furniture into the room or add a custom shape to inspect scene geometry here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GeometryGroup({
  label,
  entries,
  selected,
  onSelect,
  onHover,
}: {
  label: string;
  entries: GeometryEntry[];
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
  onHover: (hovered: SelectedRef) => void;
}) {
  if (!entries.length) return null;

  return (
    <section className="grid gap-0.5">
      <h3 className="px-1 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">{label}</h3>
      {entries.map((entry) => (
        <GeometryRow
          key={`${entry.selectedRef.type}-${entry.id}`}
          entry={entry}
          active={selected?.type === entry.selectedRef.type && selected.id === entry.selectedRef.id}
          onSelect={() => onSelect(entry.selectedRef)}
          onHover={() => onHover(entry.selectedRef)}
          onHoverEnd={() => onHover(null)}
        />
      ))}
    </section>
  );
}

function GeometryRow({
  entry,
  active,
  onSelect,
  onHover,
  onHoverEnd,
}: {
  entry: GeometryEntry;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
}) {
  const Icon = entry.selectedRef.type === "furniture" ? Box : entry.selectedRef.type === "camera" ? Camera : Cuboid;

  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={onHover}
      onPointerLeave={onHoverEnd}
      onFocus={onHover}
      onBlur={onHoverEnd}
      aria-pressed={active}
      className={cn(
        "grid min-h-9 grid-cols-[auto_1fr] items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-left hover:bg-[var(--color-inset)]",
        active && "border-[color-mix(in_srgb,var(--color-accent)_44%,transparent)] bg-[var(--color-accent-soft)]",
      )}
    >
      <span className="grid size-6 place-items-center rounded-sm bg-[var(--color-inset)] text-[var(--color-text-muted)]">
        <Icon className={cn("size-3", active && "text-[var(--color-accent)]")} />
      </span>
      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">{entry.label}</span>
          <span className="block truncate text-[10px] capitalize text-[var(--color-text-muted)]">
            {entry.category} / {sourceLabel(entry.source)}
          </span>
        </span>
        <span className="shrink-0 text-right text-[10px] tabular-nums text-[var(--color-text-muted)]">
          {entry.status ? `${entry.status} / ` : null}
          {formatPosition(entry.position)}
        </span>
      </span>
    </button>
  );
}

function sourceLabel(source: GeometryEntry["source"]) {
  if (source === "room") return "Room";
  if (source === "upload") return "Uploaded";
  if (source === "custom") return "Custom";
  if (source === "camera") return "View";
  return "Meshy";
}

function formatPosition(position: GeometryEntry["position"]) {
  return `${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)}`;
}
