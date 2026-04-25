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

  useEffect(() => {
    const t = setTimeout(() => setUiVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

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
        overflow: "hidden",
      }}
    >
      {/* Load Bebas Neue — condensed architectural display font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

        .landing-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 13px 36px;
          border: 1px solid rgba(255,255,255,0.28);
          background: transparent;
          color: rgba(255,255,255,0.75);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .landing-btn:hover {
          background: rgba(255,255,255,0.94);
          color: #090a0c;
          border-color: transparent;
        }
        .landing-btn .arrow {
          transition: transform 0.18s ease;
        }
        .landing-btn:hover .arrow {
          transform: translateX(4px);
        }
      `}</style>

      {/* Grid — perspective container */}
      <div
        style={{
          position: "absolute",
          inset: "-5%",
          perspective: "1000px",
          perspectiveOrigin: "50% 54%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "50% 100%",
            transition: isTilting
              ? "transform 1400ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
            transform: isTilting
              ? "rotateX(65deg) rotateZ(43deg) scale(1.0)"
              : "rotateX(0deg) rotateZ(0deg) scale(1.3)",
          }}
        >
          <RippleGrid
            gridColor="#5b8db8"
            rippleIntensity={isTilting ? 0.015 : 0.04}
            gridSize={7}
            gridThickness={70}
            glowIntensity={0}
            opacity={0.5}
            vignetteStrength={1.6}
            fadeDistance={1.8}
            mouseInteraction={!isTilting}
            mouseInteractionRadius={1.3}
          />
        </div>
      </div>

      {/* Vignette — edges dark, center open so grid reads through */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 20%, rgba(9,10,12,0.72) 100%)",
          pointerEvents: "none",
          transition: "opacity 0.6s ease",
          opacity: isTilting ? 0.35 : 1,
          zIndex: 1,
        }}
      />

      {/* UI */}
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
            ? "scale(0.97) translateY(-12px)"
            : uiVisible
              ? "scale(1) translateY(0)"
              : "scale(1) translateY(18px)",
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)",
            margin: 0,
            marginBottom: 28,
            transition: "opacity 0.8s ease 0.05s, transform 0.8s ease 0.05s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          3D Interior Studio
        </p>

        {/* Headline */}
        <div
          style={{
            textAlign: "center",
            transition: "opacity 0.8s ease 0.12s, transform 0.8s ease 0.12s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(14px)",
          }}
        >
          <div
            style={{
              fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
              fontSize: "clamp(4.5rem, 10.5vw, 7.5rem)",
              lineHeight: 0.92,
              letterSpacing: "0.03em",
              color: "#fff",
              display: "block",
              userSelect: "none",
            }}
          >
            Design Your
          </div>
          <div
            style={{
              fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
              fontSize: "clamp(4.5rem, 10.5vw, 7.5rem)",
              lineHeight: 0.92,
              letterSpacing: "0.03em",
              color: "transparent",
              WebkitTextStroke: "1.5px #3b8eff",
              display: "block",
              userSelect: "none",
            }}
          >
            Space.
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 280,
            height: 1,
            background: "rgba(255,255,255,0.1)",
            margin: "28px auto",
            transition: "opacity 0.8s ease 0.22s, transform 0.8s ease 0.22s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "scaleX(1)" : "scaleX(0.4)",
            transformOrigin: "left",
          }}
        />

        {/* Description */}
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(10px, 1.2vw, 12px)",
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.38)",
            textAlign: "center",
            maxWidth: 400,
            lineHeight: 1.8,
            margin: 0,
            marginBottom: 44,
            transition: "opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          Generate 3D furniture from text prompts.
          <br />
          Arrange, refine, and visualize — instantly.
        </p>

        {/* CTA */}
        <div
          style={{
            transition: "opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <button className="landing-btn" onClick={handleEnter}>
            Enter Studio
            <span className="arrow">→</span>
          </button>
        </div>

        {/* Footer hint */}
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.13)",
            margin: 0,
            marginTop: 48,
            transition: "opacity 0.8s ease 0.55s",
            opacity: uiVisible ? 1 : 0,
          }}
        >
          ↑ Press Enter
        </p>
      </div>
    </div>
  );
}
