import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls, PerspectiveCamera, TransformControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onSelect: (selected: SelectedRef) => void;
  registerSceneCapture: (capture: () => string | undefined) => void;
};

type Projector = (clientX: number, clientY: number) => Vec3 | null;

export function SceneView(props: SceneViewProps) {
  const projectorRef = useRef<Projector | null>(null);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
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
      className="relative h-full min-h-0 bg-slate-950"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => props.onSelect(null)}
        className="h-full w-full"
      >
        <SceneContent {...props} setProjector={(projector) => (projectorRef.current = projector)} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
        <div className="font-medium text-slate-100">Blockout Room</div>
        <div>
          Drop Meshy assets onto the floor. Drag walls to reshape the boundary.
        </div>
      </div>
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
  setProjector,
}: SceneViewProps & { setProjector: (projector: Projector) => void }) {
  const [dragWall, setDragWall] = useState<WallId | null>(null);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const floorPoint = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    registerSceneCapture(() => gl.domElement.toDataURL("image/png"));
  }, [gl, registerSceneCapture]);

  useEffect(() => {
    setProjector((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(floorPlane, floorPoint);
      if (!hit) return null;
      return [floorPoint.x, 0.25, floorPoint.z];
    });
  }, [camera, floorPlane, floorPoint, gl.domElement, pointer, raycaster, setProjector]);

  function updateInstance(next: FurnitureInstance) {
    onInstancesChange(instances.map((instance) => (instance.id === next.id ? next : instance)));
  }

  function handleWallPointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragWall) return;
    event.stopPropagation();
    const point = event.point;
    const value = dragWall === "east" || dragWall === "west" ? point.x : point.z;
    onRoomChange(moveWall(room, dragWall, value));
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[6.5, 5.2, 7]} fov={44} />
      <color attach="background" args={["#05070b"]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[4, 7, 5]} intensity={1.4} shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 3, -3]} intensity={2.2} color="#14b8a6" />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} />
      <Grid
        args={[24, 24]}
        sectionSize={1}
        cellSize={0.5}
        position={[0, -0.01, 0]}
        cellColor="#1e293b"
        sectionColor="#334155"
        fadeDistance={24}
      />
      <RoomFloor room={room} />
      {(["north", "south", "east", "west"] as WallId[]).map((wall) => (
        <WallMesh
          key={wall}
          wall={wall}
          room={room}
          selected={selected?.type === "wall" && selected.id === wall}
          onPointerDown={(event) => {
            event.stopPropagation();
            const target = event.target as Element | null;
            target?.setPointerCapture(event.pointerId);
            setDragWall(wall);
            onSelect({ type: "wall", id: wall });
          }}
          onPointerMove={handleWallPointerMove}
          onPointerUp={(event) => {
            event.stopPropagation();
            const target = event.target as Element | null;
            target?.releasePointerCapture(event.pointerId);
            setDragWall(null);
          }}
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
      <Html position={[room.minX, 0.04, room.maxZ + 0.22]} center>
        <span className="rounded bg-slate-950/85 px-2 py-1 text-[11px] text-teal-200">
          {(room.maxX - room.minX).toFixed(1)}m x {(room.maxZ - room.minZ).toFixed(1)}m
        </span>
      </Html>
    </>
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
      <meshStandardMaterial color="#111827" roughness={0.82} metalness={0.05} />
    </mesh>
  );
}

type WallMeshProps = {
  wall: WallId;
  room: RoomBounds;
  selected: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void;
};

function WallMesh({ wall, room, selected, onPointerDown, onPointerMove, onPointerUp }: WallMeshProps) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={wallPosition(room, wall)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <boxGeometry args={wallSize(room, wall)} />
      <meshStandardMaterial
        color={selected ? "#5eead4" : "#475569"}
        transparent
        opacity={selected ? 0.72 : 0.44}
        roughness={0.7}
      />
    </mesh>
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
        {asset?.modelUrl ? (
          <GeneratedModel url={asset.modelUrl} selected={selected} />
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

function GeneratedModel({ url, selected }: { url: string; selected: boolean }) {
  const gltf = useGLTF(url);
  return (
    <group>
      <primitive object={gltf.scene.clone()} />
      {selected ? <SelectionRing /> : null}
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
          <meshStandardMaterial color="#94a3b8" roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 16]} />
          <meshStandardMaterial color="#334155" />
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
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh castShadow position={[0, 0.62, 0.24]}>
          <boxGeometry args={[0.62, 0.72, 0.12]} />
          <meshStandardMaterial color="#475569" />
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
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh castShadow position={[0, 1.18, 0]}>
          <coneGeometry args={[0.28, 0.38, 28]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.35} />
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
          <meshStandardMaterial color="#7f1d1d" />
        </mesh>
        <mesh castShadow position={[0, 0.58, 0]}>
          <sphereGeometry args={[0.38, 20, 20]} />
          <meshStandardMaterial color="#16a34a" roughness={0.8} />
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
          <meshStandardMaterial color="#64748b" roughness={0.65} />
        </mesh>
        {selected ? <SelectionRing /> : null}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[1.45, 0.45, 0.72]} />
        <meshStandardMaterial color="#64748b" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.74, 0.27]}>
        <boxGeometry args={[1.45, 0.68, 0.16]} />
        <meshStandardMaterial color="#475569" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[-0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color="#334155" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0.74, 0.56, 0]}>
        <boxGeometry args={[0.12, 0.45, 0.72]} />
        <meshStandardMaterial color="#334155" roughness={0.78} />
      </mesh>
      {selected ? <SelectionRing /> : null}
    </group>
  );
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
      <ringGeometry args={[0.85, 0.9, 48]} />
      <meshBasicMaterial color="#2dd4bf" transparent opacity={0.9} />
    </mesh>
  );
}
