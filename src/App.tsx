"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMeshyStreamUpdate,
  isTerminalMeshyUpdate,
  openFurnitureMeshyStream,
  startFurnitureMeshyTask,
} from "./api/meshy";
import { PrecisionLayout } from "./components/PrecisionLayout";
import { SceneView } from "./components/SceneView";
import { BlueprintView } from "./components/BlueprintView";
import type { ViewMode } from "./components/ModeBar";
import {
  buildFurnitureAssetMap,
  createDefaultWallSegmentation,
  createDoor,
  createFurnitureAsset,
  createUploadedFurnitureAsset,
  createWindowOpening,
  initialState,
  removeWallSegment,
} from "./state/editor";
import type { CaptureImage, EditorState } from "./state/types";

export default function App({ entering = false }: { entering?: boolean }) {
  const [state, setState] = useState<EditorState>(() => ({ ...initialState }));
  const [viewMode, setViewMode] = useState<ViewMode>("Block");
  const sceneCaptureRef = useRef<() => CaptureImage | undefined>(() => undefined);
  const blueprintCaptureRef = useRef<() => string | undefined>(() => undefined);
  const generationRunRef = useRef(0);
  const furnitureStreamsRef = useRef<Map<string, EventSource>>(new Map());
  const assetById = useMemo(() => buildFurnitureAssetMap(state.furnitureAssets), [state.furnitureAssets]);

  const registerSceneCapture = useCallback((capture: () => CaptureImage | undefined) => {
    sceneCaptureRef.current = capture;
  }, []);

  const registerBlueprintCapture = useCallback((capture: () => string | undefined) => {
    blueprintCaptureRef.current = capture;
  }, []);

  async function handleGenerateFurniture(prompt: string) {
    const asset = createFurnitureAsset(prompt);
    setState((current) => ({
      ...current,
      furnitureAssets: [{ ...asset, status: "generating", progress: 0 }, ...current.furnitureAssets],
    }));

    const started = await startFurnitureMeshyTask({ ...asset, status: "generating", progress: 0 });
    setState((current) => ({
      ...current,
      furnitureAssets: current.furnitureAssets.map((item) => (item.id === asset.id ? started : item)),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewMode(splatUrl ? "Splat" : "Block");
  }, [splatUrl]);

  async function handleGenerateFinalRoom() {
    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;

    const totalDurationMs = 25_000;
    const startedAt = performance.now();

    setState((current) => ({
      ...current,
      marble: { status: "uploading", progress: 0, etaMs: totalDurationMs },
    }));

    // Tiny "uploading" beat so the UI doesn't snap straight to generating
    await sleep(450);
    if (generationRunRef.current !== runId) return;

    setState((current) => ({
      ...current,
      marble: { status: "generating", progress: 0.02, etaMs: totalDurationMs - 450 },
    }));

    // Drive a non-linear progress curve — small ticks, occasional long stalls,
    // and short "burst" jumps. Caps just shy of 100% so the final tick is the
    // moment the splat URL becomes available.
    let progress = 0.02;
    let nextStallUntil = 0;
    while (true) {
      const elapsed = performance.now() - startedAt;
      const elapsedFraction = Math.min(1, elapsed / totalDurationMs);

      // A "smooth target" we're chasing — still nonlinear (cubic ease-out) so
      // the bar feels lively early and slow late.
      const smoothTarget = 1 - Math.pow(1 - elapsedFraction, 3);

      // Sometimes stall for a chunk of time to imitate a real loader. Pick a
      // new stall window every couple of seconds when one isn't already armed.
      if (performance.now() > nextStallUntil && Math.random() < 0.18 && progress < 0.92) {
        nextStallUntil = performance.now() + 600 + Math.random() * 1800;
      }

      const stalled = performance.now() < nextStallUntil;

      if (!stalled) {
        // Normal step: chase the smooth target, occasionally jump ahead.
        const gap = Math.max(0, smoothTarget - progress);
        const jitter = (Math.random() - 0.35) * 0.012;
        let step = gap * 0.18 + Math.max(0, jitter);
        if (Math.random() < 0.06) step += 0.04 + Math.random() * 0.06; // burst
        progress = Math.min(0.985, progress + step);
      } else {
        // Tiny dribble during stalls so the bar isn't perfectly frozen.
        progress = Math.min(0.97, progress + 0.0008);
      }

      const etaMs = Math.max(0, totalDurationMs - elapsed);
      const snapshot = progress;
      setState((current) => {
        if (current.marble.status !== "generating") return current;
        return {
          ...current,
          marble: { ...current.marble, progress: snapshot, etaMs },
        };
      });

      if (elapsed >= totalDurationMs) break;
      await sleep(120 + Math.random() * 180);
      if (generationRunRef.current !== runId) return;
    }

    if (generationRunRef.current !== runId) return;

    setState((current) => ({
      ...current,
      marble: {
        status: "complete",
        progress: 1,
        etaMs: 0,
        spzUrl: LOCAL_SPLAT_URL,
      },
    }));
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

  const setRoom: React.ComponentProps<typeof SceneView>["onRoomChange"] = (room) =>
    setState((current) => ({ ...current, room }));
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
    setState((current) => ({ ...current, wallSegments }));
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

  function handleRemoveWallSegment(wall: Parameters<typeof removeWallSegment>[1], id: string) {
    setState((current) => ({
      ...current,
      wallSegments: removeWallSegment(current.wallSegments, wall, id),
      selected:
        current.selected?.type === "wall-segment" && current.selected.id === id
          ? null
          : current.selected,
    }));
  }

  function handleResetWallSegments() {
    setState((current) => ({
      ...current,
      wallSegments: createDefaultWallSegmentation(),
      selected: current.selected?.type === "wall-segment" ? null : current.selected,
    }));
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
          onDoorsChange={() => undefined}
          onWindowsChange={() => undefined}
          registerBlueprintCapture={registerBlueprintCapture}
          interactive={false}
        />
      }
      furnitureAssets={state.furnitureAssets}
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
      onRemoveWallSegment={handleRemoveWallSegment}
      onResetWallSegments={handleResetWallSegments}
      onGenerateFurniture={handleGenerateFurniture}
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

/**
 * Pre-baked splat we render in place of the (now disabled) WorldLabs Marble
 * generation pipeline. Served by Next.js as a static asset out of `public/`.
 */
const LOCAL_SPLAT_URL = "/splats/sleek-icelandic-bedroom.spz";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
