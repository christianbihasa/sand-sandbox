export class SandEngine {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.totalCells = width * height;

    // Allocate continuous sequential blocks of memory
    this.currentGrid = new Uint8Array(this.totalCells);
    this.nextGrid = new Uint8Array(this.totalCells);
  }

  clear() {
    this.currentGrid.fill(0);
    this.nextGrid.fill(0);
  }

  setCell(x, y, type) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.currentGrid[y * this.width + x] = type;
    }
  }

  updatePhysics() {
    const width = this.width;
    const height = this.height;
    const currentGrid = this.currentGrid;
    const nextGrid = this.nextGrid;

    nextGrid.fill(0); // Wipe write buffer

    // Retain solid static walls across frames
    for (let i = 0; i < currentGrid.length; i++) {
      if (currentGrid[i] === 3) nextGrid[i] = 3;
    }

    // Parse grid rows vertically from Bottom to Top
    for (let y = height - 1; y >= 0; y--) {
      const leftToRight = Math.random() > 0.5;

      // Loop columns horizontally using our unbiased indexing variable 'i'
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

          if (y + 1 < height) {
            if (nextGrid[below] === 0 && currentGrid[below] === 0) {
              nextGrid[below] = 1;
              continue;
            } else if (currentGrid[below] === 2 || nextGrid[below] === 2) {
              nextGrid[below] = 1;
              nextGrid[idx] = 2; // Displacement position swap
              continue;
            }
          }

          const slideLeftFirst = Math.random() > 0.5;
          let moved = false;

          if (y + 1 < height) {
            if (slideLeftFirst) {
              if (
                x - 1 >= 0 &&
                nextGrid[bottomLeft] === 0 &&
                currentGrid[bottomLeft] === 0
              ) {
                nextGrid[bottomLeft] = 1;
                moved = true;
              } else if (
                x - 1 >= 0 &&
                (currentGrid[bottomLeft] === 2 || nextGrid[bottomLeft] === 2)
              ) {
                nextGrid[bottomLeft] = 1;
                nextGrid[idx] = 2;
                moved = true;
              } else if (
                x + 1 < width &&
                nextGrid[bottomRight] === 0 &&
                currentGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 1;
                moved = true;
              } else if (
                x + 1 < width &&
                (currentGrid[bottomRight] === 2 || nextGrid[bottomRight] === 2)
              ) {
                nextGrid[bottomRight] = 1;
                nextGrid[idx] = 2;
                moved = true;
              }
            } else {
              if (
                x + 1 < width &&
                nextGrid[bottomRight] === 0 &&
                currentGrid[bottomRight] === 0
              ) {
                nextGrid[bottomRight] = 1;
                moved = true;
              } else if (
                x + 1 < width &&
                (currentGrid[bottomRight] === 2 || nextGrid[bottomRight] === 2)
              ) {
                nextGrid[bottomRight] = 1;
                nextGrid[idx] = 2;
                moved = true;
              } else if (
                x - 1 >= 0 &&
                nextGrid[bottomLeft] === 0 &&
                currentGrid[bottomLeft] === 0
              ) {
                nextGrid[bottomLeft] = 1;
                moved = true;
              } else if (
                x - 1 >= 0 &&
                (currentGrid[bottomLeft] === 2 || nextGrid[bottomLeft] === 2)
              ) {
                nextGrid[bottomLeft] = 1;
                nextGrid[idx] = 2;
                moved = true;
              }
            }
          }

          if (moved) continue;
          if (nextGrid[idx] === 0) nextGrid[idx] = 1;
        }

        // Water physics (Fixed Infinite Generation & Loss Loops)
        else if (type === 2) {
          // If sand already displaced water into this cell during this pass, lock it down
          if (nextGrid[idx] !== 0) continue;

          const below = (y + 1) * width + x;
          const bottomLeft = (y + 1) * width + (x - 1);
          const bottomRight = (y + 1) * width + (x + 1);
          const left = y * width + (x - 1);
          const right = y * width + (x + 1);

          if (
            y + 1 < height &&
            currentGrid[below] === 0 &&
            nextGrid[below] === 0
          ) {
            nextGrid[below] = 2;
            continue;
          }

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

          // Horizontal Fluid Spreading Check
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

          // If no movement parameters match, pool safely inside current slot coordinates
          if (nextGrid[idx] === 0) nextGrid[idx] = 2;
        }
      }
    }
    this.currentGrid.set(this.nextGrid);
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

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellType = currentGrid[y * width + x];

        let r = 17,
          g = 22,
          b = 37; // Dark Emerald Canvas Base
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
        } // Slate Wall

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
