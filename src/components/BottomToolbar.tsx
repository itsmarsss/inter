"use client";

import { WandSparkles } from "lucide-react";
import { useState } from "react";

type BottomToolbarProps = {
  worldActive: boolean;
  onOpenWorld: () => void;
};

export function BottomToolbar({ worldActive, onOpenWorld }: BottomToolbarProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
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
          borderRadius: 20,
          padding: "4px 8px",
          display: "flex",
          gap: 2,
        }}
      >
        <button
          type="button"
          aria-label="Open world generation"
          title="World Generation"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onOpenWorld}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: worldActive
              ? "var(--accent-dim)"
              : hovered
              ? "var(--surface-overlay)"
              : "var(--surface-input)",
            border: worldActive
              ? "1px solid var(--accent-border)"
              : "1px solid var(--border-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: worldActive
              ? "var(--accent-text)"
              : hovered
              ? "var(--text-primary)"
              : "var(--text-secondary)",
            transition: "all 120ms",
          }}
        >
          <WandSparkles size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
