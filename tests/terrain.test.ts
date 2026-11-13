import { describe, expect, it } from 'vitest';
import type { LevelData, Obstacle } from '../src/game/levels/level-types';
import { validateLevel } from '../src/game/levels/validate-level';
import { GridMap, obstacleContains } from '../src/game/sim/grid-map';
import { World } from '../src/game/sim/world';

function level(obstacles: Obstacle[]): LevelData {
  return {
    id: 'terrain',
    name: 'level.01',
    chapter: 1,
    grid: { cols: 36, rows: 64, cell: 20 },
    tiles: 'meadow',
    obstacles,
    entries: [{ id: 'n', x: 360, y: 0, radius: 60 }],
    zones: [{ x: 0, y: 1040, w: 720, h: 90 }],
    baseHp: 20,
    turretLimit: 4,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 5, duration: 4, entry: 'n', delay: 0 }] }],
  };
}

const leftCliff: Obstacle = { type: 'cliff', shape: { kind: 'rect', x: 0, y: 0, w: 260, h: 1040 } };
const rightCliff: Obstacle = {
  type: 'cliff',
  shape: { kind: 'rect', x: 460, y: 0, w: 260, h: 1040 },
};

describe('cliffs', () => {
  it('block goblins but stay buildable and see-through', () => {
    const map = new GridMap(level([leftCliff]));
    expect(map.blocked(100, 500)).toBe(true);
    expect(map.canBuild(100, 500)).toBe(true);
    expect(map.hasSight(100, 500, 400, 500)).toBe(true);
  });

  it('keep rock, forest, water and ruins unbuildable', () => {
    for (const type of ['rock', 'forest', 'water', 'ruins'] as const) {
      const map = new GridMap(
        level([{ type, shape: { kind: 'rect', x: 0, y: 400, w: 200, h: 200 } }]),
      );
      expect(map.canBuild(100, 500)).toBe(false);
      expect(map.blocked(100, 500)).toBe(true);
    }
  });

  it('never allow building in the red zone', () => {
    const map = new GridMap(level([leftCliff]));
    expect(map.canBuild(360, 1080)).toBe(false);
  });

  it('let turrets stand on a plateau above a corridor', () => {
    const world = new World({ level: level([leftCliff, rightCliff]), manualSpawns: true });
    expect(world.placementIssue('ballista', 130, 500)).toBe('ok');
    expect(world.placementIssue('ballista', 360, 500)).toBe('ok');
    expect(world.placementIssue('ballista', 262, 500)).toBe('ok');
    const rock = new World({
      level: level([leftCliff, { type: 'rock', shape: { kind: 'circle', x: 360, y: 500, r: 40 } }]),
      manualSpawns: true,
    });
    expect(rock.placementIssue('ballista', 360, 500)).toBe('blocked');
  });

  it('route goblins through the corridor between plateaus', () => {
    const world = new World({ level: level([leftCliff, rightCliff]), manualSpawns: true });
    world.phase = 'battle';
    for (let n = 0; n < 15; n += 1) world.spawnAtEntry('grunt', 'n');
    for (let i = 0; i < 60 * 40 && world.horde.count > 0; i += 1) {
      world.step(1 / 60);
      for (let g = 0; g < world.horde.count; g += 1) {
        const x = world.horde.x[g] ?? 0;
        const y = world.horde.y[g] ?? 0;
        expect(world.map.inside(x, y) && world.map.blocked(x, y)).toBe(false);
      }
    }
    expect(world.leaked).toBe(15);
  });
});

describe('circle obstacles', () => {
  it('contain points inside the radius only', () => {
    const peg: Obstacle = { type: 'rock', shape: { kind: 'circle', x: 100, y: 100, r: 30 } };
    expect(obstacleContains(peg, 120, 110)).toBe(true);
    expect(obstacleContains(peg, 131, 100)).toBe(false);
  });

  it('are validated', () => {
    const bad = level([{ type: 'rock', shape: { kind: 'circle', x: 100, y: 100, r: 1 } }]);
    expect(validateLevel(bad)).toEqual(['obstacles[0].shape.r: 1 is out of range 4..1280']);
  });
});

describe('level checks', () => {
  it('require room for turrets', () => {
    const sealed = level([
      { type: 'rock', shape: { kind: 'rect', x: 0, y: 0, w: 300, h: 1040 } },
      { type: 'rock', shape: { kind: 'rect', x: 420, y: 0, w: 300, h: 1040 } },
      { type: 'water', shape: { kind: 'rect', x: 300, y: 0, w: 120, h: 1040 } },
    ]);
    const issues = validateLevel(sealed);
    expect(issues.some((issue) => issue.includes('buildable cells'))).toBe(true);
  });
});
