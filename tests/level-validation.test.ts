import { describe, expect, it } from 'vitest';
import { isTranslationKey } from '../src/i18n';
import { levels } from '../src/game/levels';
import type { LevelData } from '../src/game/levels/level-types';
import { LevelValidationError, parseLevel, validateLevel } from '../src/game/levels/validate-level';

function valid(): LevelData {
  return {
    id: 'x',
    name: 'level.01',
    chapter: 1,
    grid: { cols: 36, rows: 64, cell: 20 },
    tiles: 'meadow',
    obstacles: [{ type: 'rock', shape: { kind: 'rect', x: 100, y: 400, w: 100, h: 60 } }],
    entries: [{ id: 'n', x: 360, y: 0, radius: 80 }],
    zones: [{ x: 0, y: 1040, w: 720, h: 90 }],
    baseHp: 20,
    turretLimit: 3,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 5, duration: 4, entry: 'n', delay: 0 }] }],
  };
}

function kinds(level: LevelData): Set<string> {
  return new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.goblin)));
}

function broken(change: (level: Record<string, unknown>) => void): string[] {
  const level: Record<string, unknown> = { ...structuredClone(valid()) };
  change(level);
  return validateLevel(level);
}

describe('bundled levels', () => {
  it('ships 12 valid levels in 3 chapters of 4', () => {
    expect(levels).toHaveLength(12);
    for (const chapter of [1, 2, 3]) {
      expect(levels.filter((level) => level.chapter === chapter)).toHaveLength(4);
    }
    for (const level of levels) expect(validateLevel(level)).toEqual([]);
  });

  it('uses unique ids and translated names', () => {
    expect(new Set(levels.map((level) => level.id)).size).toBe(levels.length);
    for (const level of levels) expect(isTranslationKey(level.name)).toBe(true);
  });

  it('starts with one entry and ends with several entries, gliders and bosses', () => {
    for (const level of levels.filter((item) => item.chapter === 1)) {
      expect(level.entries).toHaveLength(1);
    }
    const third = levels.filter((item) => item.chapter === 3);
    expect(third.every((level) => level.entries.length >= 2)).toBe(true);
    expect(third.some((level) => kinds(level).has('glider'))).toBe(true);
    expect(third.some((level) => kinds(level).has('boss'))).toBe(true);
    expect(kinds(levels[0] ?? valid())).toEqual(new Set(['grunt']));
  });
});

describe('validateLevel', () => {
  it('accepts a valid level', () => {
    expect(validateLevel(valid())).toEqual([]);
    expect(parseLevel(valid(), 'x.json').id).toBe('x');
  });

  it('rejects non-objects', () => {
    expect(validateLevel(null)).toEqual(['level: expected an object']);
  });

  it('names the exact field for wrong types and ranges', () => {
    expect(broken((l) => (l.baseHp = 'many'))).toEqual(['baseHp: expected a number, got "many"']);
    expect(broken((l) => (l.turretLimit = 2.5))).toEqual([
      'turretLimit: expected an integer, got 2.5',
    ]);
    expect(broken((l) => (l.tiles = 'lava'))[0]).toContain('tiles: unknown value "lava"');
    expect(broken((l) => (l.grid = { cols: 2, rows: 64, cell: 20 }))[0]).toContain('grid.cols');
  });

  it('reports unknown goblins and entries with their path', () => {
    const issues = broken((l) => {
      l.waves = [{ groups: [{ goblin: 'orc', count: 0, duration: 1, entry: 'south', delay: 0 }] }];
    });
    expect(issues).toContain('waves[0].groups[0].count: 0 is out of range 1..3000');
    expect(issues).toContain('waves[0].groups[0].entry: unknown entry "south"');
    expect(
      issues.some((issue) => issue.startsWith('waves[0].groups[0].goblin: unknown value "orc"')),
    ).toBe(true);
  });

  it('requires entries on the map edge', () => {
    const issues = broken((l) => (l.entries = [{ id: 'n', x: 360, y: 300, radius: 80 }]));
    expect(issues[0]).toContain('entries[0]: an entry must sit on a map edge');
  });

  it('rejects an entry that cannot reach the red zone', () => {
    const issues = broken((l) => {
      l.obstacles = [{ type: 'rock', shape: { kind: 'rect', x: 0, y: 500, w: 720, h: 40 } }];
    });
    expect(issues).toEqual([
      'entries[0]: entry "n" cannot reach a red zone (blocked by obstacles)',
    ]);
  });

  it('validates obstacle shapes and the win condition', () => {
    expect(
      broken(
        (l) =>
          (l.obstacles = [{ type: 'rock', shape: { kind: 'poly', points: [{ x: 1, y: 1 }] } }]),
      )[0],
    ).toContain('obstacles[0].shape.points: expected at least 3 item(s)');
    expect(
      broken((l) => (l.obstacles = [{ type: 'lava', shape: { kind: 'circle' } }])),
    ).toHaveLength(2);
    expect(broken((l) => (l.win = { type: 'timer' }))[0]).toContain('win.seconds');
    expect(broken((l) => (l.win = { type: 'points' }))).toEqual([
      'win.type: expected "waves" or "timer"',
    ]);
  });

  it('throws a readable error with every issue', () => {
    const level = { ...valid(), baseHp: -1, zones: [] };
    expect(() => parseLevel(level, 'bad.json')).toThrow(LevelValidationError);
    expect(() => parseLevel(level, 'bad.json')).toThrow('Invalid level bad.json');
    expect(() => parseLevel(level, 'bad.json')).toThrow('zones: expected at least 1 item(s)');
  });
});
