import { useEffect, useMemo, useRef } from "react";
import type { FurnitureAsset, FurnitureInstance, RoomBounds, SelectedRef } from "../state/types";
import { roomDimensions } from "../state/editor";

type BlueprintViewProps = {
  room: RoomBounds;
  assets: FurnitureAsset[];
  instances: FurnitureInstance[];
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
  registerBlueprintCapture: (capture: () => string | undefined) => void;
};

export function BlueprintView({
  room,
  assets,
  instances,
  selected,
  onSelect,
  registerBlueprintCapture,
}: BlueprintViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
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

  return (
    <div className="h-full bg-[var(--color-background)] p-2">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Live room blueprint"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="h-full w-full rounded-md border border-[var(--color-border)] bg-[#F4EEE6]"
      >
        <defs>
          <pattern id="bp-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#D7CCC0" strokeWidth="0.015" />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#bp-grid)" />
        <rect
          x={room.minX}
          y={room.minZ}
          width={room.maxX - room.minX}
          height={room.maxZ - room.minZ}
          fill="#F4EEE6"
          stroke="#3A332B"
          strokeWidth="0.12"
        />
        <line
          x1={room.minX}
          x2={room.maxX}
          y1={room.minZ - 0.45}
          y2={room.minZ - 0.45}
          stroke="#B8653F"
          strokeWidth="0.035"
        />
        <line
          x1={room.maxX + 0.45}
          x2={room.maxX + 0.45}
          y1={room.minZ}
          y2={room.maxZ}
          stroke="#B8653F"
          strokeWidth="0.035"
        />
        <text x={(room.minX + room.maxX) / 2} y={room.minZ - 0.6} textAnchor="middle" fontSize="0.28" fill="#B8653F">
          {dimensions.width}m
        </text>
        <text
          x={room.maxX + 0.62}
          y={(room.minZ + room.maxZ) / 2}
          textAnchor="middle"
          fontSize="0.28"
          fill="#B8653F"
          transform={`rotate(90 ${room.maxX + 0.62} ${(room.minZ + room.maxZ) / 2})`}
        >
          {dimensions.depth}m
        </text>
        <path
          d={`M ${room.minX + 0.65} ${room.minZ} Q ${room.minX + 1.15} ${room.minZ + 0.15} ${room.minX + 1.35} ${room.minZ + 0.65}`}
          fill="none"
          stroke="#C96B5D"
          strokeWidth="0.045"
        />
        <line
          x1={room.minX + 0.65}
          y1={room.minZ}
          x2={room.minX + 1.35}
          y2={room.minZ}
          stroke="#F4EEE6"
          strokeWidth="0.15"
        />
        {instances.map((instance) => {
          const asset = assets.find((item) => item.id === instance.assetId);
          const footprint = footprintFor(asset?.primitive);
          const isSelected = selected?.type === "furniture" && selected.id === instance.id;
          return (
            <g
              key={instance.id}
              transform={`translate(${instance.position[0]} ${instance.position[2]}) rotate(${(instance.rotation[1] * 180) / Math.PI}) scale(${instance.scale[0]} ${instance.scale[2]})`}
              onClick={() => onSelect({ type: "furniture", id: instance.id })}
              className="cursor-pointer"
            >
              <rect
                x={-footprint.width / 2}
                y={-footprint.depth / 2}
                width={footprint.width}
                height={footprint.depth}
                rx="0.05"
                fill={isSelected ? "#B8653F" : "#A89F94"}
                stroke="#3A332B"
                strokeWidth="0.035"
              />
              <text y="0.05" textAnchor="middle" fontSize="0.18" fill="#151310">
                {asset?.name.split(" ")[0] ?? instance.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function footprintFor(primitive?: FurnitureAsset["primitive"]) {
  if (primitive === "table") return { width: 1.15, depth: 1.15 };
  if (primitive === "chair") return { width: 0.7, depth: 0.75 };
  if (primitive === "lamp" || primitive === "plant") return { width: 0.55, depth: 0.55 };
  if (primitive === "cabinet") return { width: 1.35, depth: 0.5 };
  return { width: 1.65, depth: 0.9 };
}
