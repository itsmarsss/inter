"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";

export function BottomToolbar() {
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
          aria-label="Magic wand"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: hovered ? "var(--surface-overlay)" : "var(--surface-input)",
            border: "1px solid var(--border-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
            transition: "all 120ms",
          }}
        >
          <Wand2 size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
