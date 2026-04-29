import type { FurnitureAsset, LibraryEntry } from "../state/types";

export async function fetchLibrary(): Promise<LibraryEntry[]> {
  try {
    const res = await fetch("/api/library");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function saveAssetToLibrary(asset: FurnitureAsset): Promise<LibraryEntry | null> {
  if (!asset.modelUrl) return null;
  try {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: asset.id,
        name: asset.name,
        prompt: asset.prompt,
        primitive: asset.primitive,
        modelUrl: asset.modelUrl,
        thumbnailUrl: asset.thumbnailUrl,
        realLengthMeters: asset.realLengthMeters,
        footprint: asset.footprint,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function deleteAssetFromLibrary(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/library/${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export function libraryEntryToAsset(entry: LibraryEntry): FurnitureAsset {
  // Use the entry's own id so the asset is stable across sessions and
  // SceneView's assetById map can look it up immediately on drag-drop.
  return {
    id: entry.id,
    name: entry.name,
    prompt: entry.prompt,
    primitive: entry.primitive,
    status: "ready",
    modelUrl: entry.localModelPath,
    thumbnailUrl: entry.localThumbPath,
    realLengthMeters: entry.realLengthMeters,
    footprint: entry.footprint,
    createdAt: entry.savedAt,
  };
}
