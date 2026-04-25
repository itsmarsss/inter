import { Box, Camera, Cuboid, MousePointer2, Move, RotateCw, Scaling, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";
import type { ToolMode } from "../state/types";

type ToolbarProps = {
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  onGenerateFinal: () => void;
  generating: boolean;
};

const tools: Array<{ id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "move", label: "Move", icon: Move },
  { id: "rotate", label: "Rotate", icon: RotateCw },
  { id: "scale", label: "Scale", icon: Scaling },
  { id: "add-wall", label: "Add Wall", icon: Cuboid },
  { id: "add-furniture", label: "Generate 3D Model", icon: Box },
  { id: "add-camera", label: "Add Camera", icon: Camera },
];

export function Toolbar({ tool, onToolChange, onGenerateFinal, generating }: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <div className="grid size-8 place-items-center rounded bg-[var(--color-accent-clay)] text-[var(--color-background)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Marble Studio</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">Blockout to generated world</p>
          </div>
        </div>
        <nav className="flex items-center overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToolChange(item.id)}
                aria-pressed={tool === item.id}
                className={cn(
                  "flex h-9 items-center gap-2 border-r border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-muted)] last:border-r-0 hover:bg-[var(--color-inset)] hover:text-[var(--color-text-primary)]",
                  tool === item.id && "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <button
        type="button"
        onClick={onGenerateFinal}
        disabled={generating}
        className="flex h-9 items-center gap-2 rounded bg-[var(--color-accent-clay)] px-4 text-sm font-semibold text-[var(--color-background)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-inset)] disabled:text-[var(--color-text-muted)]"
      >
        <Sparkles className="size-4" />
        {generating ? "Generating" : "Generate Final Room"}
      </button>
    </header>
  );
}
