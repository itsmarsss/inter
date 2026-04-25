export type ToolMode =
  | "select"
  | "move"
  | "rotate"
  | "scale"
  | "cut-wall"
  | "add-wall"
  | "add-furniture"
  | "add-shape"
  | "add-camera"
  | "add-door"
  | "add-window";

export type WorkflowStepId = "chisel" | "panorama" | "draft" | "world";

export type ProjectVisibility = "private" | "public";

export type UploadStatus =
  | { status: "idle" }
  | { status: "ready"; fileName: string }
  | { status: "failed"; fileName?: string; error: string };

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
  progress?: number;
  status: FurnitureStatus;
  createdAt: number;
  error?: string;
  primitive: "sofa" | "table" | "chair" | "lamp" | "plant" | "cabinet";
  // LLM-estimated real-world length (longest physical dimension) in meters,
  // used to scale the imported GLB to a believable size.
  realLengthMeters?: number;
  // Post-scale axis-aligned footprint of the loaded GLB, in meters. Reported
  // by the 3D viewport once the model is measured so that 2D blueprint views
  // can draw an accurate top-down bounding box instead of falling back to a
  // primitive-shape guess.
  footprint?: {
    width: number;
    depth: number;
    height: number;
  };
};

export type FurnitureAssetMap = Map<string, FurnitureAsset>;

export type FurnitureInstance = {
  id: string;
  assetId: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type ShapeKind = "cube" | "sphere" | "cylinder" | "cone" | "plane";

export type CustomShape = {
  id: string;
  name: string;
  kind: ShapeKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
};

export type SceneCamera = {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  fov: number;
};

export type Door = {
  id: string;
  name: string;
  wall: WallId;
  offset: number;
  width: number;
  height: number;
};

export type WindowOpening = {
  id: string;
  name: string;
  wall: WallId;
  offset: number;
  baseY: number;
  width: number;
  height: number;
};

export type WallSegment = {
  id: string;
  start: number;
  end: number;
  displacement: number;
};

export type WallSegmentation = Record<WallId, WallSegment[]>;

export type SelectedRef =
  | { type: "wall"; id: WallId }
  | { type: "furniture"; id: string }
  | { type: "shape"; id: string }
  | { type: "camera"; id: string }
  | { type: "door"; id: string }
  | { type: "window"; id: string }
  | { type: "wall-segment"; wall: WallId; id: string }
  | null;

export type MarblePayload = {
  model: "marble-1.0-draft" | "marble-1.0" | "marble-1.1" | "marble-1.1-plus";
  world_prompt: {
    type: "image" | "multi-image" | "text";
    text_prompt: string;
    media_assets?: Array<{ id: string; role: string }>;
  };
  metadata: {
    capture?: {
      role: CaptureImage["role"];
      isPano: boolean;
      resolution?: { width: number; height: number };
      camera?: { position: Vec3 };
      roomCenter: Vec3;
      coordinateSystem: "three-y-up";
      generationMode: "layout-pano";
    };
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
    shapes: Array<{
      id: string;
      name: string;
      kind: ShapeKind;
      position: Vec3;
      rotation: Vec3;
      scale: Vec3;
      color: string;
    }>;
    project: {
      title: string;
      visibility: ProjectVisibility;
      workflowStep: WorkflowStepId;
      templateId: string;
      panoramaOpacity: number;
    };
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
  /** 0..1 progress for the generation step. Optional; UI should fall back to status-based bands. */
  progress?: number;
  /** Estimated milliseconds remaining; only meaningful while `status === "generating"`. */
  etaMs?: number;
};

export type CaptureImage = {
  role: "layout-pano" | "scene-perspective" | "scene-front" | "scene-side" | "blueprint";
  dataUrl: string;
  isPano?: boolean;
  resolution?: { width: number; height: number };
  camera?: { position: Vec3 };
};

export type EditorState = {
  projectTitle: string;
  visibility: ProjectVisibility;
  workflowStep: WorkflowStepId;
  selectedTemplateId: string;
  panoramaOpacity: number;
  upload: UploadStatus;
  tool: ToolMode;
  room: RoomBounds;
  selected: SelectedRef;
  furnitureAssets: FurnitureAsset[];
  furnitureInstances: FurnitureInstance[];
  customShapes: CustomShape[];
  cameras: SceneCamera[];
  doors: Door[];
  windows: WindowOpening[];
  wallSegments: WallSegmentation;
  activeShapeKind: ShapeKind;
  stylePrompt: string;
  marble: MarbleResult;
  panels: Record<Exclude<PanelKey, "scene">, boolean>;
};
