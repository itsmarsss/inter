import { roomDimensions, wallAxisLength, wallPosition } from "./editor";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  RoomBounds,
  SceneCamera,
  SelectedRef,
  Vec3,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "./types";

export type GeometrySource = "room" | "meshy" | "upload" | "custom" | "camera" | "opening" | "wall-segment";

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
  doors = [],
  windows = [],
  wallSegments,
}: {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
  doors?: Door[];
  windows?: WindowOpening[];
  wallSegments?: WallSegmentation;
}): GeometryEntry[] {
  const segmentEntries: GeometryEntry[] = [];
  if (wallSegments) {
    (["north", "south", "east", "west"] as WallId[]).forEach((wall) => {
      const segments = wallSegments[wall];
      if (!segments || segments.length <= 1) return;
      segments.forEach((segment, index) => {
        segmentEntries.push(segmentEntry(wall, segment, index, room));
      });
    });
  }

  return [
    ...(["north", "south", "east", "west"] as WallId[]).map((wall) => wallEntry(room, wall)),
    ...segmentEntries,
    ...doors.map((door) => doorEntry(door, room)),
    ...windows.map((window) => windowEntry(window, room)),
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

function doorEntry(door: Door, room: RoomBounds): GeometryEntry {
  const position = openingWorldPosition(room, door.wall, door.offset, door.height / 2);
  return {
    id: door.id,
    selectedRef: { type: "door", id: door.id },
    label: door.name,
    category: `door / ${door.wall}`,
    source: "opening",
    position,
    metadata: `${door.width.toFixed(1)} x ${door.height.toFixed(1)}m`,
  };
}

function windowEntry(window: WindowOpening, room: RoomBounds): GeometryEntry {
  const position = openingWorldPosition(room, window.wall, window.offset, window.baseY + window.height / 2);
  return {
    id: window.id,
    selectedRef: { type: "window", id: window.id },
    label: window.name,
    category: `window / ${window.wall}`,
    source: "opening",
    position,
    metadata: `${window.width.toFixed(1)} x ${window.height.toFixed(1)}m`,
  };
}

function segmentEntry(wall: WallId, segment: WallSegment, index: number, room: RoomBounds): GeometryEntry {
  const length = wallAxisLength(room, wall);
  const segmentLength = (segment.end - segment.start) * length;
  const center = wallPosition(room, wall);
  const alongOffset = ((segment.start + segment.end) / 2 - 0.5) * length;
  const sign = wall === "north" || wall === "east" ? -1 : 1;
  const perp = sign * segment.displacement;
  const position: Vec3 =
    wall === "north" || wall === "south"
      ? [(room.minX + room.maxX) / 2 + alongOffset, room.height / 2, center[2] + perp]
      : [center[0] + perp, room.height / 2, (room.minZ + room.maxZ) / 2 + alongOffset];
  return {
    id: segment.id,
    selectedRef: { type: "wall-segment", wall, id: segment.id },
    label: `${wall} segment ${index + 1}`,
    category: `wall-segment / ${wall}`,
    source: "wall-segment",
    position,
    metadata: `${segmentLength.toFixed(2)}m wide / displaced ${segment.displacement.toFixed(2)}m`,
  };
}

function openingWorldPosition(room: RoomBounds, wall: WallId, offset: number, y: number): Vec3 {
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;
  if (wall === "north") return [centerX + offset, y, room.maxZ];
  if (wall === "south") return [centerX + offset, y, room.minZ];
  if (wall === "east") return [room.maxX, y, centerZ + offset];
  return [room.minX, y, centerZ + offset];
}
