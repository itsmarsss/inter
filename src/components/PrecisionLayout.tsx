"use client";

import { type ReactNode, useState } from "react";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
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
  blueprintPreview: ReactNode;

  furnitureAssets: FurnitureAsset[];
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
  /** When true, all chrome animates in from its respective edge. */
  entering?: boolean;
};

export function PrecisionLayout({
  viewport,
  blueprint,
  blueprintPreview,
  furnitureAssets,
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
  entering = false,
}: PrecisionLayoutProps) {
  const [activeSection, setActiveSection] = useState<RailSection>("objects");
  const [panelOpen, setPanelOpen] = useState(true);
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false);

  const splatAvailable = marble.status === "complete" && Boolean(marble.spzUrl);

  // Build an animation shorthand for the entrance animations. Each wrapper
  // div uses `position: absolute; inset: 0` (a full-screen positioned box),
  // so children that already use absolute positioning land in the same spot
  // they would without the wrapper.
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const anim = (name: string, delay: number) =>
    entering ? `${name} 0.55s ${ease} ${delay}ms both` : undefined;

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
      {/* Layer 0 — full-screen 3D viewport */}
      <Viewport room={room}>{viewport}</Viewport>

      {/* Layer 1 — icon rail (slides from left) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-left", 0) }}>
        <div style={{ pointerEvents: "auto" }}>
          <IconRail
            activeSection={activeSection}
            panelOpen={panelOpen}
            onSectionChange={handleSectionChange}
          />
        </div>
      </div>

      {/* Layer 1 — left panels (slide from left, slightly delayed) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-left", 80) }}>
        <div style={{ pointerEvents: "auto" }}>
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
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-left", 80) }}>
        <div style={{ pointerEvents: "auto" }}>
          <FurniturePanel
            open={panelOpen && activeSection === "furniture"}
            assets={furnitureAssets}
            onGenerate={onGenerateFurniture}
            onUploadModel={onUploadModel}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-left", 80) }}>
        <div style={{ pointerEvents: "auto" }}>
          <WorldPanel
            open={panelOpen && activeSection === "world"}
            prompt={stylePrompt}
            marble={marble}
            onPromptChange={onStylePromptChange}
            onGenerate={onGenerateRoom}
            onCancelRun={onCancelRun}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>

      {/* Layer 2 — floating chrome (never covers viewport center) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-top", 40) }}>
        <div style={{ pointerEvents: "auto" }}>
          <ModeBar
            activeMode={viewMode}
            onModeChange={onViewModeChange}
            splatAvailable={splatAvailable}
          />
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: anim("ui-from-right", 80) }}>
        <div style={{ pointerEvents: "auto" }}>
          <MinimapPanel
            room={room}
            blueprint={blueprintPreview}
            onExpand={() => setBlueprintDialogOpen(true)}
          />
        </div>
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

      <BlueprintDialog
        open={blueprintDialogOpen}
        blueprint={blueprint}
        onClose={() => setBlueprintDialogOpen(false)}
      />
    </div>
  );
}
