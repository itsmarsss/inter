export type ToolMode = "select" | "move" | "rotate" | "scale" | "add-wall" | "add-furniture";

export type PanelKey =
  | "scene"
  | "furniture"
  | "blueprint"
  | "ai"
  | "preview"
  | "properties";

export type Vec3 = [number, number, number];

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
};

export type WallId = "north" | "south" | "east" | "west";

export type FurnitureStatus = "mock" | "queued" | "generating" | "ready" | "failed";

export type FurnitureAsset = {
  id: string;
  prompt: string;
  name: string;
  thumbnailUrl?: string;
  modelUrl?: string;
  taskId?: string;
  status: FurnitureStatus;
  createdAt: number;
  error?: string;
  primitive: "sofa" | "table" | "chair" | "lamp" | "plant" | "cabinet";
};

export type FurnitureInstance = {
  id: string;
  assetId: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type SelectedRef =
  | { type: "wall"; id: WallId }
  | { type: "furniture"; id: string }
  | null;

export type MarblePayload = {
  model: "marble-1.1";
  world_prompt: {
    type: "multi-image" | "text";
    text_prompt: string;
    media_assets?: Array<{ id: string; role: string }>;
  };
  metadata: {
    roomLayout: {
      bounds: RoomBounds;
      dimensions: { width: number; depth: number; height: number };
    };
    objects: Array<{
      id: string;
      name: string;
      prompt: string;
      position: Vec3;
      rotation: Vec3;
      scale: Vec3;
      modelUrl?: string;
    }>;
  };
};

export type MarbleResult = {
  status: "idle" | "uploading" | "generating" | "complete" | "failed";
  payload?: MarblePayload;
  operationId?: string;
  worldUrl?: string;
  thumbnailUrl?: string;
  panoUrl?: string;
  spzUrl?: string;
  colliderMeshUrl?: string;
  error?: string;
};

export type CaptureImage = {
  role: "scene-perspective" | "scene-front" | "scene-side" | "blueprint";
  dataUrl: string;
};

export type EditorState = {
  tool: ToolMode;
  room: RoomBounds;
  selected: SelectedRef;
  furnitureAssets: FurnitureAsset[];
  furnitureInstances: FurnitureInstance[];
  stylePrompt: string;
  marble: MarbleResult;
  panels: Record<Exclude<PanelKey, "scene">, boolean>;
};
