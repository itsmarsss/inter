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
}: PrecisionLayoutProps) {
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

      {/* Layer 1 — icon rail */}
      <IconRail
        activeSection={activeSection}
        panelOpen={panelOpen}
        onSectionChange={handleSectionChange}
      />

      {/* Layer 1 — furniture panel (always mounted for smooth transition) */}
      <FurniturePanel
        open={panelOpen && activeSection === "furniture"}
        assets={furnitureAssets}
        onGenerate={onGenerateFurniture}
        onClose={() => setPanelOpen(false)}
      />

      {/* Layer 2 — floating overlays */}
      <ModeBar activeMode={viewMode} onModeChange={setViewMode} />
      <MinimapPanel room={room} instances={furnitureInstances} />

      {/* Generate panel (toggleable) */}
      {generateOpen && (
        <GeneratePanel
          prompt={stylePrompt}
          marble={marble}
          onPromptChange={onStylePromptChange}
          onGenerate={onGenerateRoom}
          onCancelRun={onCancelRun}
        />
      )}

      <BottomToolbar
        panelOpen={generateOpen}
        onTogglePanel={() => setGenerateOpen((o) => !o)}
      />
      <RefToggle opacity={panoramaOpacity} onChange={onPanoramaOpacityChange} />

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
