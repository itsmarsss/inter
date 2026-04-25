import { SplatEdit, SplatEditRgbaBlendMode, SplatEditSdf, SplatEditSdfType, SplatMesh } from "@sparkjsdev/spark";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls, PerspectiveCamera, PointerLockControls, TransformControls, useGLTF } from "@react-three/drei";
import { Camera, Footprints } from "lucide-react";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl, PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import {
  clampToRoom,
  createCustomShape,
  createFurnitureInstance,
  createSceneCamera,
  resizeRoomFromWall,
  roomDimensions,
  wallPosition,
  wallSize,
} from "../state/editor";
import type {
  CustomShape,
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
} from "../state/types";
import { cn } from "../lib/cn";

type SceneViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  cameras: SceneCamera[];
  activeShapeKind: ShapeKind;
  selected: SelectedRef;
  hovered: SelectedRef;
  tool: ToolMode;
  marble: MarbleResult;
  panoramaOpacity?: number;
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onShapesChange: (shapes: CustomShape[]) => void;
  onCamerasChange: (cameras: SceneCamera[]) => void;
  onSelect: (selected: SelectedRef) => void;
  registerSceneCapture: (capture: () => CaptureImage | undefined) => void;
};

type Projector = (clientX: number, clientY: number) => Vec3 | null;
type ViewMode = "blockout" | "generated";
type ComparisonMode = "blockout" | "blend" | "splat";
type ObjectSplatMode = "off" | "highlight" | "fade" | "hide" | "isolate";
type SplatLoadState = { status: "idle" | "loading" | "ready" | "error"; message?: string };
type SplatAlignment = {
  position: Vec3;
  rotationY: number;
  scale: number;
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

const SCENE_COLORS = {
  background: "#080B10",
  floor: "#111821",
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
const DEFAULT_SPLAT_ALIGNMENT: SplatAlignment = {
  position: [0, 0, 0],
  rotationY: 0,
  scale: 1,
};
const DEFAULT_COMPARISON_VALUE = 72;
const INITIAL_CAMERA_POSITION: Vec3 = [6.5, 5.2, 7];
const WALK_SPEED = 2.4;
const WALK_FAST_MULTIPLIER = 1.8;
const WALK_WALL_MARGIN = 0.3;
const WALK_EYE_HEIGHT = 1.6;
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
  const firstPersonLockRef = useRef<() => void>(() => undefined);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("blockout");
  const [comparisonValue, setComparisonValue] = useState(0);
  const [comparisonSpzUrl, setComparisonSpzUrl] = useState<string | undefined>();
  const [objectSplatMode, setObjectSplatMode] = useState<ObjectSplatMode>("off");
  const [splatLoadState, setSplatLoadState] = useState<SplatLoadState>({ status: "idle" });
  const [splatAlignmentState, setSplatAlignmentState] = useState<{
    spzUrl?: string;
    value: SplatAlignment;
  }>(() => ({ spzUrl: props.marble.spzUrl, value: splatAlignmentFromMarble(props.marble) }));
  const [firstPersonActive, setFirstPersonActive] = useState(false);
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
  const activeComparisonMode = generatedAvailable
    ? comparisonSpzUrl === props.marble.spzUrl
      ? comparisonMode
      : "blend"
    : "blockout";
  const activeComparisonValue = generatedAvailable
    ? comparisonSpzUrl === props.marble.spzUrl
      ? comparisonValue
      : Math.round((props.panoramaOpacity ?? DEFAULT_COMPARISON_VALUE / 100) * 100)
    : 0;
  const activeViewMode: ViewMode = generatedAvailable && activeComparisonMode !== "blockout" ? "generated" : "blockout";
  const blockoutOpacity = generatedAvailable ? (100 - activeComparisonValue) / 100 : 1;
  const splatOpacity = generatedAvailable ? activeComparisonValue / 100 : 0;
  const firstPersonEnabled = firstPersonActive && activeViewMode === "generated" && splatLoadState.status !== "error";
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

  function selectComparisonMode(nextMode: ComparisonMode) {
    if (!generatedAvailable && nextMode !== "blockout") return;
    setComparisonMode(nextMode);
    setComparisonSpzUrl(props.marble.spzUrl);
    if (nextMode === "blockout") {
      setComparisonValue(0);
      setFirstPersonActive(false);
    }
    if (nextMode === "blend") setComparisonValue((current) => (current > 0 && current < 100 ? current : 50));
    if (nextMode === "splat") setComparisonValue(100);
  }

  function updateComparisonValue(value: number) {
    const nextValue = THREE.MathUtils.clamp(value, 0, 100);
    setComparisonValue(nextValue);
    setComparisonMode(nextValue <= 0 ? "blockout" : nextValue >= 100 ? "splat" : "blend");
    setComparisonSpzUrl(props.marble.spzUrl);
    if (nextValue <= 0) setFirstPersonActive(false);
  }

  function enterFirstPerson() {
    if (!generatedAvailable) return;
    setComparisonMode("splat");
    setComparisonValue(100);
    setComparisonSpzUrl(props.marble.spzUrl);
    setFirstPersonActive(true);
    firstPersonLockRef.current();
  }

  function exitFirstPerson() {
    setFirstPersonActive(false);
  }

  const registerFirstPersonLock = useCallback((lock: () => void) => {
    firstPersonLockRef.current = lock;
  }, []);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (activeViewMode !== "blockout") return;
    const assetId = event.dataTransfer.getData("application/x-furniture-asset");
    const asset = props.assetById?.get(assetId) ?? props.assets.find((item) => item.id === assetId);
    const position = projectorRef.current?.(event.clientX, event.clientY);
    if (!asset || !position) return;

    const instance = createFurnitureInstance(asset, clampToRoom(position, props.room));
    props.onInstancesChange([...props.instances, instance]);
    props.onSelect({ type: "furniture", id: instance.id });
  }

  return (
    <div
      className="relative h-full min-h-0 bg-[var(--color-background)]"
      title="Viewport navigation: middle mouse or Alt-drag orbits, right mouse pans, wheel zooms."
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
        <SceneContent
          {...props}
          viewMode={activeViewMode}
          generatedAvailable={generatedAvailable}
          splatAlignment={splatAlignment}
          splatObjectRegions={splatObjectRegions}
          objectSplatMode={objectSplatControlsVisible ? objectSplatMode : "off"}
          blockoutOpacity={blockoutOpacity}
          splatOpacity={splatOpacity}
          firstPersonActive={firstPersonEnabled}
          onSplatLoadStateChange={setSplatLoadState}
          onFirstPersonActiveChange={setFirstPersonActive}
          registerFirstPersonLock={registerFirstPersonLock}
          setProjector={(projector) => (projectorRef.current = projector)}
        />
      </Canvas>
      <div className="absolute left-1/2 top-3 flex min-w-0 -translate-x-1/2 flex-col items-stretch gap-2 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_86%,transparent)] px-2 py-1.5 text-xs text-[var(--color-text-muted)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)] sm:min-w-[22rem]">
        <div className="px-1 font-medium text-[var(--color-text-primary)]">
          {generatedAvailable ? "Compare room" : "Blockout room"}
        </div>
        <div className="flex rounded-sm border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5">
          {(["blockout", "blend", "splat"] as ComparisonMode[]).map((mode) => {
            const disabled = !generatedAvailable && mode !== "blockout";
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={activeComparisonMode === mode}
                disabled={disabled}
                className={`min-w-0 flex-1 rounded-sm px-2 py-1 font-medium capitalize ${
                  activeComparisonMode === mode
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                } ${disabled ? "cursor-not-allowed opacity-45 hover:text-[var(--color-text-muted)]" : ""}`}
                onClick={() => selectComparisonMode(mode)}
              >
                {mode === "blockout" ? "Block out" : mode}
              </button>
            );
          })}
        </div>
        {generatedAvailable ? (
          <button
            type="button"
            aria-pressed={firstPersonEnabled}
            aria-label={firstPersonEnabled ? "Exit first-person view" : "Enter first-person view"}
            title={firstPersonEnabled ? "Exit first-person view" : "Enter first-person view"}
            className={`flex h-8 items-center justify-center gap-2 rounded-sm border border-[var(--color-border)] px-2 font-medium ${
              firstPersonEnabled
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-inset)]"
            }`}
            onClick={firstPersonEnabled ? exitFirstPerson : enterFirstPerson}
          >
            <Footprints className="size-4" />
            <span>{firstPersonEnabled ? "Exit Walk" : "Walk"}</span>
          </button>
        ) : null}
        {generatedAvailable ? (
          <label className="grid grid-cols-[auto_minmax(8rem,1fr)_2.5rem] items-center gap-2 px-1">
            <span className="font-medium text-[var(--color-text-primary)]">Mix</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={activeComparisonValue}
              aria-label="Blockout to splat comparison"
              className="h-2 min-w-0 accent-[var(--color-accent)]"
              onChange={(event) => updateComparisonValue(Number(event.target.value))}
            />
            <span className="text-right tabular-nums text-[var(--color-text-primary)]">{activeComparisonValue}%</span>
          </label>
        ) : null}
        {objectSplatControlsVisible ? (
          <div className="grid gap-1 px-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--color-text-primary)]">Object splat</span>
              <span className="max-w-[8rem] truncate text-[var(--color-text-muted)]">{selectedSplatRegion?.label}</span>
            </div>
            <div className="flex rounded-sm border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5">
              {OBJECT_SPLAT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={objectSplatMode === mode.value}
                  className={cn(
                    "min-w-0 flex-1 rounded-sm px-1.5 py-1 font-medium",
                    objectSplatMode === mode.value
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                  )}
                  onClick={() => setObjectSplatMode(mode.value)}
                >
                  <span className="block truncate">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {splatOpacity > 0 && splatLoadState.status !== "ready" ? (
        <SplatViewportOverlay marble={props.marble} loadState={splatLoadState} />
      ) : null}
      {splatOpacity > 0 ? (
        firstPersonEnabled ? null : (
          <SplatAlignmentControls
            alignment={splatAlignment}
            defaultAlignment={defaultSplatAlignment}
            onAlignmentChange={setSplatAlignment}
          />
        )
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
  activeShapeKind,
  selected,
  hovered,
  tool,
  onRoomChange,
  onInstancesChange,
  onShapesChange,
  onCamerasChange,
  onSelect,
  registerSceneCapture,
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
  onFirstPersonActiveChange,
  registerFirstPersonLock,
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
  onFirstPersonActiveChange: (active: boolean) => void;
  registerFirstPersonLock: (lock: () => void) => void;
  setProjector: (projector: Projector) => void;
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const pointerLockControlsRef = useRef<PointerLockControlsImpl>(null);
  const roomRef = useRef(room);
  const instancesRef = useRef(instances);
  const shapesRef = useRef(shapes);
  const camerasRef = useRef(cameras);
  const onRoomChangeRef = useRef(onRoomChange);
  const onInstancesChangeRef = useRef(onInstancesChange);
  const onShapesChangeRef = useRef(onShapesChange);
  const onCamerasChangeRef = useRef(onCamerasChange);
  const wallDragRef = useRef<WallDragSession | null>(null);
  const objectDragRef = useRef<ObjectDragSession | null>(null);
  const pointerScratchRef = useRef({
    pointer: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    floorPoint: new THREE.Vector3(),
  });
  const [hoveredWall, setHoveredWall] = useState<WallId | null>(null);
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    registerSceneCapture(() => captureLayoutPano(scene, gl, roomRef.current));
  }, [gl, registerSceneCapture, scene]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onInstancesChangeRef.current = onInstancesChange;
  }, [onInstancesChange]);

  useEffect(() => {
    onShapesChangeRef.current = onShapesChange;
  }, [onShapesChange]);

  useEffect(() => {
    onCamerasChangeRef.current = onCamerasChange;
  }, [onCamerasChange]);

  useEffect(() => {
    const element = gl.domElement;

    function setLeftOrbitEnabled(enabled: boolean) {
      const controls = orbitControlsRef.current;
      if (!controls) return;
      if (firstPersonActive) {
        controls.enabled = false;
        return;
      }
      controls.mouseButtons = viewMode === "generated" || enabled ? ALT_ORBIT_MOUSE_BUTTONS : EDITING_MOUSE_BUTTONS;
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

  useEffect(() => {
    setProjector(projectPointerToFloor);
  }, [projectPointerToFloor, setProjector]);

  useEffect(() => {
    registerFirstPersonLock(() => {
      const controls = pointerLockControlsRef.current;
      if (!controls) return;
      controls.connect(gl.domElement);
      controls.lock();
    });

    return () => {
      registerFirstPersonLock(() => undefined);
    };
  }, [gl.domElement, registerFirstPersonLock]);

  useEffect(() => {
    const element = gl.domElement;

    function valueForWallAxis(wall: WallId, point: Vec3) {
      return wall === "east" || wall === "west" ? point[0] : point[2];
    }

    function applyWallDrag() {
      const session = wallDragRef.current;
      if (!session) return;

      session.rafId = null;
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

      const nextPosition = clampToRoom(
        [
          point[0] - session.grabOffset[0],
          session.grabOffset[1],
          point[2] - session.grabOffset[2],
        ],
        roomRef.current,
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

  function updateInstance(next: FurnitureInstance) {
    onInstancesChange(instances.map((instance) => (instance.id === next.id ? next : instance)));
  }

  function updateShape(next: CustomShape) {
    onShapesChange(shapes.map((shape) => (shape.id === next.id ? next : shape)));
  }

  function updateCamera(next: SceneCamera) {
    onCamerasChange(cameras.map((camera) => (camera.id === next.id ? next : camera)));
  }

  function handleFloorPointerDown(event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    if (tool !== "add-shape" && tool !== "add-camera") {
      onSelect(null);
      return;
    }

    const point = projectPointerToFloor(event.clientX, event.clientY);
    if (!point) return;

    if (tool === "add-camera") {
      const camera = createSceneCamera([point[0], 1.45, point[2]], room);
      onCamerasChange([...cameras, camera]);
      onSelect({ type: "camera", id: camera.id });
      return;
    }

    const shape = createCustomShape(activeShapeKind, clampToRoom(point, room));
    onShapesChange([...shapes, shape]);
    onSelect({ type: "shape", id: shape.id });
  }

  function handleWallPointerDown(wall: WallId, event: ThreeEvent<PointerEvent>) {
    if (viewMode !== "blockout") return;
    if (event.button !== 0 || event.altKey || !event.nativeEvent.isPrimary) return;

    event.stopPropagation();
    const point = projectPointerToFloor(event.clientX, event.clientY);
    const projectedValue = point ? (wall === "east" || wall === "west" ? point[0] : point[2]) : 0;
    const wallAxisValue = wall === "east" || wall === "west" ? wallPosition(roomRef.current, wall)[0] : wallPosition(roomRef.current, wall)[2];
    const controls = orbitControlsRef.current;

    wallDragRef.current = {
      wall,
      pointerId: event.pointerId,
      grabOffset: projectedValue - wallAxisValue,
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
        enabled={!firstPersonActive}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        mouseButtons={viewMode === "generated" ? ALT_ORBIT_MOUSE_BUTTONS : EDITING_MOUSE_BUTTONS}
        touches={VIEWPORT_TOUCHES}
      />
      <PointerLockControls
        ref={pointerLockControlsRef}
        domElement={gl.domElement}
        enabled={firstPersonActive}
        makeDefault={firstPersonActive}
        pointerSpeed={0.82}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 1.55}
        onUnlock={() => onFirstPersonActiveChange(false)}
      />
      <FirstPersonController
        active={firstPersonActive}
        room={room}
        pointerLockControls={pointerLockControlsRef}
        onActiveChange={onFirstPersonActiveChange}
      />
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
          selected={selected}
          hovered={hoveredWall ? { type: "wall", id: hoveredWall } : hovered}
          editable={viewMode === "blockout"}
          opacity={blockoutOpacity}
          onReferenceSelect={() => onSelect(null)}
          onWallPointerDown={handleWallPointerDown}
          onWallPointerOver={setHoveredWall}
          onWallPointerOut={(wall) => setHoveredWall((current) => (current === wall ? null : current))}
          onFloorPointerDown={handleFloorPointerDown}
        />
        {instances.map((instance) => {
          const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
          return (
            <FurnitureNode
              key={instance.id}
              instance={instance}
              asset={asset}
              room={room}
              selected={viewMode === "blockout" && selected?.type === "furniture" && selected.id === instance.id}
              hovered={viewMode === "blockout" && hovered?.type === "furniture" && hovered.id === instance.id}
              tool={viewMode === "blockout" ? tool : "select"}
              opacity={blockoutOpacity}
              onSelect={() => onSelect(viewMode === "blockout" ? { type: "furniture", id: instance.id } : null)}
              onDragStart={(event) =>
                handleObjectPointerDown({ type: "furniture", id: instance.id }, instance.position, event)
              }
              onChange={updateInstance}
            />
          );
        })}
        {shapes.map((shape) => (
          <ShapeNode
            key={shape.id}
            shape={shape}
            room={room}
            selected={viewMode === "blockout" && selected?.type === "shape" && selected.id === shape.id}
            hovered={viewMode === "blockout" && hovered?.type === "shape" && hovered.id === shape.id}
            tool={viewMode === "blockout" ? tool : "select"}
            opacity={blockoutOpacity}
            onSelect={() => onSelect(viewMode === "blockout" ? { type: "shape", id: shape.id } : null)}
            onDragStart={(event) => handleObjectPointerDown({ type: "shape", id: shape.id }, shape.position, event)}
            onChange={updateShape}
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
            onChange={updateCamera}
          />
        ))}
      </group>
      {viewMode === "blockout" ? (
        <Html position={[room.minX, 0.04, room.maxZ + 0.22]} center zIndexRange={[0, 0]}>
            <span className="rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] px-2 py-1 text-[11px] text-[var(--color-accent)]">
            {(room.maxX - room.minX).toFixed(1)}m x {(room.maxZ - room.minZ).toFixed(1)}m
          </span>
        </Html>
      ) : null}
    </>
  );
}

function BlockoutReferenceLayer({
  room,
  selected,
  hovered,
  editable,
  opacity,
  onReferenceSelect,
  onWallPointerDown,
  onWallPointerOver,
  onWallPointerOut,
  onFloorPointerDown,
}: {
  room: RoomBounds;
  selected: SelectedRef;
  hovered: SelectedRef;
  editable: boolean;
  opacity: number;
  onReferenceSelect: () => void;
  onWallPointerDown: (wall: WallId, event: ThreeEvent<PointerEvent>) => void;
  onWallPointerOver: (wall: WallId) => void;
  onWallPointerOut: (wall: WallId) => void;
  onFloorPointerDown: (event: ThreeEvent<PointerEvent>) => void;
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
      <RoomFloor room={room} opacity={opacity} onPointerDown={editable ? onFloorPointerDown : undefined} />
      {(["north", "south", "east", "west"] as WallId[]).map((wall) => (
        <WallMesh
          key={wall}
          wall={wall}
          room={room}
          selected={editable && selected?.type === "wall" && selected.id === wall}
          hovered={editable && hovered?.type === "wall" && hovered.id === wall}
          opacity={opacity}
          onPointerDown={editable ? (event) => onWallPointerDown(wall, event) : undefined}
          onPointerOver={editable ? () => onWallPointerOver(wall) : undefined}
          onPointerOut={editable ? () => onWallPointerOut(wall) : undefined}
        />
      ))}
    </group>
  );
}

function fadeSceneColor(color: string, opacity: number) {
  return new THREE.Color(color).lerp(new THREE.Color(SCENE_COLORS.background), 1 - THREE.MathUtils.clamp(opacity, 0, 1));
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
    splat.quaternion.set(1, 0, 0, 0);
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
  mesh.position.set(...alignment.position);
  mesh.quaternion.copy(SPARK_SPLAT_BASE_QUATERNION).premultiply(rotationY);
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

function FirstPersonController({
  active,
  room,
  pointerLockControls,
  onActiveChange,
}: {
  active: boolean;
  room: RoomBounds;
  pointerLockControls: RefObject<PointerLockControlsImpl | null>;
  onActiveChange: (active: boolean) => void;
}) {
  const { camera } = useThree();
  const cameraRef = useRef(camera);
  const keysRef = useRef<WalkKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    fast: false,
  });
  const roomRef = useRef(room);
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const moveRef = useRef(new THREE.Vector3());

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const keys = keysRef.current;

    if (!active) {
      resetWalkKeys(keys);
      if (pointerLockControls.current?.isLocked) pointerLockControls.current.unlock();
      return;
    }

    const activeCamera = cameraRef.current;
    const eyeHeight = firstPersonEyeHeight(roomRef.current);
    const centerX = (roomRef.current.minX + roomRef.current.maxX) / 2;
    const centerZ = (roomRef.current.minZ + roomRef.current.maxZ) / 2;
    const spawnZ = THREE.MathUtils.clamp(
      roomRef.current.minZ + 0.9,
      roomRef.current.minZ + WALK_WALL_MARGIN,
      roomRef.current.maxZ - WALK_WALL_MARGIN,
    );
    activeCamera.position.set(centerX, eyeHeight, spawnZ);
    activeCamera.lookAt(centerX, eyeHeight, centerZ);
    activeCamera.updateProjectionMatrix();

    return () => {
      resetWalkKeys(keys);
    };
  }, [active, pointerLockControls]);

  useEffect(() => {
    if (!active) return;
    const keys = keysRef.current;

    function applyKey(event: KeyboardEvent, pressed: boolean) {
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
      onActiveChange(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [active, onActiveChange]);

  useFrame((_, delta) => {
    const activeCamera = cameraRef.current;
    const controls = pointerLockControls.current;
    if (!active || !controls?.isLocked) return;

    const keys = keysRef.current;
    const forwardAmount = Number(keys.forward) - Number(keys.backward);
    const rightAmount = Number(keys.right) - Number(keys.left);
    if (forwardAmount === 0 && rightAmount === 0) return;

    const forward = forwardRef.current;
    const right = rightRef.current;
    const move = moveRef.current;
    activeCamera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.setFromMatrixColumn(activeCamera.matrix, 0);
    right.y = 0;
    right.normalize();
    move.set(0, 0, 0).addScaledVector(forward, forwardAmount).addScaledVector(right, rightAmount);
    if (move.lengthSq() === 0) return;

    const distance = delta * WALK_SPEED * (keys.fast ? WALK_FAST_MULTIPLIER : 1);
    move.normalize().multiplyScalar(distance);
    activeCamera.position.add(move);
    activeCamera.position.set(
      THREE.MathUtils.clamp(
        activeCamera.position.x,
        roomRef.current.minX + WALK_WALL_MARGIN,
        roomRef.current.maxX - WALK_WALL_MARGIN,
      ),
      firstPersonEyeHeight(roomRef.current),
      THREE.MathUtils.clamp(
        activeCamera.position.z,
        roomRef.current.minZ + WALK_WALL_MARGIN,
        roomRef.current.maxZ - WALK_WALL_MARGIN,
      ),
    );
  });

  return null;
}

function resetWalkKeys(keys: WalkKeys) {
  keys.forward = false;
  keys.backward = false;
  keys.left = false;
  keys.right = false;
  keys.fast = false;
}

function firstPersonEyeHeight(room: RoomBounds) {
  return THREE.MathUtils.clamp(WALK_EYE_HEIGHT, 0.6, Math.max(0.6, room.height - 0.25));
}

function clampCameraPosition(position: Vec3, room: RoomBounds): Vec3 {
  const floorClamped = clampToRoom(position, room, 0.2);
  return [
    floorClamped[0],
    THREE.MathUtils.clamp(position[1], 0.25, Math.max(0.25, room.height - 0.15)),
    floorClamped[2],
  ];
}

function splatAlignmentFromMarble(marble: MarbleResult): SplatAlignment {
  const position = marble.payload?.metadata.capture?.camera?.position;
  if (!position) return DEFAULT_SPLAT_ALIGNMENT;
  return {
    ...DEFAULT_SPLAT_ALIGNMENT,
    position,
  };
}

function captureLayoutPano(scene: THREE.Scene, renderer: THREE.WebGLRenderer, room: RoomBounds): CaptureImage | undefined {
  try {
    const position = layoutPanoCameraPosition(room);
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
      material.needsUpdate = true;
      restores.push(() => {
        material.transparent = previousTransparent;
        material.opacity = previousOpacity;
        material.depthWrite = previousDepthWrite;
        material.needsUpdate = true;
      });
    });
  });

  return () => {
    for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]();
  };
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

function layoutPanoCameraPosition(room: RoomBounds): Vec3 {
  return [
    (room.minX + room.maxX) / 2,
    THREE.MathUtils.clamp(room.height * 0.55, 1.2, 1.7),
    (room.minZ + room.maxZ) / 2,
  ];
}

function dataUrlByteLength(dataUrl: string) {
  return Math.ceil(dataUrl.length * 0.75);
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
    <div className="absolute right-3 top-3 w-56 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] p-2 text-xs text-[var(--color-text-muted)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-medium text-[var(--color-text-primary)]">Splat Align</div>
        <button
          type="button"
          className="rounded-sm border border-[var(--color-border)] px-2 py-1 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-inset)]"
          onClick={() => onAlignmentChange(defaultAlignment)}
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
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
      </div>
    </div>
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
  opacity,
  onPointerDown,
}: {
  room: RoomBounds;
  opacity: number;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  return (
    <mesh
      receiveShadow
      position={[(room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={onPointerDown}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color={SCENE_COLORS.floor}
        roughness={0.82}
        metalness={0.05}
        transparent
        opacity={opacity}
        depthWrite={opacity >= 0.98}
      />
    </mesh>
  );
}

type WallMeshProps = {
  wall: WallId;
  room: RoomBounds;
  selected: boolean;
  hovered: boolean;
  opacity: number;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
};

function WallMesh({ wall, room, selected, hovered, opacity, onPointerDown, onPointerOver, onPointerOut }: WallMeshProps) {
  const visibleSize = wallSize(room, wall);
  const outlineSize: Vec3 = [visibleSize[0] + 0.012, visibleSize[1] + 0.012, visibleSize[2] + 0.012];
  const highlighted = selected || hovered;
  const hitSize: Vec3 =
    wall === "east" || wall === "west"
      ? [0.42, visibleSize[1], visibleSize[2] + 0.36]
      : [visibleSize[0] + 0.36, visibleSize[1], 0.42];
  const handleSize: Vec3 = wall === "east" || wall === "west" ? [0.3, 0.34, 0.62] : [0.62, 0.34, 0.3];
  const dimensions = roomDimensions(room);
  const selectedLabel =
    wall === "east" || wall === "west" ? `${dimensions.width}m wide` : `${dimensions.depth}m deep`;

  return (
    <group
      position={wallPosition(room, wall)}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={visibleSize} />
        <meshStandardMaterial
          color={selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          transparent
          opacity={(selected ? 0.88 : hovered ? 0.82 : 0.74) * opacity}
          roughness={0.62}
          emissive={highlighted ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          emissiveIntensity={selected ? 0.16 : hovered ? 0.1 : 0.05}
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
          opacity={(selected ? 0.62 : hovered ? 0.5 : 0.34) * opacity}
          depthWrite={false}
        />
      </mesh>
      {selected ? (
        <>
          <mesh position={[0, visibleSize[1] * 0.42, 0]}>
            <boxGeometry args={handleSize} />
            <meshStandardMaterial
              color={SCENE_COLORS.wallSelected}
              emissive={SCENE_COLORS.wallSelected}
              emissiveIntensity={0.2}
              roughness={0.45}
              transparent
              opacity={0.94 * opacity}
              depthWrite={opacity >= 0.98}
            />
          </mesh>
          <Html position={[0, visibleSize[1] + 0.34, 0]} center distanceFactor={10} zIndexRange={[0, 0]}>
            <span className="whitespace-nowrap rounded border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-overlay)_90%,transparent)] px-2 py-1 text-[11px] font-semibold capitalize text-[var(--color-accent-hover)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
              {wall} wall / {selectedLabel}
            </span>
          </Html>
        </>
      ) : null}
      <mesh>
        <boxGeometry args={hitSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

type FurnitureNodeProps = {
  instance: FurnitureInstance;
  asset?: FurnitureAsset;
  room: RoomBounds;
  selected: boolean;
  hovered: boolean;
  tool: ToolMode;
  opacity: number;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onChange: (instance: FurnitureInstance) => void;
};

function FurnitureNode({ instance, asset, room, selected, hovered, tool, opacity, onSelect, onDragStart, onChange }: FurnitureNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const transformMode = tool === "rotate" ? "rotate" : tool === "scale" ? "scale" : "translate";
  const modelUrl = asset?.modelUrl ? proxiedModelUrl(asset.modelUrl) : undefined;

  useFrame(() => {
    if (!groupRef.current || !selected) return;
    const object = groupRef.current;
    const nextPosition = clampToRoom([object.position.x, object.position.y, object.position.z], room);
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
            <GeneratedModel url={modelUrl} selected={selected} hovered={hovered} opacity={opacity} />
          </GeneratedModelBoundary>
        ) : (
          <PrimitiveFurniture primitive={asset?.primitive ?? "sofa"} selected={selected} hovered={hovered} opacity={opacity} />
        )}
      </Suspense>
    </group>
  );

  if (!selected || tool === "select" || tool === "add-wall" || tool === "add-furniture" || tool === "add-shape") return content;

  return (
    <TransformControls mode={transformMode} onObjectChange={pushTransform} onMouseUp={pushTransform}>
      {content}
    </TransformControls>
  );
}

type ShapeNodeProps = {
  shape: CustomShape;
  room: RoomBounds;
  selected: boolean;
  hovered: boolean;
  tool: ToolMode;
  opacity: number;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onChange: (shape: CustomShape) => void;
};

function ShapeNode({ shape, room, selected, hovered, tool, opacity, onSelect, onDragStart, onChange }: ShapeNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const transformMode = tool === "rotate" ? "rotate" : tool === "scale" ? "scale" : "translate";

  useFrame(() => {
    if (!groupRef.current || !selected) return;
    const object = groupRef.current;
    const nextPosition = clampToRoom([object.position.x, object.position.y, object.position.z], room);
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
      ...shape,
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    });
  }

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
    </group>
  );

  if (!selected || tool === "select" || tool === "add-wall" || tool === "add-furniture" || tool === "add-shape") {
    return content;
  }

  return (
    <TransformControls mode={transformMode} onObjectChange={pushTransform} onMouseUp={pushTransform}>
      {content}
    </TransformControls>
  );
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
    <TransformControls mode={transformMode} onObjectChange={pushTransform} onMouseUp={pushTransform}>
      {content}
    </TransformControls>
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

function GeneratedModel({ url, selected, hovered, opacity }: { url: string; selected: boolean; hovered: boolean; opacity: number }) {
  const gltf = useGLTF(url);
  const model = useMemo(() => gltf.scene.clone(), [gltf.scene]);

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
      <primitive object={model} />
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
