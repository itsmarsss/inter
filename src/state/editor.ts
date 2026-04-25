import type {
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
