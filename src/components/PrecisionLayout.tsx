"use client";

import { type ReactNode, useState } from "react";
import type { FurnitureAsset, FurnitureInstance, MarbleResult, RoomBounds, UploadStatus } from "../state/types";
import { BottomToolbar } from "./BottomToolbar";
import { FurniturePanel } from "./FurniturePanel";
import { GeneratePanel } from "./GeneratePanel";
import { IconRail, type RailSection } from "./IconRail";
import { MinimapPanel } from "./MinimapPanel";
import { ModeBar, type ViewMode } from "./ModeBar";
import { RefToggle } from "./RefToggle";
import { Viewport } from "./Viewport";

type PrecisionLayoutProps = {
  viewport: ReactNode;
  furnitureAssets: FurnitureAsset[];
  furnitureInstances: FurnitureInstance[];
  room: RoomBounds;
  onGenerateFurniture: (prompt: string) => void;
  panoramaOpacity: number;
  onPanoramaOpacityChange: (v: number) => void;
  upload: UploadStatus;
  /* world generation */
  stylePrompt: string;
  onStylePromptChange: (prompt: string) => void;
  marble: MarbleResult;
  onGenerateRoom: () => void;
  onCancelRun: () => void;
  /** When true, sidebars animate in from their edges */
  entering?: boolean;
};

export function PrecisionLayout({
  viewport,
  furnitureAssets,
  furnitureInstances,
  room,
  onGenerateFurniture,
  panoramaOpacity,
  onPanoramaOpacityChange,
  upload,
  stylePrompt,
  onStylePromptChange,
  marble,
  onGenerateRoom,
  onCancelRun,
  entering = false,
}: PrecisionLayoutProps) {
  // Build an animation shorthand string for the entrance animations.
  // Each wrapper div uses `position:absolute; inset:0` so it's a full-screen
  // positioned container — children's own `position:absolute` references
  // this wrapper, which is the same effective rect as the parent.
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const anim = (name: string, delay: number) =>
    entering ? `${name} 0.55s ${ease} ${delay}ms both` : undefined;
  const [activeSection, setActiveSection] = useState<RailSection>("furniture");
  const [panelOpen, setPanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("Block");
  const [generateOpen, setGenerateOpen] = useState(true);

  function handleSectionChange(section: RailSection) {
    if (section === activeSection && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveSection(section);
      setPanelOpen(true);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--surface-void)",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* Layer 0 — viewport fills entire screen */}
      <Viewport room={room}>{viewport}</Viewport>

      {/* Layer 1 — icon rail (slides from left) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-left", 0) }}>
        <IconRail
          activeSection={activeSection}
          panelOpen={panelOpen}
          onSectionChange={handleSectionChange}
        />
      </div>

      {/* Layer 1 — furniture panel (slides from left, slightly delayed) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-left", 80) }}>
        <FurniturePanel
          open={panelOpen && activeSection === "furniture"}
          assets={furnitureAssets}
          onGenerate={onGenerateFurniture}
          onClose={() => setPanelOpen(false)}
        />
      </div>

      {/* Layer 2 — mode bar (slides from top) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-top", 40), pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <ModeBar activeMode={viewMode} onModeChange={setViewMode} />
        </div>
      </div>

      {/* Minimap (slides from right) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-right", 80), pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <MinimapPanel room={room} instances={furnitureInstances} />
        </div>
      </div>

      {/* Generate panel (slides from bottom) */}
      {generateOpen && (
        <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-bottom", 120), pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>
            <GeneratePanel
              prompt={stylePrompt}
              marble={marble}
              onPromptChange={onStylePromptChange}
              onGenerate={onGenerateRoom}
              onCancelRun={onCancelRun}
            />
          </div>
        </div>
      )}

      {/* Bottom toolbar (slides from bottom) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-from-bottom", 100), pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <BottomToolbar
            panelOpen={generateOpen}
            onTogglePanel={() => setGenerateOpen((o) => !o)}
          />
        </div>
      </div>

      {/* Ref toggle (fades in) */}
      <div style={{ position: "absolute", inset: 0, animation: anim("ui-fade-in", 160), pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <RefToggle opacity={panoramaOpacity} onChange={onPanoramaOpacityChange} />
        </div>
      </div>

      {/* Version badge */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 56,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-primary)",
          fontFamily: "var(--font-ui)",
          zIndex: 15,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        N
      </div>

      {/* Upload error toast */}
      {upload.status === "failed" && (
        <div
          style={{
            position: "absolute",
            bottom: 52,
            left: 56,
            background: "var(--surface-raised)",
            border: "1px solid var(--status-error-border)",
            borderRadius: 5,
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--status-error)",
            fontFamily: "var(--font-ui)",
            maxWidth: 240,
            zIndex: 20,
            animation: "fade-in 200ms ease",
          }}
        >
          {upload.error}
        </div>
      )}
    </div>
  );
}
