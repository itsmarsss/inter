import { Box, Cuboid, MousePointer2, Move, RotateCw, Scaling, Sparkles } from "lucide-react";
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
  { id: "add-furniture", label: "Add Furniture", icon: Box },
];

export function Toolbar({ tool, onToolChange, onGenerateFinal, generating }: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <div className="grid size-8 place-items-center rounded bg-teal-400 text-slate-950">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Marble Studio</h1>
            <p className="text-[11px] text-slate-500">Blockout to generated world</p>
          </div>
        </div>
        <nav className="flex items-center overflow-hidden rounded border border-slate-800 bg-slate-900">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToolChange(item.id)}
                aria-pressed={tool === item.id}
                className={cn(
                  "flex h-9 items-center gap-2 border-r border-slate-800 px-3 text-xs font-medium text-slate-400 last:border-r-0 hover:bg-slate-800 hover:text-slate-100",
                  tool === item.id && "bg-slate-800 text-teal-200",
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
        className="flex h-9 items-center gap-2 rounded bg-teal-400 px-4 text-sm font-semibold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        <Sparkles className="size-4" />
        {generating ? "Generating" : "Generate Final Room"}
      </button>
    </header>
  );
}
