"use client";

import type { RoomBounds } from "../../state/types";
import { GridCanvas } from "./GridCanvas";

type ViewportProps = {
  room: RoomBounds;
  children: React.ReactNode;
};

export function Viewport({ room: _room, children }: ViewportProps) {
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
    </div>
  );
}
