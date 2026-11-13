import { upgradeTree, type TurretKind } from '../../src/game/balance';
import type { LevelData } from '../../src/game/levels/level-types';
import { unlockedTurrets, type Loadout } from '../../src/game/sim/loadout';
import { loadoutFrom } from '../../src/game/sim/tree';
import { World } from '../../src/game/sim/world';

export interface BotResult {
  won: boolean;
  hpFraction: number;
  kills: number;
  leaked: number;
  peakHorde: number;
  seconds: number;
  bounty: number;
  turrets: number;
}

const PREFERENCE: readonly TurretKind[] = ['mortar', 'gatling', 'tar', 'beam', 'tesla', 'ballista'];

export function treeAt(share: number): Record<string, number> {
  const levels: Record<string, number> = {};
  if (share <= 0) return levels;
  const ordered = upgradeTree.filter((node) => node.effect.type !== 'core');
  const count = Math.round(ordered.length * Math.min(1, share * 1.4));
  for (const node of ordered.slice(0, count)) {
    levels[node.id] = Math.max(1, Math.round(node.maxLevel * share));
  }
  for (let pass = 0; pass < 6; pass += 1) {
    for (const node of ordered) {
      if (node.parent && node.parent !== 'core' && levels[node.id] && !levels[node.parent]) {
        levels[node.parent] = 1;
      }
    }
  }
  return levels;
}

export function loadoutAt(share: number): Loadout {
  return loadoutFrom(treeAt(share));
}

export function place(world: World): void {
  const kinds = unlockedTurrets(world.loadout);
  const order = PREFERENCE.filter((kind) => kinds.includes(kind));
  const zone = world.level.zones[0];
  if (!zone) return;
  const rows = [150, 280, 410];
  const columns = Math.min(4, world.turretLimit);
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < world.turretLimit; attempt += 1) {
    const row = rows[Math.floor(placed / columns) % rows.length] ?? 150;
    const column = placed % columns;
    const x = zone.x + (zone.w * (column + 0.5)) / columns + ((attempt * 37) % 90) - 45;
    const y = zone.y - row - (attempt % 5) * 26;
    const kind = order[placed % order.length] ?? 'ballista';
    if (world.addTurret(kind, x, y)) placed += 1;
  }
}

export function useAbilities(world: World): void {
  const h = world.horde;
  let best = -1;
  let least = Number.POSITIVE_INFINITY;
  for (let i = 0; i < h.count; i += 1) {
    const x = h.x[i] ?? 0;
    const y = h.y[i] ?? 0;
    if (!world.map.inside(x, y) || h.flying[i]) continue;
    const d = world.flow.distanceAt(x, y);
    if (d < least) {
      least = d;
      best = i;
    }
  }
  if (best < 0) return;
  const x = h.x[best] ?? 0;
  const y = h.y[best] ?? 0;
  world.useAirstrike(x - 150, y - 40, x + 150, y - 40);
  world.usePillar(x, y - 50);
  if (world.baseHp < world.baseMaxHp * 0.4) world.useBigBang();
}

export function playLevel(level: LevelData, loadout: Loadout, seed = 1): BotResult {
  const world = new World({ level, loadout, seed });
  place(world);
  world.startBattle();
  let peak = 0;
  let tick = 0;
  while (world.phase === 'battle' && world.time < 900) {
    if (tick % 30 === 0 && world.horde.count > 30) useAbilities(world);
    world.step(1 / 60);
    world.events.clear();
    if (world.horde.count > peak) peak = world.horde.count;
    tick += 1;
  }
  return {
    won: world.phase === 'won',
    hpFraction: world.baseHp / world.baseMaxHp,
    kills: world.kills,
    leaked: world.leaked,
    peakHorde: peak,
    seconds: world.time,
    bounty: world.bounty,
    turrets: world.turrets.length,
  };
}
