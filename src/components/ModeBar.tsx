"use client";

import { useState } from "react";

const MODES = ["Blockout", "Block", "Splat"] as const;
export type ViewMode = (typeof MODES)[number];

type ModeBarProps = {
  activeMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
};

export function ModeBar({ activeMode, onModeChange }: ModeBarProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-dim)",
          borderRadius: 8,
          padding: 3,
          display: "flex",
          gap: 1,
        }}
      >
        {MODES.map((mode) => (
          <ModeButton
            key={mode}
            label={mode}
            active={activeMode === mode}
            onClick={() => onModeChange(mode)}
          />
        ))}
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 14px",
        borderRadius: 5,
        fontSize: 12,
        fontFamily: "var(--font-ui)",
        fontWeight: 400,
        border: "none",
        cursor: "pointer",
        letterSpacing: "0.01em",
        background: active ? "var(--surface-overlay)" : "transparent",
        color: active ? "var(--text-bright)" : hovered ? "var(--text-primary)" : "var(--text-secondary)",
        transition: "background 100ms, color 100ms",
      }}
    >
      {label}
    </button>
  );
}
