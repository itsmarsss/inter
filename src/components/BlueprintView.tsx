import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CustomShape, FurnitureAsset, FurnitureAssetMap, FurnitureInstance, RoomBounds, SelectedRef, WallId } from "../state/types";
import { clampToRoom, resizeRoomFromWall, roomDimensions } from "../state/editor";

type BlueprintViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
  onRoomChange: (room: RoomBounds) => void;
  onInstancesChange: (instances: FurnitureInstance[]) => void;
  onShapesChange: (shapes: CustomShape[]) => void;
  registerBlueprintCapture: (capture: () => string | undefined) => void;
};

type BlueprintObjectDrag = {
  target: Extract<NonNullable<SelectedRef>, { type: "furniture" | "shape" }>;
  grabOffsetX: number;
  grabOffsetZ: number;
  y: number;
};

export function BlueprintView({
  room,
  assets,
  assetById,
  instances,
  shapes,
  selected,
  onSelect,
  onRoomChange,
  onInstancesChange,
  onShapesChange,
  registerBlueprintCapture,
}: BlueprintViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingWall, setDraggingWall] = useState<WallId | null>(null);
  const [draggingObject, setDraggingObject] = useState<BlueprintObjectDrag | null>(null);
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

  useEffect(() => {
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
    position: FurnitureInstance["position"] | CustomShape["position"],
    event: ReactPointerEvent<SVGGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    onSelect(target);
    setDraggingObject({
      target,
      grabOffsetX: point.x - position[0],
      grabOffsetZ: point.y - position[2],
      y: position[1],
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function updateObjectDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingObject) return;

    const point = pointFromPointer(event.clientX, event.clientY);
    if (!point) return;

    const nextPosition = clampToRoom(
      [point.x - draggingObject.grabOffsetX, draggingObject.y, point.y - draggingObject.grabOffsetZ],
      room,
    );

    if (draggingObject.target.type === "furniture") {
      onInstancesChange(
        instances.map((instance) =>
          instance.id === draggingObject.target.id ? { ...instance, position: nextPosition } : instance,
        ),
      );
      return;
    }

    onShapesChange(
      shapes.map((shape) => (shape.id === draggingObject.target.id ? { ...shape, position: nextPosition } : shape)),
    );
  }

  function endObjectDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingObject) return;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }

    setDraggingObject(null);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (draggingWall) {
      updateWallDrag(event);
      return;
    }

    updateObjectDrag(event);
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    endWallDrag(event);
    endObjectDrag(event);
  }

  return (
    <div className="h-full bg-[var(--color-background)] p-2">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Live room blueprint"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="h-full w-full rounded-md border border-[var(--color-border)] bg-[#ECF1F2]"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerDown={() => onSelect(null)}
      >
        <defs>
          <pattern id="bp-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#B9C4C8" strokeWidth="0.018" />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#bp-grid)" />
        <rect
          x={room.minX}
          y={room.minZ}
          width={room.maxX - room.minX}
          height={room.maxZ - room.minZ}
          fill="#FFF9EE"
          stroke="#14232B"
          strokeWidth="0.18"
        />
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
        <path
          d={`M ${room.minX + 0.65} ${room.minZ} Q ${room.minX + 1.15} ${room.minZ + 0.15} ${room.minX + 1.35} ${room.minZ + 0.65}`}
          fill="none"
          stroke="#BC3E35"
          strokeWidth="0.055"
        />
        <line
          x1={room.minX + 0.65}
          y1={room.minZ}
          x2={room.minX + 1.35}
          y2={room.minZ}
          stroke="#FFF9EE"
          strokeWidth="0.22"
        />
        {instances.map((instance) => {
          const asset = assetById?.get(instance.assetId) ?? assets.find((item) => item.id === instance.assetId);
          const footprint = footprintFor(asset?.primitive);
          const isSelected = selected?.type === "furniture" && selected.id === instance.id;
          return (
            <g
              key={instance.id}
              transform={`translate(${instance.position[0]} ${instance.position[2]}) rotate(${(instance.rotation[1] * 180) / Math.PI}) scale(${instance.scale[0]} ${instance.scale[2]})`}
              onPointerDown={(event) =>
                beginObjectDrag({ type: "furniture", id: instance.id }, instance.position, event)
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
          return (
            <g
              key={shape.id}
              transform={`translate(${shape.position[0]} ${shape.position[2]}) rotate(${(shape.rotation[1] * 180) / Math.PI}) scale(${shape.scale[0]} ${shape.scale[2]})`}
              onPointerDown={(event) => beginObjectDrag({ type: "shape", id: shape.id }, shape.position, event)}
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
      </svg>
    </div>
  );
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
