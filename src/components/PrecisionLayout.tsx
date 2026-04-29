"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  LibraryEntry,
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
import { ProductSearchPanel } from "./ProductSearchPanel";
import { Viewport } from "./Viewport";
import { WorldPanel } from "./WorldPanel";

type PrecisionLayoutProps = {
  viewport: ReactNode;
  blueprint: ReactNode;
  blueprintPreview: ReactNode;

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
  onRemoveFurnitureInstance: (id: string) => void;
  onRotateFurnitureInstance: (id: string, deltaRad: number) => void;
  onRemoveWallSegment: (wall: WallId, id: string) => void;
  onResetWallSegments: () => void;

  onGenerateFurniture: (prompt: string) => void;
  libraryEntries: LibraryEntry[];
  savingAssetId: string | null;
  onSaveAsset: (asset: FurnitureAsset) => void;
  onDeleteLibraryEntry: (id: string) => void;
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
  furnitureInstances,
  customShapes,
  cameras,
  doors,
  windows,
  wallSegments,
  assetById,
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
  onRemoveFurnitureInstance,
  onRotateFurnitureInstance,
  onRemoveWallSegment,
  onResetWallSegments,
  onGenerateFurniture,
  libraryEntries,
  savingAssetId,
  onSaveAsset,
  onDeleteLibraryEntry,
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
  //
  // We also need to keep the chrome fully hidden BEFORE the `entering` phase
  // begins. Otherwise, during the revealing-fade phase the editor is already
  // visible (opacity 1) but no animation is applied yet, so the chrome shows
  // at its final position. Then when the `entering` phase starts and we
  // attach `animation: ... both`, the element snaps to the keyframes' "from"
  // state (off-screen) for the leading delay before animating back in —
  // producing a visible appear → hide → re-appear flash.
  //
  // `hasEntered` latches true the first time `entering` is true; it never
  // flips back. Combined with `opacity: 0` when neither flag is set, the
  // chrome stays hidden until its keyframes take over, then the keyframes'
  // `forwards` fill mode keeps it visible afterwards.
  // Latch: once `entering` has been true, the chrome has begun (or already
  // finished) its entrance animation, so it should never be force-hidden
  // again. Setting state during render (with the same value short-circuit)
  // is the documented React pattern for deriving sticky state from props —
  // the second render runs immediately and uses the latched value.
  const [hasEntered, setHasEntered] = useState(entering);
  if (entering && !hasEntered) setHasEntered(true);
  const preHidden = !entering && !hasEntered;

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
      <div style={wrapperStyleFor("ui-from-left", 0, entering, preHidden)}>
        <div style={{ pointerEvents: "auto" }}>
          <IconRail
            activeSection={activeSection}
            panelOpen={panelOpen}
            onSectionChange={handleSectionChange}
          />
        </div>
      </div>

      {/* Layer 1 — left panels (slide from left, slightly delayed) */}
      <div style={wrapperStyleFor("ui-from-left", 80, entering, preHidden)}>
        <div style={{ pointerEvents: "auto" }}>
          <ObjectsPanel
            open={panelOpen && activeSection === "objects"}
            tool={tool}
            onToolChange={onToolChange}
            selected={selected}
            onSelect={onSelect}
            furnitureInstances={furnitureInstances}
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
            onRemoveFurnitureInstance={onRemoveFurnitureInstance}
            onRotateFurnitureInstance={onRotateFurnitureInstance}
            onRemoveWallSegment={onRemoveWallSegment}
            onResetWallSegments={onResetWallSegments}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>

      <div style={wrapperStyleFor("ui-from-left", 80, entering, preHidden)}>
        <div style={{ pointerEvents: "auto" }}>
          <FurniturePanel
            open={panelOpen && activeSection === "furniture"}
            assets={furnitureAssets}
            libraryEntries={libraryEntries}
            savingAssetId={savingAssetId}
            onGenerate={onGenerateFurniture}
            onUploadModel={onUploadModel}
            onSaveAsset={onSaveAsset}
            onDeleteLibraryEntry={onDeleteLibraryEntry}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>

      <div style={wrapperStyleFor("ui-from-left", 80, entering, preHidden)}>
        <div style={{ pointerEvents: "auto" }}>
          <ProductSearchPanel
            open={panelOpen && activeSection === "products"}
            assets={furnitureAssets}
            instances={furnitureInstances}
            assetById={assetById}
            libraryEntries={libraryEntries}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>

      <div style={wrapperStyleFor("ui-from-left", 80, entering, preHidden)}>
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
      <div style={wrapperStyleFor("ui-from-top", 40, entering, preHidden)}>
        <div style={{ pointerEvents: "auto" }}>
          <ModeBar
            activeMode={viewMode}
            onModeChange={onViewModeChange}
            splatAvailable={splatAvailable}
          />
        </div>
      </div>

      <div style={wrapperStyleFor("ui-from-right", 80, entering, preHidden)}>
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

const ENTRANCE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// Pure helper kept outside the component so it doesn't capture refs from the
// render scope (which would trip our `react-hooks/refs` lint rule). All
// inputs are plain values resolved by the caller in the render body.
function wrapperStyleFor(
  name: string,
  delay: number,
  entering: boolean,
  preHidden: boolean,
): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: preHidden ? 0 : undefined,
    animation: entering ? `${name} 0.55s ${ENTRANCE_EASE} ${delay}ms both` : undefined,
  };
}
