"use client";

import { Trash2, FolderOpen } from "lucide-react";
import { useState } from "react";
import type { LibraryEntry } from "../../state/types";
import { FurnitureSilhouette } from "./AssetCard";

type LibraryCardProps = {
  entry: LibraryEntry;
  onLoad: () => void;
  onDelete: () => void;
};

export function LibraryCard({ entry, onLoad, onDelete }: LibraryCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px 9px 14px",
        borderBottom: "1px solid var(--border-dim)",
        background: hovered ? "rgba(255,255,255,0.018)" : "transparent",
        transition: "background 120ms ease",
      }}
    >
      {/* Amber left accent bar — distinguishes library from session */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: "var(--status-generating)",
          opacity: 0.5,
        }}
      />

      {/* Thumbnail */}
      <div
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: 3,
          background: "var(--surface-input)",
          border: `1px solid ${hovered ? "var(--border-mid)" : "var(--border-dim)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: "border-color 120ms",
        }}
      >
        {entry.localThumbPath ? (
          <img
            src={entry.localThumbPath}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <FurnitureSilhouette primitive={entry.primitive} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: hovered ? "var(--text-bright)" : "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "var(--font-ui)",
            letterSpacing: "-0.005em",
            transition: "color 120ms",
          }}
        >
          {entry.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-ui)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontStyle: "italic",
            marginTop: 2,
          }}
        >
          {entry.prompt}
        </div>
      </div>

      {/* Actions — slide in on hover */}
      <div
        style={{
          display: "flex",
          gap: 2,
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(6px)",
          transition: "opacity 150ms ease, transform 150ms ease",
        }}
      >
        <ActionBtn
          label="Load into session"
          icon={<FolderOpen size={11} strokeWidth={1.5} />}
          onClick={onLoad}
        />
        <ActionBtn
          label="Delete from library"
          icon={<Trash2 size={11} strokeWidth={1.5} />}
          onClick={onDelete}
          danger
        />
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
        borderRadius: 3,
        border: `1px solid ${hovered ? (danger ? "var(--status-error-border)" : "var(--border-mid)") : "var(--border-dim)"}`,
        background: hovered ? (danger ? "var(--status-error-bg)" : "var(--surface-input)") : "transparent",
        color: hovered
          ? danger ? "var(--status-error)" : "var(--text-primary)"
          : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      {icon}
    </button>
  );
}
