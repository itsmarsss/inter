"use client";

import { Minus } from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";

type PlaceholderPanelProps = {
  open: boolean;
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  description: string;
  onClose: () => void;
};

export function PlaceholderPanel({ open, title, icon: Icon, description, onClose }: PlaceholderPanelProps) {
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
        <Icon size={13} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-bright)",
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-ui)",
            flex: 1,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <PanelIconBtn label="Collapse panel" icon={<Minus size={11} strokeWidth={1.5} />} onClick={onClose} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "0 24px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 11,
          lineHeight: 1.55,
          fontFamily: "var(--font-ui)",
        }}
      >
        <Icon size={28} strokeWidth={1} color="var(--text-ghost)" />
        <div>
          <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
            Coming soon
          </div>
          {description}
        </div>
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
      title={label}
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
