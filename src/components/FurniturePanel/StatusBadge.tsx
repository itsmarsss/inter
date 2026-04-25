"use client";

import type { FurnitureStatus } from "../../state/types";

type BadgeConfig = {
  label: string;
  bg: string;
  color: string;
  border: string;
  pulse?: boolean;
};

const BADGE_MAP: Record<string, BadgeConfig> = {
  ready: {
    label: "READY",
    bg: "var(--status-ready-bg)",
    color: "var(--status-ready)",
    border: "var(--status-ready-border)",
  },
  mock: {
    label: "READY",
    bg: "var(--status-ready-bg)",
    color: "var(--status-ready)",
    border: "var(--status-ready-border)",
  },
  generating: {
    label: "GENERATING",
    bg: "var(--status-generating-bg)",
    color: "var(--status-generating)",
    border: "var(--status-generating-border)",
    pulse: true,
  },
  queued: {
    label: "QUEUED",
    bg: "var(--status-generating-bg)",
    color: "var(--status-generating)",
    border: "var(--status-generating-border)",
    pulse: true,
  },
  failed: {
    label: "FAILED",
    bg: "var(--status-error-bg)",
    color: "var(--status-error)",
    border: "var(--status-error-border)",
  },
};

export function StatusBadge({ status }: { status: FurnitureStatus }) {
  const badge = BADGE_MAP[status] ?? BADGE_MAP.ready;

  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 500,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.07em",
        padding: "2px 5px",
        borderRadius: 3,
        border: `1px solid ${badge.border}`,
        background: badge.bg,
        color: badge.color,
        whiteSpace: "nowrap",
        flexShrink: 0,
        animation: badge.pulse ? "pulse-opacity 1.4s ease-in-out infinite" : undefined,
        lineHeight: 1.4,
      }}
    >
      {badge.label}
    </span>
  );
}
