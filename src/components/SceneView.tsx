import { SplatEdit, SplatEditRgbaBlendMode, SplatEditSdf, SplatEditSdfType, SplatMesh } from "@sparkjsdev/spark";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls, PerspectiveCamera, TransformControls, useGLTF } from "@react-three/drei";
import { XR, XROrigin, createXRStore, useXR, useXRControllerLocomotion } from "@react-three/xr";
import { Camera, Minus, SlidersHorizontal } from "lucide-react";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  buildFloorPolygon,
  clampToFloor,
  clampToRoom,
  clampWallOffset,
  clampWindowVerticalOffset,
  createCustomShape,
  createDoor,
  createFurnitureInstance,
  createSceneCamera,
  createWindowOpening,
  cutWallAt,
  findSegmentAtFraction,
  isSegmentationDefault,
  offsetToFraction,
  resizeRoomFromWall,
  roomDimensions,
  setRoomDimensionFromWall,
  setSegmentDisplacement,
  wallAxisLength,
  wallPosition,
} from "../state/editor";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  MarbleResult,
  CaptureImage,
  RoomBounds,
  SceneCamera,
  SelectedRef,
  ShapeKind,
  ToolMode,
  Vec3,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "../state/types";
import { cn } from "../lib/cn";

type SceneViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
  doors: Door[];
  windows: WindowOpening[];
  wallSegments: WallSegmentation;
  activeShapeKind: ShapeKind;
  selected: SelectedRef;
  hovered: SelectedRef;
  tool: ToolMode;
  marble: MarbleResult;
  panoramaOpacity?: number;
  displayMode: "Block" | "Splat";
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onShapesChange: (shapes: CustomShape[]) => void;
  onCamerasChange: (cameras: SceneCamera[]) => void;
  onDoorsChange: (doors: Door[]) => void;
  onWindowsChange: (windows: WindowOpening[]) => void;
  onWallSegmentsChange: (segmentation: WallSegmentation) => void;
  onSelect: (selected: SelectedRef) => void;
  onToolChange: (tool: ToolMode) => void;
  registerSceneCapture: (capture: () => CaptureImage | undefined) => void;
  onAssetMeasured?: (
    assetId: string,
    footprint: { width: number; depth: number; height: number },
  ) => void;
};

type Projector = (clientX: number, clientY: number) => Vec3 | null;
type ViewMode = "blockout" | "generated";
type ObjectSplatMode = "off" | "highlight" | "fade" | "hide" | "isolate";
type SplatLoadState = { status: "idle" | "loading" | "ready" | "error"; message?: string };
type SplatAlignment = {
  position: Vec3;
  rotationY: number;
  scale: number;
  /**
   * Marble-produced SPZs are Y-down so we apply a 180° flip around X to bring
   * them into Three's Y-up convention. Pre-baked splats from other tools are
   * often already Y-up — set to `false` for those. Defaults to `true` to
   * preserve historical behavior.
   */
  flipX?: boolean;
};
type SplatObjectRegion = {
  sourceRef: Exclude<NonNullable<SelectedRef>, { type: "wall" | "camera" }>;
  label: string;
  center: Vec3;
  rotation: Vec3;
  size: Vec3;
  shape: "box" | "ellipsoid" | "sphere" | "cylinder";
};
type WalkKeys = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fast: boolean;
};

type WallDragSession = {
  wall: WallId;
  pointerId: number;
  grabOffset: number;
  startValue: number;
  startClientX: number;
  startClientY: number;
  screenAxisX: number;
  screenAxisY: number;
  screenAxisLengthSq: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type ObjectDragSession = {
  target: Exclude<NonNullable<SelectedRef>, { type: "wall" }>;
  pointerId: number;
  grabOffset: Vec3;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type ShapeResizeAxis = 0 | 1 | 2;

type ShapeResizeSession = {
  shapeId: string;
  pointerId: number;
  axis: ShapeResizeAxis;
  sign: -1 | 1;
  startScale: Vec3;
  startLocalValue: number;
  startClientY: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type ShapeRotateSession = {
  shapeId: string;
  pointerId: number;
  startRotation: Vec3;
  startAngle: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type InstanceRotateSession = {
  instanceId: string;
  pointerId: number;
  startRotation: Vec3;
  startAngle: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type OpeningKind = "door" | "window";

type OpeningDragSession = {
  kind: OpeningKind;
  id: string;
  pointerId: number;
  wall: WallId;
  startOffset: number;
  startBaseY: number;
  grabOffsetAlong: number;
  grabOffsetVertical: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

type SegmentDisplacementSession = {
  segmentId: string;
  pointerId: number;
  wall: WallId;
  startDisplacement: number;
  startClientX: number;
  startClientY: number;
  screenAxisX: number;
  screenAxisY: number;
  screenAxisLengthSq: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

/**
 * Bright, well-lit "blockout" colors used only when capturing the layout
 * panorama for Marble. Marble's image guidance recommends clear floor / wall /
 * ceiling contrast so its model can read the spatial structure. The editor's
 * normal dark theme is great for UX but reads as a dim grey box to Marble.
 *
 * Roles are tagged on the architectural meshes via `userData.captureRole` and
 * applied/restored by `prepareSceneForLayoutCapture`.
 */
const LAYOUT_CAPTURE = {
  background: "#E8E4D8",
  floor: "#C9A37A",
  wall: "#EFEAE0",
  doorPanel: "#7A4A2B",
  doorFrame: "#3A2410",
  windowGlass: "#9BC4E2",
  windowFrame: "#3A2410",
  ambientIntensity: 0.95,
} as const;

const SCENE_COLORS = {
  background: "#080B10",
  floor: "#111821",
  axisX: "#E2564A",
  axisY: "#65B96F",
  axisZ: "#4C8DFF",
  wall: "#B8C2CC",
  wallEdge: "#E5EDF5",
  wallSelected: "#3BA7FF",
  wallSelectedEdge: "#B9E2FF",
  gridCell: "#263140",
  gridSection: "#465466",
  accent: "#3BA7FF",
  text: "#F7FAFC",
  warmLight: "#D7E9FF",
  tableTop: "#8F9FB0",
  darkWood: "#566575",
  upholstery: "#738398",
  clayDark: "#46505C",
  leaf: "#6E9F80",
  shapeWire: "#F4EEE6",
  doorPanel: "#9C7A52",
  doorFrame: "#3B2D20",
  windowFrame: "#2A2F36",
  windowGlass: "#7DB7D9",
  extrusion: "#8C7B6B",
} as const;

const EDITING_MOUSE_BUTTONS: OrbitControlsImpl["mouseButtons"] = {
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};

const ALT_ORBIT_MOUSE_BUTTONS: OrbitControlsImpl["mouseButtons"] = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};

const VIEWPORT_TOUCHES: OrbitControlsImpl["touches"] = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const SPARK_SPLAT_BASE_QUATERNION = new THREE.Quaternion(1, 0, 0, 0);
const SPLAT_IDENTITY_QUATERNION = new THREE.Quaternion();
const DEFAULT_SPLAT_ALIGNMENT: SplatAlignment = {
  position: [0, 0, 0],
  rotationY: 0,
  scale: 1,
  flipX: true,
};
/** URL → starting alignment overrides for pre-baked splats we ship locally. */
const LOCAL_SPLAT_DEFAULTS: Record<string, SplatAlignment> = {
  "/splats/sleek-icelandic-bedroom.spz": {
    position: [0, 0, 0],
    rotationY: 0,
    scale: 1.8,
    flipX: false,
  },
};
const INITIAL_CAMERA_POSITION: Vec3 = [6.5, 5.2, 7];
const WALK_SPEED = 2.4;
const WALK_FAST_MULTIPLIER = 1.8;
const WALK_EYE_HEIGHT = 1.6;

/**
 * Single module-level WebXR store. createXRStore() lazily wires Three.js's
 * renderer.xr into the active <XR> tree, so creating it once at import time
 * is safe even before any Canvas mounts. The button outside the Canvas calls
 * `xrStore.enterVR()` directly; useXR() inside the tree reads session state.
 *
 * Configuration is tuned for the "render on PC, present on Quest via Meta
 * Quest Link / SteamVR" flow:
 *  - We render only the splat walkthrough in VR — no UI panels, no hand UI —
 *    so we disable hand pointers, gaze, screen input, transient pointers,
 *    and all of the world-tracking features (planes, meshes, hit-test,
 *    anchors, body, depth). This keeps the session lean and avoids
 *    permission prompts the user doesn't expect.
 *  - Controller models stay on so the user can see their Touch controllers
 *    (and so `useXRControllerLocomotion` has a thumbstick to read).
 *  - Framebuffer scaling is set to "high" since the laptop GPU has the
 *    headroom that the Quest standalone GPU does not.
 */
const xrStore = createXRStore({
  controller: true,
  hand: false,
  transientPointer: false,
  gaze: false,
  screenInput: false,
  frameBufferScaling: "high",
  foveation: 0,
  anchors: false,
  handTracking: false,
  bodyTracking: false,
  planeDetection: false,
  meshDetection: false,
  hitTest: false,
  depthSensing: false,
  domOverlay: false,
});
/**
 * Half-extent of the box (centered at the origin) the splat first-person
 * camera is allowed to roam. The local pre-baked splat is roughly bedroom-
 * sized at scale 3, so ±2.5m gives enough wiggle without letting the walker
 * drift outside the scan.
 */
const SPLAT_WALK_HALF_EXTENT = 2.5;
const SPLAT_LOOK_SENSITIVITY = 0.0035;
const SPLAT_PITCH_LIMIT = THREE.MathUtils.degToRad(70);
const LAYOUT_PANO_WIDTH = 2048;
const LAYOUT_PANO_FALLBACK_WIDTH = 1536;
const LAYOUT_PANO_MAX_DATA_URL_BYTES = 30 * 1024 * 1024;
const OBJECT_SPLAT_PADDING = 0.15;
const OBJECT_SPLAT_ACCENT = "#B8653F";
const OBJECT_SPLAT_MODES: Array<{ value: ObjectSplatMode; label: string }> = [
  { value: "off", label: "Off" },
  { value: "highlight", label: "Highlight" },
  { value: "fade", label: "Fade" },
  { value: "hide", label: "Hide" },
  { value: "isolate", label: "Isolate" },
];
const FURNITURE_REGION_PROFILES: Record<
  FurnitureAsset["primitive"],
  { size: Vec3; centerOffset: Vec3; shape: SplatObjectRegion["shape"] }
> = {
  sofa: { size: [1.72, 1.1, 0.88], centerOffset: [0, 0.55, 0.1], shape: "box" },
  table: { size: [1.34, 0.38, 1.34], centerOffset: [0, 0.18, 0], shape: "cylinder" },
  chair: { size: [0.82, 1.08, 0.8], centerOffset: [0, 0.54, 0.1], shape: "box" },
  lamp: { size: [0.72, 1.52, 0.72], centerOffset: [0, 0.76, 0], shape: "cylinder" },
  plant: { size: [0.92, 1.05, 0.92], centerOffset: [0, 0.55, 0], shape: "ellipsoid" },
  cabinet: { size: [1.5, 1.15, 0.62], centerOffset: [0, 0.56, 0], shape: "box" },
};

function SelectedCameraPreviewPanel({ camera }: { camera: SceneCamera; spzUrl: string; splatAlignment: SplatAlignment }) {
  return (
    <aside className="pointer-events-none absolute bottom-4 left-4 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] p-3 text-xs text-[var(--color-text-muted)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
      <div className="mb-2 flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
        <Camera className="size-4 text-[var(--color-accent)]" />
        <span className="truncate">{camera.name}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
        <span>Position</span>
        <span className="text-[var(--color-text-primary)]">
          {camera.position.map((value) => value.toFixed(2)).join(", ")}
        </span>
        <span>FOV</span>
        <span className="text-[var(--color-text-primary)]">{camera.fov} deg</span>
      </div>
    </aside>
  );
}

function buildSplatObjectRegions(
  instances: FurnitureInstance[],
  shapes: CustomShape[],
  assets: FurnitureAsset[],
  assetById?: FurnitureAssetMap,
): SplatObjectRegion[] {
  return [
    ...instances.map((instance) => {
      const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
      return furnitureSplatRegion(instance, asset?.primitive ?? "sofa");
    }),
    ...shapes.map(shapeSplatRegion),
  ];
}

function furnitureSplatRegion(instance: FurnitureInstance, primitive: FurnitureAsset["primitive"]): SplatObjectRegion {
  const profile = FURNITURE_REGION_PROFILES[primitive];
  const center = offsetPosition(instance.position, profile.centerOffset, instance.rotation, instance.scale);
  return {
    sourceRef: { type: "furniture", id: instance.id },
    label: instance.name,
    center,
    rotation: instance.rotation,
    size: scaleSize(profile.size, instance.scale),
    shape: profile.shape,
  };
}

function shapeSplatRegion(shape: CustomShape): SplatObjectRegion {
  return {
    sourceRef: { type: "shape", id: shape.id },
    label: shape.name,
    center: shape.position,
    rotation: shape.rotation,
    size: shape.kind === "plane" ? [shape.scale[0], Math.max(0.06, shape.scale[1] * 0.04), shape.scale[2]] : shape.scale,
    shape: shape.kind === "sphere" ? "ellipsoid" : shape.kind === "cylinder" ? "cylinder" : "box",
  };
}

function offsetPosition(position: Vec3, localOffset: Vec3, rotation: Vec3, scale: Vec3): Vec3 {
  const offset = new THREE.Vector3(localOffset[0] * scale[0], localOffset[1] * scale[1], localOffset[2] * scale[2]);
  offset.applyEuler(new THREE.Euler(...rotation));
  return [position[0] + offset.x, position[1] + offset.y, position[2] + offset.z];
}

function scaleSize(size: Vec3, scale: Vec3): Vec3 {
  return [Math.abs(size[0] * scale[0]), Math.abs(size[1] * scale[1]), Math.abs(size[2] * scale[2])];
}

function selectedRefMatches(left: NonNullable<SelectedRef>, right: SelectedRef) {
  return Boolean(right && left.type === right.type && left.id === right.id);
}

export function SceneView(props: SceneViewProps) {
  const projectorRef = useRef<Projector | null>(null);
  const [objectSplatMode, setObjectSplatMode] = useState<ObjectSplatMode>("off");
  const [splatLoadState, setSplatLoadState] = useState<SplatLoadState>({ status: "idle" });
  const [splatAlignmentState, setSplatAlignmentState] = useState<{
    spzUrl?: string;
    value: SplatAlignment;
  }>(() => ({ spzUrl: props.marble.spzUrl, value: splatAlignmentFromMarble(props.marble) }));
  const generatedAvailable = props.marble.status === "complete" && Boolean(props.marble.spzUrl);
  const defaultSplatAlignment = splatAlignmentFromMarble(props.marble);
  const splatAlignment =
    splatAlignmentState.spzUrl === props.marble.spzUrl ? splatAlignmentState.value : defaultSplatAlignment;
  const setSplatAlignment = useCallback(
    (value: SplatAlignment) => {
      setSplatAlignmentState({ spzUrl: props.marble.spzUrl, value });
    },
    [props.marble.spzUrl],
  );
  const wantsSplat = props.displayMode === "Splat" && generatedAvailable;
  const activeViewMode: ViewMode = wantsSplat ? "generated" : "blockout";
  const blockoutOpacity = wantsSplat ? 0 : 1;
  const splatOpacity = wantsSplat ? 1 : 0;
  // Splat view is *always* first-person. Once the splat is on screen and ready
  // we hand the camera over to drag-to-look + WASD; orbit goes back on the
  // moment we leave splat view.
  const firstPersonActive = wantsSplat && splatLoadState.status === "ready";

  const selectedCamera =
    props.selected?.type === "camera" ? props.cameras.find((camera) => camera.id === props.selected?.id) : undefined;
  const splatObjectRegions = useMemo(
    () => buildSplatObjectRegions(props.instances, props.shapes, props.assets, props.assetById),
    [props.instances, props.shapes, props.assets, props.assetById],
  );
  const selectedSplatRegion = props.selected
    ? splatObjectRegions.find((region) => selectedRefMatches(region.sourceRef, props.selected))
    : undefined;
  const objectSplatControlsVisible = generatedAvailable && splatOpacity > 0 && Boolean(selectedSplatRegion);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (activeViewMode !== "blockout") return;
    const assetId = event.dataTransfer.getData("application/x-furniture-asset");
    const asset = props.assetById?.get(assetId) ?? props.assets.find((item) => item.id === assetId);
    const position = projectorRef.current?.(event.clientX, event.clientY);
    if (!asset || !position) return;

    const instance = createFurnitureInstance(asset, clampToFloor(position, props.room, props.wallSegments));
    props.onInstancesChange([...props.instances, instance]);
    props.onSelect({ type: "furniture", id: instance.id });
  }

  return (
    <div
      className="relative h-full min-h-0 bg-[var(--color-background)]"
      title="Viewport navigation: two-finger swipe, middle mouse, or Alt-drag orbits; right mouse pans."
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => {
          props.onSelect(null);
        }}
        className="h-full w-full"
      >
        {/*
         * <XR> hooks the renderer into WebXR. When no XR session is active
         * everything renders the same as before. When the user enters VR
         * via xrStore.enterVR(), Three.js's renderer.xr takes over the
         * camera (driven by the headset pose) and produces stereo frames
         * for the HMD. Everything else in the scene — including the
         * Gaussian splat — is drawn through the same render path, so it
         * appears in the headset automatically.
         */}
        <XR store={xrStore}>
          <SceneContent
            {...props}
            viewMode={activeViewMode}
            generatedAvailable={generatedAvailable}
            splatAlignment={splatAlignment}
            splatObjectRegions={splatObjectRegions}
            objectSplatMode={objectSplatControlsVisible ? objectSplatMode : "off"}
            blockoutOpacity={blockoutOpacity}
            splatOpacity={splatOpacity}
            firstPersonActive={firstPersonActive}
            onSplatLoadStateChange={setSplatLoadState}
            setProjector={(projector) => (projectorRef.current = projector)}
          />
        </XR>
      </Canvas>
      {wantsSplat && objectSplatControlsVisible ? (
        <div className="absolute right-3 bottom-12 flex flex-col gap-1 rounded-md border border-[var(--border-mid)] bg-[#16181d] px-2 py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-medium text-[var(--text-bright)]">Object</span>
            <span className="max-w-[7rem] truncate text-[var(--text-secondary)]">{selectedSplatRegion?.label}</span>
            <div className="flex min-w-0 flex-1 rounded-sm border border-[var(--border-dim)] bg-[var(--surface-input)] p-0.5">
              {OBJECT_SPLAT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={objectSplatMode === mode.value}
                  className={cn(
                    "min-w-0 flex-1 rounded-sm px-1.5 py-0.5 font-medium",
                    objectSplatMode === mode.value
                      ? "bg-[var(--accent-dim)] text-[var(--accent-text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                  onClick={() => setObjectSplatMode(mode.value)}
                >
                  <span className="block truncate">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {wantsSplat && splatLoadState.status === "ready" ? (
        <SplatOverlayControls />
      ) : null}
      {splatOpacity > 0 && splatLoadState.status !== "ready" ? (
        <SplatViewportOverlay marble={props.marble} loadState={splatLoadState} />
      ) : null}
      {splatOpacity > 0 ? (
        <SplatAlignmentControls
          alignment={splatAlignment}
          defaultAlignment={defaultSplatAlignment}
          onAlignmentChange={setSplatAlignment}
        />
      ) : null}
      {generatedAvailable && selectedCamera && props.marble.spzUrl ? (
        <SelectedCameraPreviewPanel
          camera={selectedCamera}
          spzUrl={props.marble.spzUrl}
          splatAlignment={splatAlignment}
        />
      ) : null}
    </div>
  );
}

function SceneContent({
  room,
  assets,
  assetById,
  instances,
  shapes,
  cameras,
  doors,
  windows,
  wallSegments,
  activeShapeKind,
  selected,
  hovered,
  tool,
  onRoomChange,
  onInstancesChange,
  onShapesChange,
  onCamerasChange,
  onDoorsChange,
  onWindowsChange,
  onWallSegmentsChange,
  onSelect,
  onToolChange,
  registerSceneCapture,
  onAssetMeasured,
  marble,
  viewMode,
  generatedAvailable,
  splatAlignment,
  splatObjectRegions,
  objectSplatMode,
  blockoutOpacity,
  splatOpacity,
  firstPersonActive,
  onSplatLoadStateChange,
  setProjector,
}: SceneViewProps & {
  viewMode: ViewMode;
  generatedAvailable: boolean;
  splatAlignment: SplatAlignment;
  splatObjectRegions: SplatObjectRegion[];
  objectSplatMode: ObjectSplatMode;
  blockoutOpacity: number;
  splatOpacity: number;
  firstPersonActive: boolean;
  onSplatLoadStateChange: (state: SplatLoadState) => void;
  setProjector: (projector: Projector) => void;
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const roomRef = useRef(room);
  const instancesRef = useRef(instances);
  const shapesRef = useRef(shapes);
  const camerasRef = useRef(cameras);
  const doorsRef = useRef(doors);
  const windowsRef = useRef(windows);
  const wallSegmentsRef = useRef(wallSegments);
  const onRoomChangeRef = useRef(onRoomChange);
  const onInstancesChangeRef = useRef(onInstancesChange);
  const onShapesChangeRef = useRef(onShapesChange);
  const onCamerasChangeRef = useRef(onCamerasChange);
  const onDoorsChangeRef = useRef(onDoorsChange);
  const onWindowsChangeRef = useRef(onWindowsChange);
  const onWallSegmentsChangeRef = useRef(onWallSegmentsChange);
  const wallDragRef = useRef<WallDragSession | null>(null);
  const objectDragRef = useRef<ObjectDragSession | null>(null);
  const shapeResizeRef = useRef<ShapeResizeSession | null>(null);
  const shapeRotateRef = useRef<ShapeRotateSession | null>(null);
  const instanceRotateRef = useRef<InstanceRotateSession | null>(null);
  const openingDragRef = useRef<OpeningDragSession | null>(null);
  const segmentDragRef = useRef<SegmentDisplacementSession | null>(null);
  const pointerScratchRef = useRef({
    pointer: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    floorPoint: new THREE.Vector3(),
  });
  const [hoveredWall, setHoveredWall] = useState<WallId | null>(null);
  const { camera, gl, scene } = useThree();
  // While a WebXR session is presenting, the headset drives the camera —
  // OrbitControls and the FirstPersonController must not also try to move
  // it, or the user's view will jitter or be locked at the wrong height.
  const xrPresenting = useXR((state) => state.session != null);
  const firstPersonControlsActive = firstPersonActive && !xrPresenting;
  useEffect(() => {
    registerSceneCapture(() =>
      captureLayoutPano(scene, gl, roomRef.current, wallSegmentsRef.current),
    );
  }, [gl, registerSceneCapture, scene]);

  useLayoutEffect(() => {
    roomRef.current = room;
  }, [room]);

  useLayoutEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  useLayoutEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useLayoutEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

  useLayoutEffect(() => {
    doorsRef.current = doors;
  }, [doors]);

  useLayoutEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useLayoutEffect(() => {
    wallSegmentsRef.current = wallSegments;
  }, [wallSegments]);

  useLayoutEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useLayoutEffect(() => {
    onInstancesChangeRef.current = onInstancesChange;
  }, [onInstancesChange]);

  useLayoutEffect(() => {
    onShapesChangeRef.current = onShapesChange;
  }, [onShapesChange]);

  useLayoutEffect(() => {
    onCamerasChangeRef.current = onCamerasChange;
  }, [onCamerasChange]);

  useLayoutEffect(() => {
    onDoorsChangeRef.current = onDoorsChange;
  }, [onDoorsChange]);

  useLayoutEffect(() => {
    onWindowsChangeRef.current = onWindowsChange;
  }, [onWindowsChange]);

  useLayoutEffect(() => {
    onWallSegmentsChangeRef.current = onWallSegmentsChange;
  }, [onWallSegmentsChange]);

  useEffect(() => {
    const element = gl.domElement;

    function setLeftOrbitEnabled(enabled: boolean) {
      const controls = orbitControlsRef.current;
      if (!controls) return;
      if (firstPersonActive) {
        controls.enabled = false;
        return;
      }
      controls.mouseButtons = enabled ? ALT_ORBIT_MOUSE_BUTTONS : EDITING_MOUSE_BUTTONS;
    }

    function handlePointerDown(event: PointerEvent) {
      setLeftOrbitEnabled(event.button === 0 && event.altKey);
    }

    function resetMouseButtons() {
      setLeftOrbitEnabled(false);
    }

    function preventContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    element.addEventListener("pointerdown", handlePointerDown, { capture: true });
    element.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("pointerup", resetMouseButtons, { capture: true });
    window.addEventListener("pointercancel", resetMouseButtons, { capture: true });
    window.addEventListener("blur", resetMouseButtons);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      element.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("pointerup", resetMouseButtons, { capture: true });
      window.removeEventListener("pointercancel", resetMouseButtons, { capture: true });
      window.removeEventListener("blur", resetMouseButtons);
    };
  }, [firstPersonActive, gl.domElement, viewMode]);

  useEffect(() => {
    const element = gl.domElement;

    function handleTrackpadWheel(event: WheelEvent) {
      const controls = orbitControlsRef.current;
      if (firstPersonActive || !controls?.enabled || event.ctrlKey) return;
      if (
        shapeResizeRef.current ||
        shapeRotateRef.current ||
        instanceRotateRef.current ||
        objectDragRef.current ||
        wallDragRef.current ||
        openingDragRef.current ||
        segmentDragRef.current
      ) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const target = controls.target;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      const rotateSpeed = 0.0032;
      spherical.theta += event.deltaX * rotateSpeed;
      spherical.phi += event.deltaY * rotateSpeed;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI / 2.05);
      spherical.makeSafe();

      camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(target);
      controls.update();
    }

    element.addEventListener("wheel", handleTrackpadWheel, { capture: true, passive: false });
    return () => {
      element.removeEventListener("wheel", handleTrackpadWheel, { capture: true });
    };
  }, [camera, firstPersonActive, gl.domElement, viewMode]);

  const projectPointerToFloor = useCallback(
    (clientX: number, clientY: number): Vec3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const { pointer, raycaster, floorPoint } = pointerScratchRef.current;
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(FLOOR_PLANE, floorPoint);
      if (!hit) return null;
      return [floorPoint.x, 0.25, floorPoint.z];
    },
    [camera, gl.domElement],
  );

  const projectPointerToWallPlane = useCallback(
    (wall: WallId, clientX: number, clientY: number): { offsetAlong: number; y: number; offsetPerp: number } | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const room = roomRef.current;
      const center = wallPosition(room, wall);
      const normal = wall === "north" || wall === "south"
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(center[0], 0, center[2]));
      const target = new THREE.Vector3();
      const hit = ray.ray.intersectPlane(plane, target);
      if (!hit) return null;
      const cx = (room.minX + room.maxX) / 2;
      const cz = (room.minZ + room.maxZ) / 2;
      if (wall === "east" || wall === "west") {
        const sign = wall === "east" ? 1 : -1;
        return { offsetAlong: target.z - cz, y: target.y, offsetPerp: (target.x - center[0]) * sign };
      }
      const sign = wall === "north" ? 1 : -1;
      return { offsetAlong: target.x - cx, y: target.y, offsetPerp: (target.z - center[2]) * sign };
    },
    [camera, gl.domElement],
  );

  useEffect(() => {
    setProjector(projectPointerToFloor);
  }, [projectPointerToFloor, setProjector]);


  useEffect(() => {
    const element = gl.domElement;

    function valueForWallAxis(wall: WallId, point: Vec3) {
      return wall === "east" || wall === "west" ? point[0] : point[2];
    }

    function valueFromScreenDrag(session: WallDragSession) {
      if (session.screenAxisLengthSq < 16) return null;

      const deltaX = session.latestClientX - session.startClientX;
      const deltaY = session.latestClientY - session.startClientY;
      const metersAlongAxis =
        (deltaX * session.screenAxisX + deltaY * session.screenAxisY) / session.screenAxisLengthSq;
      return session.startValue + metersAlongAxis;
    }

    function applyWallDrag() {
      const session = wallDragRef.current;
      if (!session) return;

      session.rafId = null;
      const screenValue = valueFromScreenDrag(session);
      if (screenValue !== null) {
        onRoomChangeRef.current(resizeRoomFromWall(roomRef.current, session.wall, screenValue));
        return;
      }

      const point = projectPointerToFloor(session.latestClientX, session.latestClientY);
      if (!point) return;

      const value = valueForWallAxis(session.wall, point) - session.grabOffset;
      onRoomChangeRef.current(resizeRoomFromWall(roomRef.current, session.wall, value));
    }

    function scheduleWallDragUpdate() {
      const session = wallDragRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyWallDrag);
    }

    function endWallDrag(pointerId?: number) {
      const session = wallDragRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }

      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after browser-level cancellation.
      }

      const controls = orbitControlsRef.current;
      if (controls) {
        controls.enabled = session.previousControlsEnabled;
      }

      wallDragRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = wallDragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleWallDragUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endWallDrag(event.pointerId);
    }

    function handleBlur() {
      endWallDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endWallDrag();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToFloor]);

  useEffect(() => {
    const element = gl.domElement;

    function applyObjectDrag() {
      const session = objectDragRef.current;
      if (!session) return;

      session.rafId = null;
      const point = projectPointerToFloor(session.latestClientX, session.latestClientY);
      if (!point) return;

      const nextPosition = clampToFloor(
        [
          point[0] - session.grabOffset[0],
          session.grabOffset[1],
          point[2] - session.grabOffset[2],
        ],
        roomRef.current,
        wallSegmentsRef.current,
      );

      if (session.target.type === "furniture") {
        onInstancesChangeRef.current(
          instancesRef.current.map((instance) =>
            instance.id === session.target.id ? { ...instance, position: nextPosition } : instance,
          ),
        );
        return;
      }

      if (session.target.type === "camera") {
        onCamerasChangeRef.current(
          camerasRef.current.map((camera) =>
            camera.id === session.target.id ? { ...camera, position: nextPosition } : camera,
          ),
        );
        return;
      }

      onShapesChangeRef.current(
        shapesRef.current.map((shape) =>
          shape.id === session.target.id ? { ...shape, position: nextPosition } : shape,
        ),
      );
    }

    function scheduleObjectDragUpdate() {
      const session = objectDragRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyObjectDrag);
    }

    function endObjectDrag(pointerId?: number) {
      const session = objectDragRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }

      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after browser-level cancellation.
      }

      const controls = orbitControlsRef.current;
      if (controls) {
        controls.enabled = session.previousControlsEnabled;
      }

      objectDragRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = objectDragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleObjectDragUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endObjectDrag(event.pointerId);
    }

    function handleBlur() {
      endObjectDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endObjectDrag();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToFloor]);

  useEffect(() => {
    const element = gl.domElement;

    function applyShapeResize() {
      const session = shapeResizeRef.current;
      if (!session) return;

      session.rafId = null;
      const shape = shapesRef.current.find((item) => item.id === session.shapeId);
      if (!shape) return;

      let nextAxisScale = session.startScale[session.axis];
      if (session.axis === 1) {
        nextAxisScale = session.startScale[1] + session.sign * (session.startClientY - session.latestClientY) * 0.025;
      } else {
        const nextLocalValue = shapeLocalPointerValue(
          shape,
          session.axis,
          session.latestClientX,
          session.latestClientY,
          projectPointerToFloor,
        );
        if (nextLocalValue === null) return;
        nextAxisScale = session.startScale[session.axis] + session.sign * 2 * (nextLocalValue - session.startLocalValue);
      }

      const nextScale: Vec3 = [...session.startScale];
      nextScale[session.axis] = Math.max(0.05, Math.abs(nextAxisScale));
      onShapesChangeRef.current(
        shapesRef.current.map((item) => (item.id === session.shapeId ? { ...item, scale: nextScale } : item)),
      );
    }

    function scheduleShapeResizeUpdate() {
      const session = shapeResizeRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyShapeResize);
    }

    function endShapeResize(pointerId?: number) {
      const session = shapeResizeRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }

      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after browser-level cancellation.
      }

      const controls = orbitControlsRef.current;
      if (controls) {
        controls.enabled = session.previousControlsEnabled;
      }

      shapeResizeRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = shapeResizeRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleShapeResizeUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endShapeResize(event.pointerId);
    }

    function handleBlur() {
      endShapeResize();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endShapeResize();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToFloor]);

  useEffect(() => {
    const element = gl.domElement;

    function applyShapeRotate() {
      const session = shapeRotateRef.current;
      if (!session) return;

      session.rafId = null;
      const shape = shapesRef.current.find((item) => item.id === session.shapeId);
      if (!shape) return;

      const nextAngle = shapePointerAngle(shape, session.latestClientX, session.latestClientY, projectPointerToFloor);
      if (nextAngle === null) return;

      const nextRotation: Vec3 = [...session.startRotation];
      nextRotation[1] = session.startRotation[1] - shortestAngleDelta(nextAngle, session.startAngle);
      onShapesChangeRef.current(
        shapesRef.current.map((item) => (item.id === session.shapeId ? { ...item, rotation: nextRotation } : item)),
      );
    }

    function scheduleShapeRotateUpdate() {
      const session = shapeRotateRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyShapeRotate);
    }

    function endShapeRotate(pointerId?: number) {
      const session = shapeRotateRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }

      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after browser-level cancellation.
      }

      const controls = orbitControlsRef.current;
      if (controls) {
        controls.enabled = session.previousControlsEnabled;
      }

      shapeRotateRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = shapeRotateRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleShapeRotateUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endShapeRotate(event.pointerId);
    }

    function handleBlur() {
      endShapeRotate();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endShapeRotate();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToFloor]);

  // Drag-to-rotate for furniture instances via the base ring. Snaps to
  // 15-degree increments around the world-Y (vertical) axis.
  useEffect(() => {
    const element = gl.domElement;
    const SNAP_RADIANS = Math.PI / 12; // 15°

    function applyInstanceRotate() {
      const session = instanceRotateRef.current;
      if (!session) return;

      session.rafId = null;
      const instance = instancesRef.current.find((item) => item.id === session.instanceId);
      if (!instance) return;

      const nextAngle = pointerAngleAroundPosition(
        instance.position,
        session.latestClientX,
        session.latestClientY,
        projectPointerToFloor,
      );
      if (nextAngle === null) return;

      // Continuous Y-rotation following the pointer, then snap to 15° steps.
      const continuous =
        session.startRotation[1] - shortestAngleDelta(nextAngle, session.startAngle);
      const snapped = Math.round(continuous / SNAP_RADIANS) * SNAP_RADIANS;
      if (Math.abs(snapped - instance.rotation[1]) < 1e-4) return;

      const nextRotation: Vec3 = [
        session.startRotation[0],
        snapped,
        session.startRotation[2],
      ];
      onInstancesChangeRef.current(
        instancesRef.current.map((item) =>
          item.id === session.instanceId ? { ...item, rotation: nextRotation } : item,
        ),
      );
    }

    function scheduleInstanceRotateUpdate() {
      const session = instanceRotateRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyInstanceRotate);
    }

    function endInstanceRotate(pointerId?: number) {
      const session = instanceRotateRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }

      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after browser-level cancellation.
      }

      const controls = orbitControlsRef.current;
      if (controls) {
        controls.enabled = session.previousControlsEnabled;
      }

      instanceRotateRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = instanceRotateRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleInstanceRotateUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endInstanceRotate(event.pointerId);
    }

    function handleBlur() {
      endInstanceRotate();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endInstanceRotate();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToFloor]);

  useEffect(() => {
    const element = gl.domElement;

    function applyOpeningDrag() {
      const session = openingDragRef.current;
      if (!session) return;
      session.rafId = null;
      const projection = projectPointerToWallPlane(session.wall, session.latestClientX, session.latestClientY);
      if (!projection) return;

      const room = roomRef.current;
      if (session.kind === "door") {
        const door = doorsRef.current.find((item) => item.id === session.id);
        if (!door) return;
        const nextOffset = clampWallOffset(
          room,
          session.wall,
          projection.offsetAlong - session.grabOffsetAlong,
          door.width,
        );
        if (nextOffset === door.offset) return;
        onDoorsChangeRef.current(
          doorsRef.current.map((item) =>
            item.id === session.id ? { ...item, offset: nextOffset } : item,
          ),
        );
        return;
      }

      const window = windowsRef.current.find((item) => item.id === session.id);
      if (!window) return;
      const nextOffset = clampWallOffset(
        room,
        session.wall,
        projection.offsetAlong - session.grabOffsetAlong,
        window.width,
      );
      const nextBaseY = clampWindowVerticalOffset(
        room,
        projection.y - session.grabOffsetVertical,
        window.height,
      );
      if (nextOffset === window.offset && nextBaseY === window.baseY) return;
      onWindowsChangeRef.current(
        windowsRef.current.map((item) =>
          item.id === session.id ? { ...item, offset: nextOffset, baseY: nextBaseY } : item,
        ),
      );
    }

    function scheduleOpeningDragUpdate() {
      const session = openingDragRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applyOpeningDrag);
    }

    function endOpeningDrag(pointerId?: number) {
      const session = openingDragRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;
      if (session.rafId !== null) window.cancelAnimationFrame(session.rafId);
      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // ignore release errors
      }
      const controls = orbitControlsRef.current;
      if (controls) controls.enabled = session.previousControlsEnabled;
      openingDragRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = openingDragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleOpeningDragUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endOpeningDrag(event.pointerId);
    }

    function handleBlur() {
      endOpeningDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endOpeningDrag();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement, projectPointerToWallPlane]);

  useEffect(() => {
    const element = gl.domElement;

    function applySegmentDrag() {
      const session = segmentDragRef.current;
      if (!session) return;
      session.rafId = null;
      if (session.screenAxisLengthSq < 0.0001) return;

      const room = roomRef.current;
      const segmentation = wallSegmentsRef.current;
      const segments = segmentation[session.wall];
      const segment = segments.find((item) => item.id === session.segmentId);
      if (!segment) return;

      const deltaX = session.latestClientX - session.startClientX;
      const deltaY = session.latestClientY - session.startClientY;
      const meters =
        (deltaX * session.screenAxisX + deltaY * session.screenAxisY) / session.screenAxisLengthSq;
      const nextDisplacement = clampDisplacement(session.startDisplacement + meters, room, session.wall);
      if (Math.abs(nextDisplacement - segment.displacement) < 0.001) return;
      onWallSegmentsChangeRef.current(
        setSegmentDisplacement(segmentation, session.wall, session.segmentId, nextDisplacement),
      );
    }

    function scheduleSegmentDragUpdate() {
      const session = segmentDragRef.current;
      if (!session || session.rafId !== null) return;
      session.rafId = window.requestAnimationFrame(applySegmentDrag);
    }

    function endSegmentDrag(pointerId?: number) {
      const session = segmentDragRef.current;
      if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;
      if (session.rafId !== null) window.cancelAnimationFrame(session.rafId);
      try {
        if (element.hasPointerCapture(session.pointerId)) {
          element.releasePointerCapture(session.pointerId);
        }
      } catch {
        // ignore release errors
      }
      const controls = orbitControlsRef.current;
      if (controls) controls.enabled = session.previousControlsEnabled;
      segmentDragRef.current = null;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = segmentDragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      session.latestClientX = event.clientX;
      session.latestClientY = event.clientY;
      scheduleSegmentDragUpdate();
    }

    function handlePointerUp(event: PointerEvent) {
      endSegmentDrag(event.pointerId);
    }

    function handleBlur() {
      endSegmentDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      endSegmentDrag();
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [gl.domElement]);

  function updateInstance(next: FurnitureInstance) {
    onInstancesChange(instances.map((instance) => (instance.id === next.id ? next : instance)));
  }

  function updateCamera(next: SceneCamera) {
    onCamerasChange(cameras.map((camera) => (camera.id === next.id ? next : camera)));
  }

  function handleTransformActiveChange(active: boolean) {
    const controls = orbitControlsRef.current;
    if (!controls) return;
    controls.enabled = !active && !firstPersonActive;
  }

  function handleFloorPointerDown(event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    if (tool !== "add-shape" && tool !== "add-camera") {
      onSelect(null);
      return;
    }

    event.stopPropagation();
    const point = projectPointerToFloor(event.clientX, event.clientY);
    if (!point) return;

    if (tool === "add-camera") {
      const camera = createSceneCamera([point[0], 1.45, point[2]], room);
      onCamerasChange([...cameras, camera]);
      onSelect({ type: "camera", id: camera.id });
      return;
    }

    const shape = createCustomShape(activeShapeKind, clampToFloor(point, room, wallSegments));
    onShapesChange([...shapes, shape]);
    onSelect({ type: "shape", id: shape.id });
    onToolChange("select");
  }

  function handleWallPointerDown(wall: WallId, event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    const room = roomRef.current;
    const projection = projectPointerToWallPlane(wall, event.clientX, event.clientY);

    if (tool === "add-door") {
      const newDoor = createDoor(room, wall);
      newDoor.offset = clampWallOffset(room, wall, projection?.offsetAlong ?? 0, newDoor.width);
      onDoorsChangeRef.current([...doorsRef.current, newDoor]);
      onSelect({ type: "door", id: newDoor.id });
      onToolChange("select");
      return;
    }

    if (tool === "add-window") {
      const newWindow = createWindowOpening(room, wall);
      newWindow.offset = clampWallOffset(room, wall, projection?.offsetAlong ?? 0, newWindow.width);
      if (projection) {
        newWindow.baseY = clampWindowVerticalOffset(
          room,
          (projection.y ?? newWindow.baseY) - newWindow.height / 2,
          newWindow.height,
        );
      }
      onWindowsChangeRef.current([...windowsRef.current, newWindow]);
      onSelect({ type: "window", id: newWindow.id });
      onToolChange("select");
      return;
    }

    if (tool === "cut-wall") {
      const offsetAlong = projection?.offsetAlong ?? 0;
      const fraction = offsetToFraction(room, wall, offsetAlong);
      const result = cutWallAt(wallSegmentsRef.current, wall, fraction);
      if (result.next === wallSegmentsRef.current) return;
      onWallSegmentsChangeRef.current(result.next);
      const dragSegmentId = result.newSegmentIds?.[0];
      if (dragSegmentId) {
        onSelect({ type: "wall-segment", wall, id: dragSegmentId });
        beginSegmentDrag(dragSegmentId, wall, 0, event);
      }
      onToolChange("select");
      return;
    }

    if (!isSegmentationDefault(wallSegmentsRef.current, wall)) {
      onSelect({ type: "wall", id: wall });
      return;
    }

    const point = projectPointerToFloor(event.clientX, event.clientY);
    const projectedValue = point ? (wall === "east" || wall === "west" ? point[0] : point[2]) : 0;
    const wallCenter = wallPosition(roomRef.current, wall);
    const wallAxisValue = wall === "east" || wall === "west" ? wallCenter[0] : wallCenter[2];
    const screenAxis = screenAxisForWall(wall, wallCenter, camera, gl.domElement);
    const controls = orbitControlsRef.current;

    wallDragRef.current = {
      wall,
      pointerId: event.pointerId,
      grabOffset: projectedValue - wallAxisValue,
      startValue: wallAxisValue,
      startClientX: event.clientX,
      startClientY: event.clientY,
      screenAxisX: screenAxis.x,
      screenAxisY: screenAxis.y,
      screenAxisLengthSq: screenAxis.lengthSq,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };

    if (controls) {
      controls.enabled = false;
    }

    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can reject capture if the native pointer sequence has already ended.
    }

    onSelect({ type: "wall", id: wall });
  }

  function handleObjectPointerDown(
    target: Exclude<NonNullable<SelectedRef>, { type: "wall" }>,
    position: Vec3,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (viewMode !== "blockout") return;
    if (tool !== "select" && tool !== "move") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    const point = projectPointerToFloor(event.clientX, event.clientY);
    if (!point) return;

    const controls = orbitControlsRef.current;
    objectDragRef.current = {
      target,
      pointerId: event.pointerId,
      grabOffset: [point[0] - position[0], position[1], point[2] - position[2]],
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };

    if (controls) {
      controls.enabled = false;
    }

    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can reject capture if the native pointer sequence has already ended.
    }
  }

  function handleShapeResizePointerDown(
    shape: CustomShape,
    axis: ShapeResizeAxis,
    sign: -1 | 1,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (viewMode !== "blockout") return;
    if (tool !== "select" && tool !== "move" && tool !== "scale") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    const startLocalValue = axis === 1 ? 0 : shapeLocalPointerValue(shape, axis, event.clientX, event.clientY, projectPointerToFloor);
    if (startLocalValue === null) return;

    const controls = orbitControlsRef.current;
    shapeResizeRef.current = {
      shapeId: shape.id,
      pointerId: event.pointerId,
      axis,
      sign,
      startScale: [...shape.scale],
      startLocalValue,
      startClientY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };

    objectDragRef.current = null;
    if (controls) {
      controls.enabled = false;
    }

    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can reject capture if the native pointer sequence has already ended.
    }

    onSelect({ type: "shape", id: shape.id });
  }

  function handleInstanceRotatePointerDown(instance: FurnitureInstance, event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    const startAngle = pointerAngleAroundPosition(
      instance.position,
      event.clientX,
      event.clientY,
      projectPointerToFloor,
    );
    if (startAngle === null) return;

    const controls = orbitControlsRef.current;
    instanceRotateRef.current = {
      instanceId: instance.id,
      pointerId: event.pointerId,
      startRotation: [...instance.rotation] as Vec3,
      startAngle,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };

    objectDragRef.current = null;
    if (controls) controls.enabled = false;

    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can reject capture if the native pointer sequence has already ended.
    }

    onSelect({ type: "furniture", id: instance.id });
  }

  function handleShapeRotatePointerDown(shape: CustomShape, event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (tool !== "select" && tool !== "move" && tool !== "rotate") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    const startAngle = shapePointerAngle(shape, event.clientX, event.clientY, projectPointerToFloor);
    if (startAngle === null) return;

    const controls = orbitControlsRef.current;
    shapeRotateRef.current = {
      shapeId: shape.id,
      pointerId: event.pointerId,
      startRotation: [...shape.rotation],
      startAngle,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };

    objectDragRef.current = null;
    shapeResizeRef.current = null;
    if (controls) {
      controls.enabled = false;
    }

    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can reject capture if the native pointer sequence has already ended.
    }

    onSelect({ type: "shape", id: shape.id });
  }

  function handleOpeningPointerDown(
    kind: OpeningKind,
    target: Door | WindowOpening,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    onSelect({ type: kind, id: target.id });

    if (tool !== "select" && tool !== "move") return;

    const projection = projectPointerToWallPlane(target.wall, event.clientX, event.clientY);
    if (!projection) return;

    const baseY = kind === "door" ? 0 : (target as WindowOpening).baseY;
    const grabVertical = projection.y - (baseY + target.height / 2);

    const controls = orbitControlsRef.current;
    openingDragRef.current = {
      kind,
      id: target.id,
      pointerId: event.pointerId,
      wall: target.wall,
      startOffset: target.offset,
      startBaseY: baseY,
      grabOffsetAlong: projection.offsetAlong - target.offset,
      grabOffsetVertical: grabVertical,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };
    if (controls) controls.enabled = false;
    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture errors
    }
  }

  function handleSegmentPointerDown(wall: WallId, segment: WallSegment, event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();

    if (tool === "cut-wall") {
      const room = roomRef.current;
      const projection = projectPointerToWallPlane(wall, event.clientX, event.clientY);
      const offsetAlong = projection?.offsetAlong ?? 0;
      const fraction = offsetToFraction(room, wall, offsetAlong);
      const result = cutWallAt(wallSegmentsRef.current, wall, fraction);
      if (result.next === wallSegmentsRef.current) return;
      onWallSegmentsChangeRef.current(result.next);
      const dragSegmentId = result.newSegmentIds?.[0];
      if (dragSegmentId) {
        onSelect({ type: "wall-segment", wall, id: dragSegmentId });
        beginSegmentDrag(dragSegmentId, wall, segment.displacement, event);
      }
      onToolChange("select");
      return;
    }

    onSelect({ type: "wall-segment", wall, id: segment.id });

    if (tool !== "select" && tool !== "move") return;

    beginSegmentDrag(segment.id, wall, segment.displacement, event);
  }

  function beginSegmentDrag(
    segmentId: string,
    wall: WallId,
    startDisplacement: number,
    event: ThreeEvent<PointerEvent>,
  ) {
    const wallCenter = wallPosition(roomRef.current, wall);
    const screenAxis = screenPerpAxisForWall(wall, wallCenter, camera, gl.domElement);
    const controls = orbitControlsRef.current;
    segmentDragRef.current = {
      segmentId,
      pointerId: event.pointerId,
      wall,
      startDisplacement,
      startClientX: event.clientX,
      startClientY: event.clientY,
      screenAxisX: screenAxis.x,
      screenAxisY: screenAxis.y,
      screenAxisLengthSq: screenAxis.lengthSq,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      rafId: null,
      previousControlsEnabled: controls?.enabled ?? true,
    };
    if (controls) controls.enabled = false;
    try {
      gl.domElement.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture errors
    }
  }

  return (
    <>
      <ViewportCamera />
      <color attach="background" args={[SCENE_COLORS.background]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[4, 7, 5]} intensity={1.4} shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 3, -3]} intensity={2.2} color={SCENE_COLORS.warmLight} />
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enabled={!firstPersonControlsActive && !xrPresenting}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        mouseButtons={EDITING_MOUSE_BUTTONS}
        touches={VIEWPORT_TOUCHES}
      />
      <FirstPersonController active={firstPersonControlsActive} />
      <VrSplatRig active={firstPersonActive && xrPresenting} />
      {generatedAvailable && marble.spzUrl ? (
        <MarbleSplatScene
          url={proxiedMarbleSpzUrl(marble.spzUrl)}
          alignment={splatAlignment}
          opacity={splatOpacity}
          regions={splatObjectRegions}
          selected={selected}
          objectSplatMode={objectSplatMode}
          onLoadStateChange={onSplatLoadStateChange}
        />
      ) : null}
      <group visible={blockoutOpacity > 0}>
        <BlockoutReferenceLayer
          room={room}
          wallSegments={wallSegments}
          selected={selected}
          hovered={hoveredWall ? { type: "wall", id: hoveredWall } : hovered}
          editable={viewMode === "blockout"}
          opacity={blockoutOpacity}
          tool={tool}
          onReferenceSelect={() => onSelect(null)}
          onWallPointerDown={handleWallPointerDown}
          onWallPointerOver={setHoveredWall}
          onWallPointerOut={(wall) => setHoveredWall((current) => (current === wall ? null : current))}
          onFloorPointerDown={handleFloorPointerDown}
          onSegmentPointerDown={handleSegmentPointerDown}
        />
        {instances.map((instance) => {
          const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
          return (
            <FurnitureNode
              key={instance.id}
              instance={instance}
              asset={asset}
              room={room}
              wallSegments={wallSegments}
              selected={viewMode === "blockout" && selected?.type === "furniture" && selected.id === instance.id}
              hovered={viewMode === "blockout" && hovered?.type === "furniture" && hovered.id === instance.id}
              tool={viewMode === "blockout" ? tool : "select"}
              opacity={blockoutOpacity}
              onSelect={() => onSelect(viewMode === "blockout" ? { type: "furniture", id: instance.id } : null)}
              onDragStart={(event) =>
                handleObjectPointerDown({ type: "furniture", id: instance.id }, instance.position, event)
              }
              onRotateStart={(event) => handleInstanceRotatePointerDown(instance, event)}
              onTransformActiveChange={handleTransformActiveChange}
              onChange={updateInstance}
              onMeasured={
                onAssetMeasured && asset
                  ? (footprint) => onAssetMeasured(asset.id, footprint)
                  : undefined
              }
            />
          );
        })}
        {shapes.map((shape) => (
          <ShapeNode
            key={shape.id}
            shape={shape}
            room={room}
            wallSegments={wallSegments}
            selected={viewMode === "blockout" && selected?.type === "shape" && selected.id === shape.id}
            hovered={viewMode === "blockout" && hovered?.type === "shape" && hovered.id === shape.id}
            tool={viewMode === "blockout" ? tool : "select"}
            opacity={blockoutOpacity}
            onSelect={() => onSelect(viewMode === "blockout" ? { type: "shape", id: shape.id } : null)}
            onDragStart={(event) => handleObjectPointerDown({ type: "shape", id: shape.id }, shape.position, event)}
            onResizeStart={(axis, sign, event) => handleShapeResizePointerDown(shape, axis, sign, event)}
            onRotateStart={(event) => handleShapeRotatePointerDown(shape, event)}
          />
        ))}
        {cameras.map((sceneCamera) => (
          <SceneCameraNode
            key={sceneCamera.id}
            camera={sceneCamera}
            room={room}
            selected={viewMode === "blockout" && selected?.type === "camera" && selected.id === sceneCamera.id}
            hovered={viewMode === "blockout" && hovered?.type === "camera" && hovered.id === sceneCamera.id}
            tool={viewMode === "blockout" ? tool : "select"}
            opacity={blockoutOpacity}
            onSelect={() => onSelect(viewMode === "blockout" ? { type: "camera", id: sceneCamera.id } : null)}
            onDragStart={(event) => handleObjectPointerDown({ type: "camera", id: sceneCamera.id }, sceneCamera.position, event)}
            onTransformActiveChange={handleTransformActiveChange}
            onChange={updateCamera}
          />
        ))}
        {doors.map((door) => (
          <DoorNode
            key={door.id}
            door={door}
            room={room}
            wallSegments={wallSegments}
            selected={viewMode === "blockout" && selected?.type === "door" && selected.id === door.id}
            hovered={viewMode === "blockout" && hovered?.type === "door" && hovered.id === door.id}
            opacity={blockoutOpacity}
            onPointerDown={(event) => handleOpeningPointerDown("door", door, event)}
            onPointerOver={() => {}}
            onPointerOut={() => {}}
          />
        ))}
        {windows.map((window) => (
          <WindowNode
            key={window.id}
            window={window}
            room={room}
            wallSegments={wallSegments}
            selected={viewMode === "blockout" && selected?.type === "window" && selected.id === window.id}
            hovered={viewMode === "blockout" && hovered?.type === "window" && hovered.id === window.id}
            opacity={blockoutOpacity}
            onPointerDown={(event) => handleOpeningPointerDown("window", window, event)}
            onPointerOver={() => {}}
            onPointerOut={() => {}}
          />
        ))}
      </group>
      {viewMode === "blockout" ? (
        <Html position={[room.minX, 0.04, room.maxZ + 0.22]} center zIndexRange={[0, 0]}>
          <RoomDimensionBadge room={room} onRoomChange={onRoomChange} />
        </Html>
      ) : null}
    </>
  );
}

function BlockoutReferenceLayer({
  room,
  wallSegments,
  selected,
  hovered,
  editable,
  opacity,
  tool,
  onReferenceSelect,
  onWallPointerDown,
  onWallPointerOver,
  onWallPointerOut,
  onFloorPointerDown,
  onSegmentPointerDown,
}: {
  room: RoomBounds;
  wallSegments: WallSegmentation;
  selected: SelectedRef;
  hovered: SelectedRef;
  editable: boolean;
  opacity: number;
  tool: ToolMode;
  onReferenceSelect: () => void;
  onWallPointerDown: (wall: WallId, event: ThreeEvent<PointerEvent>) => void;
  onWallPointerOver: (wall: WallId) => void;
  onWallPointerOut: (wall: WallId) => void;
  onFloorPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onSegmentPointerDown: (wall: WallId, segment: WallSegment, event: ThreeEvent<PointerEvent>) => void;
}) {
  const gridCellColor = fadeSceneColor(SCENE_COLORS.gridCell, opacity);
  const gridSectionColor = fadeSceneColor(SCENE_COLORS.gridSection, opacity);

  return (
    <group
      onPointerDown={
        editable
          ? undefined
          : (event) => {
              event.stopPropagation();
              onReferenceSelect();
            }
      }
    >
      <Grid
        userData={{ captureHidden: true }}
        args={[72, 72]}
        sectionSize={1}
        cellSize={0.5}
        position={[0, -0.01, 0]}
        cellColor={gridCellColor}
        sectionColor={gridSectionColor}
        fadeDistance={34}
        fadeStrength={1.35}
        fadeFrom={0}
      />
      <WorldAxisGuides room={room} opacity={opacity} />
      <RoomFloor
        room={room}
        wallSegments={wallSegments}
        opacity={opacity}
        onPointerDown={editable ? onFloorPointerDown : undefined}
      />
      {(["north", "south", "east", "west"] as WallId[]).map((wall) => (
        <SegmentedWall
          key={wall}
          wall={wall}
          room={room}
          segments={wallSegments[wall]}
          selected={selected}
          hovered={hovered}
          editable={editable}
          opacity={opacity}
          tool={tool}
          onWallPointerDown={onWallPointerDown}
          onWallPointerOver={onWallPointerOver}
          onWallPointerOut={onWallPointerOut}
          onSegmentPointerDown={onSegmentPointerDown}
        />
      ))}
    </group>
  );
}

type SegmentedWallProps = {
  wall: WallId;
  room: RoomBounds;
  segments: WallSegment[];
  selected: SelectedRef;
  hovered: SelectedRef;
  editable: boolean;
  opacity: number;
  tool: ToolMode;
  onWallPointerDown: (wall: WallId, event: ThreeEvent<PointerEvent>) => void;
  onWallPointerOver: (wall: WallId) => void;
  onWallPointerOut: (wall: WallId) => void;
  onSegmentPointerDown: (wall: WallId, segment: WallSegment, event: ThreeEvent<PointerEvent>) => void;
};

function SegmentedWall({
  wall,
  room,
  segments,
  selected,
  hovered,
  editable,
  opacity,
  tool,
  onWallPointerDown,
  onWallPointerOver,
  onWallPointerOut,
  onSegmentPointerDown,
}: SegmentedWallProps) {
  const wallSelected = editable && selected?.type === "wall" && selected.id === wall;
  const wallHovered = editable && hovered?.type === "wall" && hovered.id === wall;
  const wallLength = wallAxisLength(room, wall);
  const isHorizontal = wall === "north" || wall === "south";
  const center = wallPosition(room, wall);
  const sign = wallSurfaceSign(wall);

  return (
    <group>
      {segments.map((segment) => {
        const segmentLength = (segment.end - segment.start) * wallLength;
        const alongOffset = ((segment.start + segment.end) / 2 - 0.5) * wallLength;
        const perp = sign * segment.displacement;
        const position: Vec3 = isHorizontal
          ? [(room.minX + room.maxX) / 2 + alongOffset, room.height / 2, center[2] + perp]
          : [center[0] + perp, room.height / 2, (room.minZ + room.maxZ) / 2 + alongOffset];
        const segmentSelected =
          editable && selected?.type === "wall-segment" && selected.id === segment.id;
        const segmentHovered =
          editable && hovered?.type === "wall-segment" && hovered.id === segment.id;
        const cursorActive = editable && (tool === "cut-wall" || segmentSelected);
        return (
          <SegmentMesh
            key={segment.id}
            wall={wall}
            length={segmentLength}
            height={room.height}
            position={position}
            opacity={opacity}
            selected={segmentSelected || wallSelected}
            hovered={segmentHovered || wallHovered}
            highlightCursor={cursorActive}
            onPointerDown={
              editable
                ? (event) => {
                    if (segments.length === 1 && segment.displacement === 0 && tool !== "cut-wall") {
                      onWallPointerDown(wall, event);
                      return;
                    }
                    onSegmentPointerDown(wall, segment, event);
                  }
                : undefined
            }
            onPointerOver={editable ? () => onWallPointerOver(wall) : undefined}
            onPointerOut={editable ? () => onWallPointerOut(wall) : undefined}
          />
        );
      })}
      {segments.slice(0, -1).map((segment, index) => {
        const next = segments[index + 1];
        const delta = next.displacement - segment.displacement;
        if (Math.abs(delta) < 0.001) return null;
        const cutAlong = (segment.end - 0.5) * wallLength;
        const midDisp = (segment.displacement + next.displacement) / 2;
        const perp = sign * midDisp;
        const position: Vec3 = isHorizontal
          ? [(room.minX + room.maxX) / 2 + cutAlong, room.height / 2, center[2] + perp]
          : [center[0] + perp, room.height / 2, (room.minZ + room.maxZ) / 2 + cutAlong];
        return (
          <ConnectorMesh
            key={`${segment.id}-${next.id}-connector`}
            wall={wall}
            depth={Math.abs(delta)}
            height={room.height}
            position={position}
            opacity={opacity}
            highlight={wallSelected || wallHovered}
          />
        );
      })}
      {(() => {
        const first = segments[0];
        if (!first || Math.abs(first.displacement) < 0.001) return null;
        const startAlong = -wallLength / 2;
        const midDisp = first.displacement / 2;
        const perp = sign * midDisp;
        const position: Vec3 = isHorizontal
          ? [(room.minX + room.maxX) / 2 + startAlong, room.height / 2, center[2] + perp]
          : [center[0] + perp, room.height / 2, (room.minZ + room.maxZ) / 2 + startAlong];
        return (
          <ConnectorMesh
            key={`${wall}-start-connector`}
            wall={wall}
            depth={Math.abs(first.displacement)}
            height={room.height}
            position={position}
            opacity={opacity}
            highlight={wallSelected || wallHovered}
          />
        );
      })()}
      {(() => {
        const last = segments[segments.length - 1];
        if (!last || Math.abs(last.displacement) < 0.001) return null;
        const endAlong = wallLength / 2;
        const midDisp = last.displacement / 2;
        const perp = sign * midDisp;
        const position: Vec3 = isHorizontal
          ? [(room.minX + room.maxX) / 2 + endAlong, room.height / 2, center[2] + perp]
          : [center[0] + perp, room.height / 2, (room.minZ + room.maxZ) / 2 + endAlong];
        return (
          <ConnectorMesh
            key={`${wall}-end-connector`}
            wall={wall}
            depth={Math.abs(last.displacement)}
            height={room.height}
            position={position}
            opacity={opacity}
            highlight={wallSelected || wallHovered}
          />
        );
      })()}
    </group>
  );
}

function wallSurfaceSign(wall: WallId): number {
  if (wall === "north" || wall === "east") return -1;
  return 1;
}

function RoomDimensionBadge({
  room,
  onRoomChange,
}: {
  room: RoomBounds;
  onRoomChange: (room: RoomBounds) => void;
}) {
  const dimensions = roomDimensions(room);

  function commitWidth(value: string) {
    const nextWidth = Number(value);
    if (!Number.isFinite(nextWidth)) {
      return;
    }
    onRoomChange(setRoomDimensionFromWall(room, "east", nextWidth));
  }

  function commitDepth(value: string) {
    const nextDepth = Number(value);
    if (!Number.isFinite(nextDepth)) {
      return;
    }
    onRoomChange(setRoomDimensionFromWall(room, "north", nextDepth));
  }

  return (
    <div
      className="flex whitespace-nowrap rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_90%,transparent)] px-1.5 py-1 text-[11px] text-[var(--color-accent)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DimensionInput
        key={`width-${formatDimensionValue(dimensions.width)}`}
        ariaLabel="Room width"
        initialValue={formatDimensionValue(dimensions.width)}
        onCommit={commitWidth}
      />
      <span className="px-1 text-[var(--color-text-muted)]">x</span>
      <DimensionInput
        key={`depth-${formatDimensionValue(dimensions.depth)}`}
        ariaLabel="Room depth"
        initialValue={formatDimensionValue(dimensions.depth)}
        onCommit={commitDepth}
      />
    </div>
  );
}

function DimensionInput({
  ariaLabel,
  initialValue,
  onCommit,
}: {
  ariaLabel: string;
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setValue(initialValue);
      event.currentTarget.blur();
    }
  }

  return (
    <label className="flex items-center gap-0.5">
      <input
        aria-label={ariaLabel}
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onCommit(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        className="h-5 w-10 rounded-sm border border-transparent bg-transparent text-right font-semibold tabular-nums text-[var(--color-accent)] outline-none hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:bg-[var(--color-inset)]"
      />
      <span>m</span>
    </label>
  );
}

function formatDimensionValue(value: number) {
  return value.toFixed(1);
}

function fadeSceneColor(color: string, opacity: number) {
  return new THREE.Color(color).lerp(new THREE.Color(SCENE_COLORS.background), 1 - THREE.MathUtils.clamp(opacity, 0, 1));
}

function shapeLocalPointerValue(
  shape: CustomShape,
  axis: ShapeResizeAxis,
  clientX: number,
  clientY: number,
  projectPointerToFloor: Projector,
) {
  if (axis === 1) return 0;
  const point = projectPointerToFloor(clientX, clientY);
  if (!point) return null;

  const localPoint = new THREE.Vector3(
    point[0] - shape.position[0],
    point[1] - shape.position[1],
    point[2] - shape.position[2],
  );
  const inverseRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)).invert();
  localPoint.applyQuaternion(inverseRotation);
  return axis === 0 ? localPoint.x : localPoint.z;
}

function shapePointerAngle(shape: CustomShape, clientX: number, clientY: number, projectPointerToFloor: Projector) {
  return pointerAngleAroundPosition(shape.position, clientX, clientY, projectPointerToFloor);
}

/** Angle (radians) from `position` to the projected pointer on the floor plane. */
function pointerAngleAroundPosition(
  position: Vec3,
  clientX: number,
  clientY: number,
  projectPointerToFloor: Projector,
) {
  const point = projectPointerToFloor(clientX, clientY);
  if (!point) return null;
  return Math.atan2(point[2] - position[2], point[0] - position[0]);
}

function shortestAngleDelta(nextAngle: number, startAngle: number) {
  return Math.atan2(Math.sin(nextAngle - startAngle), Math.cos(nextAngle - startAngle));
}

function WorldAxisGuides({ room, opacity }: { room: RoomBounds; opacity: number }) {
  const axisLength = Math.max(10000, room.maxX - room.minX, room.maxZ - room.minZ);
  const xStart = -axisLength;
  const xEnd = axisLength;
  const zStart = -axisLength;
  const zEnd = axisLength;
  const lineOpacity = 0.76 * opacity;

  return (
    <group userData={{ captureHidden: true }}>
      <AxisGuideLine start={[xStart, 0.035, 0]} end={[xEnd, 0.035, 0]} color={SCENE_COLORS.axisX} opacity={lineOpacity} />
      <AxisGuideLine start={[0, 0.035, zStart]} end={[0, 0.035, zEnd]} color={SCENE_COLORS.axisZ} opacity={lineOpacity} />
      <AxisGuideLine start={[0, -axisLength, 0]} end={[0, axisLength, 0]} color={SCENE_COLORS.axisY} opacity={lineOpacity} />
    </group>
  );
}

function AxisGuideLine({
  start,
  end,
  color,
  opacity,
}: {
  start: Vec3;
  end: Vec3;
  color: string;
  opacity: number;
}) {
  const line = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return new THREE.Line(nextGeometry, material);
  }, [color, end, opacity, start]);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      if (Array.isArray(line.material)) {
        line.material.forEach((material) => material.dispose());
      } else {
        line.material.dispose();
      }
    };
  }, [line]);

  return <primitive object={line} />;
}

function MarbleSplatScene({
  url,
  alignment,
  opacity,
  regions,
  selected,
  objectSplatMode,
  onLoadStateChange,
}: {
  url: string;
  alignment: SplatAlignment;
  opacity: number;
  regions: SplatObjectRegion[];
  selected: SelectedRef;
  objectSplatMode: ObjectSplatMode;
  onLoadStateChange: (state: SplatLoadState) => void;
}) {
  const { scene } = useThree();
  const splatRef = useRef<SplatMesh | null>(null);
  const alignmentRef = useRef(alignment);
  const opacityRef = useRef(opacity);
  const regionsRef = useRef(regions);
  const selectedRef = useRef(selected);
  const objectSplatModeRef = useRef(objectSplatMode);

  useEffect(() => {
    alignmentRef.current = alignment;
    if (splatRef.current) applySplatAlignment(splatRef.current, alignment);
  }, [alignment]);

  useEffect(() => {
    opacityRef.current = opacity;
    if (splatRef.current) applySplatOpacity(splatRef.current, opacity);
  }, [opacity]);

  useEffect(() => {
    regionsRef.current = regions;
    selectedRef.current = selected;
    objectSplatModeRef.current = objectSplatMode;
    if (splatRef.current) applySplatObjectEdits(splatRef.current, regions, selected, objectSplatMode);
  }, [objectSplatMode, regions, selected]);

  useEffect(() => {
    let disposed = false;
    onLoadStateChange({ status: "loading" });

    const splat = new SplatMesh({ url, editable: true });
    splat.userData.captureHidden = true;
    // Final orientation comes from applySplatAlignment (which honors flipX),
    // so no preliminary quaternion seeding here.
    applySplatAlignment(splat, alignmentRef.current);
    applySplatOpacity(splat, opacityRef.current);
    applySplatObjectEdits(splat, regionsRef.current, selectedRef.current, objectSplatModeRef.current);
    splatRef.current = splat;
    scene.add(splat);

    splat.initialized
      .then((mesh) => {
        if (disposed) return;
        applySplatAlignment(mesh, alignmentRef.current);
        applySplatOpacity(mesh, opacityRef.current);
        applySplatObjectEdits(mesh, regionsRef.current, selectedRef.current, objectSplatModeRef.current);
        onLoadStateChange({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        onLoadStateChange({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load the generated SPZ asset.",
        });
      });

    return () => {
      disposed = true;
      scene.remove(splat);
      if (splatRef.current === splat) splatRef.current = null;
      splat.dispose();
    };
  }, [onLoadStateChange, scene, url]);

  return null;
}

function applySplatAlignment(mesh: SplatMesh, alignment: SplatAlignment) {
  const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), alignment.rotationY);
  const base = (alignment.flipX ?? true) ? SPARK_SPLAT_BASE_QUATERNION : SPLAT_IDENTITY_QUATERNION;
  mesh.position.set(...alignment.position);
  mesh.quaternion.copy(base).premultiply(rotationY);
  mesh.scale.setScalar(alignment.scale);
  mesh.updateMatrixWorld();
}

function applySplatOpacity(mesh: SplatMesh, opacity: number) {
  mesh.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
  mesh.updateGenerator();
}

function applySplatObjectEdits(
  mesh: SplatMesh,
  regions: SplatObjectRegion[],
  selected: SelectedRef,
  mode: ObjectSplatMode,
) {
  const selectedRegion = selected ? regions.find((region) => selectedRefMatches(region.sourceRef, selected)) : undefined;
  if (mode === "off" || !selectedRegion) {
    mesh.edits = null;
    mesh.updateGenerator();
    return;
  }

  const edits: SplatEdit[] = [];
  if (mode === "highlight") {
    edits.push(createSplatRegionEdit(selectedRegion, SplatEditRgbaBlendMode.SET_RGB, OBJECT_SPLAT_ACCENT, 0.92));
  }

  if (mode === "hide") {
    edits.push(createSplatRegionEdit(selectedRegion, SplatEditRgbaBlendMode.MULTIPLY, "#FFFFFF", 0));
  }

  if (mode === "fade") {
    for (const region of regions) {
      if (!selectedRefMatches(region.sourceRef, selectedRegion.sourceRef)) {
        edits.push(createSplatRegionEdit(region, SplatEditRgbaBlendMode.MULTIPLY, "#FFFFFF", 0.32));
      }
    }
    edits.push(createSplatRegionEdit(selectedRegion, SplatEditRgbaBlendMode.SET_RGB, OBJECT_SPLAT_ACCENT, 0.96));
  }

  if (mode === "isolate") {
    for (const region of regions) {
      if (!selectedRefMatches(region.sourceRef, selectedRegion.sourceRef)) {
        edits.push(createSplatRegionEdit(region, SplatEditRgbaBlendMode.MULTIPLY, "#FFFFFF", 0.14));
      }
    }
  }

  mesh.edits = edits.length > 0 ? edits : null;
  mesh.updateGenerator();
}

function createSplatRegionEdit(
  region: SplatObjectRegion,
  rgbaBlendMode: SplatEditRgbaBlendMode,
  color: string,
  opacity: number,
) {
  const edit = new SplatEdit({ rgbaBlendMode, softEdge: 0.08, sdfSmooth: 0.04 });
  const sdf = new SplatEditSdf({
    type: splatSdfType(region.shape),
    color: new THREE.Color(color),
    opacity,
  });
  sdf.position.set(...region.center);
  sdf.rotation.set(...region.rotation);
  sdf.scale.set(...paddedSplatRegionSize(region.size));
  edit.add(sdf);
  return edit;
}

function splatSdfType(shape: SplatObjectRegion["shape"]) {
  if (shape === "sphere") return SplatEditSdfType.SPHERE;
  if (shape === "ellipsoid") return SplatEditSdfType.ELLIPSOID;
  if (shape === "cylinder") return SplatEditSdfType.CYLINDER;
  return SplatEditSdfType.BOX;
}

function paddedSplatRegionSize(size: Vec3): Vec3 {
  return [
    Math.max(0.05, size[0] + OBJECT_SPLAT_PADDING * 2),
    Math.max(0.05, size[1] + OBJECT_SPLAT_PADDING * 2),
    Math.max(0.05, size[2] + OBJECT_SPLAT_PADDING * 2),
  ];
}

function ViewportCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position.set(...INITIAL_CAMERA_POSITION);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, []);

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={44} />;
}

/**
 * First-person camera controller used inside the splat view.
 *
 * - Spawn pose: standing at the world origin (eye height ~1.6m), looking down
 *   the camera's natural forward axis (-Z).
 * - Look: drag with the left mouse button anywhere on the canvas to rotate
 *   yaw + pitch (no pointer lock — the cursor stays visible).
 * - Move: WASD; hold shift to sprint.
 * - Bounds: position is clamped to a ±SPLAT_WALK_HALF_EXTENT box around the
 *   origin so you can roam the room but not drift into the void.
 */
function FirstPersonController({ active }: { active: boolean }) {
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);
  const keysRef = useRef<WalkKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    fast: false,
  });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const draggingRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const moveRef = useRef(new THREE.Vector3());
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Spawn at origin and reset look angles whenever we (re-)enter splat mode.
  useEffect(() => {
    const keys = keysRef.current;

    if (!active) {
      resetWalkKeys(keys);
      draggingRef.current = false;
      return;
    }

    yawRef.current = 0;
    pitchRef.current = 0;
    const cam = cameraRef.current;
    cam.position.set(0, WALK_EYE_HEIGHT, 0);
    applyLook(cam, yawRef.current, pitchRef.current, eulerRef.current);
    cam.updateProjectionMatrix();

    return () => {
      resetWalkKeys(keys);
    };
  }, [active]);

  // Drag-to-look on the canvas (no pointer lock — cursor stays visible).
  useEffect(() => {
    if (!active) return;
    const element = gl.domElement;

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey) return;
      draggingRef.current = true;
      dragPointerIdRef.current = event.pointerId;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // pointer capture occasionally throws on transient capture conflicts;
        // dragging still works without it.
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!draggingRef.current || event.pointerId !== dragPointerIdRef.current) return;
      const dx = event.clientX - lastPointerRef.current.x;
      const dy = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      yawRef.current -= dx * SPLAT_LOOK_SENSITIVITY;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - dy * SPLAT_LOOK_SENSITIVITY,
        -SPLAT_PITCH_LIMIT,
        SPLAT_PITCH_LIMIT,
      );
      applyLook(cameraRef.current, yawRef.current, pitchRef.current, eulerRef.current);
    }

    function endDrag(event: PointerEvent) {
      if (event.pointerId !== dragPointerIdRef.current) return;
      draggingRef.current = false;
      dragPointerIdRef.current = null;
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // safe to ignore — capture may already be released
      }
    }

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", endDrag);
    element.addEventListener("pointercancel", endDrag);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", endDrag);
      element.removeEventListener("pointercancel", endDrag);
    };
  }, [active, gl.domElement]);

  // WASD (works without pointer lock).
  useEffect(() => {
    if (!active) return;
    const keys = keysRef.current;

    function applyKey(event: KeyboardEvent, pressed: boolean) {
      // Don't hijack typing inside text inputs (style prompt, etc.).
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const handled =
        event.code === "KeyW" ||
        event.code === "KeyA" ||
        event.code === "KeyS" ||
        event.code === "KeyD" ||
        event.code === "ShiftLeft" ||
        event.code === "ShiftRight";

      if (!handled) return;
      event.preventDefault();

      if (event.code === "KeyW") keys.forward = pressed;
      if (event.code === "KeyS") keys.backward = pressed;
      if (event.code === "KeyA") keys.left = pressed;
      if (event.code === "KeyD") keys.right = pressed;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.fast = pressed;
    }

    function handleKeyDown(event: KeyboardEvent) {
      applyKey(event, true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      applyKey(event, false);
    }

    function handleBlur() {
      resetWalkKeys(keys);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const cam = cameraRef.current;
    const keys = keysRef.current;
    const forwardAmount = Number(keys.forward) - Number(keys.backward);
    const rightAmount = Number(keys.right) - Number(keys.left);
    if (forwardAmount === 0 && rightAmount === 0) return;

    const forward = forwardRef.current;
    const right = rightRef.current;
    const move = moveRef.current;
    cam.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    right.setFromMatrixColumn(cam.matrix, 0);
    right.y = 0;
    right.normalize();
    move.set(0, 0, 0).addScaledVector(forward, forwardAmount).addScaledVector(right, rightAmount);
    if (move.lengthSq() === 0) return;

    const distance = delta * WALK_SPEED * (keys.fast ? WALK_FAST_MULTIPLIER : 1);
    move.normalize().multiplyScalar(distance);
    cam.position.add(move);
    cam.position.x = THREE.MathUtils.clamp(cam.position.x, -SPLAT_WALK_HALF_EXTENT, SPLAT_WALK_HALF_EXTENT);
    cam.position.z = THREE.MathUtils.clamp(cam.position.z, -SPLAT_WALK_HALF_EXTENT, SPLAT_WALK_HALF_EXTENT);
    cam.position.y = WALK_EYE_HEIGHT;
  });

  return null;
}

function applyLook(camera: THREE.Camera, yaw: number, pitch: number, scratch: THREE.Euler) {
  scratch.set(pitch, yaw, 0, "YXZ");
  camera.quaternion.setFromEuler(scratch);
}

/**
 * VR locomotion rig used while a WebXR session is presenting the splat
 * walkthrough (Quest Link / SteamVR / Air Link / native Quest browser).
 *
 * Why this exists:
 *  - In a WebXR session, three.js's renderer.xr drives the camera from the
 *    headset's pose. Mutating camera.position directly (the way the
 *    keyboard/mouse FirstPersonController does) does NOT translate the user
 *    — the headset pose is added on top of the camera transform every
 *    frame, so any translation you write gets visually overwritten.
 *  - The correct pattern is an "XR rig": a parent <XROrigin> group whose
 *    position represents the user's *feet* in world space. The headset
 *    pose is offset from that origin. Translating the rig translates the
 *    user.
 *
 * What it does:
 *  - Renders an <XROrigin> at world (0, 0, 0) on first activation, putting
 *    the user at the splat center. (The local bedroom splat sits at the
 *    world origin too.)
 *  - Wires `useXRControllerLocomotion` to the rig: left thumbstick = walk
 *    relative to head facing, right thumbstick = snap-turn in 30° ticks
 *    (snap-turn is much more comfortable than smooth-turn for most people
 *    in VR, especially over Quest Link's slight latency).
 *  - Clamps the rig to ±SPLAT_WALK_HALF_EXTENT so the user can't drift out
 *    of the splat. The clamp runs after the locomotion hook in useFrame,
 *    so it overrides any movement that would push past the boundary.
 *
 * The component is a no-op when `active` is false, so it's safe to mount
 * unconditionally — but we only mount it in splat mode while in VR to
 * avoid attaching controller listeners we don't need.
 */
function VrSplatRig({ active }: { active: boolean }) {
  const originRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!active) return;
    const origin = originRef.current;
    if (!origin) return;
    origin.position.set(0, 0, 0);
    origin.rotation.set(0, 0, 0);
  }, [active]);

  useXRControllerLocomotion(
    originRef,
    { speed: WALK_SPEED },
    { type: "snap", degrees: 30 },
    "left",
  );

  useFrame(() => {
    if (!active) return;
    const origin = originRef.current;
    if (!origin) return;
    origin.position.x = THREE.MathUtils.clamp(origin.position.x, -SPLAT_WALK_HALF_EXTENT, SPLAT_WALK_HALF_EXTENT);
    origin.position.z = THREE.MathUtils.clamp(origin.position.z, -SPLAT_WALK_HALF_EXTENT, SPLAT_WALK_HALF_EXTENT);
    origin.position.y = 0;
  });

  if (!active) return null;
  return <XROrigin ref={originRef} />;
}

function resetWalkKeys(keys: WalkKeys) {
  keys.forward = false;
  keys.backward = false;
  keys.left = false;
  keys.right = false;
  keys.fast = false;
}

function clampCameraPosition(position: Vec3, room: RoomBounds): Vec3 {
  const floorClamped = clampToRoom(position, room, 0.2);
  return [
    floorClamped[0],
    THREE.MathUtils.clamp(position[1], 0.25, Math.max(0.25, room.height - 0.15)),
    floorClamped[2],
  ];
}

function screenAxisForWall(wall: WallId, wallCenter: Vec3, camera: THREE.Camera, element: HTMLCanvasElement) {
  const axisEnd: Vec3 =
    wall === "east" || wall === "west"
      ? [wallCenter[0] + 1, wallCenter[1], wallCenter[2]]
      : [wallCenter[0], wallCenter[1], wallCenter[2] + 1];
  const start = worldToClientPoint(wallCenter, camera, element);
  const end = worldToClientPoint(axisEnd, camera, element);
  const x = end.x - start.x;
  const y = end.y - start.y;
  return { x, y, lengthSq: x * x + y * y };
}

function screenPerpAxisForWall(
  wall: WallId,
  reference: Vec3,
  camera: THREE.Camera,
  element: HTMLCanvasElement,
) {
  const sign = wall === "north" || wall === "east" ? -1 : 1;
  const axisEnd: Vec3 =
    wall === "north" || wall === "south"
      ? [reference[0], reference[1], reference[2] + sign]
      : [reference[0] + sign, reference[1], reference[2]];
  const start = worldToClientPoint(reference, camera, element);
  const end = worldToClientPoint(axisEnd, camera, element);
  const x = end.x - start.x;
  const y = end.y - start.y;
  return { x, y, lengthSq: x * x + y * y };
}

function worldToClientPoint(position: Vec3, camera: THREE.Camera, element: HTMLCanvasElement) {
  const rect = element.getBoundingClientRect();
  const projected = new THREE.Vector3(...position).project(camera);
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

function splatAlignmentFromMarble(marble: MarbleResult): SplatAlignment {
  // Pre-baked local splats have authored defaults — they don't follow Marble's
  // Y-down + 1m-unit convention.
  const localOverride = marble.spzUrl ? LOCAL_SPLAT_DEFAULTS[marble.spzUrl] : undefined;
  if (localOverride) return localOverride;

  const position = marble.payload?.metadata.capture?.camera?.position;
  if (!position) return DEFAULT_SPLAT_ALIGNMENT;
  return {
    ...DEFAULT_SPLAT_ALIGNMENT,
    position,
  };
}

function captureLayoutPano(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  room: RoomBounds,
  wallSegments: WallSegmentation,
): CaptureImage | undefined {
  try {
    const position = layoutPanoCameraPosition(room, wallSegments);
    const primary = renderLayoutPano(scene, renderer, position, LAYOUT_PANO_WIDTH);
    const capture =
      dataUrlByteLength(primary.dataUrl) <= LAYOUT_PANO_MAX_DATA_URL_BYTES
        ? primary
        : renderLayoutPano(scene, renderer, position, LAYOUT_PANO_FALLBACK_WIDTH);

    return {
      role: "layout-pano",
      dataUrl: capture.dataUrl,
      isPano: true,
      resolution: { width: capture.width, height: capture.height },
      camera: { position },
    };
  } catch (error) {
    console.error("Layout panorama capture failed", error);
    return undefined;
  }
}

function renderLayoutPano(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  position: Vec3,
  width: number,
): { dataUrl: string; width: number; height: number } {
  const height = width / 2;
  const cubeSize = Math.min(1024, Math.max(512, THREE.MathUtils.ceilPowerOfTwo(width / 3)));
  const restoreScene = prepareSceneForLayoutCapture(scene);
  const previousTarget = renderer.getRenderTarget();
  const previousXrEnabled = renderer.xr.enabled;
  const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
  const cubeTarget = new THREE.WebGLCubeRenderTarget(cubeSize, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    generateMipmaps: false,
  });
  const cubeCamera = new THREE.CubeCamera(0.05, 1000, cubeTarget);
  cubeCamera.position.set(...position);

  try {
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    cubeCamera.update(renderer, scene);
    const faces = readCubeFaces(renderer, cubeTarget, cubeSize);
    return {
      dataUrl: cubeFacesToEquirectDataUrl(faces, cubeSize, width, height),
      width,
      height,
    };
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.xr.enabled = previousXrEnabled;
    renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
    cubeTarget.dispose();
    restoreScene();
  }
}

function prepareSceneForLayoutCapture(scene: THREE.Scene) {
  const restores: Array<() => void> = [];

  // Swap the scene background to a bright neutral so the panorama's "above
  // the walls" region reads as a flat ceiling/sky to Marble instead of empty
  // dark space.
  const previousBackground = scene.background;
  scene.background = new THREE.Color(LAYOUT_CAPTURE.background);
  restores.push(() => {
    scene.background = previousBackground;
  });

  // Inject a strong ambient light so flat blockout faces are uniformly lit
  // (no harsh shadows that confuse Marble's spatial interpretation).
  const captureLight = new THREE.AmbientLight("#ffffff", LAYOUT_CAPTURE.ambientIntensity);
  captureLight.userData.layoutCaptureLight = true;
  scene.add(captureLight);
  restores.push(() => {
    scene.remove(captureLight);
  });

  scene.traverse((object) => {
    const shouldHide =
      object.userData.captureHidden === true ||
      object.type.includes("TransformControls") ||
      object.name.includes("TransformControls") ||
      object instanceof THREE.Line;
    if (shouldHide && object.visible) {
      object.visible = false;
      restores.push(() => {
        object.visible = true;
      });
      return;
    }

    if (!(object instanceof THREE.Mesh)) return;
    const captureRole = object.userData.captureRole as string | undefined;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      const maybeWireframe = material as THREE.Material & { wireframe?: boolean };
      if (maybeWireframe.wireframe) {
        const previousVisible = object.visible;
        object.visible = false;
        restores.push(() => {
          object.visible = previousVisible;
        });
        return;
      }

      const previousTransparent = material.transparent;
      const previousOpacity = material.opacity;
      const previousDepthWrite = material.depthWrite;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;

      // For tagged architectural meshes, swap the color (and emissive) to a
      // bright capture-time palette so floor/walls/openings are readable to
      // Marble. We restore the originals after capture so the editor view is
      // untouched.
      const overrideColor = captureColorForRole(captureRole);
      let restoreColor: (() => void) | undefined;
      if (overrideColor) {
        const colored = material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
        const previousColor = colored.color?.clone();
        const previousEmissive = colored.emissive?.clone();
        const previousEmissiveIntensity = colored.emissiveIntensity;
        if (colored.color) colored.color.set(overrideColor);
        if (colored.emissive) {
          colored.emissive.set("#000000");
          if (typeof colored.emissiveIntensity === "number") colored.emissiveIntensity = 0;
        }
        restoreColor = () => {
          if (previousColor && colored.color) colored.color.copy(previousColor);
          if (previousEmissive && colored.emissive) colored.emissive.copy(previousEmissive);
          if (typeof previousEmissiveIntensity === "number") colored.emissiveIntensity = previousEmissiveIntensity;
        };
      }
      material.needsUpdate = true;
      restores.push(() => {
        material.transparent = previousTransparent;
        material.opacity = previousOpacity;
        material.depthWrite = previousDepthWrite;
        restoreColor?.();
        material.needsUpdate = true;
      });
    });
  });

  return () => {
    for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]();
  };
}

function captureColorForRole(role: string | undefined): string | undefined {
  switch (role) {
    case "floor":
      return LAYOUT_CAPTURE.floor;
    case "wall":
      return LAYOUT_CAPTURE.wall;
    case "door-panel":
      return LAYOUT_CAPTURE.doorPanel;
    case "door-frame":
      return LAYOUT_CAPTURE.doorFrame;
    case "window-glass":
      return LAYOUT_CAPTURE.windowGlass;
    case "window-frame":
      return LAYOUT_CAPTURE.windowFrame;
    default:
      return undefined;
  }
}

function readCubeFaces(renderer: THREE.WebGLRenderer, target: THREE.WebGLCubeRenderTarget, size: number) {
  return Array.from({ length: 6 }, (_, faceIndex) => {
    const pixels = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels, faceIndex);
    return pixels;
  });
}

function cubeFacesToEquirectDataUrl(faces: Uint8Array[], cubeSize: number, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create panorama canvas.");
  const imageData = context.createImageData(width, height);
  const output = imageData.data;
  const direction = new THREE.Vector3();

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const phi = (0.5 - v) * Math.PI;
    const cosPhi = Math.cos(phi);

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const theta = (u * 2 - 1) * Math.PI;
      direction.set(Math.sin(theta) * cosPhi, Math.sin(phi), -Math.cos(theta) * cosPhi);
      const sample = sampleCubeFace(faces, cubeSize, direction);
      const outputIndex = (y * width + x) * 4;
      output[outputIndex] = sample[0];
      output[outputIndex + 1] = sample[1];
      output[outputIndex + 2] = sample[2];
      output[outputIndex + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function sampleCubeFace(faces: Uint8Array[], size: number, direction: THREE.Vector3): [number, number, number] {
  const absX = Math.abs(direction.x);
  const absY = Math.abs(direction.y);
  const absZ = Math.abs(direction.z);
  let face = 0;
  let u = 0;
  let v = 0;

  if (absX >= absY && absX >= absZ) {
    if (direction.x > 0) {
      face = 0;
      u = -direction.z / absX;
      v = direction.y / absX;
    } else {
      face = 1;
      u = direction.z / absX;
      v = direction.y / absX;
    }
  } else if (absY >= absX && absY >= absZ) {
    if (direction.y > 0) {
      face = 2;
      u = direction.x / absY;
      v = -direction.z / absY;
    } else {
      face = 3;
      u = direction.x / absY;
      v = direction.z / absY;
    }
  } else if (direction.z > 0) {
    face = 4;
    u = direction.x / absZ;
    v = direction.y / absZ;
  } else {
    face = 5;
    u = -direction.x / absZ;
    v = direction.y / absZ;
  }

  const pixelX = THREE.MathUtils.clamp(Math.floor(((u + 1) / 2) * size), 0, size - 1);
  const pixelY = THREE.MathUtils.clamp(Math.floor(((1 - v) / 2) * size), 0, size - 1);
  const index = ((size - 1 - pixelY) * size + pixelX) * 4;
  const pixels = faces[face];
  return [pixels[index], pixels[index + 1], pixels[index + 2]];
}

/**
 * Position the panorama capture camera at the centroid of the *actual* floor
 * polygon (which accounts for outcrops/cuts) at human eye height. For a plain
 * rectangular room this is identical to the geometric center; for L-shapes or
 * outcrop layouts the centroid stays inside the room.
 */
function layoutPanoCameraPosition(room: RoomBounds, wallSegments: WallSegmentation): Vec3 {
  const polygon = buildFloorPolygon(room, wallSegments);
  const eyeY = THREE.MathUtils.clamp(WALK_EYE_HEIGHT, 1.2, Math.max(1.2, room.height - 0.4));
  if (polygon.length < 3) {
    return [(room.minX + room.maxX) / 2, eyeY, (room.minZ + room.maxZ) / 2];
  }
  const { x, z } = polygonCentroid(polygon);
  return [x, eyeY, z];
}

function polygonCentroid(points: Array<{ x: number; z: number }>): { x: number; z: number } {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.z - b.x * a.z;
    area += cross;
    cx += (a.x + b.x) * cross;
    cz += (a.z + b.z) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-6) {
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumZ = points.reduce((s, p) => s + p.z, 0);
    return { x: sumX / points.length, z: sumZ / points.length };
  }
  return { x: cx / (6 * area), z: cz / (6 * area) };
}

function dataUrlByteLength(dataUrl: string) {
  return Math.ceil(dataUrl.length * 0.75);
}

type DockedViewportIcon = {
  edge: "left" | "right" | "top" | "bottom";
  offset: number;
};

function dockedViewportIconFromRect(rect: DOMRect): DockedViewportIcon {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight;
  const distances = [
    { edge: "left" as const, value: rect.left },
    { edge: "right" as const, value: width - rect.right },
    { edge: "top" as const, value: rect.top },
    { edge: "bottom" as const, value: height - rect.bottom },
  ].sort((left, right) => left.value - right.value);
  const edge = distances[0].edge;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    edge,
    offset:
      edge === "left" || edge === "right"
        ? Math.min(height - 48, Math.max(48, centerY))
        : Math.min(width - 48, Math.max(48, centerX)),
  };
}

function dockedViewportIconStyle(dock: DockedViewportIcon) {
  if (dock.edge === "left") return { left: "0.75rem", top: dock.offset, transform: "translateY(-50%)" };
  if (dock.edge === "right") return { right: "0.75rem", top: dock.offset, transform: "translateY(-50%)" };
  if (dock.edge === "top") return { left: dock.offset, top: "0.75rem", transform: "translateX(-50%)" };
  return { left: dock.offset, bottom: "0.75rem", transform: "translateX(-50%)" };
}

function clampViewportPanelPosition(x: number, y: number, width: number, height: number) {
  const margin = 12;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const maxX = Math.max(margin, viewportWidth - width - margin);
  const maxY = Math.max(margin, viewportHeight - height - margin);

  return {
    x: Math.min(maxX, Math.max(margin, x)),
    y: Math.min(maxY, Math.max(margin, y)),
  };
}

function DraggableViewportPanel({
  title,
  icon: Icon,
  restoreLabel,
  className,
  defaultPlacement,
  minimizedPlacement,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  restoreLabel: string;
  className?: string;
  defaultPlacement: React.CSSProperties;
  minimizedPlacement?: React.CSSProperties;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [minimized, setMinimized] = useState<DockedViewportIcon | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function beginPanelDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    const dragHandle = event.currentTarget;
    const panelRect = panelRef.current?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? 224;
    const panelHeight = panelRect?.height ?? 140;
    dragRef.current = {
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: panelPosition?.x ?? panelRect?.left ?? window.innerWidth - 236,
      startY: panelPosition?.y ?? panelRect?.top ?? 12,
    };
    dragHandle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const session = dragRef.current;
      if (!session || session.pointerId !== moveEvent.pointerId) return;

      setPanelPosition(
        clampViewportPanelPosition(
          session.startX + moveEvent.clientX - session.startClientX,
          session.startY + moveEvent.clientY - session.startClientY,
          panelWidth,
          panelHeight,
        ),
      );
    }

    function endDrag(endEvent: PointerEvent) {
      const session = dragRef.current;
      if (!session || session.pointerId !== endEvent.pointerId) return;
      dragRef.current = null;

      try {
        dragHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }

      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", endDrag, { capture: true });
      window.removeEventListener("pointercancel", endDrag, { capture: true });
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", endDrag, { capture: true });
    window.addEventListener("pointercancel", endDrag, { capture: true });
  }

  function minimizePanel() {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMinimized(dockedViewportIconFromRect(rect));
  }

  if (minimized) {
    return (
      <button
        type="button"
        aria-label={restoreLabel}
        title={restoreLabel}
        className="absolute grid size-10 place-items-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_94%,transparent)] text-[var(--color-text-muted)] shadow-[var(--shadow-float)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)] [backdrop-filter:var(--panel-blur)]"
        style={minimizedPlacement ?? dockedViewportIconStyle(minimized)}
        onClick={() => setMinimized(null)}
      >
        <Icon className="size-4" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] text-xs text-[var(--color-text-muted)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]",
        className,
      )}
      style={panelPosition ? { left: panelPosition.x, top: panelPosition.y } : defaultPlacement}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={beginPanelDrag}
      >
        <div className="flex min-w-0 items-center gap-2 font-medium text-[var(--color-text-primary)]">
          <Icon className="size-3.5 shrink-0 text-[var(--color-accent-hover)]" />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
          {action}
          <button
            type="button"
            aria-label={`Minimize ${title}`}
            title={`Minimize ${title}`}
            className="grid size-7 place-items-center rounded-sm border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
            onClick={minimizePanel}
          >
            <Minus className="size-3.5" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SplatAlignmentControls({
  alignment,
  defaultAlignment,
  onAlignmentChange,
}: {
  alignment: SplatAlignment;
  defaultAlignment: SplatAlignment;
  onAlignmentChange: (alignment: SplatAlignment) => void;
}) {
  function updatePosition(index: number, value: number) {
    const position: Vec3 = [...alignment.position];
    position[index] = value;
    onAlignmentChange({ ...alignment, position });
  }

  function updateScale(value: number) {
    onAlignmentChange({ ...alignment, scale: Math.max(0.01, value) });
  }

  return (
    <DraggableViewportPanel
      title="Splat Align"
      icon={SlidersHorizontal}
      restoreLabel="Restore Splat Align"
      className="w-56"
      defaultPlacement={{ right: "0.75rem", top: "0.75rem" }}
      minimizedPlacement={{ left: "calc(50% + 21rem)", top: "0.75rem" }}
      action={
        <button
          type="button"
          className="rounded-sm border border-[var(--color-border)] px-2 py-1 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-inset)]"
          onClick={() => onAlignmentChange(defaultAlignment)}
        >
          Reset
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-1.5 p-2">
        <NumberControl label="X" value={alignment.position[0]} step={0.1} onChange={(value) => updatePosition(0, value)} />
        <NumberControl label="Y" value={alignment.position[1]} step={0.1} onChange={(value) => updatePosition(1, value)} />
        <NumberControl label="Z" value={alignment.position[2]} step={0.1} onChange={(value) => updatePosition(2, value)} />
        <NumberControl
          label="Rot Y"
          value={THREE.MathUtils.radToDeg(alignment.rotationY)}
          step={1}
          onChange={(value) => onAlignmentChange({ ...alignment, rotationY: THREE.MathUtils.degToRad(value) })}
        />
        <NumberControl label="Scale" value={alignment.scale} step={0.05} min={0.01} onChange={updateScale} />
        <label className="col-span-2 flex items-center justify-between gap-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-inset)] px-1.5 py-1 text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
          <span>Flip X (Y-up fix)</span>
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={alignment.flipX ?? true}
            onChange={(event) => onAlignmentChange({ ...alignment, flipX: event.target.checked })}
          />
        </label>
      </div>
    </DraggableViewportPanel>
  );
}

function NumberControl({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-inset)] px-1.5 py-1">
      <span className="w-9 shrink-0 text-[10px] font-medium uppercase text-[var(--color-text-muted)]">{label}</span>
      <input
        type="number"
        className="min-w-0 flex-1 bg-transparent text-right text-[11px] text-[var(--color-text-primary)] outline-none"
        value={formatControlNumber(value)}
        step={step}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function formatControlNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Subscribes the React tree to the module-level xrStore so DOM elements
 * rendered *outside* the <Canvas> (i.e. outside the <XR> provider, where
 * useXR() doesn't work) can still react to XR session state — for example,
 * to swap their hint copy or hide entirely while the user is in VR.
 */
function useXrPresentingExternal() {
  return useSyncExternalStore(
    (callback) => xrStore.subscribe(callback),
    () => xrStore.getState().session != null,
    () => false,
  );
}

/**
 * Container for the bottom WASD hint and the Enter VR button. The WASD/drag
 * hint is meaningless once the user is in a headset (their hands aren't on
 * the keyboard) so we hide it during a VR session and show a controller
 * hint instead.
 */
function SplatOverlayControls() {
  const xrPresenting = useXrPresentingExternal();
  return (
    <>
      {xrPresenting ? <SplatVrHint /> : <SplatWalkHint />}
      <EnterVrButton />
    </>
  );
}

function SplatVrHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_88%,transparent)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)]">
      <span className="font-mono text-[var(--text-bright)]">L stick</span>
      <span className="ml-1">walk</span>
      <span className="mx-2 opacity-60">·</span>
      <span className="font-mono text-[var(--text-bright)]">R stick</span>
      <span className="ml-1">snap-turn</span>
    </div>
  );
}

function SplatWalkHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_88%,transparent)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)]">
      <span className="font-mono text-[var(--text-bright)]">WASD</span>
      <span className="mx-2 opacity-60">·</span>
      <span>drag to look</span>
      <span className="mx-2 opacity-60">·</span>
      <span className="font-mono text-[var(--text-bright)]">Shift</span>
      <span className="ml-1">to sprint</span>
    </div>
  );
}

/**
 * Floating button that launches an immersive-vr WebXR session. Probes
 * `navigator.xr.isSessionSupported('immersive-vr')` once on mount and only
 * renders if the browser+device combo can actually present VR (so it stays
 * hidden on a desktop Chrome without an HMD, but appears on the Quest 3
 * browser). Clicking it calls `xrStore.enterVR()`, which negotiates the
 * session and hands the renderer's camera over to the headset.
 */
function EnterVrButton() {
  // Lazy initializer covers the SSR / no-WebXR cases up front so the effect
  // below only runs the async support probe — keeps us on the right side of
  // the React 19 "no setState in effects" lint rule.
  const [supported, setSupported] = useState<boolean | null>(() => {
    if (typeof navigator === "undefined") return false;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr || typeof xr.isSessionSupported !== "function") return false;
    return null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supported !== null) return;
    let cancelled = false;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr) return;
    xr.isSessionSupported("immersive-vr")
      .then((value) => {
        if (!cancelled) setSupported(Boolean(value));
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const handleEnter = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await xrStore.enterVR();
      if (!result) {
        setError("Headset declined the session.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to enter VR.");
    } finally {
      setBusy(false);
    }
  }, []);

  // While `supported` is null we're still probing isSessionSupported(); show
  // nothing so the button doesn't pop in/out. If the probe finished and
  // there's no XR device, show a small hint instead of the button so first-
  // time users know how to get a headset connected (Quest Link / SteamVR).
  if (supported === null) return null;
  if (!supported) {
    return (
      <div className="pointer-events-none absolute right-3 top-3 flex max-w-[220px] flex-col items-end gap-1 text-right">
        <div className="pointer-events-none rounded-md border border-[var(--border-dim)] bg-[color-mix(in_srgb,#16181d_88%,transparent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)] shadow-[0_4px_12px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)]">
          VR ready · connect Quest Link
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleEnter}
        disabled={busy}
        className="pointer-events-auto rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dim,#3a4250)_60%,#16181d)] disabled:cursor-not-allowed disabled:opacity-60"
        title="Send the splat to your connected headset (Meta Quest Link, SteamVR, or native browser)"
      >
        {busy ? "Entering…" : "Enter VR"}
      </button>
      <div className="pointer-events-none text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)] opacity-80">
        Quest Link · SteamVR
      </div>
      {error ? (
        <div className="pointer-events-none rounded-sm bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-2 py-1 text-[10px] text-[var(--color-warning,#f5a25d)] shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function SplatViewportOverlay({ marble, loadState }: { marble: MarbleResult; loadState: SplatLoadState }) {
  if (loadState.status === "error") {
    return (
      <div className="pointer-events-none absolute inset-x-4 bottom-4 mx-auto max-w-md rounded-md border border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-overlay)_90%,transparent)] p-3 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
        <div className="font-semibold text-[var(--color-warning)]">Generated splat could not load</div>
        <p className="mt-1 text-pretty text-xs text-[var(--color-text-muted)]">
          {loadState.message ?? "Use the result panel thumbnail or asset links while the SPZ asset is unavailable."}
        </p>
        <div className="pointer-events-auto mt-2 flex flex-wrap gap-2 text-xs">
          {marble.thumbnailUrl ? (
            <a className="rounded-sm border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-primary)] hover:bg-[var(--color-inset)]" href={marble.thumbnailUrl} target="_blank" rel="noreferrer">
              Thumbnail
            </a>
          ) : null}
          {marble.spzUrl ? (
            <a className="rounded-sm border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-primary)] hover:bg-[var(--color-inset)]" href={marble.spzUrl} target="_blank" rel="noreferrer">
              SPZ asset
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 mx-auto max-w-sm rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] p-3 text-center text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
      <div className="font-semibold">Loading generated room</div>
      <p className="mt-1 text-pretty text-xs text-[var(--color-text-muted)]">Streaming the Marble SPZ asset into the viewport.</p>
    </div>
  );
}

function RoomFloor({
  room,
  wallSegments,
  opacity,
  onPointerDown,
}: {
  room: RoomBounds;
  wallSegments: WallSegmentation;
  opacity: number;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const geometry = useMemo(() => {
    const polygon = buildFloorPolygon(room, wallSegments);
    if (polygon.length < 3) {
      const width = room.maxX - room.minX;
      const depth = room.maxZ - room.minZ;
      return new THREE.PlaneGeometry(width, depth).translate(
        (room.minX + room.maxX) / 2,
        -(room.minZ + room.maxZ) / 2,
        0,
      );
    }
    const shape = new THREE.Shape();
    shape.moveTo(polygon[0].x, -polygon[0].z);
    for (let i = 1; i < polygon.length; i++) {
      shape.lineTo(polygon[i].x, -polygon[i].z);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [room, wallSegments]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={onPointerDown}
      geometry={geometry}
      userData={{ captureRole: "floor" }}
    >
      <meshStandardMaterial
        color={SCENE_COLORS.floor}
        roughness={0.82}
        metalness={0.05}
        transparent
        opacity={opacity}
        depthWrite={opacity >= 0.98}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const MAX_OUTWARD_DISPLACEMENT = 6;
const MAX_INWARD_DISPLACEMENT_FACTOR = 0.7;

function clampDisplacement(value: number, room: RoomBounds, wall: WallId): number {
  const inwardLimit =
    wall === "east" || wall === "west"
      ? (room.maxX - room.minX) * MAX_INWARD_DISPLACEMENT_FACTOR
      : (room.maxZ - room.minZ) * MAX_INWARD_DISPLACEMENT_FACTOR;
  return Math.min(inwardLimit, Math.max(-MAX_OUTWARD_DISPLACEMENT, value));
}

function wallOrientation(wall: WallId): { rotationY: number; normalSign: number } {
  switch (wall) {
    case "north":
      return { rotationY: Math.PI, normalSign: -1 };
    case "south":
      return { rotationY: 0, normalSign: 1 };
    case "east":
      return { rotationY: Math.PI / 2, normalSign: -1 };
    case "west":
      return { rotationY: -Math.PI / 2, normalSign: 1 };
  }
}

function segmentDisplacementAtOffset(
  room: RoomBounds,
  wall: WallId,
  segments: WallSegment[] | undefined,
  offset: number,
): number {
  if (!segments || segments.length === 0) return 0;
  const fraction = offsetToFraction(room, wall, offset);
  const segment = findSegmentAtFraction(segments, fraction);
  return segment.displacement;
}

function openingWorldPos(
  room: RoomBounds,
  wall: WallId,
  offset: number,
  y: number,
  segments?: WallSegment[],
): Vec3 {
  const center = wallPosition(room, wall);
  const displacement = segmentDisplacementAtOffset(room, wall, segments, offset);
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    const cx = (room.minX + room.maxX) / 2;
    return [cx + offset, y, center[2] + sign * displacement];
  }
  const cz = (room.minZ + room.maxZ) / 2;
  return [center[0] + sign * displacement, y, cz + offset];
}

type DoorNodeProps = {
  door: Door;
  room: RoomBounds;
  wallSegments: WallSegmentation;
  selected: boolean;
  hovered: boolean;
  opacity: number;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
};

function DoorNode({ door, room, wallSegments, selected, hovered, opacity, onPointerDown, onPointerOver, onPointerOut }: DoorNodeProps) {
  const { rotationY } = wallOrientation(door.wall);
  const position = openingWorldPos(room, door.wall, door.offset, door.height / 2, wallSegments[door.wall]);
  const frameColor = fadeSceneColor(SCENE_COLORS.doorFrame, opacity);
  const panelColor = fadeSceneColor(selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.doorPanel, opacity);
  const highlight = selected || hovered;
  const panelDepth = WALL_THICKNESS + 0.04;
  const frameDepth = WALL_THICKNESS + 0.06;
  const knobOffset = panelDepth / 2 + 0.04;

  const fullyVisible = opacity >= 0.99;
  const panelAlpha = (selected ? 0.95 : hovered ? 0.9 : 0.85) * opacity;
  const panelOpaque = fullyVisible && panelAlpha >= 0.99;
  const frameAlpha = 0.95 * opacity;
  const frameOpaque = fullyVisible && frameAlpha >= 0.99;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
    >
      <mesh renderOrder={1} userData={{ captureRole: "door-panel" }}>
        <boxGeometry args={[door.width, door.height, panelDepth]} />
        <meshStandardMaterial
          color={panelColor}
          roughness={0.6}
          transparent={!panelOpaque}
          opacity={panelAlpha}
          emissive={highlight ? SCENE_COLORS.wallSelected : "#000000"}
          emissiveIntensity={selected ? 0.25 : hovered ? 0.12 : 0}
          depthWrite={panelOpaque || panelAlpha >= 0.98}
        />
      </mesh>
      <mesh position={[-door.width / 2, 0, 0]} renderOrder={1} userData={{ captureRole: "door-frame" }}>
        <boxGeometry args={[0.06, door.height, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[door.width / 2, 0, 0]} renderOrder={1} userData={{ captureRole: "door-frame" }}>
        <boxGeometry args={[0.06, door.height, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[0, door.height / 2, 0]} renderOrder={1} userData={{ captureRole: "door-frame" }}>
        <boxGeometry args={[door.width + 0.12, 0.06, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[door.width * 0.32, 0, knobOffset]} renderOrder={2}>
        <sphereGeometry args={[0.04, 16, 10]} />
        <meshStandardMaterial
          color={SCENE_COLORS.warmLight}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[door.width * 0.32, 0, -knobOffset]} renderOrder={2}>
        <sphereGeometry args={[0.04, 16, 10]} />
        <meshStandardMaterial
          color={SCENE_COLORS.warmLight}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
    </group>
  );
}

type WindowNodeProps = {
  window: WindowOpening;
  room: RoomBounds;
  wallSegments: WallSegmentation;
  selected: boolean;
  hovered: boolean;
  opacity: number;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
};

function WindowNode({ window, room, wallSegments, selected, hovered, opacity, onPointerDown, onPointerOver, onPointerOut }: WindowNodeProps) {
  const { rotationY } = wallOrientation(window.wall);
  const centerY = window.baseY + window.height / 2;
  const position = openingWorldPos(room, window.wall, window.offset, centerY, wallSegments[window.wall]);
  const frameColor = fadeSceneColor(SCENE_COLORS.windowFrame, opacity);
  const glassColor = fadeSceneColor(selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.windowGlass, opacity);
  const highlight = selected || hovered;
  const glassDepth = WALL_THICKNESS - 0.02;
  const frameDepth = WALL_THICKNESS + 0.06;
  const frameThickness = 0.08;
  const fullyVisible = opacity >= 0.99;
  const frameAlpha = fullyVisible ? 1 : 0.95 * opacity;
  const frameOpaque = fullyVisible;
  const mullionAlpha = fullyVisible ? 1 : 0.9 * opacity;
  const mullionOpaque = fullyVisible;
  const innerWidth = Math.max(0.05, window.width - frameThickness * 2);
  const innerHeight = Math.max(0.05, window.height - frameThickness * 2);

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
    >
      <mesh renderOrder={1} userData={{ captureRole: "window-glass" }}>
        <boxGeometry args={[innerWidth, innerHeight, glassDepth]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.18}
          metalness={0.1}
          transparent
          opacity={(selected ? 0.7 : hovered ? 0.6 : 0.5) * opacity}
          emissive={highlight ? SCENE_COLORS.wallSelected : SCENE_COLORS.windowGlass}
          emissiveIntensity={selected ? 0.3 : 0.08}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-window.width / 2 + frameThickness / 2, 0, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[frameThickness, window.height, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[window.width / 2 - frameThickness / 2, 0, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[frameThickness, window.height, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[0, window.height / 2 - frameThickness / 2, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[innerWidth, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[0, -window.height / 2 + frameThickness / 2, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[innerWidth, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!frameOpaque}
          opacity={frameAlpha}
          depthWrite={frameOpaque}
        />
      </mesh>
      <mesh position={[0, 0, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[0.04, innerHeight, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!mullionOpaque}
          opacity={mullionAlpha}
          depthWrite={mullionOpaque}
        />
      </mesh>
      <mesh position={[0, 0, 0]} renderOrder={2} userData={{ captureRole: "window-frame" }}>
        <boxGeometry args={[innerWidth, 0.04, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={!mullionOpaque}
          opacity={mullionAlpha}
          depthWrite={mullionOpaque}
        />
      </mesh>
    </group>
  );
}

const WALL_THICKNESS = 0.12;
const WALL_HIT_PAD = 0.1;

type SegmentMeshProps = {
  wall: WallId;
  length: number;
  height: number;
  position: Vec3;
  opacity: number;
  selected: boolean;
  hovered: boolean;
  highlightCursor: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
};

function SegmentMesh({
  wall,
  length,
  height,
  position,
  opacity,
  selected,
  hovered,
  highlightCursor,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: SegmentMeshProps) {
  const isHorizontal = wall === "north" || wall === "south";
  const visibleSize: Vec3 = isHorizontal
    ? [length, height, WALL_THICKNESS]
    : [WALL_THICKNESS, height, length];
  const outlineSize: Vec3 = [visibleSize[0] + 0.012, visibleSize[1] + 0.012, visibleSize[2] + 0.012];
  const hitSize: Vec3 = isHorizontal
    ? [length + 0.36, height, WALL_HIT_PAD]
    : [WALL_HIT_PAD, height, length + 0.36];
  const highlighted = selected || hovered;

  return (
    <group
      position={position}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <mesh castShadow receiveShadow onPointerDown={onPointerDown} renderOrder={0} userData={{ captureRole: "wall" }}>
        <boxGeometry args={visibleSize} />
        <meshStandardMaterial
          color={selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          transparent
          opacity={(selected ? 0.92 : hovered ? 0.84 : 0.74) * opacity}
          roughness={0.62}
          emissive={highlighted ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          emissiveIntensity={selected ? 0.2 : hovered ? 0.1 : 0.05}
          depthWrite={opacity >= 0.98}
        />
      </mesh>
      <mesh>
        <boxGeometry args={outlineSize} />
        <meshBasicMaterial
          userData={{ captureHidden: true }}
          color={highlighted ? SCENE_COLORS.wallSelectedEdge : SCENE_COLORS.wallEdge}
          wireframe
          transparent
          opacity={(selected ? 0.65 : hovered ? 0.5 : 0.34) * opacity}
          depthWrite={false}
        />
      </mesh>
      <mesh onPointerDown={onPointerDown}>
        <boxGeometry args={hitSize} />
        <meshBasicMaterial
          userData={{ captureHidden: true, cursorHighlight: highlightCursor }}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

type ConnectorMeshProps = {
  wall: WallId;
  depth: number;
  height: number;
  position: Vec3;
  opacity: number;
  highlight: boolean;
};

function ConnectorMesh({ wall, depth, height, position, opacity, highlight }: ConnectorMeshProps) {
  const isHorizontal = wall === "north" || wall === "south";
  const visibleSize: Vec3 = isHorizontal
    ? [WALL_THICKNESS, height, depth]
    : [depth, height, WALL_THICKNESS];
  const outlineSize: Vec3 = [visibleSize[0] + 0.012, visibleSize[1] + 0.012, visibleSize[2] + 0.012];

  return (
    <group position={position}>
      <mesh castShadow receiveShadow userData={{ captureRole: "wall" }}>
        <boxGeometry args={visibleSize} />
        <meshStandardMaterial
          color={highlight ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          transparent
          opacity={0.84 * opacity}
          roughness={0.6}
          emissive={highlight ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          emissiveIntensity={highlight ? 0.18 : 0.05}
          depthWrite={opacity >= 0.98}
        />
      </mesh>
      <mesh>
        <boxGeometry args={outlineSize} />
        <meshBasicMaterial
          userData={{ captureHidden: true }}
          color={highlight ? SCENE_COLORS.wallSelectedEdge : SCENE_COLORS.wallEdge}
          wireframe
          transparent
          opacity={0.34 * opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

type FurnitureNodeProps = {
  instance: FurnitureInstance;
  asset?: FurnitureAsset;
  room: RoomBounds;
  wallSegments: WallSegmentation;
  selected: boolean;
  hovered: boolean;
  tool: ToolMode;
  opacity: number;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onRotateStart: (event: ThreeEvent<PointerEvent>) => void;
  onTransformActiveChange: (active: boolean) => void;
  onChange: (instance: FurnitureInstance) => void;
  onMeasured?: (footprint: { width: number; depth: number; height: number }) => void;
};

function FurnitureNode({
  instance,
  asset,
  room,
  wallSegments,
  selected,
  hovered,
  tool,
  opacity,
  onSelect,
  onDragStart,
  onRotateStart,
  onTransformActiveChange,
  onChange,
  onMeasured,
}: FurnitureNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const transformMode = tool === "rotate" ? "rotate" : tool === "scale" ? "scale" : "translate";
  const modelUrl = asset?.modelUrl ? proxiedModelUrl(asset.modelUrl) : undefined;

  useFrame(() => {
    if (!groupRef.current || !selected) return;
    const object = groupRef.current;
    const nextPosition = clampToFloor([object.position.x, object.position.y, object.position.z], room, wallSegments);
    if (
      nextPosition[0] !== object.position.x ||
      nextPosition[1] !== object.position.y ||
      nextPosition[2] !== object.position.z
    ) {
      object.position.set(...nextPosition);
    }
  });

  function pushTransform() {
    const object = groupRef.current;
    if (!object) return;
    onChange({
      ...instance,
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    });
  }

  const content = (
    <group
      ref={groupRef}
      position={instance.position}
      rotation={instance.rotation}
      scale={instance.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
    >
      <Suspense fallback={<PrimitiveFurniture primitive={asset?.primitive ?? "sofa"} selected={selected} hovered={hovered} opacity={opacity} />}>
        {modelUrl && asset ? (
          <GeneratedModelBoundary
            resetKey={modelUrl}
            fallback={<GeneratedModelFallback primitive={asset.primitive} selected={selected} hovered={hovered} opacity={opacity} />}
          >
            <GeneratedModel
              url={modelUrl}
              selected={selected}
              hovered={hovered}
              opacity={opacity}
              realLengthMeters={asset.realLengthMeters}
              onMeasured={onMeasured}
            />
          </GeneratedModelBoundary>
        ) : (
          <PrimitiveFurniture primitive={asset?.primitive ?? "sofa"} selected={selected} hovered={hovered} opacity={opacity} />
        )}
      </Suspense>
      {selected ? <FurnitureRotateRing onRotateStart={onRotateStart} /> : null}
    </group>
  );

  if (!selected || tool === "select" || tool === "add-wall" || tool === "add-furniture" || tool === "add-shape") return content;

  return (
    <TransformControls
      mode={transformMode}
      onMouseDown={() => onTransformActiveChange(true)}
      onObjectChange={pushTransform}
      onMouseUp={() => {
        pushTransform();
        onTransformActiveChange(false);
      }}
    >
      {content}
    </TransformControls>
  );
}

type ShapeNodeProps = {
  shape: CustomShape;
  room: RoomBounds;
  wallSegments: WallSegmentation;
  selected: boolean;
  hovered: boolean;
  tool: ToolMode;
  opacity: number;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onResizeStart: (axis: ShapeResizeAxis, sign: -1 | 1, event: ThreeEvent<PointerEvent>) => void;
  onRotateStart: (event: ThreeEvent<PointerEvent>) => void;
};

function ShapeNode({
  shape,
  room,
  wallSegments,
  selected,
  hovered,
  tool,
  opacity,
  onSelect,
  onDragStart,
  onResizeStart,
  onRotateStart,
}: ShapeNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const showResizeHandles = selected && (tool === "select" || tool === "move" || tool === "scale");
  const showRotateHandle = selected && (tool === "select" || tool === "move" || tool === "rotate");

  useFrame(() => {
    if (!groupRef.current || !selected) return;
    const object = groupRef.current;
    const nextPosition = clampToFloor([object.position.x, object.position.y, object.position.z], room, wallSegments);
    if (
      nextPosition[0] !== object.position.x ||
      nextPosition[1] !== object.position.y ||
      nextPosition[2] !== object.position.z
    ) {
      object.position.set(...nextPosition);
    }
  });

  const content = (
    <group
      ref={groupRef}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
    >
      <ShapePrimitive shape={shape} selected={selected} hovered={hovered} opacity={opacity} />
      {showResizeHandles ? <ShapeResizeHandles shape={shape} opacity={opacity} onResizeStart={onResizeStart} /> : null}
      {showRotateHandle ? <ShapeRotateHandle shape={shape} opacity={opacity} onRotateStart={onRotateStart} /> : null}
    </group>
  );

  return content;
}

type SceneCameraNodeProps = {
  camera: SceneCamera;
  room: RoomBounds;
  selected: boolean;
  hovered: boolean;
  tool: ToolMode;
  opacity: number;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onTransformActiveChange: (active: boolean) => void;
  onChange: (camera: SceneCamera) => void;
};

function SceneCameraNode({
  camera: sceneCamera,
  room,
  selected,
  hovered,
  tool,
  opacity,
  onSelect,
  onDragStart,
  onTransformActiveChange,
  onChange,
}: SceneCameraNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const transformMode = tool === "rotate" ? "rotate" : "translate";

  useFrame(() => {
    if (!groupRef.current || !selected) return;
    const object = groupRef.current;
    const nextPosition = clampCameraPosition([object.position.x, object.position.y, object.position.z], room);
    if (
      nextPosition[0] !== object.position.x ||
      nextPosition[1] !== object.position.y ||
      nextPosition[2] !== object.position.z
    ) {
      object.position.set(...nextPosition);
    }
  });

  function pushTransform() {
    const object = groupRef.current;
    if (!object) return;
    onChange({
      ...sceneCamera,
      position: clampCameraPosition([object.position.x, object.position.y, object.position.z], room),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    });
  }

  const content = (
    <group
      ref={groupRef}
      position={sceneCamera.position}
      rotation={sceneCamera.rotation}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
    >
      <CameraPrimitive selected={selected} hovered={hovered} opacity={opacity} />
    </group>
  );

  if (!selected || tool === "select" || tool === "add-wall" || tool === "add-furniture" || tool === "add-shape" || tool === "add-camera" || tool === "scale") {
    return content;
  }

  return (
    <TransformControls
      mode={transformMode}
      onMouseDown={() => onTransformActiveChange(true)}
      onObjectChange={pushTransform}
      onMouseUp={() => {
        pushTransform();
        onTransformActiveChange(false);
      }}
    >
      {content}
    </TransformControls>
  );
}

function ShapeResizeHandles({
  shape,
  opacity,
  onResizeStart,
}: {
  shape: CustomShape;
  opacity: number;
  onResizeStart: (axis: ShapeResizeAxis, sign: -1 | 1, event: ThreeEvent<PointerEvent>) => void;
}) {
  const safeScale = shape.scale.map((value) => Math.max(0.05, Math.abs(value))) as Vec3;
  const inverseScale: Vec3 = [1 / safeScale[0], 1 / safeScale[1], 1 / safeScale[2]];
  const handleSize: Vec3 = [0.16, 0.16, 0.16];
  const handles: Array<{ axis: ShapeResizeAxis; sign: -1 | 1; position: Vec3; color: string }> = [
    { axis: 0, sign: -1, position: [-0.62, 0, 0], color: SCENE_COLORS.axisX },
    { axis: 0, sign: 1, position: [0.62, 0, 0], color: SCENE_COLORS.axisX },
    { axis: 1, sign: -1, position: [0, -0.62, 0], color: SCENE_COLORS.axisY },
    { axis: 1, sign: 1, position: [0, 0.62, 0], color: SCENE_COLORS.axisY },
    { axis: 2, sign: -1, position: [0, 0, -0.62], color: SCENE_COLORS.axisZ },
    { axis: 2, sign: 1, position: [0, 0, 0.62], color: SCENE_COLORS.axisZ },
  ];

  return (
    <group userData={{ captureHidden: true }}>
      {handles.map((handle) => (
        <mesh
          key={`${handle.axis}-${handle.sign}`}
          position={handle.position}
          scale={inverseScale}
          onPointerDown={(event) => onResizeStart(handle.axis, handle.sign, event)}
        >
          <boxGeometry args={handleSize} />
          <meshStandardMaterial
            color={handle.color}
            emissive={handle.color}
            emissiveIntensity={0.22}
            roughness={0.42}
            transparent
            opacity={0.95 * opacity}
            depthWrite={opacity >= 0.98}
          />
        </mesh>
      ))}
    </group>
  );
}

function ShapeRotateHandle({
  shape,
  opacity,
  onRotateStart,
}: {
  shape: CustomShape;
  opacity: number;
  onRotateStart: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const safeScale = shape.scale.map((value) => Math.max(0.05, Math.abs(value))) as Vec3;
  const inverseScale: Vec3 = [1 / safeScale[0], 1 / safeScale[1], 1 / safeScale[2]];

  return (
    <group userData={{ captureHidden: true }}>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} onPointerDown={onRotateStart}>
        <torusGeometry args={[0.78, 0.012, 8, 72]} />
        <meshBasicMaterial color={SCENE_COLORS.warmLight} transparent opacity={0.72 * opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0.86, 0.72, 0]} scale={inverseScale} onPointerDown={onRotateStart}>
        <sphereGeometry args={[0.085, 18, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.warmLight}
          emissive={SCENE_COLORS.warmLight}
          emissiveIntensity={0.24}
          roughness={0.38}
          transparent
          opacity={0.96 * opacity}
          depthWrite={opacity >= 0.98}
        />
      </mesh>
    </group>
  );
}

function CameraPrimitive({ selected, hovered, opacity }: { selected: boolean; hovered: boolean; opacity: number }) {
  const highlightOpacity = (selected ? 0.74 : hovered ? 0.52 : 0.34) * opacity;

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.38, 0.26, 0.24]} />
        <meshStandardMaterial
          color={selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.darkWood}
          emissive={selected || hovered ? SCENE_COLORS.wallSelected : SCENE_COLORS.darkWood}
          emissiveIntensity={selected ? 0.18 : hovered ? 0.1 : 0.02}
          roughness={0.48}
          {...fadedMaterialProps(opacity)}
        />
      </mesh>
      <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 0.18, 24]} />
        <meshStandardMaterial color={SCENE_COLORS.accent} emissive={SCENE_COLORS.accent} emissiveIntensity={0.14} {...fadedMaterialProps(opacity)} />
      </mesh>
      <mesh userData={{ captureHidden: true }} position={[0, 0, -0.64]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.42, 0.78, 4, 1, true]} />
        <meshBasicMaterial color={SCENE_COLORS.accent} wireframe transparent opacity={highlightOpacity} depthWrite={false} />
      </mesh>
      <mesh userData={{ captureHidden: true }} position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.32, 32]} />
        <meshBasicMaterial color={SCENE_COLORS.accent} transparent opacity={highlightOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ShapePrimitive({ shape, selected, hovered, opacity }: { shape: CustomShape; selected: boolean; hovered: boolean; opacity: number }) {
  return (
    <group>
      <ShapeGeometry kind={shape.kind} color={shape.color} opacity={opacity} />
      <mesh>
        <ShapeGeometryElement kind={shape.kind} outline />
        <meshBasicMaterial userData={{ captureHidden: true }} color={SCENE_COLORS.shapeWire} wireframe transparent opacity={(selected ? 0.56 : hovered ? 0.42 : 0.24) * opacity} />
      </mesh>
      {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
    </group>
  );
}

function ShapeGeometry({ kind, color, opacity }: { kind: ShapeKind; color: string; opacity: number }) {
  return (
    <mesh castShadow receiveShadow>
      <ShapeGeometryElement kind={kind} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.04} transparent opacity={0.86 * opacity} depthWrite={opacity >= 0.98} />
    </mesh>
  );
}

function ShapeGeometryElement({ kind, outline = false }: { kind: ShapeKind; outline?: boolean }) {
  const lift = outline ? 0.004 : 0;
  if (kind === "sphere") return <sphereGeometry args={[0.5 + lift, 32, 20]} />;
  if (kind === "cylinder") return <cylinderGeometry args={[0.5 + lift, 0.5 + lift, 1 + lift, 32]} />;
  if (kind === "cone") return <coneGeometry args={[0.52 + lift, 1 + lift, 32]} />;
  if (kind === "plane") return <boxGeometry args={[1 + lift, 0.04 + lift, 1 + lift]} />;
  return <boxGeometry args={[1 + lift, 1 + lift, 1 + lift]} />;
}

function proxiedModelUrl(modelUrl: string) {
  try {
    const parsedUrl = new URL(modelUrl, window.location.origin);
    if (parsedUrl.hostname === "assets.meshy.ai") {
      return `/api/meshy/model?url=${encodeURIComponent(parsedUrl.toString())}`;
    }
  } catch {
    return modelUrl;
  }

  return modelUrl;
}

function proxiedMarbleSpzUrl(spzUrl: string) {
  // Local static assets (anything served straight out of public/) don't need
  // — and shouldn't go through — the Marble CORS proxy.
  if (spzUrl.startsWith("/") && !spzUrl.startsWith("//")) return spzUrl;
  return `/api/marble/splat?url=${encodeURIComponent(spzUrl)}`;
}

type GeneratedModelBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
};

type GeneratedModelBoundaryState = {
  hasError: boolean;
};

class GeneratedModelBoundary extends Component<GeneratedModelBoundaryProps, GeneratedModelBoundaryState> {
  state: GeneratedModelBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: unknown): GeneratedModelBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: GeneratedModelBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function GeneratedModel({
  url,
  selected,
  hovered,
  opacity,
  realLengthMeters,
  onMeasured,
}: {
  url: string;
  selected: boolean;
  hovered: boolean;
  opacity: number;
  realLengthMeters?: number;
  onMeasured?: (footprint: { width: number; depth: number; height: number }) => void;
}) {
  const gltf = useGLTF(url);

  // Clone the GLB scene AND measure its local bounding box in the same memo,
  // before the clone is attached to anything in the React-Three tree. This is
  // crucial: `Box3.setFromObject` reads `matrixWorld`, so once a model is
  // mounted inside our wrapping <group>, a later measurement would return the
  // *world* bbox (which already includes whatever scale + Y offset the
  // previous render baked in). Caching the local bbox once per loaded GLB
  // means subsequent `realLengthMeters` changes only re-derive the scaling
  // math — not the bbox — and the floor align stays correct on every
  // re-render.
  const { model, localBox, localSize } = useMemo(() => {
    const clone = gltf.scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    if (!box.isEmpty()) box.getSize(size);
    return { model: clone, localBox: box, localSize: size };
  }, [gltf.scene]);

  // Compute scale + Y offset so that:
  //   - when we have a Gemini-estimated real-world length, the longest axis
  //     of the GLB matches that physical size in meters
  //   - the bottom of the model always rests exactly on the floor (y = 0)
  //
  // We also report the post-scale axis-aligned size so 2D blueprint views
  // can draw an accurate top-down bounding rectangle for this asset.
  const { uniformScale, floorOffsetY, footprint } = useMemo(() => {
    if (localBox.isEmpty() || !Number.isFinite(localBox.min.y)) {
      return { uniformScale: 1, floorOffsetY: 0, footprint: null as null | { width: number; depth: number; height: number } };
    }
    const longest = Math.max(localSize.x, localSize.y, localSize.z);
    const s =
      typeof realLengthMeters === "number" && realLengthMeters > 0 && longest > 0
        ? realLengthMeters / longest
        : 1;
    return {
      uniformScale: s,
      floorOffsetY: -localBox.min.y * s,
      footprint: { width: localSize.x * s, depth: localSize.z * s, height: localSize.y * s },
    };
  }, [localBox, localSize, realLengthMeters]);

  const onMeasuredRef = useRef(onMeasured);
  useEffect(() => {
    onMeasuredRef.current = onMeasured;
  }, [onMeasured]);

  useEffect(() => {
    if (!footprint) return;
    onMeasuredRef.current?.(footprint);
  }, [footprint]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        material.transparent = opacity < 0.98;
        material.opacity = opacity;
        material.depthWrite = opacity >= 0.98;
        material.needsUpdate = true;
      });
    });
  }, [model, opacity]);

  return (
    <group>
      <group position={[0, floorOffsetY, 0]} scale={[uniformScale, uniformScale, uniformScale]}>
        <primitive object={model} />
      </group>
      {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
    </group>
  );
}

function GeneratedModelFallback({
  primitive,
  selected,
  hovered,
  opacity,
}: {
  primitive: FurnitureAsset["primitive"];
  selected: boolean;
  hovered: boolean;
  opacity: number;
}) {
  return (
    <group>
      <PrimitiveFurniture primitive={primitive} selected={selected} hovered={hovered} opacity={opacity} />
      {selected ? (
        <Html position={[0, 1.2, 0]} center zIndexRange={[1, 0]}>
          <span className="whitespace-nowrap rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_90%,transparent)] px-2 py-1 text-[11px] font-medium text-[var(--color-accent)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
            Generated GLB blocked by CORS
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function PrimitiveFurniture({
  primitive,
  selected,
  hovered,
  opacity,
}: {
  primitive: FurnitureAsset["primitive"];
  selected: boolean;
  hovered: boolean;
  opacity: number;
}) {
  if (primitive === "table") {
    return (
      <group>
        <mesh castShadow position={[0, 0.23, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.12, 36]} />
          <meshStandardMaterial color={SCENE_COLORS.tableTop} roughness={0.55} {...fadedMaterialProps(opacity)} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 16]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} {...fadedMaterialProps(opacity)} />
        </mesh>
        {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
      </group>
    );
  }

  if (primitive === "chair") {
    return (
      <group>
        <mesh castShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[0.62, 0.14, 0.58]} />
          <meshStandardMaterial color={SCENE_COLORS.upholstery} {...fadedMaterialProps(opacity)} />
        </mesh>
        <mesh castShadow position={[0, 0.62, 0.24]}>
          <boxGeometry args={[0.62, 0.72, 0.12]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} {...fadedMaterialProps(opacity)} />
        </mesh>
        {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
      </group>
    );
  }

  if (primitive === "lamp") {
    return (
      <group>
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 12]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} {...fadedMaterialProps(opacity)} />
        </mesh>
        <mesh castShadow position={[0, 1.18, 0]}>
          <coneGeometry args={[0.28, 0.38, 28]} />
          <meshStandardMaterial color={SCENE_COLORS.warmLight} emissive={SCENE_COLORS.warmLight} emissiveIntensity={0.28} {...fadedMaterialProps(opacity)} />
        </mesh>
        {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
      </group>
    );
  }

  if (primitive === "plant") {
    return (
      <group>
        <mesh castShadow position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 0.36, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.clayDark} {...fadedMaterialProps(opacity)} />
        </mesh>
        <mesh castShadow position={[0, 0.58, 0]}>
          <sphereGeometry args={[0.38, 20, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.leaf} roughness={0.8} {...fadedMaterialProps(opacity)} />
        </mesh>
        {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
      </group>
    );
  }

  if (primitive === "cabinet") {
    return (
      <group>
        <mesh castShadow position={[0, 0.48, 0]}>
          <boxGeometry args={[1.3, 0.95, 0.42]} />
          <meshStandardMaterial color={SCENE_COLORS.upholstery} roughness={0.65} {...fadedMaterialProps(opacity)} />
        </mesh>
        {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[1.45, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.upholstery} roughness={0.78} {...fadedMaterialProps(opacity)} />
      </mesh>
      <mesh castShadow position={[0, 0.74, 0.27]}>
        <boxGeometry args={[1.45, 0.68, 0.16]} />
        <meshStandardMaterial color={SCENE_COLORS.wall} roughness={0.78} {...fadedMaterialProps(opacity)} />
      </mesh>
      <mesh castShadow position={[-0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.darkWood} roughness={0.78} {...fadedMaterialProps(opacity)} />
      </mesh>
      <mesh castShadow position={[0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.darkWood} roughness={0.78} {...fadedMaterialProps(opacity)} />
      </mesh>
      {selected || hovered ? <SelectionRing opacity={opacity} selected={selected} /> : null}
    </group>
  );
}

function fadedMaterialProps(opacity: number) {
  return {
    transparent: opacity < 0.98,
    opacity,
    depthWrite: opacity >= 0.98,
  };
}

function SelectionRing({ opacity = 1, selected = true }: { opacity?: number; selected?: boolean }) {
  return (
    <mesh userData={{ captureHidden: true }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
      <ringGeometry args={[0.85, 0.9, 48]} />
      <meshBasicMaterial color={SCENE_COLORS.accent} transparent opacity={(selected ? 0.9 : 0.48) * opacity} />
    </mesh>
  );
}

/**
 * Interactive grab ring at the base of a selected furniture instance.
 * Overlays the visual `SelectionRing` and dispatches the rotate gesture.
 * Slightly thicker than the visual ring so it's a comfortable hit target.
 */
function FurnitureRotateRing({
  onRotateStart,
}: {
  onRotateStart: (event: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <mesh
      userData={{ captureHidden: true }}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.026, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onRotateStart(event);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {/* Wider than the visual ring (0.78–0.97 vs 0.85–0.9) for easier grab. */}
      <ringGeometry args={[0.78, 0.97, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
