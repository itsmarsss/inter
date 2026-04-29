"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMeshyStreamUpdate,
  isTerminalMeshyUpdate,
  openFurnitureMeshyStream,
  startFurnitureMeshyTask,
} from "./api/meshy";
import { generateRoomWithMarble, pollMarbleOperation } from "./api/marble";
import { estimateModelLength } from "./api/dimension";
import {
  deleteAssetFromLibrary,
  fetchLibrary,
  libraryEntryToAsset,
  saveAssetToLibrary,
} from "./api/library";
import { PrecisionLayout } from "./components/PrecisionLayout";
import { SceneView } from "./components/SceneView";
import { BlueprintView } from "./components/BlueprintView";
import type { ViewMode } from "./components/ModeBar";
import {
  buildFurnitureAssetMap,
  clampOpeningsToLayout,
  clampToFloor,
  createDefaultWallSegmentation,
  createDoor,
  createFurnitureAsset,
  createUploadedFurnitureAsset,
  createWindowOpening,
  initialState,
  removeWallSegment,
} from "./state/editor";
import type { CaptureImage, EditorState, FurnitureAsset, LibraryEntry } from "./state/types";

export default function App({ entering = false }: { entering?: boolean }) {
  const [state, setState] = useState<EditorState>(() => ({ ...initialState }));
  const [viewMode, setViewMode] = useState<ViewMode>("Block");
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const sceneCaptureRef = useRef<() => CaptureImage | undefined>(() => undefined);
  const blueprintCaptureRef = useRef<() => string | undefined>(() => undefined);
  const generationRunRef = useRef(0);
  const furnitureStreamsRef = useRef<Map<string, EventSource>>(new Map());
  const assetById = useMemo(() => {
    const map = buildFurnitureAssetMap(state.furnitureAssets);
    for (const entry of libraryEntries) {
      if (!map.has(entry.id)) {
        map.set(entry.id, libraryEntryToAsset(entry));
      }
    }
    return map;
  }, [state.furnitureAssets, libraryEntries]);

  useEffect(() => {
    fetchLibrary().then(setLibraryEntries);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        setState((current) => {
          if (current.selected?.type !== "furniture" && current.selected?.type !== "shape") return current;
          const id = current.selected.id;
          if (current.selected.type === "shape") {
            return {
              ...current,
              customShapes: current.customShapes.filter((shape) => shape.id !== id),
              selected: null,
            };
          }
          return {
            ...current,
            furnitureInstances: current.furnitureInstances.filter((i) => i.id !== id),
            selected: null,
          };
        });
        return;
      }

      // [ and ] rotate the selected furniture by ±15°
      if (event.key === "[" || event.key === "]") {
        const delta = event.key === "[" ? -Math.PI / 12 : Math.PI / 12;
        setState((current) => {
          if (current.selected?.type !== "furniture") return current;
          const id = current.selected.id;
          return {
            ...current,
            furnitureInstances: current.furnitureInstances.map((i) =>
              i.id === id
                ? { ...i, rotation: [i.rotation[0], i.rotation[1] + delta, i.rotation[2]] as [number, number, number] }
                : i,
            ),
          };
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const registerSceneCapture = useCallback((capture: () => CaptureImage | undefined) => {
    sceneCaptureRef.current = capture;
  }, []);

  const registerBlueprintCapture = useCallback((capture: () => string | undefined) => {
    blueprintCaptureRef.current = capture;
  }, []);

  // The 3D viewport reports the post-scale axis-aligned size of each loaded
  // GLB so the 2D blueprint can draw an accurate top-down bounding rectangle.
  // We dedupe by comparing against the asset's current footprint with a small
  // tolerance to avoid render loops triggered by floating-point drift.
  const handleAssetMeasured = useCallback(
    (assetId: string, footprint: { width: number; depth: number; height: number }) => {
      setState((current) => {
        let changed = false;
        const furnitureAssets = current.furnitureAssets.map((item) => {
          if (item.id !== assetId) return item;
          const previous = item.footprint;
          if (
            previous &&
            Math.abs(previous.width - footprint.width) < 1e-3 &&
            Math.abs(previous.depth - footprint.depth) < 1e-3 &&
            Math.abs(previous.height - footprint.height) < 1e-3
          ) {
            return item;
          }
          changed = true;
          return { ...item, footprint };
        });
        return changed ? { ...current, furnitureAssets } : current;
      });
    },
    [],
  );

  async function handleGenerateFurniture(prompt: string) {
    const asset = createFurnitureAsset(prompt);
    setState((current) => ({
      ...current,
      furnitureAssets: [{ ...asset, status: "generating", progress: 0 }, ...current.furnitureAssets],
    }));

    // Kick off the real-world length estimate in parallel with the Meshy job.
    // This is best-effort — when it resolves we patch `realLengthMeters` onto
    // the asset; the GLB renderer will pick it up on its next render and
    // rescale accordingly. Failure (no API key, network blip, etc.) just means
    // the model renders at its native GLB scale.
    estimateModelLength(prompt).then((lengthMeters) => {
      if (lengthMeters === null) return;
      setState((current) => ({
        ...current,
        furnitureAssets: current.furnitureAssets.map((item) =>
          item.id === asset.id ? { ...item, realLengthMeters: lengthMeters } : item,
        ),
      }));
    });

    const started = await startFurnitureMeshyTask({ ...asset, status: "generating", progress: 0 });
    setState((current) => ({
      ...current,
      furnitureAssets: current.furnitureAssets.map((item) =>
        item.id === asset.id ? { ...started, realLengthMeters: item.realLengthMeters } : item,
      ),
    }));

    if (started.status !== "generating" || !started.taskId) return;

    const source = openFurnitureMeshyStream(started.taskId, {
      onUpdate: (update) => {
        setState((current) => {
          let changed = false;
          const furnitureAssets = current.furnitureAssets.map((item) => {
            if (item.id !== asset.id) return item;
            const next = applyMeshyStreamUpdate(item, update);
            changed ||= next !== item;
            return next;
          });

          return changed ? { ...current, furnitureAssets } : current;
        });

        if (isTerminalMeshyUpdate(update)) {
          furnitureStreamsRef.current.get(asset.id)?.close();
          furnitureStreamsRef.current.delete(asset.id);
        }
      },
      onError: (error) => {
        setState((current) => {
          let changed = false;
          const furnitureAssets = current.furnitureAssets.map((item) => {
            if (item.id !== asset.id || item.status !== "generating") return item;
            changed = true;
            return { ...item, status: "failed" as const, error };
          });

          return changed ? { ...current, furnitureAssets } : current;
        });
        furnitureStreamsRef.current.delete(asset.id);
      },
    });
    furnitureStreamsRef.current.set(asset.id, source);
  }

  useEffect(() => {
    const furnitureStreams = furnitureStreamsRef.current;
    return () => {
      furnitureStreams.forEach((source) => source.close());
      furnitureStreams.clear();
    };
  }, []);

  // Auto-switch to splat view when a new world finishes generating, and back to Block if it's gone.
  const splatUrl = state.marble.status === "complete" ? state.marble.spzUrl : undefined;
  useEffect(() => {
    setViewMode(splatUrl ? "Splat" : "Block");
  }, [splatUrl]);

  async function handleGenerateFinalRoom() {
    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    const startedAt = performance.now();
    const sceneCapture = sceneCaptureRef.current?.();
    const blueprintCapture = blueprintCaptureRef.current?.();
    const captures: CaptureImage[] = [
      ...(sceneCapture ? [sceneCapture] : []),
      ...(blueprintCapture
        ? [
            {
              role: "blueprint" as const,
              dataUrl: blueprintCapture,
              isPano: false,
            },
          ]
        : []),
    ];

    setState((current) => ({
      ...current,
      marble: { status: "uploading", progress: 0.02 },
    }));

    try {
      const started = await generateRoomWithMarble({
        room: state.room,
        instances: state.furnitureInstances,
        assets: state.furnitureAssets,
        assetById,
        shapes: state.customShapes,
        projectTitle: state.projectTitle,
        visibility: state.visibility,
        workflowStep: "world",
        templateId: state.selectedTemplateId,
        panoramaOpacity: state.panoramaOpacity,
        stylePrompt: state.stylePrompt,
        captures,
      });
      if (generationRunRef.current !== runId) return;

      if (started.status === "failed" || started.status === "complete") {
        setState((current) => ({
          ...current,
          marble: {
            ...started,
            progress: started.status === "complete" ? 1 : started.progress,
            etaMs: started.status === "complete" ? 0 : started.etaMs,
          },
        }));
        return;
      }

      if (!started.operationId) {
        setState((current) => ({
          ...current,
          marble: {
            ...started,
            status: "failed",
            error: "Marble did not return an operation id.",
          },
        }));
        return;
      }

      setState((current) => ({
        ...current,
        marble: {
          ...started,
          status: "generating",
          progress: Math.max(started.progress ?? 0, 0.08),
        },
      }));

      let pollCount = 0;
      while (generationRunRef.current === runId) {
        await sleep(MARBLE_POLL_INTERVAL_MS);
        if (generationRunRef.current !== runId) return;

        const result = await pollMarbleOperation(started.operationId);
        if (generationRunRef.current !== runId) return;

        if (result.status === "complete" || result.status === "failed") {
          setState((current) => ({
            ...current,
            marble: {
              ...result,
              payload: result.payload ?? started.payload,
              progress: result.status === "complete" ? 1 : result.progress,
              etaMs: result.status === "complete" ? 0 : result.etaMs,
            },
          }));
          return;
        }

        pollCount += 1;
        const elapsedMs = performance.now() - startedAt;
        const fallbackProgress = Math.min(0.95, 0.08 + 0.78 * (1 - Math.exp(-pollCount / 12)));
        const etaMs = Math.max(0, 90_000 - elapsedMs);
        setState((current) => {
          if (current.marble.status !== "generating") return current;
          return {
            ...current,
            marble: {
              ...current.marble,
              ...result,
              payload: result.payload ?? started.payload,
              progress: Math.max(current.marble.progress ?? 0, result.progress ?? fallbackProgress),
              etaMs: result.etaMs ?? etaMs,
            },
          };
        });
      }
    } catch (error) {
      if (generationRunRef.current !== runId) return;
      setState((current) => ({
        ...current,
        marble: {
          ...current.marble,
          status: "failed",
          error: error instanceof Error ? error.message : "Marble generation failed.",
        },
      }));
    }
  }

  function handleCancelRun() {
    generationRunRef.current += 1;
    setState((current) => ({ ...current, marble: { status: "idle" } }));
  }

  function handleUploadModel(file: File) {
    const valid = file.name.toLowerCase().endsWith(".glb") || file.name.toLowerCase().endsWith(".gltf");
    if (!valid) {
      setState((current) => ({
        ...current,
        upload: {
          status: "failed",
          fileName: file.name,
          error: "Use a GLB or GLTF model for direct import.",
        },
      }));
      return;
    }

    const asset = createUploadedFurnitureAsset(file);
    setState((current) => ({
      ...current,
      upload: { status: "ready", fileName: file.name },
      furnitureAssets: [asset, ...current.furnitureAssets],
    }));
  }

  function handleRemoveFurnitureInstance(id: string) {
    setState((current) => ({
      ...current,
      furnitureInstances: current.furnitureInstances.filter((i) => i.id !== id),
      selected:
        current.selected?.type === "furniture" && current.selected.id === id
          ? null
          : current.selected,
    }));
  }

  function handleRotateFurnitureInstance(id: string, deltaRad: number) {
    setState((current) => ({
      ...current,
      furnitureInstances: current.furnitureInstances.map((i) =>
        i.id === id
          ? { ...i, rotation: [i.rotation[0], i.rotation[1] + deltaRad, i.rotation[2]] as [number, number, number] }
          : i,
      ),
    }));
  }

  async function handleSaveAsset(asset: FurnitureAsset) {
    if (!asset.modelUrl || savingAssetId) return;
    setSavingAssetId(asset.id);
    const entry = await saveAssetToLibrary(asset);
    setSavingAssetId(null);
    if (entry) {
      setLibraryEntries((current) => [entry, ...current.filter((e) => e.id !== entry.id)]);
      // The saved entry's id equals the original asset id, so the existing
      // furnitureAsset record already covers it — no duplicate needed.
    }
  }

  async function handleDeleteLibraryEntry(id: string) {
    await deleteAssetFromLibrary(id);
    setLibraryEntries((current) => current.filter((e) => e.id !== id));
    setState((current) => ({
      ...current,
      furnitureInstances: current.furnitureInstances.filter((i) => i.assetId !== id),
      selected:
        current.selected?.type === "furniture" &&
        current.furnitureInstances.find((i) => i.id === current.selected?.id)?.assetId === id
          ? null
          : current.selected,
    }));
  }

  const setRoom: React.ComponentProps<typeof SceneView>["onRoomChange"] = (room) =>
    setState((current) => {
      const openings = clampOpeningsToLayout(room, current.wallSegments, current.doors, current.windows);
      return {
        ...current,
        room,
        doors: openings.doors,
        windows: openings.windows,
        furnitureInstances: current.furnitureInstances.map((instance) => ({
          ...instance,
          position: clampToFloor(instance.position, room, current.wallSegments),
        })),
        customShapes: current.customShapes.map((shape) => ({
          ...shape,
          position: clampToFloor(shape.position, room, current.wallSegments),
        })),
      };
    });
  const setInstances: React.ComponentProps<typeof SceneView>["onInstancesChange"] = (furnitureInstances) =>
    setState((current) => ({ ...current, furnitureInstances }));
  const setShapes: React.ComponentProps<typeof SceneView>["onShapesChange"] = (customShapes) =>
    setState((current) => ({ ...current, customShapes }));
  const setCameras: React.ComponentProps<typeof SceneView>["onCamerasChange"] = (cameras) =>
    setState((current) => ({ ...current, cameras }));
  const setDoors: React.ComponentProps<typeof SceneView>["onDoorsChange"] = (doors) =>
    setState((current) => ({ ...current, doors }));
  const setWindows: React.ComponentProps<typeof SceneView>["onWindowsChange"] = (windows) =>
    setState((current) => ({ ...current, windows }));
  const setWallSegments: React.ComponentProps<typeof SceneView>["onWallSegmentsChange"] = (wallSegments) =>
    setState((current) => {
      const openings = clampOpeningsToLayout(current.room, wallSegments, current.doors, current.windows);
      return {
        ...current,
        wallSegments,
        doors: openings.doors,
        windows: openings.windows,
        furnitureInstances: current.furnitureInstances.map((instance) => ({
          ...instance,
          position: clampToFloor(instance.position, current.room, wallSegments),
        })),
        customShapes: current.customShapes.map((shape) => ({
          ...shape,
          position: clampToFloor(shape.position, current.room, wallSegments),
        })),
      };
    });
  const setSelected: React.ComponentProps<typeof SceneView>["onSelect"] = (selected) =>
    setState((current) => ({ ...current, selected }));
  const setTool: React.ComponentProps<typeof SceneView>["onToolChange"] = (tool) =>
    setState((current) => ({ ...current, tool }));

  function handleAddDoor() {
    setState((current) => {
      const door = createDoor(current.room);
      return {
        ...current,
        doors: [...current.doors, door],
        selected: { type: "door", id: door.id },
      };
    });
  }

  function handleAddWindow() {
    setState((current) => {
      const win = createWindowOpening(current.room);
      return {
        ...current,
        windows: [...current.windows, win],
        selected: { type: "window", id: win.id },
      };
    });
  }

  function handleRemoveDoor(id: string) {
    setState((current) => ({
      ...current,
      doors: current.doors.filter((door) => door.id !== id),
      selected:
        current.selected?.type === "door" && current.selected.id === id
          ? null
          : current.selected,
    }));
  }

  function handleRemoveWindow(id: string) {
    setState((current) => ({
      ...current,
      windows: current.windows.filter((window) => window.id !== id),
      selected:
        current.selected?.type === "window" && current.selected.id === id
          ? null
          : current.selected,
    }));
  }

  function handleRemoveShape(id: string) {
    setState((current) => ({
      ...current,
      customShapes: current.customShapes.filter((shape) => shape.id !== id),
      selected:
        current.selected?.type === "shape" && current.selected.id === id
          ? null
          : current.selected,
    }));
  }

  function handleRemoveWallSegment(wall: Parameters<typeof removeWallSegment>[1], id: string) {
    setState((current) => {
      const wallSegments = removeWallSegment(current.wallSegments, wall, id);
      const openings = clampOpeningsToLayout(current.room, wallSegments, current.doors, current.windows);
      return {
        ...current,
        wallSegments,
        doors: openings.doors,
        windows: openings.windows,
        selected:
          current.selected?.type === "wall-segment" && current.selected.id === id
            ? null
            : current.selected,
      };
    });
  }

  function handleResetWallSegments() {
    setState((current) => {
      const wallSegments = createDefaultWallSegmentation();
      const openings = clampOpeningsToLayout(current.room, wallSegments, current.doors, current.windows);
      return {
        ...current,
        wallSegments,
        doors: openings.doors,
        windows: openings.windows,
        selected: current.selected?.type === "wall-segment" ? null : current.selected,
      };
    });
  }

  return (
    <PrecisionLayout
      viewport={
        <SceneView
          room={state.room}
          assets={state.furnitureAssets}
          assetById={assetById}
          instances={state.furnitureInstances}
          shapes={state.customShapes}
          cameras={state.cameras}
          doors={state.doors}
          windows={state.windows}
          wallSegments={state.wallSegments}
          activeShapeKind={state.activeShapeKind}
          selected={state.selected}
          hovered={null}
          tool={state.tool}
          marble={state.marble}
          panoramaOpacity={state.panoramaOpacity}
          displayMode={viewMode}
          onRoomChange={setRoom}
          onInstancesChange={setInstances}
          onShapesChange={setShapes}
          onCamerasChange={setCameras}
          onDoorsChange={setDoors}
          onWindowsChange={setWindows}
          onWallSegmentsChange={setWallSegments}
          onSelect={setSelected}
          onToolChange={setTool}
          registerSceneCapture={registerSceneCapture}
          onAssetMeasured={handleAssetMeasured}
        />
      }
      blueprint={
        <BlueprintView
          room={state.room}
          assets={state.furnitureAssets}
          assetById={assetById}
          instances={state.furnitureInstances}
          shapes={state.customShapes}
          doors={state.doors}
          windows={state.windows}
          wallSegments={state.wallSegments}
          selected={state.selected}
          tool={state.tool}
          onSelect={setSelected}
          onRoomChange={setRoom}
          onInstancesChange={setInstances}
          onShapesChange={setShapes}
          onWallSegmentsChange={setWallSegments}
          onDoorsChange={setDoors}
          onWindowsChange={setWindows}
        />
      }
      blueprintPreview={
        <BlueprintView
          room={state.room}
          assets={state.furnitureAssets}
          assetById={assetById}
          instances={state.furnitureInstances}
          shapes={state.customShapes}
          doors={state.doors}
          windows={state.windows}
          wallSegments={state.wallSegments}
          selected={state.selected}
          tool={state.tool}
          onSelect={() => undefined}
          onRoomChange={() => undefined}
          onInstancesChange={() => undefined}
          onShapesChange={() => undefined}
          onWallSegmentsChange={() => undefined}
          onDoorsChange={() => undefined}
          onWindowsChange={() => undefined}
          registerBlueprintCapture={registerBlueprintCapture}
          interactive={false}
        />
      }
      furnitureAssets={state.furnitureAssets}
      furnitureInstances={state.furnitureInstances}
      customShapes={state.customShapes}
      cameras={state.cameras}
      doors={state.doors}
      windows={state.windows}
      wallSegments={state.wallSegments}
      assetById={assetById}
      room={state.room}
      tool={state.tool}
      selected={state.selected}
      activeShapeKind={state.activeShapeKind}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onToolChange={setTool}
      onSelect={setSelected}
      onActiveShapeKindChange={(activeShapeKind) =>
        setState((current) => ({ ...current, activeShapeKind, tool: "add-shape" }))
      }
      onUploadModel={handleUploadModel}
      onAddDoor={handleAddDoor}
      onAddWindow={handleAddWindow}
      onRemoveDoor={handleRemoveDoor}
      onRemoveWindow={handleRemoveWindow}
      onRemoveFurnitureInstance={handleRemoveFurnitureInstance}
      onRotateFurnitureInstance={handleRotateFurnitureInstance}
      onRemoveShape={handleRemoveShape}
      onRemoveWallSegment={handleRemoveWallSegment}
      onResetWallSegments={handleResetWallSegments}
      onGenerateFurniture={handleGenerateFurniture}
      libraryEntries={libraryEntries}
      savingAssetId={savingAssetId}
      onSaveAsset={handleSaveAsset}
      onDeleteLibraryEntry={handleDeleteLibraryEntry}
      upload={state.upload}
      stylePrompt={state.stylePrompt}
      onStylePromptChange={(stylePrompt) => setState((current) => ({ ...current, stylePrompt }))}
      marble={state.marble}
      onGenerateRoom={handleGenerateFinalRoom}
      onCancelRun={handleCancelRun}
      entering={entering}
    />
  );
}

const MARBLE_POLL_INTERVAL_MS = 2_500;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
