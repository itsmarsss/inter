import { Loader2, Send, TerminalSquare } from "lucide-react";
import type { MarbleResult } from "../state/types";

type AIDesignPanelProps = {
  prompt: string;
  marble: MarbleResult;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
};

export function AIDesignPanel({ prompt, marble, onPromptChange, onGenerate }: AIDesignPanelProps) {
  const busy = marble.status === "uploading" || marble.status === "generating";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Turn this into a warm Scandinavian living room..."
        className="min-h-24 flex-1 resize-none rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 outline-none focus:border-teal-400"
      />
      <button
        type="button"
        onClick={onGenerate}
        disabled={busy || !prompt.trim()}
        className="flex h-10 items-center justify-center gap-2 rounded bg-teal-400 px-3 text-sm font-semibold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {busy ? "Sending to Marble" : "Generate Designed Room"}
      </button>
      <div className="rounded border border-slate-800 bg-slate-900/70 p-2">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-200">
          <TerminalSquare className="size-4 text-teal-300" />
          API State
        </div>
        <p className="text-xs text-slate-500">
          {busy
            ? "Capturing blockout views, uploading media, then polling Marble."
            : marble.error
              ? marble.error
              : "Ready to send room layout, Meshy furniture, captures, and prompt."}
        </p>
      </div>
    </div>
  );
}
