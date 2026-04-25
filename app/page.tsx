"use client";

import { useCallback, useEffect, useState } from "react";
import EditorApp from "../src/App";
import LandingPage from "../src/components/LandingPage";

type Phase = "landing" | "zooming" | "editor";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [editorMounted, setEditorMounted] = useState(false);

  // Mount the editor early so it's ready behind the landing page
  useEffect(() => {
    const t = setTimeout(() => setEditorMounted(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Keyboard shortcut: Enter to launch
  useEffect(() => {
    if (phase !== "landing") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleEnter();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleEnter = useCallback(() => {
    if (phase !== "landing") return;
    // Phase 1: landing page fades out (handled inside LandingPage)
    // Phase 2: after 700ms, start zoom-in of editor
    setPhase("zooming");
    setTimeout(() => setPhase("editor"), 1200);
  }, [phase]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a0f" }}>
      {/* Editor — mounted behind the landing page, zooms in on transition */}
      {editorMounted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transition:
              phase === "zooming"
                ? "opacity 0.9s ease 0.1s, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s"
                : "none",
            opacity: phase === "landing" ? 0 : 1,
            transform:
              phase === "landing"
                ? "scale(1.12)"
                : phase === "zooming"
                  ? "scale(1)"
                  : "scale(1)",
            pointerEvents: phase === "editor" ? "auto" : "none",
          }}
        >
          <EditorApp />
        </div>
      )}

      {/* Sidebar slide-in overlay — appears after zoom */}
      {phase !== "landing" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Landing page — sits on top, fades out on enter */}
      {phase === "landing" && <LandingPage onEnter={handleEnter} />}

      {/* Transition flash — brief white flash bridges the two phases */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a0f",
          zIndex: 99,
          pointerEvents: "none",
          transition:
            phase === "zooming"
              ? "opacity 0.5s ease 0s"
              : phase === "editor"
                ? "opacity 0.4s ease 0s"
                : "none",
          opacity: phase === "zooming" ? 0.6 : 0,
        }}
      />
    </div>
  );
}
