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
      8: { name: "STEAM", state: "ENERGY", density: -5, flammable: false },
      9: { name: "SPOUT", state: "SOLID", density: 1000, flammable: false },
      10: { name: "DRAIN", state: "SOLID", density: 1001, flammable: false },
      11: { name: "CRUST", state: "SOLID", density: 80, flammable: false },
      12: { name: "MAGMA", state: "LIQUID", density: 70, flammable: false },
      13: {
        name: "VOLCANIC_GAS",
        state: "ENERGY",
        density: -50,
        flammable: false,
      },
    };
  }

  // Prevents canvas size changes from wiping user simulation states
  resize(newWidth, newHeight) {
    const oldWidth = this.width;
    const oldHeight = this.height;
    const oldGrid = this.currentGrid;
    const oldVariantGrid = this.currentVariantGrid;

    this.width = newWidth;
    this.height = newHeight;
    this.totalCells = newWidth * newHeight;

    this.currentGrid = new Uint8Array(this.totalCells);
    this.nextGrid = new Uint8Array(this.totalCells);
    this.currentVariantGrid = new Uint8Array(this.totalCells);
    this.nextVariantGrid = new Uint8Array(this.totalCells);

    // Repopulate older frame coordinates into the new layout system footprint
    for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
      for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
        const oldIdx = y * oldWidth + x;
        const newIdx = y * newWidth + x;
        this.currentGrid[newIdx] = oldGrid[oldIdx];
        this.currentVariantGrid[newIdx] = oldVariantGrid[oldIdx];
      }
    }
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

  getProp(x, y, propName) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return propName === "density" ? 999 : null;
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

        // --- GEOLOGICAL VOLCANIC KINETICS ---
        if (type === 12) {
          // MAGMA behavior
          // Rule A: Spontaneously release highly buoyant volcanic gas bubbles deep inside magma pools
          if (Math.random() > 0.994) {
            const upwardIdx = (y - 1) * width + x;
            if (y - 1 >= 0 && currentGrid[upwardIdx] === 12) {
              currentGrid[upwardIdx] = 13; // Exsolve into gas inside current frame
              currentVariantGrid[upwardIdx] = 0;
            }
          }

          // Rule B: Thermal Conduction - Magma melts neighboring solid crust rock
          const neighbors = [
            { nx: x, ny: y - 1 },
            { nx: x, ny: y + 1 },
            { nx: x - 1, ny: y },
            { nx: x + 1, ny: y },
          ];
          for (let n of neighbors) {
            if (n.nx >= 0 && n.nx < width && n.ny >= 0 && n.ny < height) {
              const nIdx = n.ny * width + n.nx;
              if (currentGrid[nIdx] === 11 && Math.random() > 0.999) {
                currentGrid[nIdx] = 12; // Melt solid crust into liquid magma
                currentVariantGrid[nIdx] = Math.floor(Math.random() * 4);
              }
            }
          }
        }

        if (type === 13) {
          // VOLCANIC_GAS behavior
          const aboveIdx = (y - 1) * width + x;
          let isBlocked = false;

          if (y - 1 >= 0) {
            const aboveType = currentGrid[aboveIdx];

            // 1. STABLE LIQUID BUOYANCY: Swap gas upward safely in current grid frame
            if (aboveType === 12) {
              currentGrid[aboveIdx] = 13;
              currentGrid[idx] = 12;
              currentVariantGrid[aboveIdx] = currentVariantGrid[idx];
              currentVariantGrid[idx] = 0;
              continue;
            }

            // Detect solid blockages
            if (aboveType === 11 || aboveType === 3) {
              isBlocked = true;
            }
          }

          if (isBlocked) {
            currentVariantGrid[idx] += 1; // Accumulate pressure ticks

            // THE EXPLOSIVE BLOWOUT
            if (currentVariantGrid[idx] > 30) {
              currentGrid[idx] = 0; // Clear gas core

              const blastRadius = 5;
              for (let dy = -blastRadius; dy <= 2; dy++) {
                for (let dx = -blastRadius; dx <= blastRadius; dx++) {
                  const bx = x + dx;
                  const by = y + dy;

                  if (bx >= 0 && bx < width && by >= 0 && by < height) {
                    const bIdx = by * width + bx;
                    const bType = currentGrid[bIdx];

                    // Structural containers turn to debris cleanly into next frame
                    if (bType === 11 || bType === 3) {
                      nextGrid[bIdx] = Math.random() > 0.75 ? 1 : 0; // Turn to sand or air
                      nextVariantGrid[bIdx] = 0;
                      currentGrid[bIdx] = 0; // Clear from current grid pass
                    }
                    // Ballistic Trajectory Logic
                    else if (bType === 12) {
                      const launchDistance = Math.floor(
                        Math.random() * 20 + 12,
                      );
                      const launchY = by - launchDistance;

                      if (launchY >= 0) {
                        const launchIdx = launchY * width + bx;
                        if (
                          currentGrid[launchIdx] === 0 &&
                          nextGrid[launchIdx] === 0
                        ) {
                          nextGrid[launchIdx] = 12; // Project magma directly into next grid
                          nextVariantGrid[launchIdx] = Math.floor(
                            Math.random() * 4,
                          );
                        }
                      }
                      currentGrid[bIdx] = 0; // Clear original cell position cleanly
                    }
                  }
                }
              }
              continue;
            }
          } else {
            if (currentVariantGrid[idx] > 0) currentVariantGrid[idx]--;

            // 3. STEADY NATURAL SURFACE VENTING
            if (y - 1 >= 0 && currentGrid[aboveIdx] === 0) {
              currentGrid[idx] = 0;
              const belowIdx = (y + 1) * width + x;
              if (y + 1 < height && currentGrid[belowIdx] === 12) {
                if (currentGrid[aboveIdx] === 0) {
                  nextGrid[aboveIdx] = 12;
                  currentGrid[belowIdx] = 0;
                }
              }
              continue;
            }
          }
        }

        // --- STEAM LIFE CYCLE DISPERSION ---
        if (type === 8) {
          if (Math.random() > 0.96) {
            currentGrid[idx] = 0;
            continue;
          }
        }

        // --- AUTOMATED NODE KINETICS ---
        if (type === 9) {
          if (y + 1 < height) {
            const bIdx = (y + 1) * width + x;
            if (currentGrid[bIdx] === 0) {
              currentGrid[bIdx] = 2;
              currentVariantGrid[bIdx] = Math.floor(Math.random() * 4);
            }
          }
        }
        if (type === 10) {
          if (y - 1 >= 0) {
            const aIdx = (y - 1) * width + x;
            if (
              currentGrid[aIdx] !== 0 &&
              currentGrid[aIdx] !== 10 &&
              currentGrid[aIdx] !== 3
            ) {
              currentGrid[aIdx] = 0;
            }
          }
        }

        // --- FIRE & COMBUSTION KINETICS ---
        if (type === 6) {
          if (Math.random() > 0.88) {
            currentGrid[idx] = 0;
            continue;
          }

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

              if (this.PROPERTIES[nType].flammable) {
                currentGrid[nIdx] = 6;
                currentVariantGrid[nIdx] = Math.floor(Math.random() * 4);
              } else if (nType === 2) {
                currentGrid[idx] = 0;
                currentGrid[nIdx] = 8;
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

              if (nType === 1 || nType === 7 || nType === 3) {
                currentGrid[nIdx] = 0;
                if (Math.random() > 0.4) {
                  currentGrid[idx] = 8;
                  break;
                }
              } else if (nType === 2) {
                currentGrid[idx] = 2;
                break;
              }
            }
          }
        }
      }
    }

    // Preserve permanent structural architectures into execution matrix buffers
    for (let i = 0; i < currentGrid.length; i++) {
      const gType = currentGrid[i];
      if (
        gType === 3 ||
        gType === 7 ||
        gType === 9 ||
        gType === 10 ||
        gType === 11
      ) {
        if (nextGrid[i] === 0) {
          nextGrid[i] = gType;
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

        if (
          type === 0 ||
          type === 3 ||
          type === 7 ||
          type === 9 ||
          type === 10 ||
          type === 11
        )
          continue;

        // If an explosion already mapped something here, preserve it and skip
        if (nextGrid[idx] !== 0) continue;

        // Commit Volcanic Gas that survived or naturally moved to its stable location
        if (type === 13) {
          nextGrid[idx] = type;
          nextVariantGrid[idx] = currentVariantGrid[idx];
          continue;
        }

        const state = this.PROPERTIES[type].state;
        const currentDensity = this.PROPERTIES[type].density;

        let moved = false;

        // --- CATEGORY A: DOWNWARD SETTLING PARTICLES (Powders & Liquids) ---
        if (state === "POWDER" || state === "LIQUID") {
          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);

          if (y + 1 < height) {
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

          if (!moved && state === "LIQUID") {
            // Make Magma flow tightly and viscously (dispersion rate = 1), regular liquids spread faster (5)
            const dispersionRate = type === 12 ? 1 : type === 5 ? 2 : 5;
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

                if (this.PROPERTIES[checkType].density >= currentDensity) break;

                bestX = nx;

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

        // --- CATEGORY B: UPWARD FLOATERS (Gases/Thermal Energy) ---
        else if (state === "ENERGY") {
          const above = (y - 1) * width + x;
          const topLeft = (y - 1) * width + (x - 1);
          const topRight = (y - 1) * width + (x + 1);

          if (y - 1 >= 0) {
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
          case 4: // Oil
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
          case 5: // Acid
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
          case 6: // Fire
            if (variant === 0) {
              r = 239;
              g = 68;
              b = 68;
            } else if (variant === 1) {
              r = 249;
              g = 115;
              b = 22;
            } else if (variant === 2) {
              r = 234;
              g = 179;
              b = 8;
            } else {
              r = 248;
              g = 113;
              b = 113;
            }
            break;
          case 7: // Wood
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
          case 8: // Steam (Translucent cloud vapors)
            if (variant === 0) {
              r = 203;
              g = 213;
              b = 225;
            } else if (variant === 1) {
              r = 226;
              g = 232;
              b = 240;
            } else if (variant === 2) {
              r = 148;
              g = 163;
              b = 184;
            } else {
              r = 180;
              g = 185;
              b = 200;
            }
            break;
          case 9: // Spout (Cyan mechanical node)
            r = 6;
            g = 182;
            b = 212;
            break;
          case 10: // Drain (Dark void violet node)
            r = 109;
            g = 40;
            b = 217;
            break;
          case 11: // Crust (Dark volcanic igneous rock)
            if (variant === 0) {
              r = 55;
              g = 65;
              b = 81;
            } else if (variant === 1) {
              r = 75;
              g = 85;
              b = 99;
            } else {
              r = 43;
              g = 51;
              b = 64;
            }
            break;
          case 12: // Magma (Incandescent glowing core molten rock)
            if (variant === 0) {
              r = 249;
              g = 115;
              b = 22;
            } // Safety Orange
            else if (variant === 1) {
              r = 239;
              g = 68;
              b = 68;
            } // Hot Red
            else if (variant === 2) {
              r = 254;
              g = 240;
              b = 138;
            } // Yellow Core Heat
            else {
              r = 194;
              g = 65;
              b = 12;
            }
            break;
          case 13: // Volcanic Gas / Eruption Smoke
            if (variant === 0) {
              r = 75;
              g = 75;
              b = 90;
            } else if (variant === 1) {
              r = 100;
              g = 100;
              b = 115;
            } else {
              r = 50;
              g = 50;
              b = 65;
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
            data[pixelIdx + 3] = cellType === 8 ? 140 : 255; // Render steam as transparent vapor clouds
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}
