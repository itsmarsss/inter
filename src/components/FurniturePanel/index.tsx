"use client";

import { FileUp, Minus, Package, Plus, Sparkles } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import type { FurnitureAsset } from "../../state/types";
import { AssetCard } from "./AssetCard";

type FurniturePanelProps = {
  open: boolean;
  assets: FurnitureAsset[];
  onGenerate: (prompt: string) => void;
  onUploadModel?: (file: File) => void;
  onClose: () => void;
};

export function FurniturePanel({ open, assets, onGenerate, onUploadModel, onClose }: FurniturePanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onGenerate(trimmed);
    setInputValue("");
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        top: 0,
        bottom: 0,
        width: open ? 268 : 0,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        background: "#16181d",
        borderRight: "1px solid var(--border-mid)",
        boxShadow: open ? "8px 0 28px rgba(0, 0, 0, 0.55)" : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease",
        zIndex: 15,
      }}
    >
      {/* Header */}
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
        <Package size={13} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 17,
            fontWeight: 400,
            color: "var(--text-bright)",
            letterSpacing: "0.06em",
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            lineHeight: 1,
            flex: 1,
            whiteSpace: "nowrap",
          }}
        >
          Furniture
        </span>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {onUploadModel ? (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadModel(file);
                  event.currentTarget.value = "";
                }}
              />
              <PanelIconBtn
                label="Upload GLB or GLTF"
                icon={<FileUp size={11} strokeWidth={1.5} />}
                onClick={() => uploadInputRef.current?.click()}
              />
            </>
          ) : null}
          <PanelIconBtn label="Collapse panel" icon={<Minus size={11} strokeWidth={1.5} />} onClick={onClose} />
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          padding: "8px 12px 0",
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          flexShrink: 0,
          fontFamily: "var(--font-ui)",
        }}
      >
        Generate assets, then drag them into the room.
      </div>

      {/* Input row */}
      <div
        style={{
          padding: "8px 10px",
          display: "flex",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          className="precision-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="round walnut coffee table"
          style={{
            flex: 1,
            height: 30,
            background: "var(--surface-input)",
            border: `1px solid ${inputFocused ? "var(--accent-border)" : "var(--border-dim)"}`,
            borderRadius: 5,
            padding: "0 10px",
            fontSize: 12,
            color: "var(--text-bright)",
            fontFamily: "var(--font-ui)",
            outline: "none",
            transition: "border-color 120ms",
          }}
        />
        <AddButton onClick={handleAdd} disabled={!inputValue.trim()} />
      </div>

      {/* Section header */}
      <div
        style={{
          padding: "0 12px",
          height: 30,
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid var(--border-dim)",
          flexShrink: 0,
        }}
      >
        <Sparkles size={11} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: "var(--text-primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flex: 1,
            fontFamily: "var(--font-ui)",
          }}
        >
          Available Meshys
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            background: "var(--accent-dim)",
            color: "var(--accent-text)",
            padding: "1px 6px",
            borderRadius: 3,
            border: "1px solid var(--accent-border)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.5,
          }}
        >
          {assets.length}
        </span>
      </div>

      {/* Asset list */}
      <div
        className="precision-scroll"
        style={{ flex: 1, overflowY: "auto" }}
      >
        {assets.length === 0 ? (
          <EmptyState />
        ) : (
          assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={selectedId === asset.id}
              onSelect={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AddButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30,
        height: 30,
        background: "var(--surface-input)",
        border: `1px solid ${hovered && !disabled ? "var(--border-mid)" : "var(--border-dim)"}`,
        borderRadius: 5,
        color: hovered && !disabled ? "var(--text-primary)" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: "border-color 120ms, color 120ms",
      }}
    >
      <Plus size={13} strokeWidth={1.5} />
    </button>
  );
}

function PanelIconBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 22,
        height: 22,
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
      {icon}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: 11,
        fontFamily: "var(--font-ui)",
        lineHeight: 1.6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Sparkles size={22} color="var(--text-ghost)" strokeWidth={1} />
      <div>
        <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, marginBottom: 3 }}>
          No assets yet
        </div>
        Describe a piece of furniture above.
      </div>
    </div>
  );
}
