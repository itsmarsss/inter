import { SplatMesh } from "@sparkjsdev/spark";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls, PerspectiveCamera, TransformControls, useGLTF } from "@react-three/drei";
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  clampToRoom,
  createFurnitureInstance,
  moveWall,
  wallPosition,
  wallSize,
} from "../state/editor";
import type {
  FurnitureAsset,
  FurnitureInstance,
  MarbleResult,
  RoomBounds,
  SelectedRef,
  ToolMode,
  Vec3,
  WallId,
} from "../state/types";

type SceneViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  instances: FurnitureInstance[];
  selected: SelectedRef;
  tool: ToolMode;
  marble: MarbleResult;
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onSelect: (selected: SelectedRef) => void;
  registerSceneCapture: (capture: () => string | undefined) => void;
};

type Projector = (clientX: number, clientY: number) => Vec3 | null;
type ViewMode = "blockout" | "generated";
type SplatLoadState = { status: "idle" | "loading" | "ready" | "error"; message?: string };

type WallDragSession = {
  wall: WallId;
  pointerId: number;
  grabOffset: number;
  latestClientX: number;
  latestClientY: number;
  rafId: number | null;
  previousControlsEnabled: boolean;
};

const SCENE_COLORS = {
  background: "#090806",
  floor: "#14110E",
  wall: "#564B41",
  wallSelected: "#B8653F",
  gridCell: "#2A251F",
  gridSection: "#3A332B",
  accent: "#CA7951",
  text: "#F4EEE6",
  warmLight: "#D6A24A",
  tableTop: "#8A7B6E",
  darkWood: "#4A382C",
  upholstery: "#75695E",
  clayDark: "#6D3B27",
  leaf: "#66724E",
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

export function SceneView(props: SceneViewProps) {
  const projectorRef = useRef<Projector | null>(null);
  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(null);
  const [manualViewSpzUrl, setManualViewSpzUrl] = useState<string | undefined>();
  const [splatLoadState, setSplatLoadState] = useState<SplatLoadState>({ status: "idle" });
  const generatedAvailable = props.marble.status === "complete" && Boolean(props.marble.spzUrl);
  const activeViewMode: ViewMode = generatedAvailable
    ? manualViewMode && manualViewSpzUrl === props.marble.spzUrl
      ? manualViewMode
      : "generated"
    : "blockout";

  function selectViewMode(nextViewMode: ViewMode) {
    setManualViewMode(nextViewMode);
    setManualViewSpzUrl(props.marble.spzUrl);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (activeViewMode !== "blockout") return;
    const assetId = event.dataTransfer.getData("application/x-furniture-asset");
    const asset = props.assets.find((item) => item.id === assetId);
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
          if (activeViewMode === "blockout") props.onSelect(null);
        }}
        className="h-full w-full"
      >
        <SceneContent
          {...props}
          viewMode={activeViewMode}
          onSplatLoadStateChange={setSplatLoadState}
          setProjector={(projector) => (projectorRef.current = projector)}
        />
      </Canvas>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_86%,transparent)] px-2 py-1.5 text-xs text-[var(--color-text-muted)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
        <div className="px-1 font-medium text-[var(--color-text-primary)]">
          {activeViewMode === "generated" ? "Generated Room" : "Blockout Room"}
        </div>
        {generatedAvailable ? (
          <div className="flex rounded-sm border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5">
            <button
              type="button"
              aria-pressed={activeViewMode === "blockout"}
              className={`rounded-sm px-2 py-1 font-medium ${
                activeViewMode === "blockout"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
              onClick={() => selectViewMode("blockout")}
            >
              Blockout
            </button>
            <button
              type="button"
              aria-pressed={activeViewMode === "generated"}
              className={`rounded-sm px-2 py-1 font-medium ${
                activeViewMode === "generated"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
              onClick={() => selectViewMode("generated")}
            >
              Generated
            </button>
          </div>
        ) : null}
      </div>
      {activeViewMode === "generated" && splatLoadState.status !== "ready" ? (
        <SplatViewportOverlay marble={props.marble} loadState={splatLoadState} />
      ) : null}
    </div>
  );
}

function SceneContent({
  room,
  assets,
  instances,
  selected,
  tool,
  onRoomChange,
  onInstancesChange,
  onSelect,
  registerSceneCapture,
  marble,
  viewMode,
  onSplatLoadStateChange,
  setProjector,
}: SceneViewProps & {
  viewMode: ViewMode;
  onSplatLoadStateChange: (state: SplatLoadState) => void;
  setProjector: (projector: Projector) => void;
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const roomRef = useRef(room);
  const onRoomChangeRef = useRef(onRoomChange);
  const wallDragRef = useRef<WallDragSession | null>(null);
  const { camera, gl } = useThree();

  useEffect(() => {
    registerSceneCapture(() => gl.domElement.toDataURL("image/png"));
  }, [gl, registerSceneCapture]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    const element = gl.domElement;

    function setLeftOrbitEnabled(enabled: boolean) {
      const controls = orbitControlsRef.current;
      if (!controls) return;
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
  }, [gl.domElement, viewMode]);

  const projectPointerToFloor = useCallback(
    (clientX: number, clientY: number): Vec3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      const floorPoint = new THREE.Vector3();
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
      onRoomChangeRef.current(moveWall(roomRef.current, session.wall, value));
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

  function updateInstance(next: FurnitureInstance) {
    onInstancesChange(instances.map((instance) => (instance.id === next.id ? next : instance)));
  }

  function handleWallPointerDown(wall: WallId, event: ThreeEvent<PointerEvent>) {
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

  return (
    <>
      <PerspectiveCamera makeDefault position={[6.5, 5.2, 7]} fov={44} />
      <color attach="background" args={[SCENE_COLORS.background]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[4, 7, 5]} intensity={1.4} shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 3, -3]} intensity={2.2} color={SCENE_COLORS.warmLight} />
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        mouseButtons={viewMode === "generated" ? ALT_ORBIT_MOUSE_BUTTONS : EDITING_MOUSE_BUTTONS}
        touches={VIEWPORT_TOUCHES}
      />
      {viewMode === "generated" && marble.spzUrl ? (
        <MarbleSplatScene
          url={proxiedMarbleSpzUrl(marble.spzUrl)}
          controlsRef={orbitControlsRef}
          onLoadStateChange={onSplatLoadStateChange}
        />
      ) : (
        <>
          <Grid
            args={[24, 24]}
            sectionSize={1}
            cellSize={0.5}
            position={[0, -0.01, 0]}
            cellColor={SCENE_COLORS.gridCell}
            sectionColor={SCENE_COLORS.gridSection}
            fadeDistance={24}
          />
          <RoomFloor room={room} />
          {(["north", "south", "east", "west"] as WallId[]).map((wall) => (
            <WallMesh
              key={wall}
              wall={wall}
              room={room}
              selected={selected?.type === "wall" && selected.id === wall}
              onPointerDown={(event) => handleWallPointerDown(wall, event)}
            />
          ))}
          {instances.map((instance) => {
            const asset = assets.find((item) => item.id === instance.assetId);
            return (
              <FurnitureNode
                key={instance.id}
                instance={instance}
                asset={asset}
                room={room}
                selected={selected?.type === "furniture" && selected.id === instance.id}
                tool={tool}
                onSelect={() => onSelect({ type: "furniture", id: instance.id })}
                onChange={updateInstance}
              />
            );
          })}
          <Html position={[room.minX, 0.04, room.maxZ + 0.22]} center zIndexRange={[0, 0]}>
            <span className="rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] px-2 py-1 text-[11px] text-[var(--color-accent-hover)]">
              {(room.maxX - room.minX).toFixed(1)}m x {(room.maxZ - room.minZ).toFixed(1)}m
            </span>
          </Html>
        </>
      )}
    </>
  );
}

function MarbleSplatScene({
  url,
  controlsRef,
  onLoadStateChange,
}: {
  url: string;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  onLoadStateChange: (state: SplatLoadState) => void;
}) {
  const { scene, camera } = useThree();

  useEffect(() => {
    let disposed = false;
    onLoadStateChange({ status: "loading" });

    const splat = new SplatMesh({ url });
    splat.quaternion.set(1, 0, 0, 0);
    scene.add(splat);

    splat.initialized
      .then((mesh) => {
        if (disposed) return;
        frameSplat(mesh, camera, controlsRef.current);
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
      splat.dispose();
    };
  }, [camera, controlsRef, onLoadStateChange, scene, url]);

  return null;
}

function frameSplat(mesh: SplatMesh, camera: THREE.Camera, controls?: OrbitControlsImpl | null) {
  const box = mesh.getBoundingBox(true);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  controls?.target.copy(center);
  camera.position.set(center.x + radius * 0.85, center.y + radius * 0.55, center.z + radius * 0.85);
  camera.lookAt(center);

  if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
    camera.near = Math.max(0.01, radius / 1000);
    camera.far = Math.max(1000, radius * 20);
    camera.updateProjectionMatrix();
  }

  controls?.update();
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

function RoomFloor({ room }: { room: RoomBounds }) {
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  return (
    <mesh
      receiveShadow
      position={[(room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={SCENE_COLORS.floor} roughness={0.82} metalness={0.05} />
    </mesh>
  );
}

type WallMeshProps = {
  wall: WallId;
  room: RoomBounds;
  selected: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

function WallMesh({ wall, room, selected, onPointerDown }: WallMeshProps) {
  const visibleSize = wallSize(room, wall);
  const hitSize: Vec3 =
    wall === "east" || wall === "west"
      ? [0.42, visibleSize[1], visibleSize[2] + 0.36]
      : [visibleSize[0] + 0.36, visibleSize[1], 0.42];

  return (
    <group position={wallPosition(room, wall)} onPointerDown={onPointerDown}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={visibleSize} />
        <meshStandardMaterial
          color={selected ? SCENE_COLORS.wallSelected : SCENE_COLORS.wall}
          transparent
          opacity={selected ? 0.72 : 0.44}
          roughness={0.7}
        />
      </mesh>
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
  tool: ToolMode;
  onSelect: () => void;
  onChange: (instance: FurnitureInstance) => void;
};

function FurnitureNode({ instance, asset, room, selected, tool, onSelect, onChange }: FurnitureNodeProps) {
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
      }}
      onPointerUp={pushTransform}
    >
      <Suspense fallback={<PrimitiveFurniture primitive={asset?.primitive ?? "sofa"} selected={selected} />}>
        {modelUrl && asset ? (
          <GeneratedModelBoundary
            resetKey={modelUrl}
            fallback={<GeneratedModelFallback primitive={asset.primitive} selected={selected} />}
          >
            <GeneratedModel url={modelUrl} selected={selected} />
          </GeneratedModelBoundary>
        ) : (
          <PrimitiveFurniture primitive={asset?.primitive ?? "sofa"} selected={selected} />
        )}
      </Suspense>
    </group>
  );

  if (!selected || tool === "select" || tool === "add-wall" || tool === "add-furniture") return content;

  return (
    <TransformControls mode={transformMode} onObjectChange={pushTransform} onMouseUp={pushTransform}>
      {content}
    </TransformControls>
  );
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

function GeneratedModel({ url, selected }: { url: string; selected: boolean }) {
  const gltf = useGLTF(url);
  return (
    <group>
      <primitive object={gltf.scene.clone()} />
      {selected ? <SelectionRing /> : null}
    </group>
  );
}

function GeneratedModelFallback({
  primitive,
  selected,
}: {
  primitive: FurnitureAsset["primitive"];
  selected: boolean;
}) {
  return (
    <group>
      <PrimitiveFurniture primitive={primitive} selected={selected} />
      {selected ? (
        <Html position={[0, 1.2, 0]} center zIndexRange={[1, 0]}>
          <span className="whitespace-nowrap rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_90%,transparent)] px-2 py-1 text-[11px] font-medium text-[var(--color-accent-hover)] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)]">
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
}: {
  primitive: FurnitureAsset["primitive"];
  selected: boolean;
}) {
  if (primitive === "table") {
    return (
      <group>
        <mesh castShadow position={[0, 0.23, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.12, 36]} />
          <meshStandardMaterial color={SCENE_COLORS.tableTop} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 16]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  if (primitive === "chair") {
    return (
      <group>
        <mesh castShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[0.62, 0.14, 0.58]} />
          <meshStandardMaterial color={SCENE_COLORS.upholstery} />
        </mesh>
        <mesh castShadow position={[0, 0.62, 0.24]}>
          <boxGeometry args={[0.62, 0.72, 0.12]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  if (primitive === "lamp") {
    return (
      <group>
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 12]} />
          <meshStandardMaterial color={SCENE_COLORS.darkWood} />
        </mesh>
        <mesh castShadow position={[0, 1.18, 0]}>
          <coneGeometry args={[0.28, 0.38, 28]} />
          <meshStandardMaterial color={SCENE_COLORS.warmLight} emissive={SCENE_COLORS.warmLight} emissiveIntensity={0.28} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  if (primitive === "plant") {
    return (
      <group>
        <mesh castShadow position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 0.36, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.clayDark} />
        </mesh>
        <mesh castShadow position={[0, 0.58, 0]}>
          <sphereGeometry args={[0.38, 20, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.leaf} roughness={0.8} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  if (primitive === "cabinet") {
    return (
      <group>
        <mesh castShadow position={[0, 0.48, 0]}>
          <boxGeometry args={[1.3, 0.95, 0.42]} />
          <meshStandardMaterial color={SCENE_COLORS.upholstery} roughness={0.65} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[1.45, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.upholstery} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.74, 0.27]}>
        <boxGeometry args={[1.45, 0.68, 0.16]} />
        <meshStandardMaterial color={SCENE_COLORS.wall} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[-0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.darkWood} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color={SCENE_COLORS.darkWood} roughness={0.78} />
      </mesh>
      {selected ? <SelectionRing /> : null}
    </group>
  );
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
      <ringGeometry args={[0.85, 0.9, 48]} />
      <meshBasicMaterial color={SCENE_COLORS.accent} transparent opacity={0.9} />
    </mesh>
  );
}
