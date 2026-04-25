"use client";

import { Map, Maximize2, Minus } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { FurnitureInstance, RoomBounds } from "../state/types";
import { roomDimensions } from "../state/editor";

type MinimapPanelProps = {
  room: RoomBounds;
  instances: FurnitureInstance[];
};

const SVG_W = 210;
const SVG_H = 160;
const PAD_X = 22;
const PAD_Y = 18;

export function MinimapPanel({ room, instances }: MinimapPanelProps) {
  const dims = roomDimensions(room);

  const roomW = room.maxX - room.minX;
  const roomD = room.maxZ - room.minZ;
  const usableW = SVG_W - PAD_X * 2;
  const usableH = SVG_H - PAD_Y * 2;
  const scale = Math.min(usableW / roomW, usableH / roomD) * 0.92;

  const drawW = roomW * scale;
  const drawH = roomD * scale;
  const originX = SVG_W / 2 - drawW / 2;
  const originY = SVG_H / 2 - drawH / 2;

  function toSvgX(wx: number) {
    return originX + (wx - room.minX) * scale;
  }
  function toSvgY(wz: number) {
    return originY + (wz - room.minZ) * scale;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 210,
        background: "var(--surface-raised)",
        border: "1px solid var(--border-dim)",
        borderRadius: 7,
        overflow: "hidden",
        zIndex: 15,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          height: 36,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <Map size={12} strokeWidth={1.5} color="var(--text-secondary)" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-bright)",
            flex: 1,
            fontFamily: "var(--font-ui)",
          }}
        >
          Blueprint
        </span>
        <HeaderBtn icon={<Minus size={10} strokeWidth={1.5} />} label="Minimize" />
        <HeaderBtn icon={<Maximize2 size={10} strokeWidth={1.5} />} label="Expand" />
      </div>

      {/* Parchment canvas */}
      <div
        style={{
          background: "#ede8dc",
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
          {/* Room perimeter */}
          <rect
            x={originX}
            y={originY}
            width={drawW}
            height={drawH}
            fill="none"
            stroke="#b8a88a"
            strokeWidth="1.5"
          />

          {/* Furniture footprints */}
          {instances.slice(0, 12).map((inst) => {
            const fx = toSvgX(inst.position[0]);
            const fz = toSvgY(inst.position[2]);
            const fw = Math.max(8, inst.scale[0] * scale * 2);
            const fd = Math.max(6, inst.scale[2] * scale * 2);
            return (
              <rect
                key={inst.id}
                x={fx - fw / 2}
                y={fz - fd / 2}
                width={fw}
                height={fd}
                fill="#c8b49a"
                opacity={0.65}
                rx={1}
              />
            );
          })}

          {/* Width dimension */}
          <line
            x1={originX}
            y1={originY - 8}
            x2={originX + drawW}
            y2={originY - 8}
            stroke="#b8a88a"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <line x1={originX} y1={originY - 10} x2={originX} y2={originY - 6} stroke="#b8a88a" strokeWidth="0.5" />
          <line x1={originX + drawW} y1={originY - 10} x2={originX + drawW} y2={originY - 6} stroke="#b8a88a" strokeWidth="0.5" />
          <text
            x={originX + drawW / 2}
            y={originY - 11}
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="6"
            fill="#8a7860"
          >
            {dims.width.toFixed(1)} m
          </text>

          {/* Depth dimension */}
          <line
            x1={originX + drawW + 8}
            y1={originY}
            x2={originX + drawW + 8}
            y2={originY + drawH}
            stroke="#b8a88a"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <text
            x={originX + drawW + 15}
            y={originY + drawH / 2}
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="6"
            fill="#8a7860"
            transform={`rotate(90, ${originX + drawW + 15}, ${originY + drawH / 2})`}
          >
            {dims.depth.toFixed(1)} m
          </text>
        </svg>

        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 5,
            color: "#b8a88a",
            fontSize: 11,
            lineHeight: 1,
            userSelect: "none",
            cursor: "nwse-resize",
            fontFamily: "var(--font-mono)",
          }}
        >
          ⌟
        </div>
      </div>
    </div>
  );
}

function HeaderBtn({ icon, label }: { icon: ReactNode; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 20,
        height: 20,
        borderRadius: 3,
        border: "none",
        background: hovered ? "rgba(255,255,255,0.07)" : "transparent",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
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
