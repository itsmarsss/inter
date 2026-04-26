"use client";

import {
  Box,
  Camera,
  Circle,
  Cuboid,
  Cylinder,
  DoorOpen,
  Hand,
  Minus,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Scissors,
  Square,
  Trash2,
  Triangle,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import type {
  CustomShape,
  Door,
  FurnitureInstance,
  SceneCamera,
  SelectedRef,
  ShapeKind,
  ToolMode,
  WallId,
  WallSegmentation,
  WindowOpening,
} from "../state/types";

type ObjectsPanelProps = {
  open: boolean;
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  selected: SelectedRef;
  onSelect: (selected: SelectedRef) => void;
  furnitureInstances: FurnitureInstance[];
  doors: Door[];
  windows: WindowOpening[];
  wallSegments: WallSegmentation;
  shapes: CustomShape[];
  cameras: SceneCamera[];
  activeShapeKind: ShapeKind;
  onActiveShapeKindChange: (kind: ShapeKind) => void;
  onAddDoor: () => void;
  onAddWindow: () => void;
  onRemoveDoor: (id: string) => void;
  onRemoveWindow: (id: string) => void;
  onRemoveFurnitureInstance: (id: string) => void;
  onRemoveWallSegment: (wall: WallId, id: string) => void;
  onResetWallSegments: () => void;
  onClose: () => void;
};

type ToolDef = {
  id: ToolMode;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const TRANSFORM_TOOLS: ToolDef[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "move", label: "Move", icon: Hand },
];

const ARCHITECTURE_TOOLS: ToolDef[] = [
  { id: "cut-wall", label: "Cut wall (loop cut)", icon: Scissors },
  { id: "add-door", label: "Place door", icon: DoorOpen },
  { id: "add-window", label: "Place window", icon: RectangleHorizontal },
];

const INSERT_TOOLS: ToolDef[] = [
  { id: "add-shape", label: "Place shape", icon: Plus },
  { id: "add-camera", label: "Place camera", icon: Camera },
];

const SHAPE_OPTIONS: Array<{ kind: ShapeKind; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { kind: "cube", label: "Cube", icon: Cuboid },
  { kind: "sphere", label: "Sphere", icon: Circle },
  { kind: "cylinder", label: "Cylinder", icon: Cylinder },
  { kind: "cone", label: "Cone", icon: Triangle },
  { kind: "plane", label: "Plane", icon: Square },
];

function wallLabel(wall: WallId): string {
  return wall.charAt(0).toUpperCase() + wall.slice(1);
}

export function ObjectsPanel({
  open,
  tool,
  onToolChange,
  selected,
  onSelect,
  furnitureInstances,
  doors,
  windows,
  wallSegments,
  shapes,
  cameras,
  activeShapeKind,
  onActiveShapeKindChange,
  onAddDoor,
  onAddWindow,
  onRemoveDoor,
  onRemoveWindow,
  onRemoveFurnitureInstance,
  onRemoveWallSegment,
  onResetWallSegments,
  onClose,
}: ObjectsPanelProps) {
  const segmentEntries = (Object.entries(wallSegments) as Array<[WallId, WallSegmentation[WallId]]>).flatMap(
    ([wall, segments]) => segments.map((segment) => ({ wall, segment })),
  );
  const customSegments = segmentEntries.filter(({ segment }) => segment.start > 0 || segment.end < 1);

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
        fontFamily: "var(--font-ui)",
      }}
    >
      <PanelHeader title="Objects" onClose={onClose} />

      <div className="precision-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
        <ToolSection label="Transform">
          <ToolRow tools={TRANSFORM_TOOLS} tool={tool} onToolChange={onToolChange} />
        </ToolSection>

        <ToolSection label="Architecture">
          <ToolRow tools={ARCHITECTURE_TOOLS} tool={tool} onToolChange={onToolChange} />
        </ToolSection>

        <ToolSection label="Insert">
          <ToolRow tools={INSERT_TOOLS} tool={tool} onToolChange={onToolChange} />
          {tool === "add-shape" ? (
            <ShapePicker activeKind={activeShapeKind} onChange={onActiveShapeKindChange} />
          ) : null}
        </ToolSection>

        {furnitureInstances.length > 0 ? (
          <>
            <Divider />
            <ListSection label="Placed Furniture" count={furnitureInstances.length}>
              {furnitureInstances.map((instance) => (
                <ItemRow
                  key={instance.id}
                  icon={Box}
                  label={instance.name}
                  selected={selected?.type === "furniture" && selected.id === instance.id}
                  onSelect={() => onSelect({ type: "furniture", id: instance.id })}
                  onRemove={() => onRemoveFurnitureInstance(instance.id)}
                />
              ))}
            </ListSection>
          </>
        ) : null}

        <Divider />

        <ListSection
          label="Doors"
          count={doors.length}
          action={
            <RowAction
              icon={<Plus size={11} strokeWidth={1.6} />}
              label="Add door"
              onClick={onAddDoor}
            />
          }
        >
          {doors.length === 0 ? (
            <EmptyHint>No doors</EmptyHint>
          ) : (
            doors.map((door) => (
              <ItemRow
                key={door.id}
                icon={DoorOpen}
                label={door.name}
                meta={wallLabel(door.wall)}
                selected={selected?.type === "door" && selected.id === door.id}
                onSelect={() => onSelect({ type: "door", id: door.id })}
                onRemove={() => onRemoveDoor(door.id)}
              />
            ))
          )}
        </ListSection>

        <ListSection
          label="Windows"
          count={windows.length}
          action={
            <RowAction
              icon={<Plus size={11} strokeWidth={1.6} />}
              label="Add window"
              onClick={onAddWindow}
            />
          }
        >
          {windows.length === 0 ? (
            <EmptyHint>No windows</EmptyHint>
          ) : (
            windows.map((win) => (
              <ItemRow
                key={win.id}
                icon={RectangleHorizontal}
                label={win.name}
                meta={wallLabel(win.wall)}
                selected={selected?.type === "window" && selected.id === win.id}
                onSelect={() => onSelect({ type: "window", id: win.id })}
                onRemove={() => onRemoveWindow(win.id)}
              />
            ))
          )}
        </ListSection>

        <ListSection
          label="Wall cuts"
          count={customSegments.length}
          action={
            customSegments.length > 0 ? (
              <RowAction
                icon={<RotateCcw size={11} strokeWidth={1.6} />}
                label="Reset all cuts"
                onClick={onResetWallSegments}
              />
            ) : null
          }
        >
          {customSegments.length === 0 ? (
            <EmptyHint>No cuts</EmptyHint>
          ) : (
            customSegments.map(({ wall, segment }) => (
              <ItemRow
                key={`${wall}-${segment.id}`}
                icon={Scissors}
                label={`${wallLabel(wall)} cut`}
                meta={`${(segment.start * 100).toFixed(0)}–${(segment.end * 100).toFixed(0)}%`}
                selected={selected?.type === "wall-segment" && selected.id === segment.id}
                onSelect={() => onSelect({ type: "wall-segment", wall, id: segment.id })}
                onRemove={() => onRemoveWallSegment(wall, segment.id)}
              />
            ))
          )}
        </ListSection>

        {shapes.length > 0 ? (
          <ListSection label="Shapes" count={shapes.length}>
            {shapes.map((shape) => (
              <ItemRow
                key={shape.id}
                icon={Cuboid}
                label={shape.name}
                meta={shape.kind}
                selected={selected?.type === "shape" && selected.id === shape.id}
                onSelect={() => onSelect({ type: "shape", id: shape.id })}
              />
            ))}
          </ListSection>
        ) : null}

        {cameras.length > 0 ? (
          <ListSection label="Cameras" count={cameras.length}>
            {cameras.map((camera) => (
              <ItemRow
                key={camera.id}
                icon={Camera}
                label={camera.name}
                selected={selected?.type === "camera" && selected.id === camera.id}
                onSelect={() => onSelect({ type: "camera", id: camera.id })}
              />
            ))}
          </ListSection>
        ) : null}
      </div>
    </div>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        height: 40,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid var(--border-dim)",
        flexShrink: 0,
      }}
    >
      <Box size={12} strokeWidth={1.6} color="var(--accent-text)" />
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
        }}
      >
        {title}
      </span>
      <RowAction icon={<Minus size={11} strokeWidth={1.6} />} label="Collapse panel" onClick={onClose} />
    </div>
  );
}

function ToolSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ padding: "0 12px 12px" }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function ListSection({
  label,
  count,
  action,
  children,
}: {
  label: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "10px 12px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 18, marginBottom: 4 }}>
        <SectionLabel inline>{label}</SectionLabel>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-secondary)",
            letterSpacing: 0,
          }}
        >
          {count.toString().padStart(2, "0")}
        </span>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 500,
        color: "var(--text-secondary)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: inline ? 0 : 8,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border-dim)", margin: "2px 12px 8px" }} />;
}

function ToolRow({
  tools,
  tool,
  onToolChange,
}: {
  tools: ToolDef[];
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 3,
        background: "#101216",
        border: "1px solid var(--border-dim)",
        borderRadius: 5,
      }}
    >
      {tools.map(({ id, label, icon }) => (
        <ToolButton
          key={id}
          label={label}
          icon={icon}
          active={tool === id}
          onClick={() => onToolChange(id)}
        />
      ))}
    </div>
  );
}

function ToolButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: 26,
        background: active ? "var(--accent-dim)" : hovered ? "var(--surface-overlay)" : "transparent",
        border: "none",
        borderRadius: 3,
        color: active ? "var(--accent-text)" : hovered ? "var(--text-bright)" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 100ms, color 100ms",
      }}
    >
      <Icon size={13} strokeWidth={1.6} />
    </button>
  );
}

function ShapePicker({
  activeKind,
  onChange,
}: {
  activeKind: ShapeKind;
  onChange: (kind: ShapeKind) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
      {SHAPE_OPTIONS.map(({ kind, label, icon: Icon }) => {
        const active = activeKind === kind;
        return (
          <ShapeButton key={kind} label={label} active={active} onClick={() => onChange(kind)}>
            <Icon size={12} strokeWidth={1.6} />
          </ShapeButton>
        );
      })}
    </div>
  );
}

function ShapeButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: 24,
        background: active ? "var(--accent-dim)" : hovered ? "var(--surface-overlay)" : "transparent",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border-dim)"}`,
        borderRadius: 3,
        color: active ? "var(--accent-text)" : hovered ? "var(--text-bright)" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 100ms, color 100ms, border-color 100ms",
      }}
    >
      {children}
    </button>
  );
}

function ItemRow({
  icon: Icon,
  label,
  meta,
  selected,
  onSelect,
  onRemove,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  meta?: string;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderRadius: 3,
        cursor: "pointer",
        background: selected ? "var(--accent-dim)" : hovered ? "var(--surface-overlay)" : "transparent",
        color: selected ? "var(--accent-text)" : "var(--text-primary)",
        transition: "background 100ms, color 100ms",
        height: 26,
      }}
    >
      <Icon size={12} strokeWidth={1.6} />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {meta ? (
        <span
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
          }}
        >
          {meta}
        </span>
      ) : null}
      {onRemove && hovered ? (
        <button
          type="button"
          aria-label="Remove"
          title="Remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          style={{
            width: 18,
            height: 18,
            border: "none",
            borderRadius: 3,
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={11} strokeWidth={1.6} />
        </button>
      ) : null}
    </div>
  );
}

function RowAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
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
        width: 20,
        height: 20,
        borderRadius: 3,
        border: "none",
        background: hovered ? "var(--surface-overlay)" : "transparent",
        color: hovered ? "var(--text-bright)" : "var(--text-secondary)",
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

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "4px 8px",
        fontSize: 11,
        color: "var(--text-ghost)",
        fontStyle: "normal",
      }}
    >
      {children}
    </div>
  );
}
