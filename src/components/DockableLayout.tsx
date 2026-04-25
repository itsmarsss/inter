import { PanelGroup, PanelResizeHandle, Panel as ResizePanel } from "react-resizable-panels";
import type { EditorState } from "../state/types";
import { Panel } from "./Panel";

type DockableLayoutProps = {
  state: EditorState;
  setPanelOpen: (panel: keyof EditorState["panels"], open: boolean) => void;
  scene: React.ReactNode;
  furniture: React.ReactNode;
  blueprint: React.ReactNode;
  ai: React.ReactNode;
  preview: React.ReactNode;
  properties: React.ReactNode;
};

export function DockableLayout({
  state,
  setPanelOpen,
  scene,
  furniture,
  blueprint,
  ai,
  preview,
  properties,
}: DockableLayoutProps) {
  return (
    <main className="min-h-0 flex-1 bg-[var(--color-background)] p-2">
      <PanelGroup direction="horizontal" className="h-full gap-2">
        <ResizePanel minSize={48} defaultSize={62}>
          <PanelGroup direction="vertical" className="h-full gap-2">
            <ResizePanel minSize={48} defaultSize={70}>
              <Panel title="Scene View" eyebrow="Drag walls, drop Meshy assets, transform furniture" className="h-full">
                {scene}
              </Panel>
            </ResizePanel>
            {state.panels.preview ? (
              <>
                <ResizeHandle />
                <ResizePanel minSize={18} defaultSize={30}>
                  <Panel
                    title="Generated Room"
                    eyebrow="World Labs Marble output"
                    className="h-full"
                    onClose={() => setPanelOpen("preview", false)}
                  >
                    {preview}
                  </Panel>
                </ResizePanel>
              </>
            ) : null}
          </PanelGroup>
        </ResizePanel>
        <ResizeHandle />
        <ResizePanel minSize={26} defaultSize={38}>
          <PanelGroup direction="vertical" className="h-full gap-2">
            {state.panels.furniture ? (
              <ResizePanel minSize={22} defaultSize={34}>
                <Panel
                  title="Furniture Generator"
                  eyebrow="Meshy text-to-3D"
                  className="h-full"
                  onClose={() => setPanelOpen("furniture", false)}
                >
                  {furniture}
                </Panel>
              </ResizePanel>
            ) : null}
            {state.panels.blueprint ? (
              <>
                <ResizeHandle />
                <ResizePanel minSize={22} defaultSize={28}>
                  <Panel
                    title="Blueprint"
                    eyebrow="Live schematic"
                    className="h-full"
                    onClose={() => setPanelOpen("blueprint", false)}
                  >
                    {blueprint}
                  </Panel>
                </ResizePanel>
              </>
            ) : null}
            {state.panels.ai ? (
              <>
                <ResizeHandle />
                <ResizePanel minSize={20} defaultSize={23}>
                  <Panel
                    title="AI Design"
                    eyebrow="World Labs Marble"
                    className="h-full"
                    onClose={() => setPanelOpen("ai", false)}
                  >
                    {ai}
                  </Panel>
                </ResizePanel>
              </>
            ) : null}
            {state.panels.properties ? (
              <>
                <ResizeHandle />
                <ResizePanel minSize={16} defaultSize={15}>
                  <Panel
                    title="Properties"
                    eyebrow="Selected object"
                    className="h-full"
                    onClose={() => setPanelOpen("properties", false)}
                  >
                    {properties}
                  </Panel>
                </ResizePanel>
              </>
            ) : null}
          </PanelGroup>
        </ResizePanel>
      </PanelGroup>
    </main>
  );
}

function ResizeHandle() {
  return <PanelResizeHandle className="panel-resize rounded bg-[var(--color-surface)] transition-colors" />;
}
