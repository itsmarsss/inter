import type { FurnitureAsset, FurnitureInstance, RoomBounds, SelectedRef, WallId } from "../state/types";
import { roomDimensions } from "../state/editor";

type PropertiesPanelProps = {
  room: RoomBounds;
  selected: SelectedRef;
  assets: FurnitureAsset[];
  instances: FurnitureInstance[];
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
};

export function PropertiesPanel({
  room,
  selected,
  assets,
  instances,
  onRoomChange,
  onInstancesChange,
}: PropertiesPanelProps) {
  if (!selected) {
    const dimensions = roomDimensions(room);
    return (
      <div className="grid gap-2 p-3 text-xs text-slate-400">
        <PropertyRow label="Room width" value={`${dimensions.width}m`} />
        <PropertyRow label="Room depth" value={`${dimensions.depth}m`} />
        <PropertyRow label="Wall height" value={`${dimensions.height}m`} />
        <p className="pt-2 text-slate-500">Select a wall or furniture object to edit its properties.</p>
      </div>
    );
  }

  if (selected.type === "wall") {
    return <WallProperties room={room} wall={selected.id} onRoomChange={onRoomChange} />;
  }

  const instance = instances.find((item) => item.id === selected.id);
  if (!instance) return <div className="p-3 text-sm text-slate-500">Selection no longer exists.</div>;
  const asset = assets.find((item) => item.id === instance.assetId);

  function update(next: FurnitureInstance) {
    onInstancesChange(instances.map((item) => (item.id === instance?.id ? next : item)));
  }

  return (
    <div className="thin-scrollbar grid max-h-full gap-3 overflow-auto p-3">
      <div>
        <label className="text-xs font-medium text-slate-400">Name</label>
        <input
          value={instance.name}
          onChange={(event) => update({ ...instance, name: event.target.value })}
          className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 outline-none focus:border-teal-400"
        />
      </div>
      <PropertyRow label="Source" value={asset?.prompt ?? "Unknown"} />
      <VectorEditor label="Position" value={instance.position} onChange={(position) => update({ ...instance, position })} />
      <VectorEditor label="Rotation" value={instance.rotation} onChange={(rotation) => update({ ...instance, rotation })} />
      <VectorEditor label="Scale" value={instance.scale} onChange={(scale) => update({ ...instance, scale })} />
    </div>
  );
}

function WallProperties({
  room,
  wall,
  onRoomChange,
}: {
  room: RoomBounds;
  wall: WallId;
  onRoomChange: (room: RoomBounds) => void;
}) {
  const value =
    wall === "east" ? room.maxX : wall === "west" ? room.minX : wall === "north" ? room.maxZ : room.minZ;

  function update(nextValue: number) {
    if (wall === "east") onRoomChange({ ...room, maxX: nextValue });
    if (wall === "west") onRoomChange({ ...room, minX: nextValue });
    if (wall === "north") onRoomChange({ ...room, maxZ: nextValue });
    if (wall === "south") onRoomChange({ ...room, minZ: nextValue });
  }

  return (
    <div className="grid gap-3 p-3">
      <PropertyRow label="Selected wall" value={wall} />
      <label className="text-xs font-medium text-slate-400">
        Boundary position
        <input
          type="number"
          step="0.1"
          value={Number(value.toFixed(2))}
          onChange={(event) => update(Number(event.target.value))}
          className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 outline-none focus:border-teal-400"
        />
      </label>
    </div>
  );
}

function VectorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-400">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <label key={axis} className="text-[11px] text-slate-500">
            {axis}
            <input
              type="number"
              step="0.1"
              value={Number(value[index].toFixed(2))}
              onChange={(event) => {
                const next = [...value] as [number, number, number];
                next[index] = Number(event.target.value);
                onChange(next);
              }}
              className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-teal-400"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-2 py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="truncate text-xs font-medium text-slate-200">{value}</span>
    </div>
  );
}
