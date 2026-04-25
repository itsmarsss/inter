"use client";

import { useRef } from "react";

type RefToggleProps = {
  opacity: number;
  onChange: (opacity: number) => void;
};

export function RefToggle({ opacity, onChange }: RefToggleProps) {
  const checked = opacity > 0;
  const prevRef = useRef(opacity > 0 ? opacity : 1);

  function handleToggle() {
    if (checked) {
      prevRef.current = opacity;
      onChange(0);
    } else {
      onChange(prevRef.current);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        right: 14,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 15,
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-ui)",
          userSelect: "none",
        }}
      >
        Ref
      </span>
      <label
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          width: 32,
          height: 16,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={handleToggle}
          style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            background: checked ? "var(--accent)" : "var(--surface-overlay)",
            border: checked ? "none" : "1px solid var(--border-dim)",
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: checked ? 18 : 2,
            top: 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            transition: "left 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </label>
    </div>
  );
}
