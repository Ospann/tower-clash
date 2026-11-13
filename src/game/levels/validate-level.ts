import { GOBLIN_KINDS, spawnRules } from '../balance';
import { FlowField } from '../sim/flow-field';
import { layout } from '../config';
import { GridMap } from '../sim/grid-map';
import { entryOutward } from '../sim/world';
import { OBSTACLE_TYPES, TILE_THEMES, type LevelData } from './level-types';

export class LevelValidationError extends Error {
  constructor(
    readonly source: string,
    readonly issues: string[],
  ) {
    super(`Invalid level ${source}:\n- ${issues.join('\n- ')}`);
    this.name = 'LevelValidationError';
  }
}

type Issues = string[];

const MIN_BUILDABLE_CELLS = 60;
type Dict = Record<string, unknown>;

function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, at: string, issues: Issues, min: number, max: number): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(`${at}: expected a number, got ${JSON.stringify(value) ?? typeof value}`);
    return false;
  }
  if (value < min || value > max) {
    issues.push(`${at}: ${value} is out of range ${min}..${max}`);
    return false;
  }
  return true;
}

function int(value: unknown, at: string, issues: Issues, min: number, max: number): boolean {
  if (!num(value, at, issues, min, max)) return false;
  if (!Number.isInteger(value)) {
    issues.push(`${at}: expected an integer, got ${String(value)}`);
    return false;
  }
  return true;
}

function text(value: unknown, at: string, issues: Issues): value is string {
  if (typeof value !== 'string' || value === '') {
    issues.push(`${at}: expected a non-empty string`);
    return false;
  }
  return true;
}

function oneOf(value: unknown, options: readonly string[], at: string, issues: Issues): boolean {
  if (typeof value !== 'string' || !options.includes(value)) {
    issues.push(
      `${at}: unknown value ${JSON.stringify(value)}, expected one of ${options.join(', ')}`,
    );
    return false;
  }
  return true;
}

function list(value: unknown, at: string, issues: Issues, min: number): value is unknown[] {
  if (!Array.isArray(value)) {
    issues.push(`${at}: expected an array`);
    return false;
  }
  if (value.length < min) {
    issues.push(`${at}: expected at least ${min} item(s), got ${value.length}`);
    return false;
  }
  return true;
}

function rect(value: unknown, at: string, issues: Issues, w: number, h: number): boolean {
  if (!isRecord(value)) {
    issues.push(`${at}: expected a rectangle { x, y, w, h }`);
    return false;
  }
  const ok = [
    num(value.x, `${at}.x`, issues, 0, w),
    num(value.y, `${at}.y`, issues, 0, h),
    num(value.w, `${at}.w`, issues, 1, w),
    num(value.h, `${at}.h`, issues, 1, h),
  ];
  return ok.every(Boolean);
}

function checkObstacles(value: unknown, issues: Issues, w: number, h: number): void {
  if (!list(value, 'obstacles', issues, 0)) return;
  value.forEach((obstacle, o) => {
    const at = `obstacles[${o}]`;
    if (!isRecord(obstacle)) {
      issues.push(`${at}: expected an object`);
      return;
    }
    oneOf(obstacle.type, OBSTACLE_TYPES, `${at}.type`, issues);
    const shape = obstacle.shape;
    if (!isRecord(shape)) {
      issues.push(`${at}.shape: expected an object`);
      return;
    }
    if (shape.kind === 'rect') {
      rect(shape, `${at}.shape`, issues, w, h);
    } else if (shape.kind === 'poly') {
      if (!list(shape.points, `${at}.shape.points`, issues, 3)) return;
      shape.points.forEach((point, p) => {
        const here = `${at}.shape.points[${p}]`;
        if (!isRecord(point)) {
          issues.push(`${here}: expected a point { x, y }`);
          return;
        }
        num(point.x, `${here}.x`, issues, 0, w);
        num(point.y, `${here}.y`, issues, 0, h);
      });
    } else if (shape.kind === 'circle') {
      num(shape.x, `${at}.shape.x`, issues, 0, w);
      num(shape.y, `${at}.shape.y`, issues, 0, h);
      num(shape.r, `${at}.shape.r`, issues, 4, Math.max(w, h));
    } else {
      issues.push(`${at}.shape.kind: expected "rect", "poly" or "circle"`);
    }
  });
}

function checkEntries(value: unknown, issues: Issues, w: number, h: number): Set<string> {
  const ids = new Set<string>();
  if (!list(value, 'entries', issues, 1)) return ids;
  value.forEach((entry, e) => {
    const at = `entries[${e}]`;
    if (!isRecord(entry)) {
      issues.push(`${at}: expected an object`);
      return;
    }
    if (text(entry.id, `${at}.id`, issues)) {
      if (ids.has(entry.id)) issues.push(`${at}.id: duplicate entry id "${entry.id}"`);
      ids.add(entry.id);
    }
    const okX = num(entry.x, `${at}.x`, issues, 0, w);
    const okY = num(entry.y, `${at}.y`, issues, 0, h);
    num(entry.radius, `${at}.radius`, issues, 10, 400);
    if (okX && okY) {
      const x = Number(entry.x);
      const y = Number(entry.y);
      const edge = Math.min(x, y, w - x, h - y);
      if (edge > spawnRules.edgeTolerance) {
        issues.push(
          `${at}: an entry must sit on a map edge (within ${spawnRules.edgeTolerance}px), it is ${Math.round(edge)}px inside`,
        );
      }
    }
  });
  return ids;
}

function checkWaves(value: unknown, issues: Issues, entryIds: ReadonlySet<string>): void {
  if (!list(value, 'waves', issues, 1)) return;
  value.forEach((wave, w) => {
    const at = `waves[${w}]`;
    if (!isRecord(wave)) {
      issues.push(`${at}: expected an object`);
      return;
    }
    if (!list(wave.groups, `${at}.groups`, issues, 1)) return;
    wave.groups.forEach((group, g) => {
      const here = `${at}.groups[${g}]`;
      if (!isRecord(group)) {
        issues.push(`${here}: expected an object`);
        return;
      }
      oneOf(group.goblin, GOBLIN_KINDS, `${here}.goblin`, issues);
      int(group.count, `${here}.count`, issues, 1, 3000);
      num(group.duration, `${here}.duration`, issues, 0, 300);
      num(group.delay, `${here}.delay`, issues, 0, 300);
      if (text(group.entry, `${here}.entry`, issues) && !entryIds.has(group.entry)) {
        issues.push(`${here}.entry: unknown entry "${group.entry}"`);
      }
    });
  });
}

function hasLevelShape(value: unknown): value is LevelData {
  return isRecord(value);
}

export function validateLevel(value: unknown): string[] {
  const issues: Issues = [];
  if (!isRecord(value)) return ['level: expected an object'];

  text(value.id, 'id', issues);
  text(value.name, 'name', issues);
  int(value.chapter, 'chapter', issues, 0, 99);

  let w = 720;
  let h = 1280;
  let gridOk = false;
  if (isRecord(value.grid)) {
    const ok = [
      int(value.grid.cols, 'grid.cols', issues, 8, 256),
      int(value.grid.rows, 'grid.rows', issues, 8, 256),
      num(value.grid.cell, 'grid.cell', issues, 8, 64),
    ];
    if (ok.every(Boolean)) {
      gridOk = true;
      w = Number(value.grid.cols) * Number(value.grid.cell);
      h = Number(value.grid.rows) * Number(value.grid.cell);
    }
  } else {
    issues.push('grid: expected an object { cols, rows, cell }');
  }

  oneOf(value.tiles, TILE_THEMES, 'tiles', issues);
  checkObstacles(value.obstacles, issues, w, h);
  const entryIds = checkEntries(value.entries, issues, w, h);
  if (list(value.zones, 'zones', issues, 1)) {
    value.zones.forEach((zone, z) => rect(zone, `zones[${z}]`, issues, w, h));
  }
  num(value.baseHp, 'baseHp', issues, 1, 100000);
  int(value.turretLimit, 'turretLimit', issues, 1, 40);

  if (isRecord(value.win)) {
    if (value.win.type === 'timer') num(value.win.seconds, 'win.seconds', issues, 5, 3600);
    else if (value.win.type !== 'waves') issues.push('win.type: expected "waves" or "timer"');
  } else {
    issues.push('win: expected { type: "waves" } or { type: "timer", seconds }');
  }

  if (isRecord(value.difficulty)) {
    num(value.difficulty.hp, 'difficulty.hp', issues, 0.1, 100);
    num(value.difficulty.speed, 'difficulty.speed', issues, 0.1, 10);
  } else {
    issues.push('difficulty: expected an object { hp, speed }');
  }

  checkWaves(value.waves, issues, entryIds);
  if (issues.length > 0 || !gridOk || !hasLevelShape(value)) return issues;

  const level = value;
  const map = new GridMap(level);
  const flow = new FlowField(map);
  const room = map.buildableCount(layout.hudHeight, layout.bottomBarY);
  if (room < MIN_BUILDABLE_CELLS) {
    issues.push(
      `obstacles: only ${room} buildable cells, at least ${MIN_BUILDABLE_CELLS} are needed for turrets`,
    );
  }
  level.entries.forEach((entry, e) => {
    const out = entryOutward(entry, w, h);
    const x = Math.min(Math.max(entry.x - out.x * spawnRules.inset, 1), w - 1);
    const y = Math.min(Math.max(entry.y - out.y * spawnRules.inset, 1), h - 1);
    if (!flow.reachable(x, y)) {
      issues.push(
        `entries[${e}]: entry "${entry.id}" cannot reach a red zone (blocked by obstacles)`,
      );
    }
  });
  return issues;
}

export function isLevelData(value: unknown): value is LevelData {
  return validateLevel(value).length === 0;
}

export function parseLevel(value: unknown, source: string): LevelData {
  if (!isLevelData(value)) throw new LevelValidationError(source, validateLevel(value));
  return value;
}
