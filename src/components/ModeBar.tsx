"use client";

import { useState } from "react";

const MODES = ["Block", "Splat"] as const;
export type ViewMode = (typeof MODES)[number];

type ModeBarProps = {
  activeMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  splatAvailable: boolean;
};

export function ModeBar({ activeMode, onModeChange, splatAvailable }: ModeBarProps) {
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
          background: "#16181d",
          border: "1px solid var(--border-mid)",
          borderRadius: 8,
          padding: 3,
          display: "flex",
          gap: 1,
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
        }}
      >
        {MODES.map((mode) => {
          const disabled = mode === "Splat" && !splatAvailable;
          return (
            <ModeButton
              key={mode}
              label={mode}
              active={activeMode === mode}
              disabled={disabled}
              title={
                disabled
                  ? "Generate a world to view the gaussian splat"
                  : mode === "Block"
                  ? "Show the blockout 3D model"
                  : "Show the generated gaussian splat"
              }
              onClick={() => {
                if (!disabled) onModeChange(mode);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  disabled,
  title,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 14px",
        borderRadius: 5,
        fontSize: 12,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.01em",
        background: active ? "var(--accent-dim)" : "transparent",
        color: disabled
          ? "var(--text-ghost)"
          : active
          ? "var(--accent-text)"
          : hovered
          ? "var(--text-bright)"
          : "var(--text-primary)",
        transition: "background 100ms, color 100ms",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  );
}
