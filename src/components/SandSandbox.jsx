import React, { useEffect, useRef, useState } from "react";

export default function SandSandbox() {
  const canvasRef = useRef(null);
  const [activeElement, setActiveElement] = useState(1); // 1 = Sand, 2 = Water, 3 = Wall, 0 = Eraser

  const simRef = useRef({
    // Physics grid
    width: 200,
    height: 150,

    // Visual pixel magnification
    cellSize: 4,

    currentGrid: null,
    nextGrid: null,
    isDrawing: false,
    lastX: null,
    lastY: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sim = simRef.current;

    // Allocate sequential blocks of typed memory
    const totalCells = sim.width * sim.height;
    sim.currentGrid = new Uint8Array(totalCells);
    sim.nextGrid = new Uint8Array(totalCells);

    let animationFrameId;

    const renderLoop = () => {
      // 1. Run cellular automata simulation
      updatePhysics(sim);

      // 2. Render calculated pixel values directly to viewport buffer
      drawGrid(ctx, sim);

      // 3. Swap frame arrays
      sim.currentGrid.set(sim.nextGrid);

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Physics Engine Loop (Cellular Automata)
  // VERY IMPORTANT

  const updatePhysics = (sim) => {
    const { width, height, currentGrid, nextGrid } = sim;
    nextGrid.fill(0); // Clear next grid

    // Retain static wall config across cycles
    for (let i = 0; i < currentGrid.length; i++) {
      if (currentGrid[i] === 3) {
        // Wall
        nextGrid[i] = 3;
      }
    }

    // Traverse each grid from bottom row to top row
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const type = currentGrid[idx];

        if (type === 0 || type === 3) continue; // Skip empty and wall cells

        // Sand physics
        if (type === 1) {
          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);

          // 1. Vector Direct Fall / Sink check
          if (y + 1 < height) {
            if (nextGrid[below] === 0) {
              nextGrid[below] = 1;
              continue;
            } else if (nextGrid[below] === 2) {
              nextGrid[below] = 1;
              nextGrid[idx] = 2; // DISPLACE: Swap water upward into old space
              continue;
            }
          }

          // 2. Vector Diagonal Slide check (Randomized to eliminate directional bias)
          const slideLeftFirst = Math.random() > 0.5;
          let moved = false;

          if (y + 1 < height) {
            if (slideLeftFirst) {
              if (x - 1 >= 0 && nextGrid[bottomLeft] === 0) {
                nextGrid[bottomLeft] = 1;
                moved = true;
              } else if (x - 1 >= 0 && nextGrid[bottomLeft] === 2) {
                nextGrid[bottomLeft] = 1;
                nextGrid[idx] = 2;
                moved = true;
              } else if (x + 1 < width && nextGrid[bottomRight] === 0) {
                nextGrid[bottomRight] = 1;
                moved = true;
              } else if (x + 1 < width && nextGrid[bottomRight] === 2) {
                nextGrid[bottomRight] = 1;
                nextGrid[idx] = 2;
                moved = true;
              }
            } else {
              if (x + 1 < width && nextGrid[bottomRight] === 0) {
                nextGrid[bottomRight] = 1;
                moved = true;
              } else if (x + 1 < width && nextGrid[bottomRight] === 2) {
                nextGrid[bottomRight] = 1;
                nextGrid[idx] = 2;
                moved = true;
              } else if (x - 1 >= 0 && nextGrid[bottomLeft] === 0) {
                nextGrid[bottomLeft] = 1;
                moved = true;
              } else if (x - 1 >= 0 && nextGrid[bottomLeft] === 2) {
                nextGrid[bottomLeft] = 1;
                nextGrid[idx] = 2;
                moved = true;
              }
            }
          }

          if (moved) continue;

          // 3. Obstructed: Rest in place (preserving slot if water hasn't claimed it)
          if (nextGrid[idx] === 0) {
            nextGrid[idx] = 1;
          }
        }

        // Water physics
        else if (type === 2) {
          // If a sand displacement calculation from a previous loop pass already updated
          // this slot position, respect the change and stop further liquid movement.
          if (nextGrid[idx] !== 0) continue;

          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);
          const left = y * width + (x - 1);
          const right = y * width + (x + 1);

          // 1. Liquid Gravity Fall
          if (
            y + 1 < height &&
            currentGrid[below] === 0 &&
            nextGrid[below] === 0
          ) {
            nextGrid[below] = 2;
            continue;
          }

          // 2. Liquid Diagonal Flow
          const flowLeftFirst = Math.random() > 0.5;
          let fluidMoved = false;

          if (y + 1 < height) {
            if (flowLeftFirst) {
              if (
                x - 1 >= 0 &&
                currentGrid[bottomLeft] === 0 &&
                nextGrid[bottomLeft] === 0
              ) {
                nextGrid[bottomLeft] = 2;
                fluidMoved = true;
              } else if (
                x + 1 < width &&
                currentGrid[bottomRight] === 0 &&
                nextGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 2;
                fluidMoved = true;
              }
            } else {
              if (
                x + 1 < width &&
                currentGrid[bottomRight] === 0 &&
                nextGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 2;
                fluidMoved = true;
              } else if (
                x - 1 >= 0 &&
                currentGrid[bottomLeft] === 0 &&
                nextGrid[bottomLeft] === 0
              ) {
                nextGrid[bottomLeft] = 2;
                fluidMoved = true;
              }
            }
          }

          if (fluidMoved) continue;

          // 3. Lateral Equalization (Liquid spreading completely flat across horizons)
          if (flowLeftFirst) {
            if (x - 1 >= 0 && currentGrid[left] === 0 && nextGrid[left] === 0) {
              nextGrid[left] = 2;
              fluidMoved = true;
            } else if (
              x + 1 < width &&
              currentGrid[right] === 0 &&
              nextGrid[right] === 0
            ) {
              nextGrid[right] = 2;
              fluidMoved = true;
            }
          } else {
            if (
              x + 1 < width &&
              currentGrid[right] === 0 &&
              nextGrid[right] === 0
            ) {
              nextGrid[right] = 2;
              fluidMoved = true;
            } else if (
              x - 1 >= 0 &&
              currentGrid[left] === 0 &&
              nextGrid[left] === 0
            ) {
              nextGrid[left] = 2;
              fluidMoved = true;
            }
          }

          if (fluidMoved) continue;

          // 4. Stagnant: Pool in place
          nextGrid[idx] = 2;
        }
      }
    }
  };

  // Rendering Loop (Direct Pixel Manipulation)
  const drawGrid = (ctx, sim) => {
    const { width, height, cellSize, currentGrid } = sim;
    const imgData = ctx.createImageData(width * cellSize, height * cellSize);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellType = currentGrid[y * width + x];

        let r = 17,
          g = 22,
          b = 37; // Default #111625 Base Canvas Color
        if (cellType === 1) {
          r = 234;
          g = 179;
          b = 8;
        } // Yellow Sand
        if (cellType === 2) {
          r = 59;
          g = 130;
          b = 246;
        } // Blue Water
        if (cellType === 3) {
          r = 148;
          g = 163;
          b = 184;
        } // Slate Structural Wall

        for (let cy = 0; cy < cellSize; cy++) {
          for (let cx = 0; cx < cellSize; cx++) {
            const pixelIdx =
              ((y * cellSize + cy) * (width * cellSize) + (x * cellSize + cx)) *
              4;
            data[pixelIdx] = r;
            data[pixelIdx + 1] = g;
            data[pixelIdx + 2] = b;
            data[pixelIdx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Input translation & Bresenham interpolation
  const getGridCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.floor(
      ((clientX - rect.left) / rect.width) * simRef.current.width,
    );
    const y = Math.floor(
      ((clientY - rect.top) / rect.height) * simRef.current.height,
    );
    return { x, y };
  };

  const drawLine = (x0, y0, x1, y1, element) => {
    const { width, height, currentGrid } = simRef.current;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
        currentGrid[y0 * width + x0] = element;
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
    simRef.current.isDrawing = true;
    const { x, y } = getGridCoords(e);
    simRef.current.lastX = x;
    simRef.current.lastY = y;
    drawLine(x, y, x, y, activeElement);
  };

  const handleMove = (e) => {
    if (!simRef.current.isDrawing) return;
    const { x, y } = getGridCoords(e);
    drawLine(simRef.current.lastX, simRef.current.lastY, x, y, activeElement);
    simRef.current.lastX = x;
    simRef.current.lastY = y;
  };

  const handleEnd = () => {
    simRef.current.isDrawing = false;
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen bg-arcade-bg text-white font-mono">
      <div className="mb-4 text-center select-none">
        <h1 className="text-xl tracking-widest text-emerald-400 font-bold mb-1">
          FALLING SAND SANDBOX
        </h1>
        <p className="text-xs text-gray-400">
          DENSITY DISPLACEMENT ENGINE STACK ACTIVE
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

      <div className="flex flex-wrap gap-2 mt-4 bg-gray-900/50 p-2 rounded border border-gray-800/60 text-xs justify-center">
        {[
          ["SAND", 1, "text-yellow-400 border-yellow-500/20 bg-yellow-500/5"],
          ["WATER", 2, "text-blue-400 border-blue-500/20 bg-blue-500/5"],
          ["WALL", 3, "text-slate-400 border-slate-500/20 bg-slate-500/5"],
          ["ERASER", 0, "text-rose-400 border-rose-500/20 bg-rose-500/5"],
        ].map(([name, id, style]) => (
          <button
            key={id}
            onClick={() => setActiveElement(id)}
            className={`px-4 py-2 border rounded tracking-widest transition-all active:scale-95 cursor-pointer font-bold ${style} ${
              activeElement === id
                ? "ring-1 ring-offset-2 ring-offset-slate-950 ring-emerald-500 opacity-100"
                : "opacity-40"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
