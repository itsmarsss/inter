// Single-slot store for the currently-dragged furniture asset ID.
// HTML5 drag-and-drop restricts dataTransfer.getData during dragenter/dragover
// (same-origin only on drop), so we mirror the value here so SceneView can
// show a ghost preview before the drop event fires.
let _id: string | null = null;

export function getDragAssetId(): string | null {
  return _id;
}

export function setDragAssetId(id: string | null): void {
  _id = id;
}
