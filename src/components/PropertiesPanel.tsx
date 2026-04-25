import type { CustomShape, FurnitureAsset, FurnitureAssetMap, FurnitureInstance, RoomBounds, SceneCamera, SelectedRef, ShapeKind, WallId } from "../state/types";
import { resizeRoomFromWall, roomDimensions, setRoomDimensionFromWall } from "../state/editor";

type PropertiesPanelProps = {
  room: RoomBounds;
  selected: SelectedRef;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onShapesChange: (shapes: CustomShape[]) => void;
  onCamerasChange: (cameras: SceneCamera[]) => void;
};

export function PropertiesPanel({
  room,
  selected,
  assets,
  assetById,
  instances,
  shapes,
  cameras,
  onRoomChange,
  onInstancesChange,
  onShapesChange,
  onCamerasChange,
}: PropertiesPanelProps) {
  if (!selected) {
    const dimensions = roomDimensions(room);
    return (
      <div className="grid gap-3 p-3 text-xs text-[var(--color-text-muted)]">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Room overview</h2>
          <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--color-text-muted)]">
            Drag walls in the canvas or select furniture to fine tune the layout.
          </p>
        </div>
        <PropertyRow label="Room width" value={`${dimensions.width}m`} />
        <PropertyRow label="Room depth" value={`${dimensions.depth}m`} />
        <PropertyRow label="Wall height" value={`${dimensions.height}m`} />
        <p className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-inset)] p-3 text-pretty leading-relaxed text-[var(--color-text-muted)]">
          Select a wall, furniture object, or custom shape to edit its properties.
        </p>
      </div>
    );
  }

  if (selected.type === "wall") {
    return <WallProperties room={room} wall={selected.id} onRoomChange={onRoomChange} />;
  }

  if (selected.type === "shape") {
    const shape = shapes.find((item) => item.id === selected.id);
    if (!shape) return <div className="p-3 text-sm text-[var(--color-text-muted)]">Selection no longer exists.</div>;

    function update(next: CustomShape) {
      onShapesChange(shapes.map((item) => (item.id === shape?.id ? next : item)));
    }

    return <ShapeProperties shape={shape} onChange={update} />;
  }

  if (selected.type === "camera") {
    const camera = cameras.find((item) => item.id === selected.id);
    if (!camera) return <div className="p-3 text-sm text-[var(--color-text-muted)]">Selection no longer exists.</div>;

    function update(next: SceneCamera) {
      onCamerasChange(cameras.map((item) => (item.id === camera?.id ? next : item)));
    }

    return <CameraProperties camera={camera} onChange={update} />;
  }

  const instance = instances.find((item) => item.id === selected.id);
  if (!instance) return <div className="p-3 text-sm text-[var(--color-text-muted)]">Selection no longer exists.</div>;
  const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);

  function update(next: FurnitureInstance) {
    onInstancesChange(instances.map((item) => (item.id === instance?.id ? next : item)));
  }

  return (
    <div className="thin-scrollbar grid max-h-full gap-3 overflow-auto p-3">
      <div>
        <label htmlFor="selected-furniture-name" className="text-xs font-medium text-[var(--color-text-muted)]">Name</label>
        <input
          id="selected-furniture-name"
          value={instance.name}
          onChange={(event) => update({ ...instance, name: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>
      <PropertyRow label="Source" value={asset?.prompt ?? "Unknown"} />
      <VectorEditor label="Position" value={instance.position} onChange={(position) => update({ ...instance, position })} />
      <VectorEditor label="Rotation" value={instance.rotation} onChange={(rotation) => update({ ...instance, rotation })} />
      <VectorEditor label="Scale" value={instance.scale} onChange={(scale) => update({ ...instance, scale })} />
    </div>
  );
}

function CameraProperties({ camera, onChange }: { camera: SceneCamera; onChange: (camera: SceneCamera) => void }) {
  return (
    <div className="thin-scrollbar grid max-h-full gap-3 overflow-auto p-3">
      <div>
        <label htmlFor="selected-camera-name" className="text-xs font-medium text-[var(--color-text-muted)]">Name</label>
        <input
          id="selected-camera-name"
          value={camera.name}
          onChange={(event) => onChange({ ...camera, name: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>
      <VectorEditor label="Position" value={camera.position} onChange={(position) => onChange({ ...camera, position })} />
      <VectorEditor label="Rotation" value={camera.rotation} onChange={(rotation) => onChange({ ...camera, rotation })} />
      <NumberField
        label="Field of view"
        value={camera.fov}
        step="1"
        onChange={(fov) => onChange({ ...camera, fov: Math.min(110, Math.max(20, fov)) })}
      />
    </div>
  );
}

function ShapeProperties({ shape, onChange }: { shape: CustomShape; onChange: (shape: CustomShape) => void }) {
  return (
    <div className="thin-scrollbar grid max-h-full gap-3 overflow-auto p-3">
      <div>
        <label htmlFor="selected-shape-name" className="text-xs font-medium text-[var(--color-text-muted)]">Name</label>
        <input
          id="selected-shape-name"
          value={shape.name}
          onChange={(event) => onChange({ ...shape, name: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>
      <label className="text-xs font-medium text-[var(--color-text-muted)]">
        Shape type
        <select
          value={shape.kind}
          onChange={(event) => onChange({ ...shape, kind: event.target.value as ShapeKind })}
          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        >
          <option value="cube">Cube</option>
          <option value="sphere">Sphere</option>
          <option value="cylinder">Cylinder</option>
          <option value="cone">Cone</option>
          <option value="plane">Plane</option>
        </select>
      </label>
      <label className="text-xs font-medium text-[var(--color-text-muted)]">
        Color
        <input
          type="color"
          value={shape.color}
          onChange={(event) => onChange({ ...shape, color: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-1 outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </label>
      <VectorEditor label="Position" value={shape.position} onChange={(position) => onChange({ ...shape, position })} />
      <VectorEditor label="Rotation" value={shape.rotation} onChange={(rotation) => onChange({ ...shape, rotation })} />
      <VectorEditor label="Scale" value={shape.scale} onChange={(scale) => onChange({ ...shape, scale })} />
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
  const dimensions = roomDimensions(room);
  const selectedDimension = wall === "east" || wall === "west" ? dimensions.width : dimensions.depth;
  const boundaryAxis = wall === "east" || wall === "west" ? "X" : "Z";

  function update(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onRoomChange(resizeRoomFromWall(room, wall, nextValue));
  }

  function updateSelectedDimension(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onRoomChange(setRoomDimensionFromWall(room, wall, nextValue));
  }

  function updateHeight(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onRoomChange({ ...room, height: Math.max(1.8, nextValue) });
  }

  return (
    <div className="thin-scrollbar grid max-h-full gap-3 overflow-auto p-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Wall</h2>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--color-text-muted)]">
          Drag the highlighted boundary or enter exact room measurements.
        </p>
      </div>
      <PropertyRow label="Selected wall" value={wall} />
      <PropertyRow label="Room width" value={`${dimensions.width}m`} />
      <PropertyRow label="Room depth" value={`${dimensions.depth}m`} />
      <NumberField
        label={`${boundaryAxis} boundary`}
        value={value}
        step="0.1"
        onChange={update}
      />
      <NumberField
        label={wall === "east" || wall === "west" ? "Room width" : "Room depth"}
        value={selectedDimension}
        step="0.1"
        onChange={updateSelectedDimension}
      />
      <NumberField label="Wall height" value={room.height} step="0.1" onChange={updateHeight} />
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs font-medium text-[var(--color-text-muted)]">
      {label}
      <input
        type="number"
        step={step}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
      />
    </label>
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
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <label key={axis} className="text-[11px] text-[var(--color-text-muted)]">
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
              className="mt-1 h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-focus)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-1 py-1.5 last:border-b-0">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
