"use client";

import type { RoomBounds } from "../../state/types";
import { roomDimensions } from "../../state/editor";
import { GridCanvas } from "./GridCanvas";
import { DimensionPill } from "./DimensionPill";

type ViewportProps = {
  room: RoomBounds;
  children: React.ReactNode;
};

export function Viewport({ room, children }: ViewportProps) {
  const dims = roomDimensions(room);

  return (
    <div
      className="cursor-viewport"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-void)",
      }}
    >
      <GridCanvas />
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
      <DimensionPill width={dims.width} depth={dims.depth} />
    </div>
  );
}
