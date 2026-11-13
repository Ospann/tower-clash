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
const SIZE = 2400;

const kinds: readonly TurretKind[] = ['ballista', 'mortar', 'gatling', 'tar', 'tesla', 'beam'];

export const stressTurrets: readonly { kind: TurretKind; x: number; y: number; angle: number }[] = [
  ...[300, 700, 1100, 1500, 1900].flatMap((x, index) => [
    { kind: kinds[index % kinds.length] ?? 'ballista', x, y: 1980, angle: UP },
    { kind: kinds[(index + 2) % kinds.length] ?? 'mortar', x: x + 200, y: 1700, angle: UP },
  ]),
  { kind: 'tesla', x: 1200, y: 1300, angle: UP },
  { kind: 'beam', x: 600, y: 1200, angle: UP },
  { kind: 'gatling', x: 1800, y: 1200, angle: UP },
  { kind: 'mortar', x: 1200, y: 900, angle: UP },
];

function cliff(x: number, y: number, w: number, h: number): LevelData['obstacles'][number] {
  return { type: 'cliff', shape: { kind: 'rect', x, y, w, h } };
}

export function stressLevel(): LevelData {
  return {
    id: 'stress',
    name: 'level.stress',
    chapter: 0,
    grid: { cols: SIZE / 20, rows: SIZE / 20, cell: 20 },
    tiles: 'meadow',
    obstacles: [
      cliff(0, 0, 240, SIZE),
      cliff(SIZE - 240, 0, 240, SIZE),
      cliff(240, 600, 700, 160),
      cliff(1460, 600, 700, 160),
      cliff(800, 1100, 800, 160),
      cliff(240, 1500, 600, 120),
      cliff(1560, 1500, 600, 120),
      { type: 'water', shape: { kind: 'circle', x: 1200, y: 400, r: 180 } },
      { type: 'forest', shape: { kind: 'rect', x: 520, y: 900, w: 200, h: 140 } },
      { type: 'ruins', shape: { kind: 'rect', x: 1680, y: 900, w: 200, h: 140 } },
      ...[0, 1, 2, 3, 4, 5].map((n) => ({
        type: 'rock' as const,
        shape: { kind: 'circle' as const, x: 500 + n * 280, y: 1820, r: 18 },
      })),
    ],
    entries: [
      { id: 'a', x: 600, y: 0, radius: 300 },
      { id: 'b', x: 1800, y: 0, radius: 300 },
    ],
    zones: [{ x: 240, y: 2160, w: SIZE - 480, h: 120 }],
    baseHp: 1000,
    turretLimit: 20,
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
