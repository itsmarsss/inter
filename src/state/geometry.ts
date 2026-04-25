import { roomDimensions, wallPosition } from "./editor";
import type { CustomShape, FurnitureAsset, FurnitureAssetMap, FurnitureInstance, RoomBounds, SceneCamera, SelectedRef, Vec3, WallId } from "./types";

export type GeometrySource = "room" | "meshy" | "upload" | "custom" | "camera";

export type GeometryEntry = {
  id: string;
  selectedRef: NonNullable<SelectedRef>;
  label: string;
  category: string;
  source: GeometrySource;
  status?: string;
  position: Vec3;
  metadata?: string;
};

export function buildGeometryEntries({
  room,
  assets,
  assetById = new Map(assets.map((asset) => [asset.id, asset])),
  instances,
  shapes,
  cameras,
}: {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
}): GeometryEntry[] {
  return [
    ...(["north", "south", "east", "west"] as WallId[]).map((wall) => wallEntry(room, wall)),
    ...instances.map((instance) => furnitureEntry(instance, assetById.get(instance.assetId))),
    ...shapes.map(shapeEntry),
    ...cameras.map(cameraEntry),
  ];
}

function wallEntry(room: RoomBounds, wall: WallId): GeometryEntry {
  const dimensions = roomDimensions(room);

  return {
    id: wall,
    selectedRef: { type: "wall", id: wall },
    label: `${wall} wall`,
    category: "wall",
    source: "room",
    position: wallPosition(room, wall),
    metadata: `${dimensions.width} x ${dimensions.depth} x ${dimensions.height}m`,
  };
}

function furnitureEntry(instance: FurnitureInstance, asset?: FurnitureAsset): GeometryEntry {
  const isUpload = asset?.prompt.startsWith("Uploaded model:");

  return {
    id: instance.id,
    selectedRef: { type: "furniture", id: instance.id },
    label: instance.name,
    category: asset?.primitive ?? "furniture",
    source: isUpload ? "upload" : "meshy",
    status: asset?.status,
    position: instance.position,
    metadata: asset?.name,
  };
}

function shapeEntry(shape: CustomShape): GeometryEntry {
  return {
    id: shape.id,
    selectedRef: { type: "shape", id: shape.id },
    label: shape.name,
    category: shape.kind,
    source: "custom",
    position: shape.position,
    metadata: shape.color,
  };
}

function cameraEntry(camera: SceneCamera): GeometryEntry {
  return {
    id: camera.id,
    selectedRef: { type: "camera", id: camera.id },
    label: camera.name,
    category: "camera",
    source: "camera",
    position: camera.position,
    metadata: `${camera.fov} deg`,
  };
}
