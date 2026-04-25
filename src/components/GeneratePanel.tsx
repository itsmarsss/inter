"use client";

import { Loader2, RotateCw, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { MarbleResult } from "../state/types";

type GeneratePanelProps = {
  prompt: string;
  marble: MarbleResult;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onCancelRun: () => void;
};

function statusLine(marble: MarbleResult): string | null {
  if (marble.error) return marble.error;
  if (marble.status === "uploading") return "Uploading scene…";
  if (marble.status === "generating") return "Generating world…";
  if (marble.status === "complete") return "Generation complete.";
  return null;
}

export function GeneratePanel({
  prompt,
  marble,
  onPromptChange,
  onGenerate,
  onCancelRun,
}: GeneratePanelProps) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = marble.status === "uploading" || marble.status === "generating";
  const hasResult = marble.status === "complete";
  const canGenerate = prompt.trim().length > 0 && !busy;
  const line = statusLine(marble);
  const isError = Boolean(marble.error);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 62,
        left: "50%",
        transform: "translateX(-50%)",
        width: 420,
        background: "var(--surface-raised)",
        border: `1px solid ${focused ? "var(--accent-border)" : "var(--border-dim)"}`,
        borderRadius: 9,
        zIndex: 15,
        pointerEvents: "auto",
        transition: "border-color 140ms",
        overflow: "hidden",
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      {/* Prompt row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 12px 6px",
        }}
      >
        <Sparkles
          size={13}
          strokeWidth={1.5}
          color={focused ? "var(--accent-text)" : "var(--text-secondary)"}
          style={{ marginTop: 2, flexShrink: 0, transition: "color 140ms" }}
        />
        <textarea
          ref={textareaRef}
          className="precision-textarea"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
          }}
          placeholder="Turn this into a warm living room…"
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 12,
            fontFamily: "var(--font-ui)",
            color: "var(--text-bright)",
            lineHeight: 1.6,
            padding: 0,
          }}
        />
      </div>

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 12px 10px",
          gap: 8,
        }}
      >
        {/* Status / hint */}
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "var(--font-ui)",
            color: isError ? "var(--status-error)" : "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {line ?? (
            <span style={{ color: "var(--text-ghost)" }}>⌘ Return to generate</span>
          )}
        </span>

        {/* Cancel */}
        {busy && (
          <button
            type="button"
            onClick={onCancelRun}
            style={{
              height: 26,
              padding: "0 8px",
              borderRadius: 5,
              border: "1px solid var(--border-dim)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-ui)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "border-color 120ms, color 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-mid)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-dim)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <X size={10} strokeWidth={2} />
            Cancel
          </button>
        )}

        {/* Generate */}
        <GenerateButton
          busy={busy}
          hasResult={hasResult}
          canGenerate={canGenerate}
          onClick={onGenerate}
        />
      </div>
    </div>
  );
}

function GenerateButton({
  busy,
  hasResult,
  canGenerate,
  onClick,
}: {
  busy: boolean;
  hasResult: boolean;
  canGenerate: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const disabled = !canGenerate;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 26,
        padding: "0 10px",
        borderRadius: 5,
        border: "none",
        background: disabled
          ? "var(--surface-overlay)"
          : hovered
          ? "var(--accent)"
          : "var(--accent-dim)",
        color: disabled ? "var(--text-ghost)" : hovered ? "#fff" : "var(--accent-text)",
        fontSize: 11,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        outline: "none",
        boxShadow: disabled
          ? "none"
          : hovered
          ? "none"
          : `inset 0 0 0 1px var(--accent-border)`,
        flexShrink: 0,
        whiteSpace: "nowrap",
        transition: "background 140ms, color 140ms, box-shadow 140ms",
      }}
    >
      {busy ? (
        <Loader2 size={11} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
      ) : hasResult ? (
        <RotateCw size={11} strokeWidth={2} />
      ) : (
        <Sparkles size={11} strokeWidth={1.5} />
      )}
      {busy ? "Working…" : hasResult ? "Regenerate" : "Generate"}
    </button>
  );
}
