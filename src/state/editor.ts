import type {
  Door,
  EditorState,
  CustomShape,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  RoomBounds,
  SceneCamera,
  ShapeKind,
  Vec3,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "./types";

export type RoomTemplate = {
  id: string;
  name: string;
  room: RoomBounds;
  stylePrompt: string;
  furniturePrompts: string[];
};

export const initialRoom: RoomBounds = {
  minX: -3.8,
  maxX: 3.8,
  minZ: -2.8,
  maxZ: 2.8,
  height: 2.8,
};

export const roomTemplates: RoomTemplate[] = [
  {
    id: "studio-bedroom",
    name: "Studio Bedroom",
    room: initialRoom,
    stylePrompt:
      "Turn this blockout into a calm modern bedroom with layered bedding, soft indirect lighting, warm wood, and a compact lounge corner.",
    furniturePrompts: ["low platform bed", "bedside lamp", "linen lounge chair"],
  },
  {
    id: "living-room",
    name: "Living Room",
    room: { minX: -4.2, maxX: 4.2, minZ: -3, maxZ: 3, height: 2.9 },
    stylePrompt:
      "Turn this blockout into a cozy Scandinavian living room with warm lighting, wood textures, plants, and a soft neutral palette.",
    furniturePrompts: ["low modular sofa", "round walnut coffee table", "large leafy plant"],
  },
  {
    id: "gallery-room",
    name: "Gallery Room",
    room: { minX: -5, maxX: 5, minZ: -2.4, maxZ: 2.4, height: 3.2 },
    stylePrompt:
      "Turn this blockout into a minimal gallery interior with clean plaster walls, track lighting, benches, and restrained architectural detail.",
    furniturePrompts: ["minimal bench", "sculptural pedestal", "floor spotlight"],
  },
];

export const initialState: EditorState = {
  projectTitle: "Untitled",
  visibility: "private",
  workflowStep: "chisel",
  selectedTemplateId: roomTemplates[0].id,
  panoramaOpacity: 0.72,
  upload: { status: "idle" },
  tool: "select",
  room: initialRoom,
  selected: null,
  furnitureAssets: [],
  furnitureInstances: [],
  customShapes: [],
  cameras: [],
  doors: [createInitialDoor(initialRoom)],
  windows: [],
  wallSegments: createDefaultWallSegmentation(),
  activeShapeKind: "cube",
  stylePrompt:
    "Turn this blockout into a cozy Scandinavian living room with warm lighting, wood textures, plants, and a soft neutral palette.",
  marble: { status: "idle" },
  panels: {
    furniture: true,
    blueprint: true,
    ai: true,
    preview: true,
    properties: true,
  },
};

export function applyRoomTemplate(current: EditorState, templateId: string): EditorState {
  const template = roomTemplates.find((item) => item.id === templateId) ?? roomTemplates[0];
  return {
    ...current,
    selectedTemplateId: template.id,
    room: template.room,
    selected: null,
    furnitureInstances: [],
    customShapes: [],
    cameras: [],
    doors: [createInitialDoor(template.room)],
    windows: [],
    wallSegments: createDefaultWallSegmentation(),
    stylePrompt: template.stylePrompt,
    marble: { status: "idle" },
  };
}

export function createUploadedFurnitureAsset(file: File): FurnitureAsset {
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded model";
  return {
    id: createId(),
    prompt: `Uploaded model: ${file.name}`,
    name: titleCase(name),
    status: "ready",
    createdAt: Date.now(),
    primitive: "cabinet",
    modelUrl: URL.createObjectURL(file),
  };
}

export function roomDimensions(room: RoomBounds) {
  return {
    width: round(room.maxX - room.minX),
    depth: round(room.maxZ - room.minZ),
    height: round(room.height),
  };
}

export const MIN_ROOM_SIZE = 2.4;

export function clampToRoom(position: Vec3, room: RoomBounds, margin = 0.35): Vec3 {
  return [
    Math.min(room.maxX - margin, Math.max(room.minX + margin, position[0])),
    position[1],
    Math.min(room.maxZ - margin, Math.max(room.minZ + margin, position[2])),
  ];
}

/**
 * Clamps a position to the actual segmented floor boundary using polygon
 * projection. Builds an inset floor polygon (adding margin to each segment
 * displacement), checks point-in-polygon, and if outside projects to the
 * nearest edge. This avoids the discontinuities caused by per-axis clamping
 * at segment boundaries.
 */
export function clampToFloor(
  position: Vec3,
  room: RoomBounds,
  wallSegments?: WallSegmentation,
  margin = 0.35,
): Vec3 {
  if (!wallSegments) return clampToRoom(position, room, margin);

  // Build an inset version of the floor polygon by shrinking each wall inward
  // by the margin (adding margin to displacement moves the wall inward for
  // all four walls, since positive displacement = inward for all of them).
  const inset: WallSegmentation = {
    north: wallSegments.north.map((s) => ({ ...s, displacement: s.displacement + margin })),
    east:  wallSegments.east.map((s)  => ({ ...s, displacement: s.displacement + margin })),
    south: wallSegments.south.map((s) => ({ ...s, displacement: s.displacement + margin })),
    west:  wallSegments.west.map((s)  => ({ ...s, displacement: s.displacement + margin })),
  };
  const polygon = buildFloorPolygon(room, inset);
  if (polygon.length < 3) return clampToRoom(position, room, margin);

  const px = position[0];
  const pz = position[2];

  // Ray-cast point-in-polygon test.
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  if (inside) return position;

  // Project onto the nearest polygon edge.
  let bestDist = Infinity;
  let bestX = px;
  let bestZ = pz;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = polygon[j].x, az = polygon[j].z;
    const bx = polygon[i].x, bz = polygon[i].z;
    const abx = bx - ax, abz = bz - az;
    const len2 = abx * abx + abz * abz;
    if (len2 < 1e-10) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / len2));
    const nx = ax + t * abx;
    const nz = az + t * abz;
    const dx = nx - px, dz = nz - pz;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      bestX = nx;
      bestZ = nz;
    }
  }

  return [bestX, position[1], bestZ];
}

export function moveWall(room: RoomBounds, wall: WallId, value: number): RoomBounds {
  const next = { ...room };

  if (wall === "east") next.maxX = Math.max(room.minX + MIN_ROOM_SIZE, value);
  if (wall === "west") next.minX = Math.min(room.maxX - MIN_ROOM_SIZE, value);
  if (wall === "north") next.maxZ = Math.max(room.minZ + MIN_ROOM_SIZE, value);
  if (wall === "south") next.minZ = Math.min(room.maxZ - MIN_ROOM_SIZE, value);

  return next;
}

export function resizeRoomFromWall(room: RoomBounds, wall: WallId, value: number): RoomBounds {
  return moveWall(room, wall, value);
}

export function setRoomDimensionFromWall(room: RoomBounds, wall: WallId, dimension: number): RoomBounds {
  const size = Math.max(MIN_ROOM_SIZE, dimension);

  if (wall === "east") return { ...room, maxX: room.minX + size };
  if (wall === "west") return { ...room, minX: room.maxX - size };
  if (wall === "north") return { ...room, maxZ: room.minZ + size };
  return { ...room, minZ: room.maxZ - size };
}

export function wallPosition(room: RoomBounds, wall: WallId): Vec3 {
  const y = room.height / 2;
  if (wall === "east") return [room.maxX, y, (room.minZ + room.maxZ) / 2];
  if (wall === "west") return [room.minX, y, (room.minZ + room.maxZ) / 2];
  if (wall === "north") return [(room.minX + room.maxX) / 2, y, room.maxZ];
  return [(room.minX + room.maxX) / 2, y, room.minZ];
}

export function wallSize(room: RoomBounds, wall: WallId): Vec3 {
  const thickness = 0.12;
  if (wall === "east" || wall === "west") return [thickness, room.height, room.maxZ - room.minZ];
  return [room.maxX - room.minX, room.height, thickness];
}

export function createFurnitureAsset(prompt: string): FurnitureAsset {
  const primitive = inferPrimitive(prompt);
  return {
    id: createId(),
    prompt,
    name: titleCase(prompt),
    status: "queued",
    createdAt: Date.now(),
    primitive,
  };
}

export function buildFurnitureAssetMap(assets: FurnitureAsset[]): FurnitureAssetMap {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export function createFurnitureInstance(asset: FurnitureAsset, position: Vec3): FurnitureInstance {
  return {
    id: createId(),
    assetId: asset.id,
    name: asset.name,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

export function createCustomShape(kind: ShapeKind, position: Vec3): CustomShape {
  const groundedPosition: Vec3 = [position[0], kind === "plane" ? 0.03 : 0.5, position[2]];
  return {
    id: createId(),
    name: titleCase(kind),
    kind,
    position: groundedPosition,
    rotation: [0, 0, 0],
    scale: defaultShapeScale(kind),
    color: defaultShapeColor(kind),
  };
}

export function createSceneCamera(position: Vec3, room: RoomBounds): SceneCamera {
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;
  const cameraPosition: Vec3 = [
    position[0],
    Math.min(room.height - 0.25, Math.max(0.8, position[1] || 1.45)),
    position[2],
  ];
  const yaw = Math.atan2(cameraPosition[0] - centerX, cameraPosition[2] - centerZ);

  return {
    id: createId(),
    name: "Camera",
    position: cameraPosition,
    rotation: [0, yaw, 0],
    fov: 62,
  };
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function defaultShapeScale(kind: ShapeKind): Vec3 {
  if (kind === "plane") return [1.4, 1, 1.4];
  if (kind === "sphere") return [0.85, 0.85, 0.85];
  if (kind === "cone") return [0.9, 1.2, 0.9];
  if (kind === "cylinder") return [0.9, 1, 0.9];
  return [1, 1, 1];
}

function defaultShapeColor(kind: ShapeKind) {
  if (kind === "sphere") return "#B8653F";
  if (kind === "cylinder") return "#8F9FB0";
  if (kind === "cone") return "#D6A24A";
  if (kind === "plane") return "#566575";
  return "#B8C2CC";
}

export function wallAxisLength(room: RoomBounds, wall: WallId) {
  return wall === "east" || wall === "west" ? room.maxZ - room.minZ : room.maxX - room.minX;
}

export function clampWallOffset(room: RoomBounds, wall: WallId, offset: number, width: number) {
  const length = wallAxisLength(room, wall);
  const half = width / 2;
  return Math.min(length / 2 - half, Math.max(-length / 2 + half, offset));
}

export function clampWindowVerticalOffset(room: RoomBounds, baseY: number, height: number) {
  return Math.min(room.height - height - 0.05, Math.max(0.1, baseY));
}

export function createInitialDoor(room: RoomBounds): Door {
  const width = Math.min(0.9, Math.max(0.65, (room.maxX - room.minX) * 0.16));
  const height = Math.min(2.05, Math.max(1.75, room.height * 0.74));
  const offset = clampWallOffset(room, "south", -((room.maxX - room.minX) / 2 - width - 0.4), width);
  return {
    id: createId(),
    name: "Door",
    wall: "south",
    offset,
    width,
    height,
  };
}

export function createDoor(room: RoomBounds, wall: WallId = "south"): Door {
  // Doors are a fixed physical size (~0.9m wide); only shrink if the wall is
  // genuinely too short to fit one. Don't scale proportionally with wall length.
  const STANDARD_DOOR_WIDTH = 0.9;
  const width = Math.min(STANDARD_DOOR_WIDTH, wallAxisLength(room, wall) * 0.9);
  const height = Math.min(2.05, Math.max(1.75, room.height * 0.74));
  return {
    id: createId(),
    name: "Door",
    wall,
    offset: 0,
    width,
    height,
  };
}

export function createWindowOpening(room: RoomBounds, wall: WallId = "north"): WindowOpening {
  const width = Math.min(1.4, Math.max(0.8, wallAxisLength(room, wall) * 0.22));
  const height = Math.min(1.2, Math.max(0.7, room.height * 0.4));
  const baseY = Math.max(0.9, room.height * 0.4);
  return {
    id: createId(),
    name: "Window",
    wall,
    offset: 0,
    baseY: clampWindowVerticalOffset(room, baseY, height),
    width,
    height,
  };
}

export function createDefaultWallSegmentation(): WallSegmentation {
  return {
    north: [createSpanSegment()],
    south: [createSpanSegment()],
    east: [createSpanSegment()],
    west: [createSpanSegment()],
  };
}

function createSpanSegment(start = 0, end = 1, displacement = 0): WallSegment {
  return { id: createId(), start, end, displacement };
}

const MIN_SEGMENT_FRAC = 0.05;

export function cutWallAt(
  segmentation: WallSegmentation,
  wall: WallId,
  fraction: number,
): { next: WallSegmentation; newSegmentIds?: [string, string] } {
  const segments = segmentation[wall];
  const target = segments.find((segment) => fraction > segment.start && fraction < segment.end);
  if (!target) return { next: segmentation };
  if (fraction - target.start < MIN_SEGMENT_FRAC || target.end - fraction < MIN_SEGMENT_FRAC) {
    return { next: segmentation };
  }
  const left = createSpanSegment(target.start, fraction, target.displacement);
  const right = createSpanSegment(fraction, target.end, target.displacement);
  const nextSegments = segments.flatMap((segment) =>
    segment.id === target.id ? [left, right] : [segment],
  );
  return {
    next: { ...segmentation, [wall]: nextSegments },
    newSegmentIds: [left.id, right.id],
  };
}

export function setSegmentDisplacement(
  segmentation: WallSegmentation,
  wall: WallId,
  segmentId: string,
  displacement: number,
): WallSegmentation {
  const segments = segmentation[wall];
  const next = segments.map((segment) =>
    segment.id === segmentId ? { ...segment, displacement } : segment,
  );
  return { ...segmentation, [wall]: next };
}

export function removeWallSegment(
  segmentation: WallSegmentation,
  wall: WallId,
  segmentId: string,
): WallSegmentation {
  const segments = segmentation[wall];
  const index = segments.findIndex((segment) => segment.id === segmentId);
  if (index === -1 || segments.length === 1) return segmentation;
  const target = segments[index];
  const merged = [...segments];
  if (index === 0) {
    const right = merged[1];
    merged.splice(0, 2, createSpanSegment(target.start, right.end, right.displacement));
  } else if (index === segments.length - 1) {
    const left = merged[index - 1];
    merged.splice(index - 1, 2, createSpanSegment(left.start, target.end, left.displacement));
  } else {
    const left = merged[index - 1];
    const right = merged[index + 1];
    merged.splice(
      index - 1,
      3,
      createSpanSegment(left.start, target.end, left.displacement),
      createSpanSegment(target.end, right.end, right.displacement),
    );
  }
  return { ...segmentation, [wall]: merged };
}

export function findSegmentAtFraction(segments: WallSegment[], fraction: number): WallSegment {
  for (const segment of segments) {
    if (fraction >= segment.start && fraction <= segment.end) return segment;
  }
  return segments[Math.max(0, Math.min(segments.length - 1, Math.floor(fraction * segments.length)))];
}

export function offsetToFraction(room: RoomBounds, wall: WallId, offset: number): number {
  const length = wallAxisLength(room, wall);
  if (length === 0) return 0.5;
  return Math.min(1, Math.max(0, offset / length + 0.5));
}

export function fractionToOffset(room: RoomBounds, wall: WallId, fraction: number): number {
  const length = wallAxisLength(room, wall);
  return (fraction - 0.5) * length;
}

export function isSegmentationDefault(segmentation: WallSegmentation, wall: WallId) {
  const segments = segmentation[wall];
  return segments.length === 1 && segments[0].displacement === 0;
}

export type FloorPoint = { x: number; z: number };

export function buildFloorPolygon(
  room: RoomBounds,
  segmentation: WallSegmentation,
): FloorPoint[] {
  const points: FloorPoint[] = [];
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;

  const pushPoint = (point: FloorPoint) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last.x - point.x) < 1e-4 && Math.abs(last.z - point.z) < 1e-4) return;
    points.push(point);
  };

  for (const segment of segmentation.north) {
    const z = room.maxZ - segment.displacement;
    pushPoint({ x: room.minX + segment.start * width, z });
    pushPoint({ x: room.minX + segment.end * width, z });
  }

  const eastReversed = [...segmentation.east].reverse();
  for (const segment of eastReversed) {
    const x = room.maxX - segment.displacement;
    pushPoint({ x, z: room.minZ + segment.end * depth });
    pushPoint({ x, z: room.minZ + segment.start * depth });
  }

  const southReversed = [...segmentation.south].reverse();
  for (const segment of southReversed) {
    const z = room.minZ + segment.displacement;
    pushPoint({ x: room.minX + segment.end * width, z });
    pushPoint({ x: room.minX + segment.start * width, z });
  }

  for (const segment of segmentation.west) {
    const x = room.minX + segment.displacement;
    pushPoint({ x, z: room.minZ + segment.start * depth });
    pushPoint({ x, z: room.minZ + segment.end * depth });
  }

  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.x - last.x) < 1e-4 && Math.abs(first.z - last.z) < 1e-4) {
      points.pop();
    }
  }

  return points;
}

function inferPrimitive(prompt: string): FurnitureAsset["primitive"] {
  const text = prompt.toLowerCase();
  if (text.includes("chair")) return "chair";
  if (text.includes("lamp") || text.includes("light")) return "lamp";
  if (text.includes("plant")) return "plant";
  if (text.includes("cabinet") || text.includes("shelf") || text.includes("console")) return "cabinet";
  if (text.includes("table") || text.includes("desk")) return "table";
  return "sofa";
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
