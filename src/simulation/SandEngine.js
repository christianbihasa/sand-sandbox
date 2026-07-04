export class SandEngine {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.totalCells = width * height;

    this.currentGrid = new Uint8Array(this.totalCells);
    this.nextGrid = new Uint8Array(this.totalCells);
    this.currentVariantGrid = new Uint8Array(this.totalCells);
    this.nextVariantGrid = new Uint8Array(this.totalCells);

    // Global Element Scientific Profiles
    this.PROPERTIES = {
      0: { name: "AIR", state: "GAS", density: 0, flammable: false },
      1: { name: "SAND", state: "POWDER", density: 30, flammable: false },
      2: { name: "WATER", state: "LIQUID", density: 20, flammable: false },
      3: { name: "WALL", state: "SOLID", density: 100, flammable: false },
      4: { name: "OIL", state: "LIQUID", density: 10, flammable: true },
      5: { name: "ACID", state: "LIQUID", density: 25, flammable: false },
      6: { name: "FIRE", state: "ENERGY", density: -10, flammable: false },
      7: { name: "WOOD", state: "SOLID", density: 50, flammable: true },
    };
  }

  clear() {
    this.currentGrid.fill(0);
    this.nextGrid.fill(0);
    this.currentVariantGrid.fill(0);
    this.nextVariantGrid.fill(0);
  }

  setCell(x, y, type) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const idx = y * this.width + x;
      this.currentGrid[idx] = type;
      this.currentVariantGrid[idx] =
        type === 0 ? 0 : Math.floor(Math.random() * 4);
    }
  }

  // Helper to safely fetch element properties at grid coordinates
  getProp(x, y, propName) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return propName === "density" ? 999 : null; // Out of bounds acts like bedrock
    }
    const type = this.currentGrid[y * this.width + x];
    return this.PROPERTIES[type][propName];
  }

  updatePhysics() {
    const width = this.width;
    const height = this.height;
    const currentGrid = this.currentGrid;
    const nextGrid = this.nextGrid;
    const currentVariantGrid = this.currentVariantGrid;
    const nextVariantGrid = this.nextVariantGrid;

    nextGrid.fill(0);
    nextVariantGrid.fill(0);

    // 1. PRE-REACTION PASS: Handle Combustion, Decomposition, and Acid Corrosion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const type = currentGrid[idx];

        if (type === 0) continue;

        // --- FIRE & COMBUSTION KINETICS ---
        if (type === 6) {
          // Fire naturally burns out over time
          if (Math.random() > 0.88) {
            currentGrid[idx] = 0; // Dissipate to air before physics runs
            continue;
          }

          // Scan adjacent vectors for chemical reactions
          const neighbors = [
            { nx: x, ny: y - 1 },
            { nx: x, ny: y + 1 },
            { nx: x - 1, ny: y },
            { nx: x + 1, ny: y },
          ];

          for (let n of neighbors) {
            if (n.nx >= 0 && n.nx < width && n.ny >= 0 && n.ny < height) {
              const nIdx = n.ny * width + n.nx;
              const nType = currentGrid[nIdx];

              // Reaction: Fire + Fuel (Wood/Oil) -> Exothermic Ignition Cascade
              if (this.PROPERTIES[nType].flammable) {
                currentGrid[nIdx] = 6; // Catch fire
                currentVariantGrid[nIdx] = Math.floor(Math.random() * 4);
              }
              // Reaction: Fire + Water -> Thermal Extinguishment / Evaporation
              else if (nType === 2) {
                currentGrid[idx] = 0; // Fire dies
                currentGrid[nIdx] = 0; // Water evaporates into steam (Air)
                break;
              }
            }
          }
        }

        // --- ACID CORROSION KINETICS ---
        if (type === 5) {
          const neighbors = [
            { nx: x, ny: y - 1 },
            { nx: x, ny: y + 1 },
            { nx: x - 1, ny: y },
            { nx: x + 1, ny: y },
          ];

          for (let n of neighbors) {
            if (n.nx >= 0 && n.nx < width && n.ny >= 0 && n.ny < height) {
              const nIdx = n.ny * width + n.nx;
              const nType = currentGrid[nIdx];

              // Reaction: Acid + Matter (Sand/Wood/Walls) -> Corrosive Destruction
              if (nType === 1 || nType === 7 || nType === 3) {
                currentGrid[nIdx] = 0; // Melt target cell down to empty space
                // Acid spends its chemical potential energy and turns into inert gas
                if (Math.random() > 0.4) {
                  currentGrid[idx] = 0;
                  break;
                }
              }
              // Reaction: Acid + Water -> Exothermic Neutralization / Dilution
              else if (nType === 2) {
                currentGrid[idx] = 2; // Acid is diluted into standard water
                break;
              }
            }
          }
        }
      }
    }

    // Preserve permanent structural unburned components into the frame scratchpad
    for (let i = 0; i < currentGrid.length; i++) {
      if (currentGrid[i] === 3 || currentGrid[i] === 7) {
        if (nextGrid[i] === 0) {
          nextGrid[i] = currentGrid[i];
          nextVariantGrid[i] = currentVariantGrid[i];
        }
      }
    }

    // 2. MAIN SYSTEMIC MOTION SWEEP (Bottom-To-Top)
    for (let y = height - 1; y >= 0; y--) {
      const leftToRight = Math.random() > 0.5;

      for (let i = 0; i < width; i++) {
        const x = leftToRight ? i : width - 1 - i;
        const idx = y * width + x;
        const type = currentGrid[idx];

        // Skip background air, static walls, or wood chunks that haven't been modified
        if (type === 0 || type === 3 || type === 7) continue;
        if (nextGrid[idx] !== 0) continue; // Cell space already spoken for by a density swap

        const state = this.PROPERTIES[type].state;
        const currentDensity = this.PROPERTIES[type].density;

        let moved = false;

        // Systemic Gravitational Movement Matrix

        // --- CATEGORY A: DOWNWARD SETTLING PARTICLES (Powders & Liquids) ---
        if (state === "POWDER" || state === "LIQUID") {
          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);

          if (y + 1 < height) {
            // A1. Pure Downward Sinking Check via Density Differential
            const targetType =
              nextGrid[below] === 0 ? currentGrid[below] : nextGrid[below];
            if (currentDensity > this.PROPERTIES[targetType].density) {
              const prevOccupantType =
                nextGrid[below] === 0 ? currentGrid[below] : nextGrid[below];
              const prevOccupantVariant =
                nextGrid[below] === 0
                  ? currentVariantGrid[below]
                  : nextVariantGrid[below];

              nextGrid[below] = type;
              nextVariantGrid[below] = currentVariantGrid[idx];

              if (prevOccupantType !== 0) {
                nextGrid[idx] = prevOccupantType;
                nextVariantGrid[idx] = prevOccupantVariant;
              }
              moved = true;
            }

            // A2. Diagonal Settling Sinks
            if (!moved) {
              const slideLeftFirst = Math.random() > 0.5;
              const sides = slideLeftFirst
                ? [
                    { nx: x - 1, idx: bottomLeft },
                    { nx: x + 1, idx: bottomRight },
                  ]
                : [
                    { nx: x + 1, idx: bottomRight },
                    { nx: x - 1, idx: bottomLeft },
                  ];

              for (let side of sides) {
                if (side.nx >= 0 && side.nx < width) {
                  const tType =
                    nextGrid[side.idx] === 0
                      ? currentGrid[side.idx]
                      : nextGrid[side.idx];
                  if (currentDensity > this.PROPERTIES[tType].density) {
                    const targetType =
                      nextGrid[side.idx] === 0
                        ? currentGrid[side.idx]
                        : nextGrid[side.idx];
                    const targetVariant =
                      nextGrid[side.idx] === 0
                        ? currentVariantGrid[side.idx]
                        : nextVariantGrid[side.idx];

                    nextGrid[side.idx] = type;
                    nextVariantGrid[side.idx] = currentVariantGrid[idx];

                    if (targetType !== 0) {
                      nextGrid[idx] = targetType;
                      nextVariantGrid[idx] = targetVariant;
                    }
                    moved = true;
                    break;
                  }
                }
              }
            }
          }

          // A3. Lateral Liquid Dispersion (Only liquids spread flat across matching density bounds)
          if (!moved && state === "LIQUID") {
            const dispersionRate = type === 5 ? 2 : 5; // Acid moves slower/more viscous than oil/water
            let bestX = -1;
            let foundLedge = false;
            const flowLeftFirst = Math.random() > 0.5;
            const searchDirections = flowLeftFirst ? [-1, 1] : [1, -1];

            for (let dir of searchDirections) {
              for (let d = 1; d <= dispersionRate; d++) {
                const nx = x + dir * d;
                if (nx < 0 || nx >= width) break;

                const nIdx = y * width + nx;
                const checkType =
                  nextGrid[nIdx] === 0 ? currentGrid[nIdx] : nextGrid[nIdx];

                // Blocked if horizontal path is more dense
                if (this.PROPERTIES[checkType].density >= currentDensity) break;

                bestX = nx;

                // Priority Trigger: Did the fluid find an edge to drop down through?
                if (y + 1 < height) {
                  const nBelow = (y + 1) * width + nx;
                  const belowType =
                    nextGrid[nBelow] === 0
                      ? currentGrid[nBelow]
                      : nextGrid[nBelow];
                  if (this.PROPERTIES[belowType].density < currentDensity) {
                    foundLedge = true;
                    break;
                  }
                }
              }
              if (foundLedge) break;
            }

            if (bestX !== -1) {
              const targetIdx = y * width + bestX;
              const targetType =
                nextGrid[targetIdx] === 0
                  ? currentGrid[targetIdx]
                  : nextGrid[targetIdx];
              const targetVariant =
                nextGrid[targetIdx] === 0
                  ? currentVariantGrid[targetIdx]
                  : nextVariantGrid[targetIdx];

              nextGrid[targetIdx] = type;
              nextVariantGrid[targetIdx] = currentVariantGrid[idx];

              if (targetType !== 0) {
                nextGrid[idx] = targetType;
                nextVariantGrid[idx] = targetVariant;
              }
              moved = true;
            }
          }
        }

        // --- CATEGORY B: UPWARD FLOATERS (Gases/Thermal Energy Networks like Fire) ---
        else if (state === "ENERGY") {
          const above = (y - 1) * width + x;
          const topLeft = (y - 1) * width + (x - 1);
          const topRight = (y - 1) * width + (x + 1);

          if (y - 1 >= 0) {
            // B1. Direct Upward Floating Action Check
            const targetType =
              nextGrid[above] === 0 ? currentGrid[above] : nextGrid[above];
            if (
              currentDensity < this.PROPERTIES[targetType].density &&
              this.PROPERTIES[targetType].state !== "SOLID"
            ) {
              nextGrid[above] = type;
              nextVariantGrid[above] = currentVariantGrid[idx];
              moved = true;
            }

            // B2. Diagonal Rising Sifts
            if (!moved) {
              const floatLeftFirst = Math.random() > 0.5;
              const upperSides = floatLeftFirst
                ? [
                    { nx: x - 1, idx: topLeft },
                    { nx: x + 1, idx: topRight },
                  ]
                : [
                    { nx: x + 1, idx: topRight },
                    { nx: x - 1, idx: topLeft },
                  ];

              for (let side of upperSides) {
                if (side.nx >= 0 && side.nx < width) {
                  const tType =
                    nextGrid[side.idx] === 0
                      ? currentGrid[side.idx]
                      : nextGrid[side.idx];
                  if (
                    currentDensity < this.PROPERTIES[tType].density &&
                    this.PROPERTIES[tType].state !== "SOLID"
                  ) {
                    nextGrid[side.idx] = type;
                    nextVariantGrid[side.idx] = currentVariantGrid[idx];
                    moved = true;
                    break;
                  }
                }
              }
            }
          }

          // B3. Micro Gas Drift (Simulates erratic fire flickering)
          if (!moved) {
            const driftX = x + (Math.random() > 0.5 ? 1 : -1);
            if (driftX >= 0 && driftX < width) {
              const driftIdx = y * width + driftX;
              const tType =
                nextGrid[driftIdx] === 0
                  ? currentGrid[driftIdx]
                  : nextGrid[driftIdx];
              if (tType === 0) {
                nextGrid[driftIdx] = type;
                nextVariantGrid[driftIdx] = currentVariantGrid[idx];
                moved = true;
              }
            }
          }
        }

        // --- ESCAPE PATHWAY SAFETY NET ---
        if (!moved) {
          if (nextGrid[idx] === 0) {
            nextGrid[idx] = type;
            nextVariantGrid[idx] = currentVariantGrid[idx];
          }
        }
      }
    }

    this.currentGrid.set(this.nextGrid);
    this.currentVariantGrid.set(this.nextVariantGrid);
  }

  drawGrid(ctx) {
    const imgData = ctx.createImageData(
      this.width * this.cellSize,
      this.height * this.cellSize,
    );
    const data = imgData.data;
    const width = this.width;
    const height = this.height;
    const cellSize = this.cellSize;
    const currentGrid = this.currentGrid;
    const currentVariantGrid = this.currentVariantGrid;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellType = currentGrid[y * width + x];
        const variant = currentVariantGrid[y * width + x];

        let r = 17,
          g = 22,
          b = 37; // Standard Background vacuum

        switch (cellType) {
          case 1: // Sand
            if (variant === 0) {
              r = 234;
              g = 179;
              b = 8;
            } else if (variant === 1) {
              r = 245;
              g = 197;
              b = 41;
            } else if (variant === 2) {
              r = 217;
              g = 161;
              b = 4;
            } else {
              r = 226;
              g = 170;
              b = 6;
            }
            break;
          case 2: // Water
            if (variant === 0) {
              r = 59;
              g = 130;
              b = 246;
            } else if (variant === 1) {
              r = 74;
              g = 144;
              b = 255;
            } else if (variant === 2) {
              r = 43;
              g = 114;
              b = 226;
            } else {
              r = 51;
              g = 122;
              b = 238;
            }
            break;
          case 3: // Structural Wall
            if (variant === 0) {
              r = 148;
              g = 163;
              b = 184;
            } else if (variant === 1) {
              r = 160;
              g = 174;
              b = 192;
            } else if (variant === 2) {
              r = 131;
              g = 146;
              b = 167;
            } else {
              r = 139;
              g = 154;
              b = 175;
            }
            break;
          case 4: // Oil (Amber slick / petrol hues)
            if (variant === 0) {
              r = 120;
              g = 53;
              b = 4;
            } else if (variant === 1) {
              r = 146;
              g = 64;
              b = 14;
            } else if (variant === 2) {
              r = 92;
              g = 38;
              b = 13;
            } else {
              r = 78;
              g = 31;
              b = 11;
            }
            break;
          case 5: // Acid (Corrosive Bioluminescent Toxic Greens)
            if (variant === 0) {
              r = 34;
              g = 197;
              b = 94;
            } else if (variant === 1) {
              r = 74;
              g = 222;
              b = 128;
            } else if (variant === 2) {
              r = 22;
              g = 163;
              b = 74;
            } else {
              r = 21;
              g = 128;
              b = 61;
            }
            break;
          case 6: // Fire (Incandescent Flickering Plume)
            if (variant === 0) {
              r = 239;
              g = 68;
              b = 68;
            } // Red
            else if (variant === 1) {
              r = 249;
              g = 115;
              b = 22;
            } // Orange
            else if (variant === 2) {
              r = 234;
              g = 179;
              b = 8;
            } // Yellow
            else {
              r = 248;
              g = 113;
              b = 113;
            } // Flare
            break;
          case 7: // Wood (Fibrous Bark Browns)
            if (variant === 0) {
              r = 120;
              g = 74;
              b = 52;
            } else if (variant === 1) {
              r = 139;
              g = 94;
              b = 70;
            } else if (variant === 2) {
              r = 101;
              g = 60;
              b = 41;
            } else {
              r = 88;
              g = 49;
              b = 32;
            }
            break;
        }

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
  }
}
