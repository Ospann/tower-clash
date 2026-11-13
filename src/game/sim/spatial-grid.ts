export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellStart: Int32Array;
  private readonly cellFill: Int32Array;
  readonly sorted: Int32Array;
  private xs: Float32Array = new Float32Array(0);
  private ys: Float32Array = new Float32Array(0);
  private readonly inv: number;

  constructor(
    width: number,
    height: number,
    readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.inv = 1 / cellSize;
    this.cellStart = new Int32Array(this.cols * this.rows + 1);
    this.cellFill = new Int32Array(this.cols * this.rows);
    this.sorted = new Int32Array(capacity);
  }

  cellOf(x: number, y: number): number {
    let cx = (x * this.inv) | 0;
    let cy = (y * this.inv) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  rebuild(xs: Float32Array, ys: Float32Array, count: number): void {
    this.xs = xs;
    this.ys = ys;
    const start = this.cellStart;
    const fill = this.cellFill;
    start.fill(0);
    fill.fill(0);
    const n = Math.min(count, this.sorted.length);
    for (let i = 0; i < n; i += 1) {
      const cell = this.cellOf(xs[i]!, ys[i]!);
      start[cell + 1]! += 1;
    }
    for (let c = 0; c < fill.length; c += 1) {
      start[c + 1]! += start[c]!;
    }
    for (let i = 0; i < n; i += 1) {
      const cell = this.cellOf(xs[i]!, ys[i]!);
      this.sorted[start[cell]! + fill[cell]!] = i;
      fill[cell]! += 1;
    }
  }

  queryCircle(x: number, y: number, radius: number, out: Int32Array): number {
    const inv = this.inv;
    let x0 = ((x - radius) * inv) | 0;
    let x1 = ((x + radius) * inv) | 0;
    let y0 = ((y - radius) * inv) | 0;
    let y1 = ((y + radius) * inv) | 0;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 >= this.cols) x1 = this.cols - 1;
    if (y1 >= this.rows) y1 = this.rows - 1;
    const r2 = radius * radius;
    const xs = this.xs;
    const ys = this.ys;
    const start = this.cellStart;
    const sorted = this.sorted;
    const limit = out.length;
    let found = 0;
    for (let cy = y0; cy <= y1; cy += 1) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx += 1) {
        const cell = row + cx;
        const end = start[cell + 1]!;
        for (let k = start[cell]!; k < end; k += 1) {
          const i = sorted[k]!;
          const dx = xs[i]! - x;
          const dy = ys[i]! - y;
          if (dx * dx + dy * dy <= r2) {
            if (found >= limit) return found;
            out[found] = i;
            found += 1;
          }
        }
      }
    }
    return found;
  }
}
