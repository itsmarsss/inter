import { useCallback, useRef, useState } from "react";
import { generateFurnitureWithMeshy } from "./api/meshy";
import { generateRoomWithMarble } from "./api/marble";
import { AIDesignPanel } from "./components/AIDesignPanel";
import { BlueprintView } from "./components/BlueprintView";
import { DockableLayout } from "./components/DockableLayout";
import { FurnitureGenerator } from "./components/FurnitureGenerator";
import { GeneratedRoomPreview } from "./components/GeneratedRoomPreview";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SceneView } from "./components/SceneView";
import { Toolbar } from "./components/Toolbar";
import { createFurnitureAsset, initialState } from "./state/editor";
import type { CaptureImage, EditorState } from "./state/types";

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

  const marbleBusy = state.marble.status === "uploading" || state.marble.status === "generating";

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-slate-100">
      <Toolbar
        tool={state.tool}
        onToolChange={(tool) => setState((current) => ({ ...current, tool }))}
        onGenerateFinal={handleGenerateFinalRoom}
        generating={marbleBusy}
      />
      <DockableLayout
        state={state}
        setPanelOpen={(panel, open) =>
          setState((current) => ({ ...current, panels: { ...current.panels, [panel]: open } }))
        }
        scene={
          <SceneView
            room={state.room}
            assets={state.furnitureAssets}
            instances={state.furnitureInstances}
            selected={state.selected}
            tool={state.tool}
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
        ai={
          <AIDesignPanel
            prompt={state.stylePrompt}
            marble={state.marble}
            onPromptChange={(stylePrompt) => setState((current) => ({ ...current, stylePrompt }))}
            onGenerate={handleGenerateFinalRoom}
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
