"use client";

import { useEffect, useRef } from "react";

export function GridCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (!W || !H) return;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "#090a0c";
      ctx.fillRect(0, 0, W, H);

      const vx = W / 2;
      const vy = H * 0.54;
      const GRID = 20;

      /* vertical grid lines converging to vanishing point */
      for (let i = -GRID; i <= GRID; i++) {
        const t = i / GRID;
        const baseX = W / 2 + t * W * 0.52;
        const alpha = i % 5 === 0 ? 0.055 : 0.028;
        ctx.beginPath();
        ctx.moveTo(baseX, H);
        ctx.lineTo(vx, vy);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* horizontal grid lines */
      for (let j = 1; j <= GRID; j++) {
        const t = j / GRID;
        const y = vy + (H - vy) * (1 - Math.pow(1 - t, 1.6));
        const spread = W * 0.52 * t;
        const alpha = j % 5 === 0 ? 0.055 : 0.028;
        ctx.beginPath();
        ctx.moveTo(vx - spread, y);
        ctx.lineTo(vx + spread, y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* axis lines */
      const axisY = vy + (H - vy) * 0.08;

      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(W, axisY);
      ctx.strokeStyle = "rgba(60,160,80,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, H);
      ctx.strokeStyle = "rgba(180,60,60,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    draw();

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}
