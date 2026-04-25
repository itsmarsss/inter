import type {
  EditorState,
  FurnitureAsset,
  FurnitureInstance,
  RoomBounds,
  Vec3,
  WallId,
} from "./types";

export const initialRoom: RoomBounds = {
  minX: -3.8,
  maxX: 3.8,
  minZ: -2.8,
  maxZ: 2.8,
  height: 2.8,
};

export const initialState: EditorState = {
  tool: "select",
  room: initialRoom,
  selected: null,
  furnitureAssets: [],
  furnitureInstances: [],
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

export function roomDimensions(room: RoomBounds) {
  return {
    width: round(room.maxX - room.minX),
    depth: round(room.maxZ - room.minZ),
    height: round(room.height),
  };
}

export function clampToRoom(position: Vec3, room: RoomBounds, margin = 0.35): Vec3 {
  return [
    Math.min(room.maxX - margin, Math.max(room.minX + margin, position[0])),
    position[1],
    Math.min(room.maxZ - margin, Math.max(room.minZ + margin, position[2])),
  ];
}

export function moveWall(room: RoomBounds, wall: WallId, value: number): RoomBounds {
  const minSize = 2.4;
  const next = { ...room };

  if (wall === "east") next.maxX = Math.max(room.minX + minSize, value);
  if (wall === "west") next.minX = Math.min(room.maxX - minSize, value);
  if (wall === "north") next.maxZ = Math.max(room.minZ + minSize, value);
  if (wall === "south") next.minZ = Math.min(room.maxZ - minSize, value);

  return next;
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
    id: crypto.randomUUID(),
    prompt,
    name: titleCase(prompt),
    status: "queued",
    createdAt: Date.now(),
    primitive,
  };
}

export function createFurnitureInstance(asset: FurnitureAsset, position: Vec3): FurnitureInstance {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    name: asset.name,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
