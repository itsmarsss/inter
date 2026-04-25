"use client";

import { Box, Camera, Layers2, Package, Settings2, WandSparkles } from "lucide-react";
import { type ComponentType, useState } from "react";

export type RailSection = "scenes" | "objects" | "furniture" | "viewpoints" | "world";

const TOP_ITEMS: Array<{
  id: RailSection;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "scenes", label: "Scenes", icon: Layers2 },
  { id: "objects", label: "Objects", icon: Box },
  { id: "furniture", label: "Furniture", icon: Package },
  { id: "viewpoints", label: "Viewpoints", icon: Camera },
  { id: "world", label: "World Generation", icon: WandSparkles },
];

type IconRailProps = {
  activeSection: RailSection;
  panelOpen: boolean;
  onSectionChange: (section: RailSection) => void;
};

export function IconRail({ activeSection, panelOpen, onSectionChange }: IconRailProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 44,
        background: "var(--surface-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 2,
        zIndex: 20,
        borderRight: panelOpen ? "none" : "1px solid var(--border-dim)",
      }}
    >
      {TOP_ITEMS.map(({ id, label, icon: Icon }) => (
        <RailButton
          key={id}
          label={label}
          icon={Icon}
          isActive={activeSection === id && panelOpen}
          onClick={() => onSectionChange(id)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <RailButton
        label="Settings"
        icon={Settings2}
        isActive={false}
        onClick={() => {}}
      />
    </div>
  );
}

function RailButton({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  isActive: boolean;
  onClick: () => void;
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
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 5,
        border: "none",
        background: isActive
          ? "var(--accent-dim)"
          : hovered
          ? "var(--surface-overlay)"
          : "transparent",
        cursor: "pointer",
        position: "relative",
        color: isActive
          ? "var(--accent-text)"
          : hovered
          ? "var(--text-primary)"
          : "var(--text-secondary)",
        transition: "color 120ms ease, background 120ms ease",
      }}
    >
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: -8,
            top: 6,
            bottom: 6,
            width: 2,
            borderRadius: "0 2px 2px 0",
            background: "var(--accent)",
          }}
        />
      )}
      <Icon size={15} strokeWidth={1.5} />
    </button>
  );
}
