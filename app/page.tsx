"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EditorApp from "../src/App";
import LandingPage from "../src/components/LandingPage";

/*
 * Phases:
 *  landing   — landing page visible, editor pre-mounted but invisible
 *  tilting   — grid rotates + zooms into floor perspective (~1400ms)
 *  revealing — tilt done; editor fades in, landing page fades out (500ms)
 *  entering  — editor visible; sidebars animate in (550ms)
 *  editor    — everything visible and interactive; landing unmounted
 */
type Phase = "landing" | "tilting" | "revealing" | "entering" | "editor";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("landing");
  const triggered = useRef(false);

  const handleEnter = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;

    // Start the grid tilt
    setPhase("tilting");

    // After tilt (1400ms) + small buffer: crossfade to editor
    setTimeout(() => setPhase("revealing"), 1450);

    // After crossfade (500ms): trigger sidebar slide-in
    setTimeout(() => setPhase("entering"), 1950);

    // After sidebars done (550ms): fully active
    setTimeout(() => setPhase("editor"), 2600);
  }, []);

  // Mount editor early so Three.js / shaders are compiled during landing
  const [editorMounted, setEditorMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEditorMounted(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Keep landing mounted through "revealing" so its fade-out transition can play
  const showLanding = phase === "landing" || phase === "tilting" || phase === "revealing";
  const landingOpacity = phase === "revealing" ? 0 : 1;
  const editorOpacity = phase === "landing" || phase === "tilting" ? 0 : 1;
  const isEntering = phase === "entering";

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#090a0c",
      }}
    >
      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      {editorMounted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            // Fade in when revealing; no transition while landing (stays hidden)
            transition: phase === "revealing" ? "opacity 0.5s ease" : "none",
            opacity: editorOpacity,
            pointerEvents: phase === "editor" ? "auto" : "none",
          }}
        >
          <EditorApp entering={isEntering} />
        </div>
      )}

      {/* ── Landing page (tilt + zoom) ──────────────────────────────────────── */}
      {showLanding && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            // Fade out simultaneously with editor fade-in
            transition: phase === "revealing" ? "opacity 0.5s ease" : "none",
            opacity: landingOpacity,
            pointerEvents: phase === "tilting" ? "none" : "auto",
          }}
        >
          {/* isTilting stays true through "revealing" so grid remains at floor angle while fading */}
          <LandingPage
            isTilting={phase === "tilting" || phase === "revealing"}
            onEnter={handleEnter}
          />
        </div>
      )}
    </div>
  );
}
