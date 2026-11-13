import type { LevelData, Obstacle, Point, Rect } from '../levels/level-types';

export const sightBlockers: Readonly<Record<Obstacle['type'], boolean>> = {
  cliff: false,
  rock: true,
  forest: true,
  ruins: true,
  water: false,
};

export const buildableTerrain: Readonly<Record<Obstacle['type'], boolean>> = {
  cliff: true,
  rock: false,
  forest: false,
  ruins: false,
  water: false,
};

function inPolygon(points: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function obstacleContains(obstacle: Obstacle, x: number, y: number): boolean {
  const shape = obstacle.shape;
  if (shape.kind === 'rect') {
    return x >= shape.x && x < shape.x + shape.w && y >= shape.y && y < shape.y + shape.h;
  }
  if (shape.kind === 'circle') {
    const dx = x - shape.x;
    const dy = y - shape.y;
    return dx * dx + dy * dy < shape.r * shape.r;
  }
  return inPolygon(shape.points, x, y);
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export class GridMap {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly width: number;
  readonly height: number;
  readonly blockMove: Uint8Array;
  readonly blockSight: Uint8Array;
  readonly zone: Uint8Array;
  readonly buildable: Uint8Array;
  private readonly inv: number;

  constructor(level: Pick<LevelData, 'grid' | 'obstacles' | 'zones'>) {
    this.cols = level.grid.cols;
    this.rows = level.grid.rows;
    this.cell = level.grid.cell;
    this.inv = 1 / this.cell;
    this.width = this.cols * this.cell;
    this.height = this.rows * this.cell;
    const size = this.cols * this.rows;
    this.blockMove = new Uint8Array(size);
    this.blockSight = new Uint8Array(size);
    this.zone = new Uint8Array(size);
    this.buildable = new Uint8Array(size).fill(1);
    for (let cy = 0; cy < this.rows; cy += 1) {
      for (let cx = 0; cx < this.cols; cx += 1) {
        const x = (cx + 0.5) * this.cell;
        const y = (cy + 0.5) * this.cell;
        const c = cy * this.cols + cx;
        for (const zone of level.zones) {
          if (rectContains(zone, x, y)) this.zone[c] = 1;
        }
        for (const obstacle of level.obstacles) {
          if (!obstacleContains(obstacle, x, y)) continue;
          this.blockMove[c] = 1;
          if (sightBlockers[obstacle.type]) this.blockSight[c] = 1;
          if (!buildableTerrain[obstacle.type]) this.buildable[c] = 0;
        }
        if (this.zone[c]) {
          this.blockMove[c] = 0;
          this.blockSight[c] = 0;
          this.buildable[c] = 0;
        }
      }
    }
  }

  cellAt(x: number, y: number): number {
    let cx = (x * this.inv) | 0;
    let cy = (y * this.inv) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  blocked(x: number, y: number): boolean {
    return !this.inside(x, y) || this.blockMove[this.cellAt(x, y)] === 1;
  }

  hasSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) / (this.cell * 0.5));
    if (steps <= 1) return true;
    const sx = dx / steps;
    const sy = dy / steps;
    let x = x0;
    let y = y0;
    for (let i = 1; i < steps; i += 1) {
      x += sx;
      y += sy;
      if (this.blockSight[this.cellAt(x, y)] === 1) return false;
    }
    return true;
  }

  sightLimit(x0: number, y0: number, angle: number, reach: number): number {
    const step = this.cell * 0.5;
    const sx = Math.cos(angle) * step;
    const sy = Math.sin(angle) * step;
    let x = x0;
    let y = y0;
    for (let d = step; d < reach; d += step) {
      x += sx;
      y += sy;
      if (!this.inside(x, y) || this.blockSight[this.cellAt(x, y)] === 1) return d;
    }
    return reach;
  }

  canBuild(x: number, y: number): boolean {
    return this.inside(x, y) && this.buildable[this.cellAt(x, y)] === 1;
  }

  circleBuildable(x: number, y: number, radius: number): boolean {
    for (let a = 0; a < 8; a += 1) {
      const angle = (a / 8) * Math.PI * 2;
      if (!this.canBuild(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
    }
    return this.canBuild(x, y);
  }

  buildableCount(top = 0, bottom = this.height): number {
    let total = 0;
    for (let cy = 0; cy < this.rows; cy += 1) {
      const y = (cy + 0.5) * this.cell;
      if (y < top || y > bottom) continue;
      for (let cx = 0; cx < this.cols; cx += 1) total += this.buildable[cy * this.cols + cx]!;
    }
    return total;
  }

  circleFree(x: number, y: number, radius: number): boolean {
    for (let a = 0; a < 8; a += 1) {
      const angle = (a / 8) * Math.PI * 2;
      if (this.blocked(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
    }
    return !this.blocked(x, y);
  }
}
