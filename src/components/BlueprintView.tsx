import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  RoomBounds,
  SelectedRef,
  ToolMode,
  Vec3,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "../state/types";
import {
  buildFloorPolygon,
  clampToFloor,
  clampWallOffset,
  findSegmentAtFraction,
  offsetToFraction,
  resizeRoomFromWall,
  roomDimensions,
} from "../state/editor";

type BlueprintViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  doors?: Door[];
  windows?: WindowOpening[];
  wallSegments?: WallSegmentation;
  selected: SelectedRef;
  tool: ToolMode;
  onSelect: (selected: SelectedRef) => void;
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onShapesChange: (shapes: CustomShape[]) => void;
  onDoorsChange?: (doors: Door[]) => void;
  onWindowsChange?: (windows: WindowOpening[]) => void;
  registerBlueprintCapture?: (capture: () => string | undefined) => void;
  /**
   * When false, the blueprint becomes a non-interactive preview: pointer
   * handlers are no-ops and pointer events on the SVG are disabled. Used by
   * the always-on minimap so the user can't accidentally drag walls in the
   * tiny preview.
   */
  interactive?: boolean;
};

type OpeningDragSession = {
  kind: "door" | "window";
  id: string;
  wall: WallId;
  startOffset: number;
  grabOffset: number;
  width: number;
};

type BlueprintObjectTransform = {
  target: Extract<NonNullable<SelectedRef>, { type: "furniture" | "shape" }>;
  mode: "move" | "rotate" | "scale";
  startPointer: { x: number; z: number };
  startPosition: Vec3;
  startRotationY: number;
  startScale: Vec3;
  grabOffsetX: number;
  grabOffsetZ: number;
  y: number;
  baseWidth: number;
  baseDepth: number;
};

type BlueprintObjectMetrics = {
  position: Vec3;
  rotationY: number;
  scale: Vec3;
  width: number;
  depth: number;
};

export function BlueprintView({
  room,
  assets,
  assetById,
  instances,
  shapes,
  doors = [],
  windows = [],
  wallSegments,
  selected,
  tool,
  onSelect,
  onRoomChange,
  onInstancesChange,
  onShapesChange,
  onDoorsChange,
  onWindowsChange,
  registerBlueprintCapture,
  interactive = true,
}: BlueprintViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingWall, setDraggingWall] = useState<WallId | null>(null);
  const [objectTransform, setObjectTransform] = useState<BlueprintObjectTransform | null>(null);
  const [openingDrag, setOpeningDrag] = useState<OpeningDragSession | null>(null);
  const view = useMemo(() => {
    const padding = 1.2;
    return {
      x: room.minX - padding,
      y: room.minZ - padding,
      width: room.maxX - room.minX + padding * 2,
      height: room.maxZ - room.minZ + padding * 2,
    };
  }, [room]);
  const dimensions = roomDimensions(room);
  const floorPolygonPoints = useMemo(() => {
    const segmentation =
      wallSegments ?? {
        north: [{ id: "north-default", start: 0, end: 1, displacement: 0 }],
        south: [{ id: "south-default", start: 0, end: 1, displacement: 0 }],
        east: [{ id: "east-default", start: 0, end: 1, displacement: 0 }],
        west: [{ id: "west-default", start: 0, end: 1, displacement: 0 }],
      };
    const polygon = buildFloorPolygon(room, segmentation);
    if (polygon.length < 3) return null;
    return polygon.map((point) => `${point.x},${point.z}`).join(" ");
  }, [room, wallSegments]);

  useEffect(() => {
    if (!registerBlueprintCapture) return;
    registerBlueprintCapture(() => {
      if (!svgRef.current) return undefined;
      const source = new XMLSerializer().serializeToString(svgRef.current);
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(source)))}`;
    });
  }, [registerBlueprintCapture]);

  const pointFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }, []);

  const wallValueFromPoint = useCallback((wall: WallId, clientX: number, clientY: number) => {
    const point = pointFromPointer(clientX, clientY);
    if (!point) return null;

    return wall === "east" || wall === "west" ? point.x : point.y;
  }, [pointFromPointer]);

  function beginWallDrag(wall: WallId, event: ReactPointerEvent<SVGElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingWall(wall);
    onSelect({ type: "wall", id: wall });
    svgRef.current?.setPointerCapture(event.pointerId);

    const value = wallValueFromPoint(wall, event.clientX, event.clientY);
    if (value !== null) onRoomChange(resizeRoomFromWall(room, wall, value));
  }

  function updateWallDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingWall) return;

    const value = wallValueFromPoint(draggingWall, event.clientX, event.clientY);
    if (value !== null) onRoomChange(resizeRoomFromWall(room, draggingWall, value));
  }

  function endWallDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingWall) return;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }

    setDraggingWall(null);
  }

  function beginObjectDrag(
    target: Extract<NonNullable<SelectedRef>, { type: "furniture" | "shape" }>,
    metrics: BlueprintObjectMetrics,
    event: ReactPointerEvent<SVGGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (tool !== "select" && tool !== "move") {
      onSelect(target);
      return;
    }

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    onSelect(target);
    setObjectTransform({
      target,
      mode: "move",
      startPointer: { x: point.x, z: point.y },
      startPosition: metrics.position,
      startRotationY: metrics.rotationY,
      startScale: metrics.scale,
      grabOffsetX: point.x - metrics.position[0],
      grabOffsetZ: point.y - metrics.position[2],
      y: metrics.position[1],
      baseWidth: metrics.width,
      baseDepth: metrics.depth,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function beginObjectHandleDrag(
    mode: "rotate" | "scale",
    target: Extract<NonNullable<SelectedRef>, { type: "furniture" | "shape" }>,
    metrics: BlueprintObjectMetrics,
    event: ReactPointerEvent<SVGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    onSelect(target);
    setObjectTransform({
      target,
      mode,
      startPointer: { x: point.x, z: point.y },
      startPosition: metrics.position,
      startRotationY: metrics.rotationY,
      startScale: metrics.scale,
      grabOffsetX: 0,
      grabOffsetZ: 0,
      y: metrics.position[1],
      baseWidth: metrics.width,
      baseDepth: metrics.depth,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function updateObjectDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!objectTransform) return;

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    const next = transformObjectFromPointer(objectTransform, point.x, point.y, room, wallSegments);

    if (objectTransform.target.type === "furniture") {
      onInstancesChange(
        instances.map((instance) =>
          instance.id === objectTransform.target.id
            ? { ...instance, position: next.position, rotation: next.rotation, scale: next.scale }
            : instance,
        ),
      );
      return;
    }

    onShapesChange(
      shapes.map((shape) =>
        shape.id === objectTransform.target.id
          ? { ...shape, position: next.position, rotation: next.rotation, scale: next.scale }
          : shape,
      ),
    );
  }

  function endObjectDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!objectTransform) return;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }

    setObjectTransform(null);
  }

  function beginOpeningDrag(
    kind: "door" | "window",
    target: Door | WindowOpening,
    event: ReactPointerEvent<SVGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect({ type: kind, id: target.id });
    if (tool !== "select" && tool !== "move") return;

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;
    const pointerAlong =
      target.wall === "north" || target.wall === "south" ? point.x - cx : point.y - cz;

    setOpeningDrag({
      kind,
      id: target.id,
      wall: target.wall,
      startOffset: target.offset,
      grabOffset: pointerAlong - target.offset,
      width: target.width,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function updateOpeningDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!openingDrag) return;
    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;
    const pointerAlong =
      openingDrag.wall === "north" || openingDrag.wall === "south" ? point.x - cx : point.y - cz;
    const nextOffset = clampWallOffset(
      room,
      openingDrag.wall,
      pointerAlong - openingDrag.grabOffset,
      openingDrag.width,
    );

    if (openingDrag.kind === "door" && onDoorsChange) {
      onDoorsChange(
        doors.map((door) => (door.id === openingDrag.id ? { ...door, offset: nextOffset } : door)),
      );
    } else if (openingDrag.kind === "window" && onWindowsChange) {
      onWindowsChange(
        windows.map((win) =>
          win.id === openingDrag.id ? { ...win, offset: nextOffset } : win,
        ),
      );
    }
  }

  function endOpeningDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!openingDrag) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // already released
    }
    setOpeningDrag(null);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (draggingWall) {
      updateWallDrag(event);
      return;
    }
    if (openingDrag) {
      updateOpeningDrag(event);
      return;
    }

    updateObjectDrag(event);
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    endWallDrag(event);
    endObjectDrag(event);
    endOpeningDrag(event);
  }

  return (
    <div
      className={`h-full bg-[var(--color-background)] ${interactive ? "p-2" : "p-0"}`}
      style={interactive ? undefined : { pointerEvents: "none" }}
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label="Live room blueprint"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className={`h-full w-full bg-[#ECF1F2] ${interactive ? "rounded-md border border-[var(--color-border)]" : ""}`}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerEnd : undefined}
        onPointerCancel={interactive ? handlePointerEnd : undefined}
        onPointerDown={interactive ? () => onSelect(null) : undefined}
      >
        <defs>
          <pattern id="bp-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#B9C4C8" strokeWidth="0.018" />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#bp-grid)" />
        {floorPolygonPoints ? (
          <polygon
            points={floorPolygonPoints}
            fill="#FFF9EE"
            stroke="#14232B"
            strokeWidth="0.18"
            strokeLinejoin="miter"
          />
        ) : (
          <rect
            x={room.minX}
            y={room.minZ}
            width={room.maxX - room.minX}
            height={room.maxZ - room.minZ}
            fill="#FFF9EE"
            stroke="#14232B"
            strokeWidth="0.18"
          />
        )}
        <BlueprintWallHandles
          room={room}
          selected={selected}
          onPointerDown={beginWallDrag}
        />
        <line
          x1={room.minX}
          x2={room.maxX}
          y1={room.minZ - 0.45}
          y2={room.minZ - 0.45}
          stroke="#D85E2E"
          strokeWidth="0.045"
        />
        <line
          x1={room.maxX + 0.45}
          x2={room.maxX + 0.45}
          y1={room.minZ}
          y2={room.maxZ}
          stroke="#D85E2E"
          strokeWidth="0.045"
        />
        <text x={(room.minX + room.maxX) / 2} y={room.minZ - 0.6} textAnchor="middle" fontSize="0.28" fill="#B63F1C">
          {dimensions.width}m
        </text>
        <text
          x={room.maxX + 0.62}
          y={(room.minZ + room.maxZ) / 2}
          textAnchor="middle"
          fontSize="0.28"
          fill="#B63F1C"
          transform={`rotate(90 ${room.maxX + 0.62} ${(room.minZ + room.maxZ) / 2})`}
        >
          {dimensions.depth}m
        </text>
        <BlueprintWallSegments
          room={room}
          wallSegments={wallSegments}
          selected={selected}
          onSelect={onSelect}
        />
        {doors.map((door) => {
          const isSelected = selected?.type === "door" && selected.id === door.id;
          const seg = openingSegment(door, room, wallSegments?.[door.wall]);
          const arc = doorArcPath(door, room, seg);
          return (
            <g key={door.id}>
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="#FFF9EE"
                strokeWidth="0.22"
                strokeLinecap="butt"
              />
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={isSelected ? "#3BA7FF" : "#9C7A52"}
                strokeWidth="0.08"
                strokeLinecap="butt"
                onPointerDown={(event) => beginOpeningDrag("door", door, event)}
                style={{ cursor: "grab" }}
              />
              <path
                d={arc}
                fill="none"
                stroke={isSelected ? "#3BA7FF" : "#BC3E35"}
                strokeWidth="0.045"
                pointerEvents="none"
              />
            </g>
          );
        })}
        {windows.map((win) => {
          const isSelected = selected?.type === "window" && selected.id === win.id;
          const seg = openingSegment(win, room, wallSegments?.[win.wall]);
          return (
            <g key={win.id}>
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="#FFF9EE"
                strokeWidth="0.22"
                strokeLinecap="butt"
              />
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={isSelected ? "#3BA7FF" : "#7DB7D9"}
                strokeWidth="0.1"
                strokeLinecap="butt"
                onPointerDown={(event) => beginOpeningDrag("window", win, event)}
                style={{ cursor: "grab" }}
              />
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={isSelected ? "#3BA7FF" : "#2A2F36"}
                strokeWidth="0.025"
                strokeDasharray="0.08 0.06"
                pointerEvents="none"
              />
            </g>
          );
        })}
        {instances.map((instance) => {
          const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
          const footprint = footprintFor(asset?.primitive);
          const metrics = objectMetrics(instance.position, instance.rotation[1], instance.scale, footprint.width, footprint.depth);
          const isSelected = selected?.type === "furniture" && selected.id === instance.id;
          return (
            <g
              key={instance.id}
              transform={`translate(${instance.position[0]} ${instance.position[2]}) rotate(${(instance.rotation[1] * 180) / Math.PI}) scale(${instance.scale[0]} ${instance.scale[2]})`}
              onPointerDown={(event) =>
                beginObjectDrag({ type: "furniture", id: instance.id }, metrics, event)
              }
              className={isSelected ? "cursor-move" : "cursor-pointer"}
            >
              <rect
                x={-footprint.width / 2}
                y={-footprint.depth / 2}
                width={footprint.width}
                height={footprint.depth}
                rx="0.05"
                fill={isSelected ? "#D85E2E" : "#7B8A8F"}
                stroke="#14232B"
                strokeWidth="0.045"
              />
              <text y="0.05" textAnchor="middle" fontSize="0.18" fill={isSelected ? "#FFF9EE" : "#071014"}>
                {asset?.name.split(" ")[0] ?? instance.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
        {shapes.map((shape) => {
          const isSelected = selected?.type === "shape" && selected.id === shape.id;
          const metrics = objectMetrics(shape.position, shape.rotation[1], shape.scale, 1, 1);
          return (
            <g
              key={shape.id}
              transform={`translate(${shape.position[0]} ${shape.position[2]}) rotate(${(shape.rotation[1] * 180) / Math.PI}) scale(${shape.scale[0]} ${shape.scale[2]})`}
              onPointerDown={(event) => beginObjectDrag({ type: "shape", id: shape.id }, metrics, event)}
              className={isSelected ? "cursor-move" : "cursor-pointer"}
            >
              {shape.kind === "sphere" || shape.kind === "cylinder" || shape.kind === "cone" ? (
                <circle
                  r="0.5"
                  fill={isSelected ? "#D85E2E" : shape.color}
                  stroke="#14232B"
                  strokeWidth="0.045"
                  opacity="0.92"
                />
              ) : (
                <rect
                  x="-0.5"
                  y="-0.5"
                  width="1"
                  height="1"
                  rx="0.04"
                  fill={isSelected ? "#D85E2E" : shape.color}
                  stroke="#14232B"
                  strokeWidth="0.045"
                  opacity="0.92"
                />
              )}
              <text y="0.05" textAnchor="middle" fontSize="0.18" fill={isSelected ? "#FFF9EE" : "#071014"}>
                {shape.kind}
              </text>
            </g>
          );
        })}
        <BlueprintObjectHandles
          selected={selected}
          instances={instances}
          shapes={shapes}
          assets={assets}
          assetById={assetById}
          tool={tool}
          onPointerDown={beginObjectHandleDrag}
        />
      </svg>
    </div>
  );
}

function transformObjectFromPointer(
  session: BlueprintObjectTransform,
  pointerX: number,
  pointerZ: number,
  room: RoomBounds,
  wallSegments?: WallSegmentation,
) {
  if (session.mode === "move") {
    return {
      position: clampToFloor([pointerX - session.grabOffsetX, session.y, pointerZ - session.grabOffsetZ], room, wallSegments),
      rotation: [0, session.startRotationY, 0] as Vec3,
      scale: session.startScale,
    };
  }

  if (session.mode === "rotate") {
    const startAngle = Math.atan2(
      session.startPointer.z - session.startPosition[2],
      session.startPointer.x - session.startPosition[0],
    );
    const currentAngle = Math.atan2(pointerZ - session.startPosition[2], pointerX - session.startPosition[0]);
    return {
      position: session.startPosition,
      rotation: [0, session.startRotationY + currentAngle - startAngle, 0] as Vec3,
      scale: session.startScale,
    };
  }

  const startDistance = objectScaleDistance(
    session.startPointer.x,
    session.startPointer.z,
    session.startPosition,
    session.startRotationY,
    session.baseWidth,
    session.baseDepth,
  );
  const currentDistance = objectScaleDistance(
    pointerX,
    pointerZ,
    session.startPosition,
    session.startRotationY,
    session.baseWidth,
    session.baseDepth,
  );
  const factor = Math.min(5, Math.max(0.2, currentDistance / Math.max(0.001, startDistance)));

  return {
    position: session.startPosition,
    rotation: [0, session.startRotationY, 0] as Vec3,
    scale: [
      Math.max(0.05, session.startScale[0] * factor),
      Math.max(0.05, session.startScale[1] * factor),
      Math.max(0.05, session.startScale[2] * factor),
    ] as Vec3,
  };
}

function objectScaleDistance(
  pointerX: number,
  pointerZ: number,
  position: Vec3,
  rotationY: number,
  baseWidth: number,
  baseDepth: number,
) {
  const dx = pointerX - position[0];
  const dz = pointerZ - position[2];
  const cos = Math.cos(-rotationY);
  const sin = Math.sin(-rotationY);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return Math.max(Math.abs(localX) / Math.max(0.001, baseWidth / 2), Math.abs(localZ) / Math.max(0.001, baseDepth / 2));
}

function objectMetrics(position: Vec3, rotationY: number, scale: Vec3, width: number, depth: number): BlueprintObjectMetrics {
  return { position, rotationY, scale, width, depth };
}

function BlueprintObjectHandles({
  selected,
  instances,
  shapes,
  assets,
  assetById,
  tool,
  onPointerDown,
}: {
  selected: SelectedRef;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  tool: ToolMode;
  onPointerDown: (
    mode: "rotate" | "scale",
    target: Extract<NonNullable<SelectedRef>, { type: "furniture" | "shape" }>,
    metrics: BlueprintObjectMetrics,
    event: ReactPointerEvent<SVGElement>,
  ) => void;
}) {
  if (!selected || (selected.type !== "furniture" && selected.type !== "shape")) return null;

  const target = selected;
  const metrics = selected.type === "furniture"
    ? furnitureHandleMetrics(selected.id, instances, assets, assetById)
    : shapeHandleMetrics(selected.id, shapes);
  if (!metrics) return null;

  const visibleWidth = Math.max(0.18, metrics.width * Math.abs(metrics.scale[0]));
  const visibleDepth = Math.max(0.18, metrics.depth * Math.abs(metrics.scale[2]));
  const rotationDeg = (metrics.rotationY * 180) / Math.PI;
  const scaleHandleX = visibleWidth / 2;
  const scaleHandleZ = visibleDepth / 2;
  const rotateHandleZ = -visibleDepth / 2 - 0.46;
  const showRotate = tool === "rotate" || tool === "select" || tool === "move";
  const showScale = tool === "scale" || tool === "select" || tool === "move";

  return (
    <g
      transform={`translate(${metrics.position[0]} ${metrics.position[2]}) rotate(${rotationDeg})`}
      pointerEvents="all"
    >
      <rect
        x={-visibleWidth / 2}
        y={-visibleDepth / 2}
        width={visibleWidth}
        height={visibleDepth}
        fill="none"
        stroke="#3BA7FF"
        strokeWidth="0.055"
        strokeDasharray="0.14 0.09"
        pointerEvents="none"
      />
      {showRotate ? (
        <>
          <line
            x1="0"
            y1={-visibleDepth / 2}
            x2="0"
            y2={rotateHandleZ}
            stroke="#3BA7FF"
            strokeWidth="0.04"
            pointerEvents="none"
          />
          <circle
            cx="0"
            cy={rotateHandleZ}
            r="0.16"
            fill="#3BA7FF"
            stroke="#071014"
            strokeWidth="0.035"
            onPointerDown={(event) => onPointerDown("rotate", target, metrics, event)}
            style={{ cursor: "grab" }}
          />
        </>
      ) : null}
      {showScale ? (
        <>
          {[
            [-scaleHandleX, -scaleHandleZ],
            [scaleHandleX, -scaleHandleZ],
            [scaleHandleX, scaleHandleZ],
            [-scaleHandleX, scaleHandleZ],
          ].map(([x, z]) => (
            <rect
              key={`${x}-${z}`}
              x={x - 0.13}
              y={z - 0.13}
              width="0.26"
              height="0.26"
              rx="0.045"
              fill="#FFF9EE"
              stroke="#3BA7FF"
              strokeWidth="0.045"
              onPointerDown={(event) => onPointerDown("scale", target, metrics, event)}
              style={{ cursor: "nwse-resize" }}
            />
          ))}
        </>
      ) : null}
    </g>
  );
}

function furnitureHandleMetrics(
  id: string,
  instances: FurnitureInstance[],
  assets: FurnitureAsset[],
  assetById?: FurnitureAssetMap,
): BlueprintObjectMetrics | null {
  const instance = instances.find((item) => item.id === id);
  if (!instance) return null;
  const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
  const footprint = footprintFor(asset?.primitive);
  return objectMetrics(instance.position, instance.rotation[1], instance.scale, footprint.width, footprint.depth);
}

function shapeHandleMetrics(id: string, shapes: CustomShape[]): BlueprintObjectMetrics | null {
  const shape = shapes.find((item) => item.id === id);
  if (!shape) return null;
  return objectMetrics(shape.position, shape.rotation[1], shape.scale, 1, 1);
}

function BlueprintWallHandles({
  room,
  selected,
  onPointerDown,
}: {
  room: RoomBounds;
  selected: SelectedRef;
  onPointerDown: (wall: WallId, event: ReactPointerEvent<SVGElement>) => void;
}) {
  const walls: Array<{
    id: WallId;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    handleX: number;
    handleY: number;
    cursor: string;
  }> = [
    {
      id: "north",
      x1: room.minX,
      y1: room.maxZ,
      x2: room.maxX,
      y2: room.maxZ,
      handleX: (room.minX + room.maxX) / 2,
      handleY: room.maxZ,
      cursor: "ns-resize",
    },
    {
      id: "south",
      x1: room.minX,
      y1: room.minZ,
      x2: room.maxX,
      y2: room.minZ,
      handleX: (room.minX + room.maxX) / 2,
      handleY: room.minZ,
      cursor: "ns-resize",
    },
    {
      id: "east",
      x1: room.maxX,
      y1: room.minZ,
      x2: room.maxX,
      y2: room.maxZ,
      handleX: room.maxX,
      handleY: (room.minZ + room.maxZ) / 2,
      cursor: "ew-resize",
    },
    {
      id: "west",
      x1: room.minX,
      y1: room.minZ,
      x2: room.minX,
      y2: room.maxZ,
      handleX: room.minX,
      handleY: (room.minZ + room.maxZ) / 2,
      cursor: "ew-resize",
    },
  ];

  return (
    <g>
      {walls.map((wall) => {
        const active = selected?.type === "wall" && selected.id === wall.id;
        return (
          <g key={wall.id}>
            <line
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke={active ? "#3BA7FF" : "#14232B"}
              strokeWidth={active ? "0.1" : "0.055"}
              strokeLinecap="round"
              opacity={active ? "1" : "0.78"}
              pointerEvents="none"
            />
            <line
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke="transparent"
              strokeWidth="0.42"
              strokeLinecap="round"
              onPointerDown={(event) => onPointerDown(wall.id, event)}
              style={{ cursor: wall.cursor }}
            />
            {active ? (
              <rect
                x={wall.handleX - 0.18}
                y={wall.handleY - 0.18}
                width="0.36"
                height="0.36"
                rx="0.06"
                fill="#3BA7FF"
                stroke="#071014"
                strokeWidth="0.035"
                onPointerDown={(event) => onPointerDown(wall.id, event)}
                style={{ cursor: wall.cursor }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function footprintFor(primitive?: FurnitureAsset["primitive"]) {
  if (primitive === "table") return { width: 1.15, depth: 1.15 };
  if (primitive === "chair") return { width: 0.7, depth: 0.75 };
  if (primitive === "lamp" || primitive === "plant") return { width: 0.55, depth: 0.55 };
  if (primitive === "cabinet") return { width: 1.35, depth: 0.5 };
  return { width: 1.65, depth: 0.9 };
}

function openingSegment(
  opening: Door | WindowOpening,
  room: RoomBounds,
  segments?: WallSegment[],
) {
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const half = opening.width / 2;
  const { dx, dz } = applySegmentationToOpening(room, opening.wall, opening.offset, segments);
  if (opening.wall === "north" || opening.wall === "south") {
    const z = (opening.wall === "north" ? room.maxZ : room.minZ) + dz;
    return { x1: cx + opening.offset - half, y1: z, x2: cx + opening.offset + half, y2: z };
  }
  const x = (opening.wall === "east" ? room.maxX : room.minX) + dx;
  return { x1: x, y1: cz + opening.offset - half, x2: x, y2: cz + opening.offset + half };
}

function doorArcPath(door: Door, room: RoomBounds, seg: { x1: number; y1: number; x2: number; y2: number }) {
  const radius = door.width;
  let normalX = 0;
  let normalY = 0;
  if (door.wall === "north") normalY = -1;
  else if (door.wall === "south") normalY = 1;
  else if (door.wall === "east") normalX = -1;
  else normalX = 1;
  const hingeX = seg.x1;
  const hingeY = seg.y1;
  const arcEndX = hingeX + normalX * radius;
  const arcEndY = hingeY + normalY * radius;
  void room;
  const sweep = 1;
  return `M ${hingeX} ${hingeY} L ${seg.x2} ${seg.y2} M ${seg.x2} ${seg.y2} A ${radius} ${radius} 0 0 ${sweep} ${arcEndX} ${arcEndY}`;
}

function wallSurfaceSign(wall: WallId): number {
  if (wall === "north" || wall === "east") return -1;
  return 1;
}

function segmentLineCoords(
  wall: WallId,
  segment: WallSegment,
  room: RoomBounds,
): { x1: number; y1: number; x2: number; y2: number } {
  const sign = wallSurfaceSign(wall);
  if (wall === "north") {
    const baseZ = room.maxZ + sign * segment.displacement;
    return {
      x1: room.minX + segment.start * (room.maxX - room.minX),
      y1: baseZ,
      x2: room.minX + segment.end * (room.maxX - room.minX),
      y2: baseZ,
    };
  }
  if (wall === "south") {
    const baseZ = room.minZ + sign * segment.displacement;
    return {
      x1: room.minX + segment.start * (room.maxX - room.minX),
      y1: baseZ,
      x2: room.minX + segment.end * (room.maxX - room.minX),
      y2: baseZ,
    };
  }
  if (wall === "east") {
    const baseX = room.maxX + sign * segment.displacement;
    return {
      x1: baseX,
      y1: room.minZ + segment.start * (room.maxZ - room.minZ),
      x2: baseX,
      y2: room.minZ + segment.end * (room.maxZ - room.minZ),
    };
  }
  const baseX = room.minX + sign * segment.displacement;
  return {
    x1: baseX,
    y1: room.minZ + segment.start * (room.maxZ - room.minZ),
    x2: baseX,
    y2: room.minZ + segment.end * (room.maxZ - room.minZ),
  };
}

function connectorLineCoords(
  wall: WallId,
  current: WallSegment,
  next: WallSegment,
  room: RoomBounds,
): { x1: number; y1: number; x2: number; y2: number } {
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    const x = room.minX + current.end * (room.maxX - room.minX);
    const baseZ = wall === "north" ? room.maxZ : room.minZ;
    return {
      x1: x,
      y1: baseZ + sign * current.displacement,
      x2: x,
      y2: baseZ + sign * next.displacement,
    };
  }
  const y = room.minZ + current.end * (room.maxZ - room.minZ);
  const baseX = wall === "east" ? room.maxX : room.minX;
  return {
    x1: baseX + sign * current.displacement,
    y1: y,
    x2: baseX + sign * next.displacement,
    y2: y,
  };
}

function BlueprintWallSegments({
  room,
  wallSegments,
  selected,
  onSelect,
}: {
  room: RoomBounds;
  wallSegments?: WallSegmentation;
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
}) {
  if (!wallSegments) return null;
  return (
    <g>
      {(["north", "south", "east", "west"] as WallId[]).map((wall) => {
        const segments = wallSegments[wall];
        if (!segments || segments.length <= 1) return null;
        return (
          <g key={wall}>
            {segments.map((segment) => {
              const isSelected = selected?.type === "wall-segment" && selected.id === segment.id;
              const coords = segmentLineCoords(wall, segment, room);
              return (
                <line
                  key={segment.id}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke={isSelected ? "#3BA7FF" : "#14232B"}
                  strokeWidth="0.18"
                  strokeLinecap="butt"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect({ type: "wall-segment", wall, id: segment.id });
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
            {segments.slice(0, -1).map((segment, index) => {
              const next = segments[index + 1];
              if (Math.abs(next.displacement - segment.displacement) < 0.001) return null;
              const coords = connectorLineCoords(wall, segment, next, room);
              return (
                <line
                  key={`${segment.id}-${next.id}-connector`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#14232B"
                  strokeWidth="0.14"
                  strokeLinecap="butt"
                />
              );
            })}
            {(() => {
              const first = segments[0];
              if (!first || Math.abs(first.displacement) < 0.001) return null;
              const coords = endConnectorLineCoords(wall, first, "start", room);
              return (
                <line
                  key={`${wall}-start-connector`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#14232B"
                  strokeWidth="0.14"
                  strokeLinecap="butt"
                />
              );
            })()}
            {(() => {
              const last = segments[segments.length - 1];
              if (!last || Math.abs(last.displacement) < 0.001) return null;
              const coords = endConnectorLineCoords(wall, last, "end", room);
              return (
                <line
                  key={`${wall}-end-connector`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#14232B"
                  strokeWidth="0.14"
                  strokeLinecap="butt"
                />
              );
            })()}
          </g>
        );
      })}
    </g>
  );
}

function endConnectorLineCoords(
  wall: WallId,
  segment: WallSegment,
  end: "start" | "end",
  room: RoomBounds,
): { x1: number; y1: number; x2: number; y2: number } {
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    const x =
      end === "start"
        ? room.minX + segment.start * (room.maxX - room.minX)
        : room.minX + segment.end * (room.maxX - room.minX);
    const baseZ = wall === "north" ? room.maxZ : room.minZ;
    return {
      x1: x,
      y1: baseZ,
      x2: x,
      y2: baseZ + sign * segment.displacement,
    };
  }
  const y =
    end === "start"
      ? room.minZ + segment.start * (room.maxZ - room.minZ)
      : room.minZ + segment.end * (room.maxZ - room.minZ);
  const baseX = wall === "east" ? room.maxX : room.minX;
  return {
    x1: baseX,
    y1: y,
    x2: baseX + sign * segment.displacement,
    y2: y,
  };
}

function applySegmentationToOpening(
  room: RoomBounds,
  wall: WallId,
  offset: number,
  segments: WallSegment[] | undefined,
): { dx: number; dz: number } {
  if (!segments || segments.length === 0) return { dx: 0, dz: 0 };
  const fraction = offsetToFraction(room, wall, offset);
  const segment = findSegmentAtFraction(segments, fraction);
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    return { dx: 0, dz: sign * segment.displacement };
  }
  return { dx: sign * segment.displacement, dz: 0 };
}
