"use client";

import { BookMarked, Cpu, FileUp, Minus, Package, Sparkles } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import type { FurnitureAsset, LibraryEntry } from "../../state/types";
import { AssetCard } from "./AssetCard";
import { LibraryCard } from "./LibraryCard";

type FurniturePanelProps = {
  open: boolean;
  assets: FurnitureAsset[];
  libraryEntries: LibraryEntry[];
  savingAssetId: string | null;
  onGenerate: (prompt: string) => void;
  onUploadModel?: (file: File) => void;
  onSaveAsset: (asset: FurnitureAsset) => void;
  onDeleteLibraryEntry: (id: string) => void;
  onLoadLibraryEntry: (entry: LibraryEntry) => void;
  onClose: () => void;
};

export function FurniturePanel({
  open,
  assets,
  libraryEntries,
  savingAssetId,
  onGenerate,
  onUploadModel,
  onSaveAsset,
  onDeleteLibraryEntry,
  onLoadLibraryEntry,
  onClose,
}: FurniturePanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onGenerate(trimmed);
    setInputValue("");
  }

  const canGenerate = Boolean(inputValue.trim());

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
      {/* ── Header ───────────────────────────────────────── */}
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
          <PanelIconBtn
            label="Collapse panel"
            icon={<Minus size={11} strokeWidth={1.5} />}
            onClick={onClose}
          />
        </div>
      </div>

      {/* ── Generate prompt ───────────────────────────────── */}
      <div style={{ padding: "12px 12px 14px", flexShrink: 0, borderBottom: "1px solid var(--border-dim)" }}>
        {/* Label row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 7,
          }}
        >
          <Cpu size={9} strokeWidth={1.5} color="var(--text-secondary)" />
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Describe furniture
          </span>
        </div>

        {/* Input */}
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
            width: "100%",
            height: 34,
            background: "var(--surface-input)",
            border: "1px solid var(--border-dim)",
            borderRadius: 4,
            padding: "0 10px",
            paddingLeft: inputFocused ? 8 : 10,
            fontSize: 12,
            color: "var(--text-bright)",
            fontFamily: "var(--font-ui)",
            outline: "none",
            boxSizing: "border-box",
            display: "block",
            boxShadow: inputFocused
              ? "inset 2px 0 0 var(--accent), 0 0 0 1px var(--accent-border)"
              : "none",
            transition: "box-shadow 150ms ease, padding-left 150ms ease",
          }}
        />

        {/* Generate button */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canGenerate}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            width: "100%",
            height: 32,
            marginTop: 7,
            background: canGenerate && btnHovered
              ? "var(--surface-overlay)"
              : canGenerate
              ? "var(--surface-input)"
              : "transparent",
            border: `1px solid ${canGenerate ? (btnHovered ? "var(--border-mid)" : "var(--border-dim)") : "rgba(255,255,255,0.03)"}`,
            borderRadius: 4,
            color: canGenerate ? (btnHovered ? "var(--text-bright)" : "var(--text-primary)") : "var(--text-ghost)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canGenerate ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 140ms ease",
          }}
        >
          <Sparkles
            size={10}
            strokeWidth={1.5}
            style={{
              opacity: canGenerate ? 1 : 0.3,
              color: canGenerate && btnHovered ? "var(--accent-text)" : "inherit",
              transition: "color 140ms",
            }}
          />
          Generate Mesh
          {canGenerate && (
            <span
              style={{
                fontSize: 9,
                opacity: 0.4,
                fontFamily: "var(--font-mono)",
                marginLeft: 2,
              }}
            >
              ↵
            </span>
          )}
        </button>
      </div>

      {/* ── Scrollable lists ──────────────────────────────── */}
      <div className="precision-scroll" style={{ flex: 1, overflowY: "auto" }}>

        {/* Session section */}
        <ListSectionHeader
          icon={<Sparkles size={10} strokeWidth={1.5} color="var(--accent-text)" />}
          label="Workspace"
          count={assets.length}
        />

        {assets.length === 0 ? (
          <EmptyState />
        ) : (
          assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={selectedId === asset.id}
              onSelect={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
              onSave={() => onSaveAsset(asset)}
              saving={savingAssetId === asset.id}
            />
          ))
        )}

        {/* Library section */}
        <ListSectionHeader
          icon={<BookMarked size={10} strokeWidth={1.5} color="var(--status-generating)" style={{ opacity: 0.7 }} />}
          label="My Library"
          count={libraryEntries.length}
          topBorder
          accentColor="var(--status-generating)"
        />

        {libraryEntries.length === 0 ? (
          <LibraryEmptyState />
        ) : (
          libraryEntries.map((entry) => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              onLoad={() => onLoadLibraryEntry(entry)}
              onDelete={() => onDeleteLibraryEntry(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ListSectionHeader({
  icon,
  label,
  count,
  topBorder,
  accentColor,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  topBorder?: boolean;
  accentColor?: string;
}) {
  return (
    <div
      style={{
        padding: "0 12px",
        height: 28,
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderTop: topBorder ? "1px solid var(--border-mid)" : undefined,
        borderBottom: "1px solid var(--border-dim)",
        background: "rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}
    >
      {icon}
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          color: accentColor ?? "var(--accent-text)",
          background: accentColor
            ? "rgba(232,168,58,0.08)"
            : "var(--accent-dim)",
          border: `1px solid ${accentColor ? "rgba(232,168,58,0.18)" : "var(--accent-border)"}`,
          padding: "0 5px",
          borderRadius: 2,
          lineHeight: 1.8,
          minWidth: 18,
          textAlign: "center",
        }}
      >
        {count}
      </span>
    </div>
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
        padding: "24px 16px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={14} color="var(--text-ghost)" strokeWidth={1} />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-ui)",
            color: "var(--text-primary)",
            fontWeight: 500,
            marginBottom: 3,
          }}
        >
          No assets yet
        </div>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-ui)",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          Describe a piece of furniture above
        </div>
      </div>
    </div>
  );
}

function LibraryEmptyState() {
  return (
    <div
      style={{
        padding: "14px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 3,
          height: 28,
          borderRadius: 2,
          background: "var(--status-generating)",
          opacity: 0.2,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontFamily: "var(--font-ui)",
          color: "var(--text-secondary)",
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        No saved meshes.{" "}
        <span style={{ color: "var(--text-primary)" }}>Save</span>
        {" "}any ready asset to persist it.
      </span>
    </div>
  );
}
