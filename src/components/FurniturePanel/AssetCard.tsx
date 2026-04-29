"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";
import type { FurnitureAsset } from "../../state/types";
import { setDragAssetId } from "../../state/dragAsset";

export function FurnitureSilhouette({ primitive }: { primitive: FurnitureAsset["primitive"] }) {
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
  onSave?: () => void;
  saving?: boolean;
};

export function AssetCard({ asset, selected, onSelect, onSave, saving }: AssetCardProps) {
  const [hovered, setHovered] = useState(false);
  const isReady = asset.status === "ready" || asset.status === "mock";
  const isGenerating = asset.status === "generating" || asset.status === "queued";
  const isFailed = asset.status === "failed";

  const accentColor = isReady
    ? "var(--status-ready)"
    : isGenerating
    ? "var(--status-generating)"
    : isFailed
    ? "var(--status-error)"
    : "var(--text-ghost)";

  const progress = Math.max(0, Math.min(100, asset.progress ?? 0));

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
              setDragAssetId(asset.id);
              const ghost = document.createElement("canvas");
              ghost.width = 1;
              ghost.height = 1;
              e.dataTransfer.setDragImage(ghost, 0, 0);
            }
          : undefined
      }
      onDragEnd={isReady ? () => setDragAssetId(null) : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid var(--border-dim)",
        cursor: isReady ? "grab" : "pointer",
        background: selected
          ? "var(--surface-active)"
          : hovered
          ? "rgba(255,255,255,0.022)"
          : "transparent",
        transition: "background 120ms ease",
        userSelect: "none",
        outline: "none",
      }}
    >
      {/* Status accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: accentColor,
          opacity: isGenerating ? undefined : 0.65,
          animation: isGenerating ? "pulse-opacity 2s ease-in-out infinite" : undefined,
          transition: "background 300ms",
        }}
      />

      {/* Main content row */}
      <div
        style={{
          padding: "10px 12px 10px 14px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 4,
            background: "var(--surface-input)",
            border: `1px solid ${hovered || selected ? "var(--border-mid)" : "var(--border-dim)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            transition: "border-color 120ms",
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

          {isGenerating && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(9,10,12,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  borderTopColor: "var(--status-generating)",
                  animation: "spin 0.9s linear infinite",
                }}
              />
            </div>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-bright)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "var(--font-ui)",
                letterSpacing: "-0.01em",
                flex: 1,
              }}
            >
              {asset.name}
            </span>
            {/* Status dot */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: accentColor,
                flexShrink: 0,
                opacity: 0.9,
                animation: isGenerating ? "pulse-opacity 2s ease-in-out infinite" : undefined,
              }}
            />
          </div>

          {/* Prompt */}
          <span
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-ui)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            {asset.prompt}
          </span>

          {/* Ready row */}
          {isReady && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 1 }}>
              <span
                style={{
                  fontSize: 9,
                  color: "var(--status-ready)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.75,
                }}
              >
                {asset.modelUrl ? "glb ready" : "pending"}
              </span>

              {onSave && asset.modelUrl && (
                <button
                  type="button"
                  aria-label="Save to library"
                  onClick={(e) => { e.stopPropagation(); onSave(); }}
                  disabled={saving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 6px",
                    height: 18,
                    borderRadius: 2,
                    border: "1px solid var(--border-dim)",
                    background: hovered ? "var(--surface-input)" : "transparent",
                    color: saving ? "var(--text-ghost)" : "var(--text-secondary)",
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    cursor: saving ? "default" : "pointer",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    transition: "color 120ms, background 120ms, border-color 120ms",
                    opacity: hovered ? 1 : 0.6,
                  }}
                >
                  <Bookmark size={8} strokeWidth={1.5} />
                  {saving ? "…" : "save"}
                </button>
              )}
            </div>
          )}

          {/* Generating progress */}
          {isGenerating && progress > 0 && (
            <div style={{ marginTop: 3 }}>
              <div
                style={{
                  height: 2,
                  background: "var(--border-dim)",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "var(--status-generating)",
                    borderRadius: 1,
                    transition: "width 600ms ease",
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {isFailed && asset.error && (
            <span
              style={{
                fontSize: 9,
                color: "var(--status-error)",
                fontFamily: "var(--font-ui)",
                fontStyle: "italic",
                lineHeight: 1.4,
                opacity: 0.85,
              }}
            >
              {asset.error.slice(0, 58)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
