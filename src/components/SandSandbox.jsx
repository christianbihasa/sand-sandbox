import React, { useEffect, useRef, useState } from "react";
import { SandEngine } from "../simulation/SandEngine";
import SandControls from "./SandControls";

export default function SandSandbox() {
  const canvasRef = useRef(null);
  const [activeElement, setActiveElement] = useState(1);
  const engineRef = useRef(null);
  const inputRef = useRef({ isDrawing: false, lastX: null, lastY: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Instantiating isolated physics class engine model
    const engine = new SandEngine(200, 150, 4);
    engineRef.current = engine;

    let animationFrameId;

    const renderLoop = () => {
      engine.updatePhysics();
      engine.drawGrid(ctx);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const getGridCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.floor(
      ((clientX - rect.left) / rect.width) * engineRef.current.width,
    );
    const y = Math.floor(
      ((clientY - rect.top) / rect.height) * engineRef.current.height,
    );
    return { x, y };
  };

  const drawLine = (x0, y0, x1, y1, element) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      engineRef.current.setCell(x0, y0, element);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  const handleStart = (e) => {
    inputRef.current.isDrawing = true;
    const { x, y } = getGridCoords(e);
    inputRef.current.lastX = x;
    inputRef.current.lastY = y;
    drawLine(x, y, x, y, activeElement);
  };

  const handleMove = (e) => {
    if (!inputRef.current.isDrawing) return;
    const { x, y } = getGridCoords(e);
    drawLine(
      inputRef.current.lastX,
      inputRef.current.lastY,
      x,
      y,
      activeElement,
    );
    inputRef.current.lastX = x;
    inputRef.current.lastY = y;
  };

  const handleEnd = () => {
    inputRef.current.isDrawing = false;
  };
  const handleClear = () => {
    if (engineRef.current) engineRef.current.clear();
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen bg-arcade-bg text-white font-mono">
      <div className="mb-4 text-center select-none">
        <h1 className="text-xl tracking-widest text-emerald-400 font-bold mb-1">
          FALLING SAND SANDBOX
        </h1>
        <p className="text-xs text-gray-400">
          DECOUPLED MODULAR STATE STACK DEPLOYED
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        className="w-full max-w-2xl aspect-[4/3] bg-gray-950 rounded border border-gray-800 shadow-2xl cursor-crosshair touch-none"
      />

      <SandControls
        activeElement={activeElement}
        setActiveElement={setActiveElement}
        onClear={handleClear}
      />
    </div>
  );
}
