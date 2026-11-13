import type { GoblinKind, TurretKind } from '../balance';
import type { LevelData } from '../levels/level-types';
import type { World } from '../sim/world';

const MIX: readonly (readonly [GoblinKind, number])[] = [
  ['grunt', 0.66],
  ['runner', 0.12],
  ['shield', 0.09],
  ['brute', 0.03],
  ['shaman', 0.04],
  ['glider', 0.06],
];

const UP = -Math.PI / 2;

export const stressTurrets: readonly { kind: TurretKind; x: number; y: number; angle: number }[] = [
  { kind: 'ballista', x: 360, y: 980, angle: UP },
  { kind: 'mortar', x: 120, y: 960, angle: UP },
  { kind: 'gatling', x: 250, y: 820, angle: UP },
  { kind: 'tar', x: 600, y: 960, angle: UP },
  { kind: 'tesla', x: 200, y: 640, angle: UP },
  { kind: 'beam', x: 470, y: 820, angle: UP },
  { kind: 'gatling', x: 520, y: 640, angle: UP },
  { kind: 'tesla', x: 360, y: 760, angle: UP },
  { kind: 'mortar', x: 360, y: 640, angle: UP },
  { kind: 'ballista', x: 60, y: 620, angle: -0.6 },
  { kind: 'beam', x: 660, y: 620, angle: -2.5 },
  { kind: 'tar', x: 360, y: 300, angle: UP },
];

export function stressLevel(): LevelData {
  return {
    id: 'stress',
    name: 'level.stress',
    chapter: 0,
    grid: { cols: 36, rows: 64, cell: 20 },
    tiles: 'meadow',
    obstacles: [
      { type: 'water', shape: { kind: 'rect', x: 240, y: 420, w: 240, h: 160 } },
      { type: 'rock', shape: { kind: 'rect', x: 0, y: 700, w: 200, h: 80 } },
      { type: 'rock', shape: { kind: 'rect', x: 520, y: 700, w: 200, h: 80 } },
      {
        type: 'forest',
        shape: {
          kind: 'poly',
          points: [
            { x: 60, y: 240 },
            { x: 200, y: 220 },
            { x: 220, y: 330 },
            { x: 90, y: 360 },
          ],
        },
      },
      { type: 'ruins', shape: { kind: 'rect', x: 500, y: 260, w: 120, h: 100 } },
      { type: 'ruins', shape: { kind: 'rect', x: 300, y: 860, w: 120, h: 60 } },
    ],
    entries: [
      { id: 'a', x: 180, y: 0, radius: 70 },
      { id: 'b', x: 540, y: 0, radius: 70 },
    ],
    zones: [{ x: 0, y: 1040, w: 720, h: 90 }],
    baseHp: 1000,
    turretLimit: 12,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 1, duration: 1, entry: 'a', delay: 0 }] }],
  };
}

function pickKind(roll: number): GoblinKind {
  let acc = 0;
  for (const [kind, share] of MIX) {
    acc += share;
    if (roll < acc) return kind;
  }
  return 'grunt';
}

export class StressDriver {
  constructor(
    private readonly world: World,
    private readonly target: number,
  ) {}

  update(): void {
    const world = this.world;
    const missing = Math.min(this.target, world.horde.capacity) - world.horde.count;
    const batch = Math.min(missing, 30);
    for (let n = 0; n < batch; n += 1) {
      const entry = world.level.entries[Math.floor(world.rng() * world.level.entries.length)];
      if (entry) world.spawnAtEntry(pickKind(world.rng()), entry.id);
    }
  }
}
