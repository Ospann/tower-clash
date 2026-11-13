import { describe, expect, it } from 'vitest';
import type { LevelData, Obstacle } from '../src/game/levels/level-types';
import { FlowField } from '../src/game/sim/flow-field';
import { GridMap } from '../src/game/sim/grid-map';
import { World } from '../src/game/sim/world';

function level(obstacles: Obstacle[] = [], cols = 10, rows = 10): LevelData {
  return {
    id: 'test',
    name: 'level.stress',
    chapter: 1,
    grid: { cols, rows, cell: 20 },
    tiles: 'meadow',
    obstacles,
    entries: [{ id: 'a', x: 100, y: 0, radius: 20 }],
    zones: [{ x: 0, y: (rows - 1) * 20, w: cols * 20, h: 20 }],
    baseHp: 100,
    turretLimit: 3,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 1, duration: 1, entry: 'a', delay: 0 }] }],
  };
}

const wall: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 0, y: 80, w: 160, h: 20 } };

describe('FlowField', () => {
  it('points straight at the zone on an open map', () => {
    const map = new GridMap(level());
    const flow = new FlowField(map);
    const c = map.cellAt(110, 50);
    expect(flow.dirX[c]).toBeCloseTo(0);
    expect(flow.dirY[c]).toBeCloseTo(1);
    expect(flow.distanceAt(110, 50)).toBeCloseTo(7, 0);
    expect(flow.distanceAt(110, 190)).toBe(0);
  });

  it('routes around a wall through the gap', () => {
    const map = new GridMap(level([wall]));
    const flow = new FlowField(map);
    const above = map.cellAt(30, 70);
    expect(flow.dirX[above]).toBeGreaterThan(0);
    expect(flow.distanceAt(30, 70)).toBeGreaterThan(flow.distanceAt(170, 70));
    expect(Number.isFinite(flow.distanceAt(30, 70))).toBe(true);
  });

  it('never points a free cell into a blocked cell', () => {
    const map = new GridMap(level([wall]));
    const flow = new FlowField(map);
    for (let cy = 0; cy < map.rows; cy += 1) {
      for (let cx = 0; cx < map.cols; cx += 1) {
        const c = cy * map.cols + cx;
        if (map.blockMove[c] || map.zone[c]) continue;
        const nx = cx + Math.round(flow.dirX[c] ?? 0);
        const ny = cy + Math.round(flow.dirY[c] ?? 0);
        expect(map.blockMove[ny * map.cols + nx]).toBe(0);
      }
    }
  });

  it('marks sealed areas as unreachable', () => {
    const sealed: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 0, y: 80, w: 200, h: 20 } };
    const flow = new FlowField(new GridMap(level([sealed])));
    expect(flow.reachable(100, 10)).toBe(false);
    expect(flow.reachable(100, 150)).toBe(true);
  });

  it('does not cut diagonally between two blocked corners', () => {
    const a: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 0, y: 80, w: 100, h: 20 } };
    const b: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 100, y: 100, w: 100, h: 20 } };
    const flow = new FlowField(new GridMap(level([a, b])));
    expect(flow.reachable(100, 10)).toBe(false);
  });
});

describe('horde on the flow field', () => {
  it('walks goblins around an obstacle into the zone', () => {
    const world = new World({ level: level([wall]), manualSpawns: true });
    world.phase = 'battle';
    for (let n = 0; n < 20; n += 1) world.spawnGoblin('grunt', 20 + n * 6, 30);
    for (let i = 0; i < 60 * 30 && world.horde.count > 0; i += 1) {
      world.step(1 / 60);
      for (let g = 0; g < world.horde.count; g += 1) {
        expect(world.map.blocked(world.horde.x[g] ?? 0, world.horde.y[g] ?? 0)).toBe(false);
      }
    }
    expect(world.horde.count).toBe(0);
    expect(world.leaked).toBe(20);
    expect(world.baseHp).toBe(80);
  });

  it('pushes a goblin out of a blocked cell instead of freezing it', () => {
    const world = new World({ level: level([wall]), manualSpawns: true });
    world.phase = 'battle';
    const i = world.spawnGoblin('grunt', 150, 80);
    expect(world.map.blocked(150, 80)).toBe(true);
    for (let n = 0; n < 60 * 20 && world.horde.count > 0; n += 1) world.step(1 / 60);
    expect(i).toBe(0);
    expect(world.leaked).toBe(1);
  });

  it('spreads a stacked crowd apart', () => {
    const world = new World({ level: level([], 20, 20), manualSpawns: true });
    world.phase = 'battle';
    for (let n = 0; n < 40; n += 1) world.spawnGoblin('grunt', 200, 60);
    for (let i = 0; i < 90; i += 1) world.step(1 / 60);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let g = 0; g < world.horde.count; g += 1) {
      minX = Math.min(minX, world.horde.x[g] ?? 0);
      maxX = Math.max(maxX, world.horde.x[g] ?? 0);
    }
    expect(maxX - minX).toBeGreaterThan(40);
  });

  it('flies gliders straight over obstacles', () => {
    const sealed: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 0, y: 80, w: 200, h: 20 } };
    const world = new World({ level: level([sealed]), manualSpawns: true });
    world.phase = 'battle';
    world.spawnGoblin('glider', 100, 20);
    for (let i = 0; i < 60 * 10 && world.horde.count > 0; i += 1) world.step(1 / 60);
    expect(world.leaked).toBe(1);
  });
});

describe('entries', () => {
  it('spawns goblins outside the map and runs them in', () => {
    const world = new World({ level: level(), manualSpawns: true });
    world.phase = 'battle';
    for (let n = 0; n < 30; n += 1) {
      const i = world.spawnAtEntry(n % 5 === 0 ? 'glider' : 'grunt', 'a');
      expect(world.map.inside(world.horde.x[i] ?? 0, world.horde.y[i] ?? 0)).toBe(false);
    }
    for (let i = 0; i < 60 * 30 && world.horde.count > 0; i += 1) world.step(1 / 60);
    expect(world.leaked).toBe(30);
  });
});

describe('line of sight', () => {
  it('is blocked by rock but not by water', () => {
    const rock = new GridMap(level([wall]));
    expect(rock.hasSight(50, 30, 50, 150)).toBe(false);
    expect(rock.hasSight(190, 30, 190, 150)).toBe(true);
    const water = new GridMap(
      level([{ type: 'water', shape: { kind: 'rect', x: 0, y: 80, w: 160, h: 20 } }]),
    );
    expect(water.hasSight(50, 30, 50, 150)).toBe(true);
    expect(water.blocked(50, 90)).toBe(true);
  });
});
