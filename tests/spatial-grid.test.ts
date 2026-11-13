import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/sim/rng';
import { SpatialGrid } from '../src/game/sim/spatial-grid';

function setup(count: number) {
  const rng = createRng(42);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    xs[i] = rng() * 720;
    ys[i] = rng() * 1280;
  }
  const grid = new SpatialGrid(720, 1280, 48, count);
  grid.rebuild(xs, ys, count);
  return { xs, ys, grid };
}

describe('SpatialGrid', () => {
  it('returns exactly the points inside the circle', () => {
    const { xs, ys, grid } = setup(1500);
    const out = new Int32Array(2048);
    for (const [x, y, r] of [
      [360, 640, 120],
      [0, 0, 90],
      [719, 1279, 200],
      [100, 900, 30],
    ] as const) {
      const found = Array.from(out.subarray(0, grid.queryCircle(x, y, r, out))).toSorted(
        (a, b) => a - b,
      );
      const expected: number[] = [];
      for (let i = 0; i < xs.length; i += 1) {
        if (Math.hypot((xs[i] ?? 0) - x, (ys[i] ?? 0) - y) <= r) expected.push(i);
      }
      expect(found).toEqual(expected);
    }
  });

  it('keeps points outside the map in the border cells', () => {
    const xs = Float32Array.from([-20, 800, 360]);
    const ys = Float32Array.from([-5, 1400, 640]);
    const grid = new SpatialGrid(720, 1280, 48, 3);
    grid.rebuild(xs, ys, 3);
    const out = new Int32Array(8);
    expect(grid.queryCircle(0, 0, 40, out)).toBe(1);
    expect(out[0]).toBe(0);
  });

  it('never writes past the output buffer', () => {
    const { grid } = setup(1500);
    const out = new Int32Array(4);
    expect(grid.queryCircle(360, 640, 600, out)).toBe(4);
  });

  it('forgets points after a rebuild with a smaller count', () => {
    const { xs, ys, grid } = setup(200);
    grid.rebuild(xs, ys, 0);
    expect(grid.queryCircle(360, 640, 2000, new Int32Array(512))).toBe(0);
  });
});
