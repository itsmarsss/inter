"use client";

import { Map, Maximize2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { roomDimensions } from "../state/editor";
import type { RoomBounds } from "../state/types";

type MinimapPanelProps = {
  room: RoomBounds;
  blueprint: ReactNode;
  onExpand?: () => void;
};

export function MinimapPanel({ room, blueprint, onExpand }: MinimapPanelProps) {
  const dims = roomDimensions(room);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 240,
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
          aspectRatio: "4/3",
          background: "var(--surface-input)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {blueprint}
      </div>
    </div>
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
