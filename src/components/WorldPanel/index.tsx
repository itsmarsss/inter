"use client";

import { Minus, WandSparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { MarbleResult } from "../../state/types";
import { MarbleBadge } from "./MarbleBadge";

type WorldPanelProps = {
  open: boolean;
  prompt: string;
  marble: MarbleResult;
  onPromptChange: (v: string) => void;
  onGenerate: () => void;
  onCancelRun: () => void;
  onClose: () => void;
};

export function WorldPanel({
  open,
  prompt,
  marble,
  onPromptChange,
  onGenerate,
  onCancelRun,
  onClose,
}: WorldPanelProps) {
  const [focused, setFocused] = useState(false);
  const busy = marble.status === "uploading" || marble.status === "generating";
  const hasResult = marble.status === "complete";
  const canGenerate = prompt.trim().length > 0 && !busy;

  // Drive the bar from real run progress when we have it, otherwise fall back
  // to status bands so the bar still moves on legacy/edge states.
  const progressFraction =
    typeof marble.progress === "number"
      ? Math.min(1, Math.max(0, marble.progress))
      : marble.status === "uploading"
      ? 0.05
      : marble.status === "generating"
      ? 0.55
      : marble.status === "complete"
      ? 1
      : 0;
  const progressPct = `${Math.round(progressFraction * 100)}%`;

  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        top: 0,
        bottom: 0,
        width: open ? 268 : 0,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        background: "#16181d",
        borderRight: "1px solid var(--border-mid)",
        boxShadow: open ? "8px 0 28px rgba(0, 0, 0, 0.55)" : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease",
        zIndex: 15,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border-dim)",
          flexShrink: 0,
        }}
      >
        <WandSparkles size={13} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 17,
            fontWeight: 400,
            color: "var(--text-bright)",
            letterSpacing: "0.06em",
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            lineHeight: 1,
            flex: 1,
            whiteSpace: "nowrap",
          }}
        >
          World
        </span>
        <MarbleBadge status={marble.status} />
        <PanelIconBtn label="Collapse" icon={<Minus size={11} strokeWidth={1.5} />} onClick={onClose} />
      </div>

      {/* Thumbnail — shown when complete */}
      {hasResult && marble.thumbnailUrl && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border-dim)" }}>
          <img
            src={marble.thumbnailUrl}
            alt="Generated room"
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Style directive section */}
      <div style={{ padding: "10px 12px 0", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: "var(--text-secondary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-ui)",
            marginBottom: 8,
          }}
        >
          Style Directive
        </div>

        <textarea
          className="precision-textarea"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="warm oak floors, linen curtains, soft indirect light"
          rows={4}
          disabled={busy}
          style={{
            width: "100%",
            resize: "none",
            background: "var(--surface-input)",
            border: `1px solid ${focused ? "var(--accent-border)" : "var(--border-dim)"}`,
            borderRadius: 5,
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: "var(--font-ui)",
            color: "var(--text-bright)",
            outline: "none",
            lineHeight: 1.6,
            transition: "border-color 120ms",
            opacity: busy ? 0.55 : 1,
          }}
        />
      </div>

      {/* Loader — eyebrow label + thin accent bar (matches site aesthetic) */}
      {busy && !marble.error && (
        <div style={{ padding: "14px 12px 0", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "var(--font-ui)",
              }}
            >
              {marble.status === "uploading" ? "Packaging" : "Generating"}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.04em",
              }}
            >
              {progressPct}
            </span>
          </div>
          <div
            style={{
              position: "relative",
              height: 3,
              background: "var(--surface-input)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: progressPct,
                background: "var(--accent)",
                transition: "width 320ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      )}

      {/* Error line */}
      {marble.error && (
        <div
          style={{
            padding: "6px 12px 0",
            fontSize: 11,
            color: "var(--status-error)",
            fontFamily: "var(--font-ui)",
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          {marble.error}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border-dim)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {busy && (
          <FooterButton label="Cancel" onClick={onCancelRun} variant="ghost" />
        )}
        <FooterButton
          label={busy ? "Working…" : hasResult ? "Regenerate" : "Generate →"}
          onClick={onGenerate}
          disabled={!canGenerate}
          variant="accent"
          busy={busy}
        />
      </div>
    </div>
  );
}

function PanelIconBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "none",
        background: hovered ? "var(--surface-overlay)" : "transparent",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 100ms, color 100ms",
      }}
    >
      {icon}
    </button>
  );
}

function FooterButton({
  label,
  onClick,
  disabled,
  variant,
  busy,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "accent" | "ghost";
  busy?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: 26,
          padding: "0 9px",
          borderRadius: 5,
          border: `1px solid ${hovered ? "var(--border-mid)" : "var(--border-dim)"}`,
          background: "transparent",
          color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 11,
          fontFamily: "var(--font-ui)",
          cursor: "pointer",
          transition: "border-color 120ms, color 120ms",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
    );
  }

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
        border: disabled
          ? "1px solid transparent"
          : hovered
          ? "1px solid transparent"
          : "1px solid var(--accent-border)",
        background: disabled
          ? "var(--surface-input)"
          : hovered
          ? "var(--accent)"
          : "var(--accent-dim)",
        color: disabled
          ? "var(--text-ghost)"
          : hovered
          ? "#fff"
          : "var(--accent-text)",
        fontSize: 11,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        transition: "background 140ms, color 140ms, border-color 140ms",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </button>
  );
}
