"use client";

type DimensionPillProps = {
  width: number;
  depth: number;
};

export function DimensionPill({ width, depth }: DimensionPillProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 62,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface-raised)",
        border: "1px solid var(--border-mid)",
        borderRadius: 4,
        padding: "3px 8px",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--text-bright)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 5,
        opacity: 0.85,
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{width.toFixed(1)}</span>
      <span style={{ color: "var(--text-ghost)", fontSize: 9 }}>m</span>
      <span style={{ color: "var(--border-mid)", margin: "0 1px" }}>×</span>
      <span style={{ color: "var(--text-secondary)" }}>{depth.toFixed(1)}</span>
      <span style={{ color: "var(--text-ghost)", fontSize: 9 }}>m</span>
    </div>
  );
}
