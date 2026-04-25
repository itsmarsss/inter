"use client";

import { Map, Minus } from "lucide-react";
import { type ReactNode, useState } from "react";

type BlueprintPanelProps = {
  open: boolean;
  blueprint: ReactNode;
  onClose: () => void;
};

export function BlueprintPanel({ open, blueprint, onClose }: BlueprintPanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        top: 0,
        bottom: 0,
        width: open ? 360 : 0,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        background: "var(--surface-raised)",
        borderRight: "1px solid var(--border-dim)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease",
        zIndex: 15,
      }}
    >
      <div
        style={{
          height: 44,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border-dim)",
          flexShrink: 0,
        }}
      >
        <Map size={13} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-bright)",
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-ui)",
            flex: 1,
            whiteSpace: "nowrap",
          }}
        >
          Blueprint
        </span>
        <PanelIconBtn label="Collapse panel" icon={<Minus size={11} strokeWidth={1.5} />} onClick={onClose} />
      </div>

      <div
        style={{
          padding: "8px 12px 0",
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          flexShrink: 0,
          fontFamily: "var(--font-ui)",
        }}
      >
        Top-down schematic. Drag walls, doors, windows, and shapes to reposition.
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "8px 8px 12px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: "var(--surface-input)",
            border: "1px solid var(--border-dim)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {blueprint}
        </div>
      </div>
    </div>
  );
}

function PanelIconBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
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
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "none",
        background: hovered ? "var(--surface-overlay)" : "transparent",
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
