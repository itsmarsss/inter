"use client";

import { type ReactNode, useState } from "react";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  MarbleResult,
  RoomBounds,
  SceneCamera,
  SelectedRef,
  ShapeKind,
  ToolMode,
  UploadStatus,
  WallId,
  WallSegmentation,
  WindowOpening,
} from "../state/types";
import { BlueprintDialog } from "./BlueprintDialog";
import { BottomToolbar } from "./BottomToolbar";
import { FurniturePanel } from "./FurniturePanel";
import { IconRail, type RailSection } from "./IconRail";
import { MinimapPanel } from "./MinimapPanel";
import { ModeBar, type ViewMode } from "./ModeBar";
import { ObjectsPanel } from "./ObjectsPanel";
import { Viewport } from "./Viewport";
import { WorldPanel } from "./WorldPanel";

type PrecisionLayoutProps = {
  viewport: ReactNode;
  blueprint: ReactNode;

  furnitureAssets: FurnitureAsset[];
  furnitureInstances: FurnitureInstance[];
  customShapes: CustomShape[];
  cameras: SceneCamera[];
  doors: Door[];
  windows: WindowOpening[];
  wallSegments: WallSegmentation;
  assetById: FurnitureAssetMap;
  room: RoomBounds;

  tool: ToolMode;
  selected: SelectedRef;
  activeShapeKind: ShapeKind;
  onToolChange: (tool: ToolMode) => void;
  onSelect: (selected: SelectedRef) => void;
  onActiveShapeKindChange: (kind: ShapeKind) => void;

  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  onUploadModel: (file: File) => void;
  onAddDoor: () => void;
  onAddWindow: () => void;
  onRemoveDoor: (id: string) => void;
  onRemoveWindow: (id: string) => void;
  onRemoveWallSegment: (wall: WallId, id: string) => void;
  onResetWallSegments: () => void;

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
  blueprint,
  furnitureAssets,
  furnitureInstances,
  customShapes,
  cameras,
  doors,
  windows,
  wallSegments,
  room,
  tool,
  selected,
  activeShapeKind,
  onToolChange,
  onSelect,
  onActiveShapeKindChange,
  viewMode,
  onViewModeChange,
  onUploadModel,
  onAddDoor,
  onAddWindow,
  onRemoveDoor,
  onRemoveWindow,
  onRemoveWallSegment,
  onResetWallSegments,
  onGenerateFurniture,
  upload,
  stylePrompt,
  onStylePromptChange,
  marble,
  onGenerateRoom,
  onCancelRun,
}: PrecisionLayoutProps) {
  const [activeSection, setActiveSection] = useState<RailSection>("objects");
  const [panelOpen, setPanelOpen] = useState(true);
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false);

  const splatAvailable = marble.status === "complete" && Boolean(marble.spzUrl);

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
      <ObjectsPanel
        open={panelOpen && activeSection === "objects"}
        tool={tool}
        onToolChange={onToolChange}
        selected={selected}
        onSelect={onSelect}
        doors={doors}
        windows={windows}
        wallSegments={wallSegments}
        shapes={customShapes}
        cameras={cameras}
        activeShapeKind={activeShapeKind}
        onActiveShapeKindChange={onActiveShapeKindChange}
        onAddDoor={onAddDoor}
        onAddWindow={onAddWindow}
        onRemoveDoor={onRemoveDoor}
        onRemoveWindow={onRemoveWindow}
        onRemoveWallSegment={onRemoveWallSegment}
        onResetWallSegments={onResetWallSegments}
        onClose={() => setPanelOpen(false)}
      />

      <FurniturePanel
        open={panelOpen && activeSection === "furniture"}
        assets={furnitureAssets}
        onGenerate={onGenerateFurniture}
        onUploadModel={onUploadModel}
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
      <ModeBar
        activeMode={viewMode}
        onModeChange={onViewModeChange}
        splatAvailable={splatAvailable}
      />
      <MinimapPanel
        room={room}
        instances={furnitureInstances}
        doors={doors}
        windows={windows}
        wallSegments={wallSegments}
        onExpand={() => setBlueprintDialogOpen(true)}
      />

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

      <BlueprintDialog
        open={blueprintDialogOpen}
        blueprint={blueprint}
        onClose={() => setBlueprintDialogOpen(false)}
      />
    </div>
  );
}
