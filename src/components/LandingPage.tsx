"use client";

import { useEffect, useRef, useState } from "react";
import RippleGrid from "./RippleGrid";

interface LandingPageProps {
  isTilting: boolean;
  onEnter: () => void;
}

export default function LandingPage({ isTilting, onEnter }: LandingPageProps) {
  const [uiVisible, setUiVisible] = useState(false);
  const triggered = useRef(false);

  // Fade in UI on mount
  useEffect(() => {
    const t = setTimeout(() => setUiVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    if (isTilting) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleEnter();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function handleEnter() {
    if (triggered.current || isTilting) return;
    triggered.current = true;
    onEnter();
  }

  const uiHidden = isTilting;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#090a0c",
        // Fade the whole landing page out near the end of the tilt
        transition: "opacity 0.5s ease",
        opacity: 1,
        overflow: "hidden",
      }}
    >
      {/*
       * Perspective container — perspectiveOrigin at 50% 54% matches
       * exactly the GridCanvas vanishing point (vy = H * 0.54).
       */}
      <div
        style={{
          position: "absolute",
          // Slightly oversized so edges don't show gaps after transforms
          inset: "-5%",
          perspective: "1000px",
          perspectiveOrigin: "50% 54%",
        }}
      >
        {/*
         * The grid element rotates around its bottom edge (transformOrigin 100%).
         * Start: scale(1.3) = zoomed in.  End: rotateX(65deg) scale(1.0) = floor perspective.
         * CSS applies transforms right-to-left: scale first, then rotateX.
         */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "50% 100%",
            transition: isTilting
              ? "transform 1400ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
            transform: isTilting
              ? "rotateX(65deg) scale(1.0)"
              : "rotateX(0deg) scale(1.3)",
          }}
        >
          <RippleGrid
            gridColor="#4a7fc8"
            rippleIntensity={isTilting ? 0.015 : 0.04}
            gridSize={7}
            gridThickness={52}
            glowIntensity={0}
            opacity={1.0}
            vignetteStrength={1.6}
            fadeDistance={1.8}
            mouseInteraction={!isTilting}
            mouseInteractionRadius={1.3}
          />
        </div>
      </div>

      {/* Dark radial vignette for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 65% 60% at 50% 50%, transparent 10%, rgba(9,10,12,0.5) 55%, rgba(9,10,12,0.9) 100%)",
          pointerEvents: "none",
          // Fade out this vignette during tilt so grid edges are visible
          transition: "opacity 0.6s ease",
          opacity: isTilting ? 0.4 : 1,
          zIndex: 1,
        }}
      />

      {/* UI content — fades out when tilt starts */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: uiHidden ? "none" : "auto",
          transition: "opacity 0.25s ease, transform 0.3s ease",
          opacity: uiHidden ? 0 : uiVisible ? 1 : 0,
          transform: uiHidden
            ? "scale(0.96) translateY(-16px)"
            : uiVisible
              ? "scale(1) translateY(0)"
              : "scale(1) translateY(20px)",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(79,70,229,0.13)",
            border: "1px solid rgba(99,102,241,0.28)",
            borderRadius: 999,
            padding: "5px 15px",
            marginBottom: 26,
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#818cf8",
              display: "inline-block",
              boxShadow: "0 0 6px #818cf8",
            }}
          />
          <span
            style={{
              color: "#a5b4fc",
              fontSize: 11,
              letterSpacing: "0.1em",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            AI-POWERED 3D INTERIOR DESIGN
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "clamp(2.6rem, 6.5vw, 5.2rem)",
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            lineHeight: 1.06,
            textAlign: "center",
            letterSpacing: "-0.03em",
            fontFamily: "inherit",
            transition: "opacity 0.7s ease 0.18s, transform 0.7s ease 0.18s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(14px)",
          }}
        >
          Design Your Space.
          <br />
          <span
            style={{
              backgroundImage:
                "linear-gradient(135deg, #818cf8 0%, #c084fc 45%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Powered by AI.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            marginTop: 22,
            color: "rgba(255,255,255,0.4)",
            fontSize: "clamp(0.9rem, 1.8vw, 1.1rem)",
            textAlign: "center",
            maxWidth: 460,
            lineHeight: 1.65,
            fontFamily: "inherit",
            fontWeight: 400,
            transition: "opacity 0.7s ease 0.26s, transform 0.7s ease 0.26s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          Generate, place, and preview 3D furniture in real-time.
          <br />
          Your room, your vision — rendered instantly.
        </p>

        {/* CTA */}
        <button
          onClick={handleEnter}
          style={{
            marginTop: 42,
            padding: "14px 44px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #4f46e5, #9333ea)",
            color: "#fff",
            fontSize: "0.975rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.05em",
            fontFamily: "inherit",
            boxShadow: "0 0 36px rgba(79,70,229,0.45), 0 2px 10px rgba(0,0,0,0.5)",
            transition:
              "opacity 0.7s ease 0.34s, transform 0.7s ease 0.34s, box-shadow 0.18s ease",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(10px)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 56px rgba(79,70,229,0.65), 0 4px 20px rgba(0,0,0,0.55)";
            e.currentTarget.style.transform = "translateY(-1px) scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 36px rgba(79,70,229,0.45), 0 2px 10px rgba(0,0,0,0.5)";
            e.currentTarget.style.transform = "translateY(0) scale(1)";
          }}
        >
          Open Editor →
        </button>

        {/* Hint */}
        <p
          style={{
            marginTop: 52,
            color: "rgba(255,255,255,0.16)",
            fontSize: "0.72rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            transition: "opacity 0.7s ease 0.5s",
            opacity: uiVisible ? 1 : 0,
          }}
        >
          Press Enter or click above to begin
        </p>
      </div>
    </div>
  );
}
