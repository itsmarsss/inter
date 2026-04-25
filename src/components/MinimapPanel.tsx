"use client";

import { Map, Maximize2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  buildFloorPolygon,
  findSegmentAtFraction,
  offsetToFraction,
  roomDimensions,
} from "../state/editor";
import type {
  Door,
  FurnitureInstance,
  RoomBounds,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "../state/types";

type MinimapPanelProps = {
  room: RoomBounds;
  instances: FurnitureInstance[];
  doors?: Door[];
  windows?: WindowOpening[];
  wallSegments?: WallSegmentation;
  onExpand?: () => void;
};

const SVG_W = 220;
const SVG_H = 165;
const PAD_X = 24;
const PAD_Y = 22;

export function MinimapPanel({
  room,
  instances,
  doors = [],
  windows = [],
  wallSegments,
  onExpand,
}: MinimapPanelProps) {
  const dims = roomDimensions(room);

  const segmentation: WallSegmentation = wallSegments ?? {
    north: [{ id: "north-default", start: 0, end: 1, displacement: 0 }],
    east: [{ id: "east-default", start: 0, end: 1, displacement: 0 }],
    south: [{ id: "south-default", start: 0, end: 1, displacement: 0 }],
    west: [{ id: "west-default", start: 0, end: 1, displacement: 0 }],
  };

  const polygon = buildFloorPolygon(room, segmentation);
  const xs = polygon.length > 0 ? polygon.map((p) => p.x) : [room.minX, room.maxX];
  const zs = polygon.length > 0 ? polygon.map((p) => p.z) : [room.minZ, room.maxZ];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  const polyW = maxX - minX;
  const polyH = maxZ - minZ;
  const usableW = SVG_W - PAD_X * 2;
  const usableH = SVG_H - PAD_Y * 2;
  const scale = Math.min(usableW / polyW, usableH / polyH) * 0.94;

  const drawW = polyW * scale;
  const drawH = polyH * scale;
  const originX = SVG_W / 2 - drawW / 2;
  const originY = SVG_H / 2 - drawH / 2;

  function toSvg(x: number, z: number) {
    return {
      x: originX + (x - minX) * scale,
      y: originY + (z - minZ) * scale,
    };
  }

  const polyPoints = polygon.map((p) => {
    const s = toSvg(p.x, p.z);
    return `${s.x.toFixed(2)},${s.y.toFixed(2)}`;
  }).join(" ");

  const openings = [
    ...doors.map((door) => ({ kind: "door" as const, opening: door })),
    ...windows.map((win) => ({ kind: "window" as const, opening: win })),
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 220,
        background: "#16181d",
        border: "1px solid var(--border-mid)",
        borderRadius: 6,
        overflow: "hidden",
        zIndex: 15,
        pointerEvents: "auto",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div
        style={{
          height: 32,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <Map size={11} strokeWidth={1.6} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-bright)",
            flex: 1,
            letterSpacing: "0.02em",
          }}
        >
          Blueprint
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
          }}
        >
          {dims.width.toFixed(1)} × {dims.depth.toFixed(1)} m
        </span>
        <HeaderBtn icon={<Maximize2 size={10} strokeWidth={1.6} />} label="Expand" onClick={onExpand} />
      </div>

      <div
        style={{
          background: "#0c0d11",
          aspectRatio: "4/3",
          position: "relative",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ display: "block" }}
        >
          <defs>
            <pattern id="minimap-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#minimap-grid)" />

          {polygon.length > 2 ? (
            <polygon
              points={polyPoints}
              fill="rgba(59, 142, 255, 0.06)"
              stroke="rgba(59, 142, 255, 0.55)"
              strokeWidth="1.1"
              strokeLinejoin="miter"
            />
          ) : null}

          {/* Furniture footprints */}
          {instances.slice(0, 24).map((inst) => {
            const center = toSvg(inst.position[0], inst.position[2]);
            const fw = Math.max(4, inst.scale[0] * scale * 1.6);
            const fd = Math.max(4, inst.scale[2] * scale * 1.6);
            return (
              <rect
                key={inst.id}
                x={center.x - fw / 2}
                y={center.y - fd / 2}
                width={fw}
                height={fd}
                fill="rgba(255, 255, 255, 0.18)"
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="0.4"
                rx={1}
              />
            );
          })}

          {/* Door / window openings */}
          {openings.map(({ kind, opening }) => {
            const seg = openingSegmentCoords(opening, room, segmentation[opening.wall]);
            const a = toSvg(seg.x1, seg.z1);
            const b = toSvg(seg.x2, seg.z2);
            const isDoor = kind === "door";
            return (
              <g key={`${kind}-${opening.id}`}>
                {/* Mask the wall under the opening */}
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#0c0d11"
                  strokeWidth="2.2"
                  strokeLinecap="butt"
                />
                {/* Opening marker */}
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isDoor ? "#34c97a" : "#6aadff"}
                  strokeWidth={isDoor ? 1.4 : 1.0}
                  strokeDasharray={isDoor ? undefined : "1.5 1.2"}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: 7,
            display: "flex",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-secondary)",
            letterSpacing: "0.02em",
            pointerEvents: "none",
          }}
        >
          <LegendChip color="#34c97a" label={`${doors.length} door${doors.length === 1 ? "" : "s"}`} />
          <LegendChip color="#6aadff" label={`${windows.length} window${windows.length === 1 ? "" : "s"}`} dashed />
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 8,
          height: 2,
          background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px)` : color,
          borderRadius: 1,
        }}
      />
      {label}
    </span>
  );
}

function HeaderBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 20,
        height: 20,
        borderRadius: 3,
        border: "none",
        background: hovered ? "var(--surface-overlay)" : "transparent",
        color: hovered ? "var(--text-bright)" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 100ms, color 100ms",
      }}
    >
      {icon}
    </button>
  );
}

/**
 * Compute the opening's two endpoints in floor-space (x, z), accounting for
 * any wall-segment displacement (so doors and windows on outcrops follow the
 * shifted wall instead of the original perimeter).
 */
function openingSegmentCoords(
  opening: Door | WindowOpening,
  room: RoomBounds,
  segments: WallSegment[] | undefined,
): { x1: number; z1: number; x2: number; z2: number } {
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const half = opening.width / 2;
  const { dx, dz } = applySegmentationToOpening(room, opening.wall, opening.offset, segments);

  if (opening.wall === "north" || opening.wall === "south") {
    const z = (opening.wall === "north" ? room.maxZ : room.minZ) + dz;
    return {
      x1: cx + opening.offset - half,
      z1: z,
      x2: cx + opening.offset + half,
      z2: z,
    };
  }
  const x = (opening.wall === "east" ? room.maxX : room.minX) + dx;
  return {
    x1: x,
    z1: cz + opening.offset - half,
    x2: x,
    z2: cz + opening.offset + half,
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
  // Match BlueprintView's wallSurfaceSign semantics: north/east push outward (-),
  // south/west push outward (+). Displacement is the inward push from default.
  const sign = wall === "north" || wall === "east" ? -1 : 1;
  if (wall === "north" || wall === "south") {
    return { dx: 0, dz: sign * segment.displacement };
  }
  return { dx: sign * segment.displacement, dz: 0 };
}
