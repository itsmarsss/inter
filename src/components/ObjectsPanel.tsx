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
  onRemoveWallSegment: (wall: WallId, id: string) => void;
  onResetWallSegments: () => void;
  onClose: () => void;
};

type ToolDef = {
  id: ToolMode;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const PRIMARY_TOOLS: ToolDef[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "move", label: "Move", icon: Hand },
];

const ARCHITECTURE_TOOLS: ToolDef[] = [
  { id: "cut-wall", label: "Cut wall (loop cut)", icon: Scissors },
  { id: "add-door", label: "Add door", icon: DoorOpen },
  { id: "add-window", label: "Add window", icon: RectangleHorizontal },
];

const SHAPE_OPTIONS: Array<{ kind: ShapeKind; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { kind: "cube", label: "Cube", icon: Cuboid },
  { kind: "sphere", label: "Sphere", icon: Circle },
  { kind: "cylinder", label: "Cylinder", icon: Cylinder },
  { kind: "cone", label: "Cone", icon: Triangle },
  { kind: "plane", label: "Plane", icon: Square },
];

export function ObjectsPanel({
  open,
  tool,
  onToolChange,
  selected,
  onSelect,
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
      }}
    >
      <PanelHeader title="Objects" icon={Box} onClose={onClose} />

      <div
        className="precision-scroll"
        style={{ flex: 1, overflowY: "auto" }}
      >
        <ToolSection title="Transform">
          <ToolGrid tools={PRIMARY_TOOLS} tool={tool} onToolChange={onToolChange} />
        </ToolSection>

        <ToolSection title="Architecture">
          <ToolGrid tools={ARCHITECTURE_TOOLS} tool={tool} onToolChange={onToolChange} />
          <Hint>
            {tool === "cut-wall"
              ? "Click anywhere on a wall to slice it, then drag to push the segment in or out."
              : tool === "add-door"
              ? "Click along a wall to drop a door."
              : tool === "add-window"
              ? "Click along a wall to drop a window."
              : "Pick a tool above to edit walls."}
          </Hint>
        </ToolSection>

        <ToolSection title="Add">
          <ToolGrid
            tools={[
              { id: "add-shape", label: "Add shape", icon: Plus },
              { id: "add-camera", label: "Add camera", icon: Camera },
              { id: "add-furniture", label: "Add furniture", icon: Box },
            ]}
            tool={tool}
            onToolChange={onToolChange}
          />
          {tool === "add-shape" ? (
            <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {SHAPE_OPTIONS.map(({ kind, label, icon: Icon }) => {
                const active = activeShapeKind === kind;
                return (
                  <ToolButton
                    key={kind}
                    label={label}
                    icon={Icon}
                    active={active}
                    onClick={() => onActiveShapeKindChange(kind)}
                  />
                );
              })}
            </div>
          ) : null}
        </ToolSection>

        <ListSection
          title="Doors"
          count={doors.length}
          action={
            <PanelIconBtn label="Add door" icon={<Plus size={11} strokeWidth={1.5} />} onClick={onAddDoor} />
          }
        >
          {doors.length === 0 ? (
            <EmptyHint>No doors yet</EmptyHint>
          ) : (
            doors.map((door) => (
              <Row
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
          title="Windows"
          count={windows.length}
          action={
            <PanelIconBtn label="Add window" icon={<Plus size={11} strokeWidth={1.5} />} onClick={onAddWindow} />
          }
        >
          {windows.length === 0 ? (
            <EmptyHint>No windows yet</EmptyHint>
          ) : (
            windows.map((win) => (
              <Row
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
          title="Wall segments"
          count={customSegments.length}
          action={
            customSegments.length > 0 ? (
              <PanelIconBtn label="Reset cuts" icon={<RotateCcw size={11} strokeWidth={1.5} />} onClick={onResetWallSegments} />
            ) : null
          }
        >
          {customSegments.length === 0 ? (
            <EmptyHint>No cuts yet — use the scissors tool</EmptyHint>
          ) : (
            customSegments.map(({ wall, segment }) => (
              <Row
                key={`${wall}-${segment.id}`}
                icon={Scissors}
                label={`${wallLabel(wall)} segment`}
                meta={`${(segment.start * 100).toFixed(0)}% – ${(segment.end * 100).toFixed(0)}%`}
                selected={selected?.type === "wall-segment" && selected.id === segment.id}
                onSelect={() => onSelect({ type: "wall-segment", wall, id: segment.id })}
                onRemove={() => onRemoveWallSegment(wall, segment.id)}
              />
            ))
          )}
        </ListSection>

        {shapes.length > 0 ? (
          <ListSection title="Shapes" count={shapes.length}>
            {shapes.map((shape) => (
              <Row
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
          <ListSection title="Cameras" count={cameras.length}>
            {cameras.map((camera) => (
              <Row
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

function PanelHeader({
  title,
  icon: Icon,
  onClose,
}: {
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  onClose: () => void;
}) {
  return (
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
  );
}

function ToolSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: "10px 10px 6px" }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

function ListSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          padding: "0 12px",
          height: 28,
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderTop: "1px solid var(--border-dim)",
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: "var(--text-primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flex: 1,
            fontFamily: "var(--font-ui)",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            background: "var(--accent-dim)",
            color: "var(--accent-text)",
            padding: "1px 6px",
            borderRadius: 3,
            border: "1px solid var(--accent-border)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.5,
          }}
        >
          {count}
        </span>
        {action}
      </div>
      <div style={{ padding: "4px 6px" }}>{children}</div>
    </div>
  );
}

function ToolGrid({
  tools,
  tool,
  onToolChange,
}: {
  tools: ToolDef[];
  tool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
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
        height: 30,
        background: active
          ? "var(--accent-dim)"
          : hovered
          ? "var(--surface-overlay)"
          : "var(--surface-input)",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border-dim)"}`,
        borderRadius: 5,
        color: active ? "var(--accent-text)" : hovered ? "var(--text-primary)" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 100ms, color 100ms, border-color 100ms",
      }}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  );
}

function Row({
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
        padding: "6px 8px",
        borderRadius: 4,
        cursor: "pointer",
        background: selected
          ? "var(--accent-dim)"
          : hovered
          ? "var(--surface-overlay)"
          : "transparent",
        color: selected ? "var(--accent-text)" : "var(--text-primary)",
        transition: "background 100ms",
      }}
    >
      <Icon size={13} strokeWidth={1.5} />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: "var(--font-ui)",
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
            textTransform: "uppercase",
          }}
        >
          {meta}
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          style={{
            width: 20,
            height: 20,
            border: "none",
            borderRadius: 4,
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={11} strokeWidth={1.5} />
        </button>
      ) : null}
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 400,
        color: "var(--text-secondary)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 6,
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        fontSize: 11,
        color: "var(--text-secondary)",
        lineHeight: 1.45,
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 8px",
        fontSize: 11,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </div>
  );
}

function wallLabel(wall: WallId): string {
  return wall.charAt(0).toUpperCase() + wall.slice(1);
}
