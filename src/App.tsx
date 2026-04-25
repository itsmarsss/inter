"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateFurnitureWithMeshy } from "./api/meshy";
import { generateRoomWithMarble, pollMarbleOperation } from "./api/marble";
import { AIDesignPanel } from "./components/AIDesignPanel";
import { BlueprintView } from "./components/BlueprintView";
import { FurnitureGenerator } from "./components/FurnitureGenerator";
import { GeneratedRoomPreview } from "./components/GeneratedRoomPreview";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SceneView } from "./components/SceneView";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { createFurnitureAsset, initialState } from "./state/editor";
import type { CaptureImage, EditorState } from "./state/types";

const EXAMPLE_SPZ_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";

export default function App() {
  const [state, setState] = useState<EditorState>(initialState);
  const sceneCaptureRef = useRef<() => string | undefined>(() => undefined);
  const blueprintCaptureRef = useRef<() => string | undefined>(() => undefined);

  const registerSceneCapture = useCallback((capture: () => string | undefined) => {
    sceneCaptureRef.current = capture;
  }, []);

  const registerBlueprintCapture = useCallback((capture: () => string | undefined) => {
    blueprintCaptureRef.current = capture;
  }, []);

  async function handleGenerateFurniture(prompt: string) {
    const asset = createFurnitureAsset(prompt);
    setState((current) => ({
      ...current,
      furnitureAssets: [{ ...asset, status: "generating" }, ...current.furnitureAssets],
    }));

    const generated = await generateFurnitureWithMeshy({ ...asset, status: "generating" });
    setState((current) => ({
      ...current,
      furnitureAssets: current.furnitureAssets.map((item) => (item.id === asset.id ? generated : item)),
    }));
  }

  async function handleGenerateFinalRoom() {
    const sceneCapture = sceneCaptureRef.current?.();
    const blueprintCapture = blueprintCaptureRef.current?.();
    const captures: CaptureImage[] = [
      sceneCapture ? { role: "scene-perspective", dataUrl: sceneCapture } : null,
      sceneCapture ? { role: "scene-front", dataUrl: sceneCapture } : null,
      sceneCapture ? { role: "scene-side", dataUrl: sceneCapture } : null,
      blueprintCapture ? { role: "blueprint", dataUrl: blueprintCapture } : null,
    ].filter(Boolean) as CaptureImage[];

    setState((current) => ({ ...current, marble: { status: "uploading" } }));

    const result = await generateRoomWithMarble({
      room: state.room,
      instances: state.furnitureInstances,
      assets: state.furnitureAssets,
      stylePrompt: state.stylePrompt,
      captures,
    });

    console.log("World Labs Marble payload", result.payload);
    setState((current) => ({ ...current, marble: result }));
  }

  const loadExampleSplat = useCallback(() => {
    setState((current) => ({
      ...current,
      marble: exampleSplatResult(),
    }));
  }, []);

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
          return {
            ...current,
            marble: {
              ...current.marble,
              ...result,
              payload: result.payload ?? current.marble.payload,
              error: result.status === "generating" ? undefined : result.error,
            },
          };
        });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Marble polling failed.";
        setState((current) => {
          if (current.marble.operationId !== activeOperationId) return current;
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

  const marbleBusy = state.marble.status === "uploading" || state.marble.status === "generating";

  return (
    <div className="h-dvh overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <WorkspaceLayout
        room={state.room}
        selected={state.selected}
        assets={state.furnitureAssets}
        instances={state.furnitureInstances}
        marble={state.marble}
        tool={state.tool}
        onToolChange={(tool) => setState((current) => ({ ...current, tool }))}
        onGenerateFinal={handleGenerateFinalRoom}
        generating={marbleBusy}
        scene={
          <SceneView
            room={state.room}
            assets={state.furnitureAssets}
            instances={state.furnitureInstances}
            selected={state.selected}
            tool={state.tool}
            marble={state.marble}
            onRoomChange={(room) => setState((current) => ({ ...current, room }))}
            onInstancesChange={(furnitureInstances) =>
              setState((current) => ({ ...current, furnitureInstances }))
            }
            onSelect={(selected) => setState((current) => ({ ...current, selected }))}
            registerSceneCapture={registerSceneCapture}
          />
        }
        furniture={<FurnitureGenerator assets={state.furnitureAssets} onGenerate={handleGenerateFurniture} />}
        blueprint={
          <BlueprintView
            room={state.room}
            assets={state.furnitureAssets}
            instances={state.furnitureInstances}
            selected={state.selected}
            onSelect={(selected) => setState((current) => ({ ...current, selected }))}
            registerBlueprintCapture={registerBlueprintCapture}
          />
        }
        blueprintDialog={
          <BlueprintView
            room={state.room}
            assets={state.furnitureAssets}
            instances={state.furnitureInstances}
            selected={state.selected}
            onSelect={(selected) => setState((current) => ({ ...current, selected }))}
            registerBlueprintCapture={() => undefined}
          />
        }
        ai={
          <AIDesignPanel
            prompt={state.stylePrompt}
            marble={state.marble}
            onPromptChange={(stylePrompt) => setState((current) => ({ ...current, stylePrompt }))}
            onGenerate={handleGenerateFinalRoom}
            onLoadExample={loadExampleSplat}
          />
        }
        preview={<GeneratedRoomPreview marble={state.marble} />}
        properties={
          <PropertiesPanel
            room={state.room}
            selected={state.selected}
            assets={state.furnitureAssets}
            instances={state.furnitureInstances}
            onRoomChange={(room) => setState((current) => ({ ...current, room }))}
            onInstancesChange={(furnitureInstances) =>
              setState((current) => ({ ...current, furnitureInstances }))
            }
          />
        }
      />
    </div>
  );
}

function exampleSplatResult(): EditorState["marble"] {
  return {
    status: "complete",
    operationId: "example-spark-butterfly",
    spzUrl: EXAMPLE_SPZ_URL,
    worldUrl: EXAMPLE_SPZ_URL,
    payload: initialState.marble.payload,
  };
}
