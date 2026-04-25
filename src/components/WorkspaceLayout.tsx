import { Dialog } from "@base-ui/react/dialog";
import {
  Box,
  Camera,
  Circle,
  Cuboid,
  Cylinder,
  DoorOpen,
  Expand,
  EyeOff,
  FileUp,
  Layers3,
  Map,
  Minus,
  Plus,
  RectangleHorizontal,
  Scissors,
  Sparkles,
  Square,
  Triangle,
  WandSparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import type {
  MarbleResult,
  ShapeKind,
  ToolMode,
  UploadStatus,
} from "../state/types";

type DockedWindowIcon = {
  edge: "left" | "right" | "top" | "bottom";
  offset: number;
};

type WorkspaceLayoutProps = {
  upload: UploadStatus;
  marble: MarbleResult;
  tool: ToolMode;
  prompt: string;
  panoramaOpacity: number;
  onUploadModel: (file: File) => void;
  onToolChange: (tool: ToolMode) => void;
  onGenerate: () => void;
  onCancelRun: () => void;
  onPanoramaOpacityChange: (opacity: number) => void;
  onLoadExample: () => void;
  activeShapeKind: ShapeKind;
  onActiveShapeKindChange: (kind: ShapeKind) => void;
  scene: React.ReactNode;
  furniture: React.ReactNode;
  geometry: React.ReactNode;
  blueprint: React.ReactNode;
  blueprintDialog: React.ReactNode;
  ai: React.ReactNode;
};

const tools: Array<{ id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "add-wall", label: "Add Wall", icon: Cuboid },
  { id: "cut-wall", label: "Cut wall (loop cut)", icon: Scissors },
  { id: "add-door", label: "Add Door", icon: DoorOpen },
  { id: "add-window", label: "Add Window", icon: RectangleHorizontal },
  { id: "add-furniture", label: "Generate 3D Model", icon: Box },
  { id: "add-shape", label: "Add Shape", icon: Plus },
  { id: "add-camera", label: "Add Camera", icon: Camera },
];

const shapeOptions: Array<{ kind: ShapeKind; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "cube", label: "Cube", icon: Cuboid },
  { kind: "sphere", label: "Sphere", icon: Circle },
  { kind: "cylinder", label: "Cylinder", icon: Cylinder },
  { kind: "cone", label: "Cone", icon: Triangle },
  { kind: "plane", label: "Plane", icon: Square },
];

function dockedIconFromRect(rect: DOMRect): DockedWindowIcon {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight;
  const distances = [
    { edge: "left" as const, value: rect.left },
    { edge: "right" as const, value: width - rect.right },
    { edge: "top" as const, value: rect.top },
    { edge: "bottom" as const, value: height - rect.bottom },
  ].sort((left, right) => left.value - right.value);
  const edge = distances[0].edge;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    edge,
    offset:
      edge === "left" || edge === "right"
        ? Math.min(height - 48, Math.max(48, centerY))
        : Math.min(width - 48, Math.max(48, centerX)),
  };
}

function dockedIconStyle(dock: DockedWindowIcon) {
  if (dock.edge === "left") return { left: "0.75rem", top: dock.offset, transform: "translateY(-50%)" };
  if (dock.edge === "right") return { right: "0.75rem", top: dock.offset, transform: "translateY(-50%)" };
  if (dock.edge === "top") return { left: dock.offset, top: "0.75rem", transform: "translateX(-50%)" };
  return { left: dock.offset, bottom: "0.75rem", transform: "translateX(-50%)" };
}

function clampPanelPosition(x: number, y: number, width: number, height: number) {
  const margin = 12;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const maxX = Math.max(margin, viewportWidth - width - margin);
  const maxY = Math.max(margin, viewportHeight - height - margin);

  return {
    x: Math.min(maxX, Math.max(margin, x)),
    y: Math.min(maxY, Math.max(margin, y)),
  };
}

export function WorkspaceLayout({
  upload,
  tool,
  panoramaOpacity,
  onUploadModel,
  onToolChange,
  onPanoramaOpacityChange,
  onLoadExample,
  activeShapeKind,
  onActiveShapeKindChange,
  scene,
  furniture,
  geometry,
  blueprint,
  blueprintDialog,
  ai,
}: WorkspaceLayoutProps) {
  const [geometryOpen, setGeometryOpen] = useState(true);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [geometryPanelPosition, setGeometryPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [geometryMinimized, setGeometryMinimized] = useState<DockedWindowIcon | null>(null);
  const [blueprintPanelPosition, setBlueprintPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [blueprintPanelSize, setBlueprintPanelSize] = useState({ width: 328, height: 176 });
  const [blueprintMinimized, setBlueprintMinimized] = useState<DockedWindowIcon | null>(null);
  const [aiPanelPosition, setAiPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [aiMinimized, setAiMinimized] = useState<DockedWindowIcon | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geometryDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const blueprintDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const blueprintResizeRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const aiDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  function handleToolChange(nextTool: ToolMode) {
    onToolChange(nextTool);
    if (nextTool === "add-furniture") setGeometryOpen(true);
  }

  const geometryPanelMode = tool === "add-furniture" ? "assets" : "placed";
  const geometryPanelTitle = geometryPanelMode === "assets" ? "Furniture" : "Geometry";

  function minimizeFloatingPanel(selector: string, onMinimize: (icon: DockedWindowIcon) => void) {
    const panel = document.querySelector<HTMLElement>(selector);
    if (!panel) return;
    onMinimize(dockedIconFromRect(panel.getBoundingClientRect()));
  }

  function beginGeometryPanelDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    const dragHandle = event.currentTarget;
    const panel = dragHandle.closest<HTMLElement>("[data-geometry-panel]");
    const panelRect = panel?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? 296;
    const panelHeight = panelRect?.height ?? 384;
    geometryDragRef.current = {
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: geometryPanelPosition?.x ?? panelRect?.left ?? 60,
      startY: geometryPanelPosition?.y ?? panelRect?.top ?? 12,
    };
    dragHandle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const session = geometryDragRef.current;
      if (!session || session.pointerId !== moveEvent.pointerId) return;

      setGeometryPanelPosition(
        clampPanelPosition(
          session.startX + moveEvent.clientX - session.startClientX,
          session.startY + moveEvent.clientY - session.startClientY,
          panelWidth,
          panelHeight,
        ),
      );
    }

    function endDrag(endEvent: PointerEvent) {
      const session = geometryDragRef.current;
      if (!session || session.pointerId !== endEvent.pointerId) return;
      geometryDragRef.current = null;

      try {
        dragHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }

      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", endDrag, { capture: true });
      window.removeEventListener("pointercancel", endDrag, { capture: true });
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", endDrag, { capture: true });
    window.addEventListener("pointercancel", endDrag, { capture: true });
  }

  function beginBlueprintPanelDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    const dragHandle = event.currentTarget;
    const panel = dragHandle.closest<HTMLElement>("[data-blueprint-panel]");
    const panelRect = panel?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? blueprintPanelSize.width;
    const panelHeight = panelRect?.height ?? blueprintPanelSize.height;
    blueprintDragRef.current = {
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: blueprintPanelPosition?.x ?? panelRect?.left ?? window.innerWidth - 340,
      startY: blueprintPanelPosition?.y ?? panelRect?.top ?? 12,
    };
    dragHandle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const session = blueprintDragRef.current;
      if (!session || session.pointerId !== moveEvent.pointerId) return;

      setBlueprintPanelPosition(
        clampPanelPosition(
          session.startX + moveEvent.clientX - session.startClientX,
          session.startY + moveEvent.clientY - session.startClientY,
          panelWidth,
          panelHeight,
        ),
      );
    }

    function endDrag(endEvent: PointerEvent) {
      const session = blueprintDragRef.current;
      if (!session || session.pointerId !== endEvent.pointerId) return;
      blueprintDragRef.current = null;

      try {
        dragHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }

      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", endDrag, { capture: true });
      window.removeEventListener("pointercancel", endDrag, { capture: true });
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", endDrag, { capture: true });
    window.addEventListener("pointercancel", endDrag, { capture: true });
  }

  function beginBlueprintPanelResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const resizeHandle = event.currentTarget;
    blueprintResizeRef.current = {
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: blueprintPanelSize.width,
      startHeight: blueprintPanelSize.height,
    };
    resizeHandle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const session = blueprintResizeRef.current;
      if (!session || session.pointerId !== moveEvent.pointerId) return;

      setBlueprintPanelSize({
        width: Math.min(560, Math.max(260, session.startWidth + moveEvent.clientX - session.startClientX)),
        height: Math.min(520, Math.max(160, session.startHeight + moveEvent.clientY - session.startClientY)),
      });
    }

    function endResize(endEvent: PointerEvent) {
      const session = blueprintResizeRef.current;
      if (!session || session.pointerId !== endEvent.pointerId) return;
      blueprintResizeRef.current = null;

      try {
        resizeHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }

      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", endResize, { capture: true });
      window.removeEventListener("pointercancel", endResize, { capture: true });
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", endResize, { capture: true });
    window.addEventListener("pointercancel", endResize, { capture: true });
  }

  function beginAIPanelDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    const dragHandle = event.currentTarget;
    const panel = dragHandle.closest<HTMLElement>("[data-ai-panel]");
    const panelRect = panel?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? 448;
    const panelHeight = panelRect?.height ?? 480;
    aiDragRef.current = {
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: aiPanelPosition?.x ?? panelRect?.left ?? window.innerWidth / 2 - 224,
      startY: aiPanelPosition?.y ?? panelRect?.top ?? window.innerHeight - 520,
    };
    dragHandle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const session = aiDragRef.current;
      if (!session || session.pointerId !== moveEvent.pointerId) return;

      setAiPanelPosition(
        clampPanelPosition(
          session.startX + moveEvent.clientX - session.startClientX,
          session.startY + moveEvent.clientY - session.startClientY,
          panelWidth,
          panelHeight,
        ),
      );
    }

    function endDrag(endEvent: PointerEvent) {
      const session = aiDragRef.current;
      if (!session || session.pointerId !== endEvent.pointerId) return;
      aiDragRef.current = null;

      try {
        dragHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }

      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", endDrag, { capture: true });
      window.removeEventListener("pointercancel", endDrag, { capture: true });
    }

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", endDrag, { capture: true });
    window.addEventListener("pointercancel", endDrag, { capture: true });
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[var(--color-background)]">
      <div className="absolute inset-0">{scene}</div>

      <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)]">
          <ToolRail
            tool={tool}
            activeKind={activeShapeKind}
            onToolChange={handleToolChange}
            onKindChange={onActiveShapeKindChange}
          />
        </div>

        {geometryMinimized ? (
          <DockedWindowButton
            icon={Layers3}
            label={`Restore ${geometryPanelTitle}`}
            dock={geometryMinimized}
            onClick={() => {
              setGeometryOpen(true);
              setGeometryMinimized(null);
            }}
          />
        ) : (
          <div
            data-geometry-panel
            className="pointer-events-auto absolute flex w-[18.5rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2"
            style={
              geometryPanelPosition
                ? { left: geometryPanelPosition.x, top: geometryPanelPosition.y }
                : { left: "calc(3.75rem + 0.5rem)", top: "calc(env(safe-area-inset-top) + 0.75rem)" }
            }
          >
            {geometryOpen ? (
              <FloatingSurface className="h-[min(24rem,calc(100dvh-20rem))]">
                <WidgetHeader
                  icon={Layers3}
                  title={geometryPanelTitle}
                  draggable
                  onPointerDown={beginGeometryPanelDrag}
                  action={
                    <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUploadModel(file);
                          event.currentTarget.value = "";
                        }}
                      />
                      <IconButton label="Upload GLB or GLTF" onClick={() => fileInputRef.current?.click()}>
                        <FileUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label={`Minimize ${geometryPanelTitle}`}
                        onClick={() => minimizeFloatingPanel("[data-geometry-panel]", setGeometryMinimized)}
                      >
                        <Minus className="size-4" />
                      </IconButton>
                    </div>
                  }
                />
                {upload.status === "failed" ? (
                  <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-danger)]">
                    {upload.error}
                  </div>
                ) : upload.status === "ready" ? (
                  <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    Imported {upload.fileName}
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">{geometryPanelMode === "assets" ? furniture : geometry}</div>
              </FloatingSurface>
            ) : (
              <button
                type="button"
                onClick={() => setGeometryOpen(true)}
                className="grid size-10 place-items-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)] [backdrop-filter:var(--panel-blur)]"
                aria-label="Open geometry panel"
              >
                <Layers3 className="size-4" />
              </button>
            )}
          </div>
        )}

        {blueprintMinimized ? (
          <DockedWindowButton
            icon={Map}
            label="Restore blueprint"
            dock={blueprintMinimized}
            onClick={() => setBlueprintMinimized(null)}
          />
        ) : (
          <div
            data-blueprint-panel
            className="pointer-events-auto absolute hidden max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-[calc(100vw-1.5rem)] flex-col gap-2 lg:flex"
            style={
              blueprintPanelPosition
                ? {
                    left: blueprintPanelPosition.x,
                    top: blueprintPanelPosition.y,
                    width: blueprintPanelSize.width,
                    height: blueprintPanelSize.height,
                  }
                : {
                    right: "0.75rem",
                    top: "calc(env(safe-area-inset-top) + 0.75rem)",
                    width: blueprintPanelSize.width,
                    height: blueprintPanelSize.height,
                  }
            }
          >
            <BlueprintMini
              onExpand={() => setBlueprintOpen(true)}
              onDragStart={beginBlueprintPanelDrag}
              onResizeStart={beginBlueprintPanelResize}
              onMinimize={() => minimizeFloatingPanel("[data-blueprint-panel]", setBlueprintMinimized)}
            >
              {blueprint}
            </BlueprintMini>
          </div>
        )}

        {aiMinimized ? (
          <DockedWindowButton
            icon={WandSparkles}
            label="Restore Generate result"
            dock={aiMinimized}
            onClick={() => setAiMinimized(null)}
          />
        ) : (
          <div
            data-ai-panel
            className="pointer-events-auto absolute flex w-[min(32rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col"
            style={
              aiPanelPosition
                ? { left: aiPanelPosition.x, top: aiPanelPosition.y }
                : {
                    left: "50%",
                    bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
                    transform: "translateX(-50%)",
                  }
            }
          >
            <FloatingSurface className="max-h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
              <WidgetHeader
                icon={WandSparkles}
                title="Generate result"
                draggable
                onPointerDown={beginAIPanelDrag}
                action={
                  <div onPointerDown={(event) => event.stopPropagation()}>
                    <IconButton
                      label="Minimize Generate result"
                      onClick={() => minimizeFloatingPanel("[data-ai-panel]", setAiMinimized)}
                    >
                      <Minus className="size-4" />
                    </IconButton>
                  </div>
                }
              />
              <div className="thin-scrollbar min-h-0 flex-1 overflow-auto">{ai}</div>
            </FloatingSurface>
          </div>
        )}

        <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onLoadExample}
            className="grid size-9 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
            aria-label="Load sample result"
            title="Load sample result"
          >
            <EyeOff className="size-4" />
          </button>
          <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-overlay)] px-2 text-[11px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-panel)]">
            Ref
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={panoramaOpacity}
              onChange={(event) => onPanoramaOpacityChange(Number(event.target.value))}
              className="w-20 accent-[var(--color-accent-clay)]"
            />
          </label>
        </div>
      </div>

      <WorkspaceDialog open={blueprintOpen} onOpenChange={setBlueprintOpen} title="Blueprint" description="Live room schematic">
        <div className="h-[min(72dvh,42rem)]">{blueprintDialog}</div>
      </WorkspaceDialog>
    </main>
  );
}

function ToolRail({
  tool,
  activeKind,
  onToolChange,
  onKindChange,
}: {
  tool: ToolMode;
  activeKind: ShapeKind;
  onToolChange: (tool: ToolMode) => void;
  onKindChange: (kind: ShapeKind) => void;
}) {
  const [shapeOpen, setShapeOpen] = useState(false);
  const shapeVisible = shapeOpen || tool === "add-shape";

  function handleToolChange(nextTool: ToolMode) {
    if (nextTool === "add-shape") {
      setShapeOpen((open) => (tool === "add-shape" ? !open : true));
      onToolChange(nextTool);
      return;
    }

    setShapeOpen(false);
    onToolChange(nextTool);
  }

  function handleKindChange(kind: ShapeKind) {
    onKindChange(kind);
    setShapeOpen(true);
  }

  return (
    <div className="relative flex items-start">
      <nav className="flex w-12 flex-col items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] p-1.5 shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]">
        <div className="mb-0.5 grid size-8 place-items-center rounded-md bg-[var(--color-accent-clay)] text-[var(--color-background)] shadow-[var(--shadow-float)]">
          <Sparkles className="size-4" />
        </div>
        <ToolGroup
          items={tools}
          tool={tool}
          onToolChange={handleToolChange}
          expandedTool={shapeVisible ? "add-shape" : null}
        />
      </nav>
      {shapeVisible ? (
        <ShapeGroup tool={tool} activeKind={activeKind} onKindChange={handleKindChange} />
      ) : null}
    </div>
  );
}

function ToolGroup({
  items,
  tool,
  onToolChange,
  expandedTool,
}: {
  items: typeof tools;
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  expandedTool?: ToolMode | null;
}) {
  return (
    <div className="grid gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToolChange(item.id)}
            aria-label={item.label}
            aria-pressed={tool === item.id}
            aria-expanded={item.id === "add-shape" ? expandedTool === item.id : undefined}
            title={item.label}
            className={cn(
              "relative grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]",
              tool === item.id &&
                "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent-clay)_42%,transparent)]",
            )}
          >
            {tool === item.id ? (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent-hover)]" />
            ) : null}
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function ShapeGroup({
  tool,
  activeKind,
  onKindChange,
}: {
  tool: ToolMode;
  activeKind: ShapeKind;
  onKindChange: (kind: ShapeKind) => void;
}) {
  return (
    <div className="w-36 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_94%,transparent)] p-1.5 shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]">
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Primitive</div>
      <div className="grid gap-1">
      {shapeOptions.map((item) => {
        const Icon = item.icon;
        const selected = tool === "add-shape" && activeKind === item.kind;
        return (
          <button
            key={item.kind}
            type="button"
            onClick={() => onKindChange(item.kind)}
            aria-label={`Add ${item.label}`}
            aria-pressed={selected}
            title={item.label}
            className={cn(
              "relative grid h-8 grid-cols-[1.5rem_1fr] items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]",
              selected &&
                "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent-clay)_42%,transparent)]",
            )}
          >
            {selected ? (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent-hover)]" />
            ) : null}
            <Icon className="size-4" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function BlueprintMini({
  children,
  onExpand,
  onDragStart,
  onResizeStart,
  onMinimize,
}: {
  children: React.ReactNode;
  onExpand: () => void;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onMinimize: () => void;
}) {
  return (
    <FloatingSurface className="relative h-full">
      <WidgetHeader
        icon={Map}
        title="Blueprint"
        draggable
        onPointerDown={onDragStart}
        action={
          <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
            <IconButton label="Minimize blueprint" onClick={onMinimize}>
              <Minus className="size-4" />
            </IconButton>
            <IconButton label="Expand blueprint" onClick={onExpand}>
              <Expand className="size-4" />
            </IconButton>
          </div>
        }
      />
      <div className="min-h-0 flex-1">{children}</div>
      <button
        type="button"
        aria-label="Resize blueprint"
        title="Resize blueprint"
        className="absolute bottom-0 right-0 size-5 cursor-nwse-resize rounded-tl-md border-l border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_94%,transparent)] text-[var(--color-text-muted)] hover:bg-[var(--color-inset)]"
        onPointerDown={onResizeStart}
      >
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-current" />
      </button>
    </FloatingSurface>
  );
}

function DockedWindowButton({
  icon: Icon,
  label,
  dock,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  dock: DockedWindowIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="pointer-events-auto absolute grid size-10 place-items-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_94%,transparent)] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)] [backdrop-filter:var(--panel-blur)]"
      style={dockedIconStyle(dock)}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </button>
  );
}

function WorkspaceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[rgba(11,10,8,0.72)]" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(64rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</Dialog.Title>
              <Dialog.Description className="truncate text-xs text-[var(--color-text-muted)]">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]" aria-label={`Close ${title}`}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WidgetHeader({
  icon: Icon,
  title,
  action,
  draggable,
  onPointerDown,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
  draggable?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-between border-b border-[var(--color-border)] px-2",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      onPointerDown={onPointerDown}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-[var(--color-accent-hover)]" />
        <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{title}</span>
      </div>
      {action}
    </div>
  );
}

function FloatingSurface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
