import { upgradeTree, type TurretKind } from '../../src/game/balance';
import { layout } from '../../src/game/config';
import type { LevelData } from '../../src/game/levels/level-types';
import { unlockedTurrets, type Loadout } from '../../src/game/sim/loadout';
import { loadoutFrom } from '../../src/game/sim/tree';
import { inSector } from '../../src/game/sim/turrets';
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

const STEP = 20;

export function place(world: World): void {
  const kinds = unlockedTurrets(world.loadout);
  const order = PREFERENCE.filter((kind) => kinds.includes(kind));
  const { map, flow } = world;
  const walk: number[] = [];
  let maxDist = 1;
  for (let c = 0; c < map.blockMove.length; c += 1) {
    const dist = flow.dist[c] ?? Number.POSITIVE_INFINITY;
    if (map.blockMove[c] || map.zone[c] || !Number.isFinite(dist)) continue;
    walk.push(c);
    maxDist = Math.max(maxDist, dist);
  }
  const covered = new Float32Array(map.blockMove.length);
  const centerX = (c: number): number => ((c % map.cols) + 0.5) * map.cell;
  const centerY = (c: number): number => (Math.floor(c / map.cols) + 0.5) * map.cell;

  for (let placed = 0; placed < world.turretLimit; placed += 1) {
    const kind = order[placed % order.length] ?? 'ballista';
    const spec = world.specs[kind];
    const reach = spec.range * 0.85;
    let best = { score: 0, x: 0, y: 0, sx: 0, sy: 0 };
    for (let y = layout.hudHeight + 30; y < layout.bottomBarY - 30; y += STEP) {
      for (let x = 30; x < map.width - 30; x += STEP) {
        if (world.placementIssue(kind, x, y) !== 'ok') continue;
        let score = 0;
        let sx = 0;
        let sy = 0;
        for (const c of walk) {
          const d = Math.hypot(centerX(c) - x, centerY(c) - y);
          if (d > reach || d < spec.minRange) continue;
          const weight = (1 + 2 * (1 - (flow.dist[c] ?? 0) / maxDist)) / (1 + (covered[c] ?? 0));
          score += weight;
          sx += centerX(c) * weight;
          sy += centerY(c) * weight;
        }
        if (score > best.score) best = { score, x, y, sx, sy };
      }
    }
    if (best.score <= 0) break;
    const angle = Math.atan2(best.sy / best.score - best.y, best.sx / best.score - best.x);
    const turret = world.addTurret(kind, best.x, best.y, angle);
    if (!turret) break;
    for (const c of walk) {
      if (inSector(turret, spec, centerX(c), centerY(c))) covered[c] = (covered[c] ?? 0) + 1;
    }
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
