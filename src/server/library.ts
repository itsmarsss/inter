import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { LibraryEntry } from "../state/types";

const MESHES_DIR = path.join(process.cwd(), "public", "meshes");
const MANIFEST_PATH = path.join(MESHES_DIR, "manifest.json");

export async function readLibraryManifest(): Promise<LibraryEntry[]> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(raw) as LibraryEntry[];
  } catch {
    return [];
  }
}

async function writeManifest(entries: LibraryEntry[]) {
  await fs.mkdir(MESHES_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(entries, null, 2));
}

export type SaveRequest = {
  id: string;
  name: string;
  prompt: string;
  primitive: string;
  modelUrl: string;
  thumbnailUrl?: string;
  realLengthMeters?: number;
  footprint?: { width: number; depth: number; height: number };
};

export async function saveToLibrary(req: SaveRequest): Promise<LibraryEntry> {
  await fs.mkdir(MESHES_DIR, { recursive: true });

  const actualModelUrl = extractProxiedMeshyUrl(req.modelUrl);
  if (!actualModelUrl) throw new Error("Invalid model URL — expected a proxied assets.meshy.ai URL");

  const glbResponse = await fetch(actualModelUrl);
  if (!glbResponse.ok) throw new Error(`Failed to download GLB: ${glbResponse.status}`);
  const glbBuffer = Buffer.from(await glbResponse.arrayBuffer());
  await fs.writeFile(path.join(MESHES_DIR, `${req.id}.glb`), glbBuffer);

  let localThumbPath: string | undefined;
  if (req.thumbnailUrl) {
    try {
      const thumbUrl = new URL(req.thumbnailUrl);
      if (thumbUrl.protocol === "https:") {
        const thumbResponse = await fetch(req.thumbnailUrl);
        if (thumbResponse.ok) {
          const ext = req.thumbnailUrl.toLowerCase().includes(".png") ? "png" : "jpg";
          const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
          await fs.writeFile(path.join(MESHES_DIR, `${req.id}.${ext}`), thumbBuffer);
          localThumbPath = `/meshes/${req.id}.${ext}`;
        }
      }
    } catch {
      // thumbnail is best-effort
    }
  }

  const entry: LibraryEntry = {
    id: req.id,
    name: req.name,
    prompt: req.prompt,
    primitive: req.primitive as LibraryEntry["primitive"],
    localModelPath: `/meshes/${req.id}.glb`,
    localThumbPath,
    realLengthMeters: req.realLengthMeters,
    footprint: req.footprint,
    savedAt: Date.now(),
  };

  const existing = await readLibraryManifest();
  await writeManifest([entry, ...existing.filter((e) => e.id !== req.id)]);
  return entry;
}

export async function deleteFromLibrary(id: string): Promise<void> {
  const entries = await readLibraryManifest();
  const entry = entries.find((e) => e.id === id);

  if (entry) {
    await fs.unlink(path.join(MESHES_DIR, `${id}.glb`)).catch(() => {});
    if (entry.localThumbPath) {
      await fs.unlink(path.join(MESHES_DIR, path.basename(entry.localThumbPath))).catch(() => {});
    }
  }

  await writeManifest(entries.filter((e) => e.id !== id));
}

function extractProxiedMeshyUrl(proxyPath: string): string | null {
  try {
    const idx = proxyPath.indexOf("?url=");
    if (idx === -1) return null;
    const decoded = decodeURIComponent(proxyPath.slice(idx + 5));
    const url = new URL(decoded);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "assets.meshy.ai") return null;
    return decoded;
  } catch {
    return null;
  }
}
