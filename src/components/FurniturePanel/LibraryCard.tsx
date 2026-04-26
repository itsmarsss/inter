"use client";

import { BookmarkMinus, FolderOpen } from "lucide-react";
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
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        borderBottom: "1px solid var(--border-dim)",
        background: hovered ? "var(--surface-overlay)" : "transparent",
        transition: "background 100ms ease",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 5,
          background: "var(--surface-input)",
          border: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-bright)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "var(--font-ui)",
            letterSpacing: "-0.005em",
          }}
        >
          {entry.name}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-ui)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.prompt}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 1 }}>
        <LibraryActionBtn
          label="Load into session"
          icon={<FolderOpen size={11} strokeWidth={1.5} />}
          onClick={onLoad}
        />
        <LibraryActionBtn
          label="Delete from library"
          icon={<BookmarkMinus size={11} strokeWidth={1.5} />}
          onClick={onDelete}
          danger
        />
      </div>
    </div>
  );
}

function LibraryActionBtn({
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
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "none",
        background: hovered ? "var(--surface-overlay)" : "transparent",
        color: hovered
          ? danger ? "var(--status-error)" : "var(--text-primary)"
          : "var(--text-secondary)",
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
