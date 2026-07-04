export class SandEngine {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.totalCells = width * height;

    // Core structural physics memory allocation
    this.currentGrid = new Uint8Array(this.totalCells);
    this.nextGrid = new Uint8Array(this.totalCells);

    // Visual texturing variant memory allocation (Option 3)
    this.currentVariantGrid = new Uint8Array(this.totalCells);
    this.nextVariantGrid = new Uint8Array(this.totalCells);
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
      // Assign a random texture shade variation (0, 1, 2, or 3) on placement
      this.currentVariantGrid[idx] =
        type === 0 ? 0 : Math.floor(Math.random() * 4);
    }
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

    // Retain solid static walls and their textures across frames
    for (let i = 0; i < currentGrid.length; i++) {
      if (currentGrid[i] === 3) {
        nextGrid[i] = 3;
        nextVariantGrid[i] = currentVariantGrid[i];
      }
    }

    // Parse grid rows vertically from Bottom to Top
    for (let y = height - 1; y >= 0; y--) {
      const leftToRight = Math.random() > 0.5;

      // Loop columns horizontally using our unbiased indexing tracking variable
      for (let i = 0; i < width; i++) {
        const x = leftToRight ? i : width - 1 - i;
        const idx = y * width + x;
        const type = currentGrid[idx];

        if (type === 0 || type === 3) continue;

        // Sand physics 
        if (type === 1) {
          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);
          let moved = false;

          // 1. Vertical Fall / Sinking Displacement
          if (y + 1 < height) {
            if (nextGrid[below] === 0) {
              // Space below is vacant in the future frame (either air, or water left it)
              nextGrid[below] = 1;
              nextVariantGrid[below] = currentVariantGrid[idx];
              moved = true;
            } else if (nextGrid[below] === 2) {
              // Water is trapped here for the next frame. Displace it up!
              const waterVariant = nextVariantGrid[below];
              nextGrid[below] = 1;
              nextVariantGrid[below] = currentVariantGrid[idx];
              nextGrid[idx] = 2;
              nextVariantGrid[idx] = waterVariant;
              moved = true;
            }
          }

          if (moved) continue;

          // 2. Diagonal Slide / Sinking Displacement
          if (y + 1 < height) {
            const slideLeftFirst = Math.random() > 0.5;

            if (slideLeftFirst) {
              // Try Left Diagonal
              if (x - 1 >= 0 && nextGrid[bottomLeft] === 0) {
                nextGrid[bottomLeft] = 1;
                nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                moved = true;
              } else if (x - 1 >= 0 && nextGrid[bottomLeft] === 2) {
                const waterVariant = nextVariantGrid[bottomLeft];
                nextGrid[bottomLeft] = 1;
                nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                nextGrid[idx] = 2;
                nextVariantGrid[idx] = waterVariant;
                moved = true;
              }
              // Try Right Diagonal
              if (!moved) {
                if (x + 1 < width && nextGrid[bottomRight] === 0) {
                  nextGrid[bottomRight] = 1;
                  nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                  moved = true;
                } else if (x + 1 < width && nextGrid[bottomRight] === 2) {
                  const waterVariant = nextVariantGrid[bottomRight];
                  nextGrid[bottomRight] = 1;
                  nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                  nextGrid[idx] = 2;
                  nextVariantGrid[idx] = waterVariant;
                  moved = true;
                }
              }
            } else {
              // Try Right Diagonal
              if (x + 1 < width && nextGrid[bottomRight] === 0) {
                nextGrid[bottomRight] = 1;
                nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                moved = true;
              } else if (x + 1 < width && nextGrid[bottomRight] === 2) {
                const waterVariant = nextVariantGrid[bottomRight];
                nextGrid[bottomRight] = 1;
                nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                nextGrid[idx] = 2;
                nextVariantGrid[idx] = waterVariant;
                moved = true;
              }
              // Try Left Diagonal
              if (!moved) {
                if (x - 1 >= 0 && nextGrid[bottomLeft] === 0) {
                  nextGrid[bottomLeft] = 1;
                  nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                  moved = true;
                } else if (x - 1 >= 0 && nextGrid[bottomLeft] === 2) {
                  const waterVariant = nextVariantGrid[bottomLeft];
                  nextGrid[bottomLeft] = 1;
                  nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                  nextGrid[idx] = 2;
                  nextVariantGrid[idx] = waterVariant;
                  moved = true;
                }
              }
            }
          }

          if (moved) continue;

          // 3. Stagnant Fallback
          if (nextGrid[idx] === 0) {
            nextGrid[idx] = 1;
            nextVariantGrid[idx] = currentVariantGrid[idx];
          }
        }

        // Water physics
        else if (type === 2) {
          // If sand already pushed fluid up here this frame, lock it and move on
          if (nextGrid[idx] !== 0) continue;

          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);

          // 1. Direct Downward Gravity Check
          if (
            y + 1 < height &&
            currentGrid[below] === 0 &&
            nextGrid[below] === 0
          ) {
            nextGrid[below] = 2;
            nextVariantGrid[below] = currentVariantGrid[idx];
            continue;
          }

          // 2. Immediate Diagonal Downward Slip Check
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
                nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                fluidMoved = true;
              } else if (
                x + 1 < width &&
                currentGrid[bottomRight] === 0 &&
                nextGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 2;
                nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                fluidMoved = true;
              }
            } else {
              if (
                x + 1 < width &&
                currentGrid[bottomRight] === 0 &&
                nextGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 2;
                nextVariantGrid[bottomRight] = currentVariantGrid[idx];
                fluidMoved = true;
              } else if (
                x - 1 >= 0 &&
                currentGrid[bottomLeft] === 0 &&
                nextGrid[bottomLeft] === 0
              ) {
                nextGrid[bottomLeft] = 2;
                nextVariantGrid[bottomLeft] = currentVariantGrid[idx];
                fluidMoved = true;
              }
            }
          }

          if (fluidMoved) continue;

          // 3. Fluid Dispersion System
          const dispersionRate = 5;
          let bestX = -1;
          let foundLedge = false;
          const searchDirections = flowLeftFirst ? [-1, 1] : [1, -1];

          for (let dir of searchDirections) {
            for (let d = 1; d <= dispersionRate; d++) {
              const nx = x + dir * d;
              if (nx < 0 || nx >= width) break;

              const nIdx = y * width + nx;
              if (currentGrid[nIdx] !== 0 || nextGrid[nIdx] !== 0) {
                break;
              }

              bestX = nx;

              if (y + 1 < height) {
                const nBelow = (y + 1) * width + nx;
                if (currentGrid[nBelow] === 0 && nextGrid[nBelow] === 0) {
                  foundLedge = true;
                  break;
                }
              }
            }
            if (foundLedge) break;
          }

          if (bestX !== -1) {
            const targetIdx = y * width + bestX;
            nextGrid[targetIdx] = 2;
            nextVariantGrid[targetIdx] = currentVariantGrid[idx];
            fluidMoved = true;
          }

          if (fluidMoved) continue;

          // 4. Stagnant Pool Safeguard Fallback
          if (nextGrid[idx] === 0) {
            nextGrid[idx] = 2;
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

        // Default Background Slate #111625
        let r = 17,
          g = 22,
          b = 37;

        // Apply Custom Visual Texturing Variations
        if (cellType === 1) {
          // Yellow Sand Grain Modifications
          if (variant === 0) {
            r = 234;
            g = 179;
            b = 8;
          } // Base Yellow
          else if (variant === 1) {
            r = 245;
            g = 197;
            b = 41;
          } // Highlight Lighter Sand
          else if (variant === 2) {
            r = 217;
            g = 161;
            b = 4;
          } // Shadow Deep Gold
          else {
            r = 226;
            g = 170;
            b = 6;
          } // Mid Tone
        } else if (cellType === 2) {
          // Blue Fluid Wave Modifications
          if (variant === 0) {
            r = 59;
            g = 130;
            b = 246;
          } // Base Blue
          else if (variant === 1) {
            r = 74;
            g = 144;
            b = 255;
          } // Foam Ripple Light Blue
          else if (variant === 2) {
            r = 43;
            g = 114;
            b = 226;
          } // Low Tide Deep Navy
          else {
            r = 51;
            g = 122;
            b = 238;
          } // Mid Aquatic Blue
        } else if (cellType === 3) {
          // Solid Structural Wall Variations
          if (variant === 0) {
            r = 148;
            g = 163;
            b = 184;
          } // Slate Grey
          else if (variant === 1) {
            r = 160;
            g = 174;
            b = 192;
          } // Light Brick Contrast
          else if (variant === 2) {
            r = 131;
            g = 146;
            b = 167;
          } // Mortar Deep Dark Shadow
          else {
            r = 139;
            g = 154;
            b = 175;
          } // Weathered Stone Concrete
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
