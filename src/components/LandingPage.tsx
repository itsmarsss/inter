"use client";

import { useEffect, useRef, useState } from "react";
import RippleGrid from "./RippleGrid";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [phase, setPhase] = useState<"idle" | "exiting">("idle");
  const hasTriggered = useRef(false);

  const handleEnter = () => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    setPhase("exiting");
    setTimeout(onEnter, 700);
  };

  // Auto-animate content in
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0a0a0f",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        opacity: phase === "exiting" ? 0 : 1,
        transform: phase === "exiting" ? "scale(1.04)" : "scale(1)",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
    >
      {/* Ripple Grid — full background */}
      <div style={{ position: "absolute", inset: 0 }}>
        <RippleGrid
          gridColor="#6366f1"
          rippleIntensity={0.06}
          gridSize={8}
          gridThickness={18}
          glowIntensity={0.15}
          vignetteStrength={1.6}
          fadeDistance={1.8}
          mouseInteraction
          mouseInteractionRadius={1.2}
        />
      </div>

      {/* Dark radial overlay for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, transparent 0%, rgba(10,10,15,0.55) 60%, rgba(10,10,15,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0px",
          transition: "opacity 0.8s ease, transform 0.8s ease",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(18px)",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 999,
            padding: "4px 14px",
            marginBottom: 24,
            transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
          <span style={{ color: "#a5b4fc", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.08em", fontWeight: 500 }}>
            AI-POWERED INTERIOR DESIGN
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            lineHeight: 1.05,
            textAlign: "center",
            letterSpacing: "-0.03em",
            fontFamily: "inherit",
            transition: "opacity 0.8s ease 0.18s, transform 0.8s ease 0.18s",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(12px)",
          }}
        >
          Design Your Space.
          <br />
          <span
            style={{
              backgroundImage: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",
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
            marginTop: 20,
            color: "rgba(255,255,255,0.45)",
            fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
            textAlign: "center",
            maxWidth: 480,
            lineHeight: 1.6,
            fontFamily: "inherit",
            fontWeight: 400,
            transition: "opacity 0.8s ease 0.26s, transform 0.8s ease 0.26s",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          Generate, place, and preview 3D furniture in real-time.
          <br />
          Your room, your vision — rendered instantly.
        </p>

        {/* CTA button */}
        <button
          onClick={handleEnter}
          style={{
            marginTop: 40,
            padding: "14px 40px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.04em",
            fontFamily: "inherit",
            boxShadow: "0 0 32px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.4)",
            transition:
              "opacity 0.8s ease 0.34s, transform 0.8s ease 0.34s, box-shadow 0.2s ease, scale 0.15s ease",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 48px rgba(99,102,241,0.6), 0 4px 16px rgba(0,0,0,0.5)";
            (e.currentTarget as HTMLButtonElement).style.scale = "1.04";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 32px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.4)";
            (e.currentTarget as HTMLButtonElement).style.scale = "1";
          }}
        >
          Open Editor →
        </button>

        {/* Bottom hint */}
        <p
          style={{
            marginTop: 56,
            color: "rgba(255,255,255,0.18)",
            fontSize: "0.75rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            transition: "opacity 0.8s ease 0.5s",
            opacity: visible ? 1 : 0,
          }}
        >
          Press Enter or click above to begin
        </p>
      </div>
    </div>
  );
}
