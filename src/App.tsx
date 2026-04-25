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
import {
  buildFurnitureAssetMap,
  createFurnitureAsset,
  createUploadedFurnitureAsset,
  initialState,
} from "./state/editor";
import type { CaptureImage, EditorState } from "./state/types";

export default function App() {
  const [state, setState] = useState<EditorState>(() => ({ ...initialState }));
  const hoveredGeometry: EditorState["selected"] = null;
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
          activeShapeKind={state.activeShapeKind}
          selected={state.selected}
          hovered={hoveredGeometry}
          tool={state.tool}
          marble={state.marble}
          panoramaOpacity={state.panoramaOpacity}
          onRoomChange={(room) => setState((current) => ({ ...current, room }))}
          onInstancesChange={(furnitureInstances) =>
            setState((current) => ({ ...current, furnitureInstances }))
          }
          onShapesChange={(customShapes) => setState((current) => ({ ...current, customShapes }))}
          onCamerasChange={(cameras) => setState((current) => ({ ...current, cameras }))}
          onSelect={(selected) => setState((current) => ({ ...current, selected }))}
          onToolChange={(tool) => setState((current) => ({ ...current, tool }))}
          registerSceneCapture={registerSceneCapture}
        />
      }
      furnitureAssets={state.furnitureAssets}
      furnitureInstances={state.furnitureInstances}
      room={state.room}
      onGenerateFurniture={handleGenerateFurniture}
      panoramaOpacity={state.panoramaOpacity}
      onPanoramaOpacityChange={(panoramaOpacity) => setState((current) => ({ ...current, panoramaOpacity }))}
      upload={state.upload}
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

