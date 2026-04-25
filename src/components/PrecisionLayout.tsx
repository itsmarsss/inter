"use client";

import { type ReactNode, useState } from "react";
import type { FurnitureAsset, FurnitureInstance, MarbleResult, RoomBounds, UploadStatus } from "../state/types";
import { BottomToolbar } from "./BottomToolbar";
import { FurniturePanel } from "./FurniturePanel";
import { IconRail, type RailSection } from "./IconRail";
import { MinimapPanel } from "./MinimapPanel";
import { ModeBar, type ViewMode } from "./ModeBar";
import { Viewport } from "./Viewport";
import { WorldPanel } from "./WorldPanel";

type PrecisionLayoutProps = {
  viewport: ReactNode;
  furnitureAssets: FurnitureAsset[];
  furnitureInstances: FurnitureInstance[];
  room: RoomBounds;
  onGenerateFurniture: (prompt: string) => void;
  upload: UploadStatus;
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

  function handleSectionChange(section: RailSection) {
    if (section === activeSection && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveSection(section);
      setPanelOpen(true);
    }
  }

  function openWorld() {
    setActiveSection("world");
    setPanelOpen(true);
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
      {/* Layer 0 — full-screen 3D viewport */}
      <Viewport room={room}>{viewport}</Viewport>

      {/* Layer 1 — icon rail (always visible) */}
      <IconRail
        activeSection={activeSection}
        panelOpen={panelOpen}
        onSectionChange={handleSectionChange}
      />

      {/* Layer 1 — left panels (always mounted, width-animated) */}
      <FurniturePanel
        open={panelOpen && activeSection === "furniture"}
        assets={furnitureAssets}
        onGenerate={onGenerateFurniture}
        onClose={() => setPanelOpen(false)}
      />

      <WorldPanel
        open={panelOpen && activeSection === "world"}
        prompt={stylePrompt}
        marble={marble}
        onPromptChange={onStylePromptChange}
        onGenerate={onGenerateRoom}
        onCancelRun={onCancelRun}
        onClose={() => setPanelOpen(false)}
      />

      {/* Layer 2 — floating chrome (never covers viewport center) */}
      <ModeBar activeMode={viewMode} onModeChange={setViewMode} />
      <MinimapPanel room={room} instances={furnitureInstances} />

      <BottomToolbar
        worldActive={activeSection === "world" && panelOpen}
        onOpenWorld={openWorld}
      />

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
