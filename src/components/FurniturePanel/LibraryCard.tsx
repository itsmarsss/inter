"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { LibraryEntry } from "../../state/types";
import { setDragAssetId } from "../../state/dragAsset";
import { FurnitureSilhouette } from "./AssetCard";

type LibraryCardProps = {
  entry: LibraryEntry;
  onDelete: () => void;
};

export function LibraryCard({ entry, onDelete }: LibraryCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-furniture-asset", entry.id);
        e.dataTransfer.effectAllowed = "copy";
        setDragAssetId(entry.id);
        const ghost = document.createElement("canvas");
        ghost.width = 1;
        ghost.height = 1;
        e.dataTransfer.setDragImage(ghost, 0, 0);
      }}
      onDragEnd={() => setDragAssetId(null)}
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
        cursor: "grab",
        userSelect: "none",
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

      {/* Delete button — slides in on hover */}
      <div
        style={{
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(6px)",
          transition: "opacity 150ms ease, transform 150ms ease",
        }}
      >
        <DeleteBtn onClick={onDelete} />
      </div>
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Delete from library"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
        borderRadius: 3,
        border: `1px solid ${hovered ? "var(--status-error-border)" : "var(--border-dim)"}`,
        background: hovered ? "var(--status-error-bg)" : "transparent",
        color: hovered ? "var(--status-error)" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      <Trash2 size={11} strokeWidth={1.5} />
    </button>
  );
}
