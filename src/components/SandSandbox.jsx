import React, { useEffect, useRef, useState } from "react";
import { SandEngine } from "../simulation/SandEngine";
import SandControls from "./SandControls";

export default function SandSandbox() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [activeElement, setActiveElement] = useState(1);
  const [eraserSize, setEraserSize] = useState(4);
  const engineRef = useRef(null);
  const inputRef = useRef({ isDrawing: false, lastX: null, lastY: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    // Handles adapting internal array resolutions to match layout viewport metrics
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();

      // Update canvas viewport configuration to match native display bounds
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Calculate grid arrays dynamically based on a uniform 4px cell scale factor
      const cellScale = 4;
      const engineWidth = Math.floor(canvas.width / cellScale);
      const engineHeight = Math.floor(canvas.height / cellScale);

      // Re-instantiate physics matrix to fill the new layout configuration bounds
      const engine = new SandEngine(engineWidth, engineHeight, cellScale);
      engineRef.current = engine;
    };

    // Trigger initial calculation
    resizeCanvas();

    // Attach resize observer to track fluid container shifts dynamically
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    const renderLoop = () => {
      if (engineRef.current) {
        engineRef.current.updatePhysics();
        engineRef.current.drawGrid(ctx);
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  const getGridCoords = (e) => {
    if (!engineRef.current || !canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Scale calculation mapping coordinate tracking points cleanly to grid scales
    const rawX = Math.floor(
      ((clientX - rect.left) / rect.width) * engineRef.current.width,
    );
    const rawY = Math.floor(
      ((clientY - rect.top) / rect.height) * engineRef.current.height,
    );

    // Hard boundary constraint clamps to prevent matrix index array overflows
    const x = Math.max(0, Math.min(engineRef.current.width - 1, rawX));
    const y = Math.max(0, Math.min(engineRef.current.height - 1, rawY));

    return { x, y };
  };

  const drawLine = (x0, y0, x1, y1, element, radius) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (element === 0) {
        for (let row = -radius; row <= radius; row++) {
          for (let col = -radius; col <= radius; col++) {
            if (col * col + row * row <= radius * radius) {
              engineRef.current.setCell(x0 + col, y0 + row, 0);
            }
          }
        }
      } else {
        engineRef.current.setCell(x0, y0, element);
      }

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
    drawLine(x, y, x, y, activeElement, eraserSize);
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
      eraserSize,
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
    <div className="flex flex-col items-center justify-center p-4 md:p-6 h-screen max-h-screen bg-arcade-bg text-white font-mono w-full selection:bg-emerald-500/30 overflow-hidden">
      {/* Structural Visual Header */}
      <div className="mb-4 text-center select-none shrink-0">
        <h1 className="text-xl md:text-2xl tracking-[0.25em] text-emerald-400 font-black mb-1 drop-shadow-[0_2px_8px_rgba(52,211,153,0.2)]">
          NEXUS ELEMENTAL ENGINE
        </h1>
        <p className="text-[10px] md:text-xs text-gray-400 max-w-2xl mx-auto tracking-widest leading-relaxed uppercase">
          Real-Time Grid Automata • Fluid Dispersion Model • Decoupled State
          Architecture
        </p>
      </div>

      {/* Maximized Structural Workstation Shell */}
      <div className="flex flex-col md:flex-row gap-5 items-center md:items-stretch justify-center w-full max-w-[98vw] xl:max-w-[95vw] mx-auto bg-gray-950/20 p-4 rounded-xl border border-gray-900/40 backdrop-blur-sm shadow-inner flex-1 min-h-0 mb-2">
        {/* Left Hand Command Tower Dashboard */}
        <SandControls
          activeElement={activeElement}
          setActiveElement={setActiveElement}
          onClear={handleClear}
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
        />

        {/* Dynamic Full-Scale Wrapper Frame (No static aspect filters) */}
        <div
          ref={containerRef}
          className="w-full flex-1 relative bg-gray-950 rounded-lg border border-gray-800/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] overflow-hidden min-h-[300px] md:min-h-0"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none focus:outline-none block"
          />
        </div>
      </div>
    </div>
  );
}
