"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { FurnitureAsset } from "../../state/types";
import { StatusBadge } from "./StatusBadge";

function FurnitureSilhouette({ primitive }: { primitive: FurnitureAsset["primitive"] }) {
  const c = "var(--text-ghost)";

  if (primitive === "table") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="3" y="10" width="24" height="2.5" fill={c} rx="0.5" />
        <rect x="4.5" y="12.5" width="2" height="10" fill={c} rx="0.5" />
        <rect x="23.5" y="12.5" width="2" height="10" fill={c} rx="0.5" />
        <rect x="8.5" y="12.5" width="2" height="7" fill={c} rx="0.5" />
        <rect x="19.5" y="12.5" width="2" height="7" fill={c} rx="0.5" />
      </svg>
    );
  }
  if (primitive === "chair") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="8" y="13" width="14" height="2" fill={c} rx="0.5" />
        <rect x="8" y="15" width="2" height="9" fill={c} rx="0.5" />
        <rect x="20" y="15" width="2" height="9" fill={c} rx="0.5" />
        <rect x="8" y="8" width="2" height="7" fill={c} rx="0.5" />
        <rect x="20" y="8" width="2" height="7" fill={c} rx="0.5" />
      </svg>
    );
  }
  if (primitive === "sofa") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="2" y="14" width="26" height="8" fill={c} opacity="0.4" rx="1" />
        <rect x="2" y="11" width="26" height="3" fill={c} opacity="0.6" rx="0.5" />
        <rect x="2" y="14" width="3.5" height="8" fill={c} rx="0.5" />
        <rect x="24.5" y="14" width="3.5" height="8" fill={c} rx="0.5" />
      </svg>
    );
  }
  if (primitive === "lamp") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <polygon points="10,13 20,13 17,7 13,7" fill={c} opacity="0.7" />
        <rect x="14" y="13" width="2" height="11" fill={c} />
        <rect x="11" y="24" width="8" height="1.5" fill={c} rx="0.5" />
      </svg>
    );
  }
  if (primitive === "plant") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <ellipse cx="15" cy="11" rx="7" ry="6" fill={c} opacity="0.4" />
        <ellipse cx="10" cy="13" rx="4" ry="5" fill={c} opacity="0.35" />
        <ellipse cx="20" cy="13" rx="4" ry="5" fill={c} opacity="0.35" />
        <rect x="13" y="18" width="4" height="5" fill={c} rx="1" />
        <rect x="10" y="22.5" width="10" height="2" fill={c} rx="0.5" />
      </svg>
    );
  }
  if (primitive === "cabinet") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="5" y="6" width="20" height="18" fill={c} opacity="0.15" rx="1" />
        <rect x="5" y="6" width="20" height="18" stroke={c} strokeWidth="1" rx="1" fill="none" />
        <line x1="15" y1="6" x2="15" y2="24" stroke={c} strokeWidth="0.8" />
        <circle cx="13" cy="15" r="1" fill={c} />
        <circle cx="17" cy="15" r="1" fill={c} />
        <rect x="5" y="24" width="20" height="2" fill={c} rx="0.5" />
      </svg>
    );
  }
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect x="5" y="8" width="20" height="14" fill={c} opacity="0.15" rx="1" />
      <rect x="5" y="8" width="20" height="14" stroke={c} strokeWidth="1" rx="1" fill="none" />
      <line x1="5" y1="8" x2="15" y2="15" stroke={c} strokeWidth="0.5" opacity="0.5" />
      <line x1="25" y1="8" x2="15" y2="15" stroke={c} strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

type AssetCardProps = {
  asset: FurnitureAsset;
  selected: boolean;
  onSelect: () => void;
};

export function AssetCard({ asset, selected, onSelect }: AssetCardProps) {
  const [hovered, setHovered] = useState(false);
  const isReady = asset.status === "ready" || asset.status === "mock";

  return (
    <div
      data-status={asset.status}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={isReady}
      onDragStart={
        isReady
          ? (e) => {
              e.dataTransfer.setData("application/x-furniture-asset", asset.id);
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      style={{
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        borderBottom: "1px solid var(--border-dim)",
        cursor: isReady ? "grab" : "pointer",
        position: "relative",
        background: selected
          ? "var(--surface-active)"
          : hovered
          ? "var(--surface-overlay)"
          : "transparent",
        transition: "background 100ms ease",
        userSelect: "none",
        outline: "none",
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--accent)",
            borderRadius: "0 1px 1px 0",
          }}
        />
      )}

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
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <FurnitureSilhouette primitive={asset.primitive} />
        )}
      </div>

      {/* Text */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
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
            {asset.name}
          </span>
          <StatusBadge status={asset.status} />
        </div>

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
          {asset.prompt}
        </span>

        {isReady && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
            <Sparkles size={10} color="var(--accent-text)" strokeWidth={1.5} />
            <span
              style={{
                fontSize: 10,
                color: "var(--accent-text)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {asset.modelUrl ? "GLB ready" : "model pending"}
            </span>
          </div>
        )}

        {asset.status === "failed" && asset.error && (
          <span
            style={{
              fontSize: 10,
              color: "var(--status-error)",
              fontFamily: "var(--font-ui)",
              marginTop: 1,
            }}
          >
            {asset.error.slice(0, 60)}
          </span>
        )}
      </div>
    </div>
  );
}
