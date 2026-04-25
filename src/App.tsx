"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMeshyStreamUpdate,
  isTerminalMeshyUpdate,
  openFurnitureMeshyStream,
  startFurnitureMeshyTask,
} from "./api/meshy";
import { generateRoomWithMarble, pollMarbleOperation } from "./api/marble";
import { PrecisionLayout } from "./components/PrecisionLayout";
import { SceneView } from "./components/SceneView";
import { BlueprintView } from "./components/BlueprintView";
import type { ViewMode } from "./components/ModeBar";
import {
  buildFurnitureAssetMap,
  clampToRoom,
  effectiveBoundsForRoom,
  createDefaultWallSegmentation,
  createDoor,
  createFurnitureAsset,
  createUploadedFurnitureAsset,
  createWindowOpening,
  initialState,
  removeWallSegment,
} from "./state/editor";
import type { CaptureImage, EditorState } from "./state/types";

export default function App() {
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
    const layoutPanoCapture = sceneCaptureRef.current?.();
    const blueprintCapture = blueprintCaptureRef.current?.();
    const captures: CaptureImage[] = [
      layoutPanoCapture ?? null,
      blueprintCapture ? { role: "blueprint", dataUrl: blueprintCapture } : null,
    ].filter(Boolean) as CaptureImage[];

    setState((current) => ({ ...current, marble: { status: "uploading" } }));

    const result = await generateRoomWithMarble({
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
    setState((current) => ({ ...current, marble: result }));
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

  useEffect(() => {
    const operationId = state.marble.operationId;
    if (state.marble.status !== "generating" || !operationId) return;
    const activeOperationId = operationId;

    let active = true;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await pollMarbleOperation(activeOperationId);
        if (!active) return;
        setState((current) => {
          if (current.marble.operationId !== activeOperationId) return current;
          const nextMarble = {
            ...current.marble,
            ...result,
            payload: result.payload ?? current.marble.payload,
            error: result.status === "generating" ? undefined : result.error,
          };
          if (sameMarbleResult(current.marble, nextMarble)) return current;
          return {
            ...current,
            marble: nextMarble,
          };
        });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Marble polling failed.";
        setState((current) => {
          if (current.marble.operationId !== activeOperationId) return current;
          if (
            current.marble.status === "generating" &&
            current.marble.operationId === activeOperationId &&
            current.marble.error === message
          ) {
            return current;
          }
          return {
            ...current,
            marble: {
              ...current.marble,
              status: "generating",
              operationId: activeOperationId,
              error: message,
            },
          };
        });
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const intervalId = window.setInterval(() => void poll(), 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [state.marble.operationId, state.marble.status]);

  const setRoom: React.ComponentProps<typeof SceneView>["onRoomChange"] = (room) =>
    setState((current) => {
      const bounds = effectiveBoundsForRoom(room, current.wallSegments);
      return {
        ...current,
        room,
        furnitureInstances: current.furnitureInstances.map((instance) => ({
          ...instance,
          position: clampToRoom(instance.position, bounds),
        })),
        customShapes: current.customShapes.map((shape) => ({
          ...shape,
          position: clampToRoom(shape.position, bounds),
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
      const bounds = effectiveBoundsForRoom(current.room, wallSegments);
      return {
        ...current,
        wallSegments,
        furnitureInstances: current.furnitureInstances.map((instance) => ({
          ...instance,
          position: clampToRoom(instance.position, bounds),
        })),
        customShapes: current.customShapes.map((shape) => ({
          ...shape,
          position: clampToRoom(shape.position, bounds),
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
      onRemoveWallSegment={handleRemoveWallSegment}
      onResetWallSegments={handleResetWallSegments}
      onGenerateFurniture={handleGenerateFurniture}
      upload={state.upload}
      stylePrompt={state.stylePrompt}
      onStylePromptChange={(stylePrompt) => setState((current) => ({ ...current, stylePrompt }))}
      marble={state.marble}
      onGenerateRoom={handleGenerateFinalRoom}
      onCancelRun={handleCancelRun}
    />
  );
}

function sameMarbleResult(left: EditorState["marble"], right: EditorState["marble"]) {
  return left.status === right.status &&
    left.operationId === right.operationId &&
    left.worldUrl === right.worldUrl &&
    left.thumbnailUrl === right.thumbnailUrl &&
    left.panoUrl === right.panoUrl &&
    left.spzUrl === right.spzUrl &&
    left.colliderMeshUrl === right.colliderMeshUrl &&
    left.error === right.error &&
    left.payload === right.payload;
}
