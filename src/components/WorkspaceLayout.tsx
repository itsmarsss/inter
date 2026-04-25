import { Dialog } from "@base-ui/react/dialog";
import {
  Box,
  Camera,
  Circle,
  Cuboid,
  Expand,
  EyeOff,
  FileUp,
  Layers3,
  Map,
  Sparkles,
  SquarePen,
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
  { id: "add-furniture", label: "Generate 3D Model", icon: Box },
  { id: "add-shape", label: "Add Shape", icon: SquarePen },
  { id: "add-camera", label: "Add Camera", icon: Camera },
];

const shapeOptions: Array<{ kind: ShapeKind; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "cube", label: "Cube", icon: Cuboid },
  { kind: "sphere", label: "Sphere", icon: Circle },
  { kind: "cylinder", label: "Cylinder", icon: Circle },
  { kind: "cone", label: "Cone", icon: Triangle },
  { kind: "plane", label: "Plane", icon: SquarePen },
];

export function WorkspaceLayout({
  upload,
  marble,
  tool,
  prompt,
  panoramaOpacity,
  onUploadModel,
  onToolChange,
  onGenerate,
  onCancelRun,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = marble.status === "uploading" || marble.status === "generating";

  function handleToolChange(nextTool: ToolMode) {
    onToolChange(nextTool);
    if (nextTool === "add-furniture") setGeometryOpen(true);
  }

  const geometryPanelMode = tool === "add-furniture" ? "assets" : "placed";
  const geometryPanelTitle = geometryPanelMode === "assets" ? "Furniture" : "Geometry";

  return (
    <main className="relative h-dvh overflow-hidden bg-[var(--color-background)]">
      <div className="absolute inset-0">{scene}</div>

      <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex items-start gap-2">
          <ToolRail
            tool={tool}
            activeKind={activeShapeKind}
            onToolChange={handleToolChange}
            onKindChange={onActiveShapeKindChange}
          />
          <div className="flex w-[18.5rem] max-w-[calc(100vw-5.5rem)] flex-col gap-2">
            {geometryOpen ? (
              <FloatingSurface className="h-[min(24rem,calc(100dvh-20rem))]">
                <WidgetHeader
                  icon={Layers3}
                  title={geometryPanelTitle}
                  action={
                    <div className="flex items-center gap-1">
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
                      <IconButton label="Close geometry panel" onClick={() => setGeometryOpen(false)}>
                        <X className="size-4" />
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
        </div>

        <div className="pointer-events-auto absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] hidden max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[20.5rem] flex-col gap-2 lg:flex">
          <BlueprintMini onExpand={() => setBlueprintOpen(true)}>{blueprint}</BlueprintMini>
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 lg:hidden">
          <FloatingSurface>
            <WidgetHeader icon={WandSparkles} title="Generate result" />
            {ai}
          </FloatingSurface>
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 hidden -translate-x-1/2 items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy || !prompt.trim()}
            className="flex h-9 items-center gap-2 rounded-md bg-[var(--color-accent-clay)] px-3 text-xs font-semibold text-[var(--color-background)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)]"
          >
            <Sparkles className="size-4" />
            Generate
          </button>
          <button
            type="button"
            onClick={onCancelRun}
            disabled={!busy}
            className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 text-xs font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-inset)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
          >
            <X className="size-4" />
            Cancel
          </button>
        </div>

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

  function handleToolChange(nextTool: ToolMode) {
    if (nextTool === "add-shape") {
      setShapeOpen((open) => !open);
      onToolChange(nextTool);
      return;
    }

    setShapeOpen(false);
    onToolChange(nextTool);
  }

  function handleKindChange(kind: ShapeKind) {
    onKindChange(kind);
    setShapeOpen(false);
  }

  return (
    <nav className="flex w-12 flex-col items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] p-1.5 shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]">
      <div className="mb-0.5 grid size-8 place-items-center rounded-md bg-[var(--color-accent-clay)] text-[var(--color-background)] shadow-[var(--shadow-float)]">
        <Sparkles className="size-4" />
      </div>
      <ToolGroup items={tools} tool={tool} onToolChange={handleToolChange} expandedTool={shapeOpen ? "add-shape" : null} />
      {shapeOpen ? (
        <>
          <div className="my-0.5 h-px w-7 bg-[var(--color-border)]" />
          <ShapeGroup tool={tool} activeKind={activeKind} onKindChange={handleKindChange} />
        </>
      ) : null}
    </nav>
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
              "relative grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]",
              selected &&
                "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent-clay)_42%,transparent)]",
            )}
          >
            {selected ? (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent-hover)]" />
            ) : null}
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function BlueprintMini({ children, onExpand }: { children: React.ReactNode; onExpand: () => void }) {
  return (
    <FloatingSurface className="h-44">
      <WidgetHeader
        icon={Map}
        title="Blueprint"
        action={
          <IconButton label="Expand blueprint" onClick={onExpand}>
            <Expand className="size-4" />
          </IconButton>
        }
      />
      <div className="min-h-0 flex-1">{children}</div>
    </FloatingSurface>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-[var(--color-border)] px-2">
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
