import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Cuboid,
  Expand,
  Layers3,
  Map,
  MousePointer2,
  Move,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Scaling,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { roomDimensions } from "../state/editor";
import type { FurnitureAsset, FurnitureInstance, MarbleResult, RoomBounds, SelectedRef, ToolMode } from "../state/types";

type InspectorTab = "properties" | "ai" | "preview";

type WorkspaceLayoutProps = {
  room: RoomBounds;
  selected: SelectedRef;
  assets: FurnitureAsset[];
  instances: FurnitureInstance[];
  marble: MarbleResult;
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  onGenerateFinal: () => void;
  generating: boolean;
  scene: React.ReactNode;
  furniture: React.ReactNode;
  blueprint: React.ReactNode;
  blueprintDialog: React.ReactNode;
  ai: React.ReactNode;
  preview: React.ReactNode;
  properties: React.ReactNode;
};

const tools: Array<{ id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "move", label: "Move", icon: Move },
  { id: "rotate", label: "Rotate", icon: RotateCw },
  { id: "scale", label: "Scale", icon: Scaling },
  { id: "add-wall", label: "Add Wall", icon: Cuboid },
  { id: "add-furniture", label: "Add Furniture", icon: Box },
];

const transformTools = tools.slice(0, 4);
const createTools = tools.slice(4);

export function WorkspaceLayout({
  room,
  selected,
  assets,
  instances,
  marble,
  tool,
  onToolChange,
  onGenerateFinal,
  generating,
  scene,
  furniture,
  blueprint,
  blueprintDialog,
  ai,
  preview,
  properties,
}: WorkspaceLayoutProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [promptOpen, setPromptOpen] = useState(true);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dimensions = roomDimensions(room);
  const readyAssets = assets.filter((asset) => asset.status === "ready" || asset.status === "mock").length;
  const busy = marble.status === "uploading" || marble.status === "generating";

  return (
    <main className="relative h-dvh overflow-hidden bg-[var(--color-background)]">
      <div className="absolute inset-0">{scene}</div>

      <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex items-start gap-2">
          <ToolRail tool={tool} onToolChange={onToolChange} />
          <div className="flex w-[18.5rem] max-w-[calc(100vw-5.5rem)] flex-col gap-2">
            <TopWidget
              assetsOpen={assetsOpen}
              onAssetsOpenChange={setAssetsOpen}
              dimensions={`${dimensions.width}m x ${dimensions.depth}m x ${dimensions.height}m`}
              assetCount={readyAssets}
              instanceCount={instances.length}
              generating={generating}
              onGenerateFinal={onGenerateFinal}
            />
            {assetsOpen ? (
              <FloatingSurface className="h-[min(25rem,calc(100dvh-12rem))]">
                <WidgetHeader
                  icon={Layers3}
                  title="Geometry"
                  action={
                    <IconButton label="Collapse asset browser" onClick={() => setAssetsOpen(false)}>
                      <PanelLeftClose className="size-4" />
                    </IconButton>
                  }
                />
                <div className="min-h-0 flex-1">{furniture}</div>
              </FloatingSurface>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-auto absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] hidden max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[20.5rem] flex-col gap-2 lg:flex">
          {inspectorOpen ? (
            <RightInspector
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              onCollapse={() => setInspectorOpen(false)}
              selected={selected}
              marble={marble}
              properties={properties}
              ai={ai}
              preview={preview}
              onPreviewExpand={() => setPreviewOpen(true)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="ml-auto grid size-10 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
              aria-label="Open inspector"
            >
              <PanelRightOpen className="size-4" />
            </button>
          )}
          <BlueprintMini onExpand={() => setBlueprintOpen(true)}>{blueprint}</BlueprintMini>
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2">
          {promptOpen ? (
            <FloatingSurface>
              <WidgetHeader
                icon={WandSparkles}
                title="Chisel Scene"
                action={
                  <IconButton label="Collapse generation prompt" onClick={() => setPromptOpen(false)}>
                    <ChevronRight className="size-4 rotate-90" />
                  </IconButton>
                }
              />
              {ai}
            </FloatingSurface>
          ) : (
            <button
              type="button"
              onClick={() => setPromptOpen(true)}
              className="mx-auto flex h-11 items-center gap-2 rounded-md bg-[var(--color-accent-clay)] px-4 text-sm font-semibold text-[var(--color-background)] shadow-[var(--shadow-panel)] hover:bg-[var(--color-accent-hover)]"
            >
              <WandSparkles className="size-4" />
              Create World
            </button>
          )}
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 flex items-center gap-2">
          <StatusChip label="Tool" value={toolLabel(tool)} />
          <StatusChip label="Objects" value={String(instances.length)} />
          <StatusChip label="Marble" value={busy ? "Working" : marble.status} />
        </div>
      </div>

      <WorkspaceDialog open={blueprintOpen} onOpenChange={setBlueprintOpen} title="Blueprint" description="Live room schematic">
        <div className="h-[min(72dvh,42rem)]">{blueprintDialog}</div>
      </WorkspaceDialog>

      <WorkspaceDialog open={previewOpen} onOpenChange={setPreviewOpen} title="Generated Room" description="World Labs Marble output">
        <div className="h-[min(76dvh,44rem)]">{preview}</div>
      </WorkspaceDialog>
    </main>
  );
}

function ToolRail({ tool, onToolChange }: { tool: ToolMode; onToolChange: (tool: ToolMode) => void }) {
  return (
    <nav className="flex w-12 flex-col items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] p-1.5 shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]">
      <div className="mb-0.5 grid size-8 place-items-center rounded-md bg-[var(--color-accent-clay)] text-[var(--color-background)] shadow-[var(--shadow-float)]">
        <Sparkles className="size-4" />
      </div>
      <ToolGroup items={transformTools} tool={tool} onToolChange={onToolChange} />
      <div className="my-0.5 h-px w-7 bg-[var(--color-border)]" />
      <ToolGroup items={createTools} tool={tool} onToolChange={onToolChange} />
    </nav>
  );
}

function ToolGroup({
  items,
  tool,
  onToolChange,
}: {
  items: typeof tools;
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
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

function TopWidget({
  assetsOpen,
  onAssetsOpenChange,
  dimensions,
  assetCount,
  instanceCount,
  generating,
  onGenerateFinal,
}: {
  assetsOpen: boolean;
  onAssetsOpenChange: (open: boolean) => void;
  dimensions: string;
  assetCount: number;
  instanceCount: number;
  generating: boolean;
  onGenerateFinal: () => void;
}) {
  return (
    <FloatingSurface className="gap-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">Marble Studio</h1>
          <p className="truncate text-[11px] text-[var(--color-text-muted)]">Scene blockout cockpit</p>
        </div>
        <IconButton
          label={assetsOpen ? "Hide asset browser" : "Show asset browser"}
          onClick={() => onAssetsOpenChange(!assetsOpen)}
        >
          {assetsOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[11px] tabular-nums text-[var(--color-text-muted)]">
        <Metric label="Room" value={dimensions} />
        <Metric label="Assets" value={String(assetCount)} />
        <Metric label="Placed" value={String(instanceCount)} />
      </div>
      <button
        type="button"
        onClick={onGenerateFinal}
        disabled={generating}
        className="flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-accent-clay)] px-3 text-sm font-semibold text-[var(--color-background)] shadow-[var(--shadow-float)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)] disabled:shadow-none"
      >
        <Sparkles className="size-4" />
        {generating ? "Generating" : "Create World"}
      </button>
    </FloatingSurface>
  );
}

function RightInspector({
  activeTab,
  onActiveTabChange,
  onCollapse,
  selected,
  marble,
  properties,
  ai,
  preview,
  onPreviewExpand,
}: {
  activeTab: InspectorTab;
  onActiveTabChange: (tab: InspectorTab) => void;
  onCollapse: () => void;
  selected: SelectedRef;
  marble: MarbleResult;
  properties: React.ReactNode;
  ai: React.ReactNode;
  preview: React.ReactNode;
  onPreviewExpand: () => void;
}) {
  return (
    <FloatingSurface className="h-[min(35rem,calc(100dvh-12rem))]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">Chisel Scene</h2>
          <p className="truncate text-[11px] text-[var(--color-text-muted)]">{selectionLabel(selected)}</p>
        </div>
        <IconButton label="Collapse inspector" onClick={onCollapse}>
          <PanelRightClose className="size-4" />
        </IconButton>
      </div>
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => onActiveTabChange(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List className="grid grid-cols-3 gap-1 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_42%,transparent)] p-1" aria-label="Inspector tabs">
          <InspectorTabButton value="properties" label="Properties" />
          <InspectorTabButton value="ai" label="Chisel" />
          <InspectorTabButton value="preview" label="Result" />
        </Tabs.List>
        <Tabs.Panel value="properties" className="thin-scrollbar min-h-0 flex-1 overflow-auto">
          {properties}
        </Tabs.Panel>
        <Tabs.Panel value="ai" className="thin-scrollbar min-h-0 flex-1 overflow-auto">
          {ai}
        </Tabs.Panel>
        <Tabs.Panel value="preview" className="thin-scrollbar min-h-0 flex-1 overflow-auto">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">{marble.status}</span>
            <button
              type="button"
              onClick={onPreviewExpand}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
            >
              <Expand className="size-3.5" />
              Expand
            </button>
          </div>
          {preview}
        </Tabs.Panel>
      </Tabs.Root>
    </FloatingSurface>
  );
}

function InspectorTabButton({ value, label }: { value: InspectorTab; label: string }) {
  return (
    <Tabs.Tab
      value={value}
      className="h-8 rounded-md px-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)] data-[selected]:bg-[var(--color-accent-soft)] data-[selected]:text-[var(--color-accent-hover)]"
    >
      {label}
    </Tabs.Tab>
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
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 text-[var(--color-accent-hover)]" />
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
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_94%,transparent)] shadow-[var(--shadow-panel)] [backdrop-filter:var(--panel-blur)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]"
    >
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-inset)] px-2 py-1">
      <div className="truncate text-[var(--color-text-muted)]">{label}</div>
      <div className="truncate font-medium text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-overlay)_92%,transparent)] px-2 py-1 text-[11px] shadow-[var(--shadow-float)] [backdrop-filter:var(--panel-blur)] sm:block">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="ml-1 font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function selectionLabel(selected: SelectedRef) {
  if (!selected) return "Room overview";
  if (selected.type === "wall") return `${selected.id} wall`;
  return "Furniture object";
}

function toolLabel(tool: ToolMode) {
  return tools.find((item) => item.id === tool)?.label ?? tool;
}
