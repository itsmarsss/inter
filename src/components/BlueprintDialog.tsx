"use client";

import { Map, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type BlueprintDialogProps = {
  open: boolean;
  blueprint: ReactNode;
  onClose: () => void;
};

export function BlueprintDialog({ open, blueprint, onClose }: BlueprintDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8, 9, 12, 0.7)",
        animation: "fade-in 160ms ease",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(960px, calc(100vw - 48px))",
          height: "min(720px, calc(100vh - 48px))",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-dim)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
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
              fontFamily: "var(--font-ui)",
              flex: 1,
            }}
          >
            Blueprint
          </span>
          <CloseBtn onClick={onClose} />
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "var(--surface-input)" }}>{blueprint}</div>
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Close blueprint"
      title="Close blueprint"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
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
      <X size={14} strokeWidth={1.5} />
    </button>
  );
}
