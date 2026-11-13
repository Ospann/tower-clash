import type { GridMap } from './grid-map';

const WALL_PENALTY = 0.7;
const SQRT2 = Math.SQRT2;
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [-1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, -1, SQRT2],
];

class MinHeap {
  private readonly cells: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, key: number): void {
    const cells = this.cells;
    const keys = this.keys;
    let i = cells.length;
    cells.push(cell);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      cells[i] = cells[parent]!;
      keys[i] = keys[parent]!;
      i = parent;
    }
    cells[i] = cell;
    keys[i] = key;
  }

  pop(): number {
    const cells = this.cells;
    const keys = this.keys;
    const top = cells[0]!;
    const lastCell = cells.pop()!;
    const lastKey = keys.pop()!;
    const n = cells.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = i * 2 + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1]! < keys[child]!) child += 1;
        if (keys[child]! >= lastKey) break;
        cells[i] = cells[child]!;
        keys[i] = keys[child]!;
        i = child;
      }
      cells[i] = lastCell;
      keys[i] = lastKey;
    }
    return top;
  }
}

export class FlowField {
  readonly dist: Float32Array;
  readonly dirX: Float32Array;
  readonly dirY: Float32Array;

  constructor(readonly map: GridMap) {
    const { cols, rows } = map;
    const size = cols * rows;
    this.dist = new Float32Array(size).fill(Number.POSITIVE_INFINITY);
    this.dirX = new Float32Array(size);
    this.dirY = new Float32Array(size);

    const penalty = new Float32Array(size);
    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        const c = cy * cols + cx;
        if (map.blockMove[c]) continue;
        for (const [ox, oy] of NEIGHBOURS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (map.blockMove[ny * cols + nx]) {
            penalty[c] = WALL_PENALTY;
            break;
          }
        }
      }
    }

    const heap = new MinHeap();
    for (let c = 0; c < size; c += 1) {
      if (map.zone[c]) {
        this.dist[c] = 0;
        heap.push(c, 0);
      }
    }
    while (heap.size > 0) {
      const c = heap.pop();
      const base = this.dist[c]!;
      const cx = c % cols;
      const cy = (c - cx) / cols;
      for (const [ox, oy, cost] of NEIGHBOURS) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = ny * cols + nx;
        if (map.blockMove[n]) continue;
        if (ox !== 0 && oy !== 0) {
          if (map.blockMove[cy * cols + nx] || map.blockMove[ny * cols + cx]) continue;
        }
        const next = base + cost + penalty[n]!;
        if (next < this.dist[n]!) {
          this.dist[n] = next;
          heap.push(n, next);
        }
      }
    }

    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        const c = cy * cols + cx;
        const blocked = map.blockMove[c] === 1;
        let best = blocked ? Number.POSITIVE_INFINITY : this.dist[c]!;
        let bx = 0;
        let by = 0;
        for (const [ox, oy] of NEIGHBOURS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx;
          if (map.blockMove[n]) continue;
          if (!blocked && ox !== 0 && oy !== 0) {
            if (map.blockMove[cy * cols + nx] || map.blockMove[ny * cols + cx]) continue;
          }
          if (this.dist[n]! < best) {
            best = this.dist[n]!;
            bx = ox;
            by = oy;
          }
        }
        const len = Math.hypot(bx, by) || 1;
        this.dirX[c] = bx / len;
        this.dirY[c] = by / len;
      }
    }
  }

  reachable(x: number, y: number): boolean {
    return Number.isFinite(this.dist[this.map.cellAt(x, y)]!);
  }

  distanceAt(x: number, y: number): number {
    return this.dist[this.map.cellAt(x, y)]!;
  }
}
