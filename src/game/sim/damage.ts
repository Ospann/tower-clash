import type { DamageType, GoblinStats } from '../balance';
import { statsAt, type World } from './world';

const MIN_DAMAGE_SHARE = 0.1;

export function computeDamage(
  amount: number,
  type: DamageType,
  stats: GoblinStats,
  pierce = 0,
): number {
  if (amount <= 0) return 0;
  const afterArmor = type === 'bolt' ? amount - Math.max(0, stats.armor - pierce) : amount;
  return Math.max(amount * MIN_DAMAGE_SHARE, afterArmor * stats.resist[type]);
}

export function applyDamage(
  world: World,
  i: number,
  amount: number,
  type: DamageType,
  flash = true,
  pierce = 0,
): number {
  const h = world.horde;
  if (i < 0 || i >= h.count || h.hp[i]! <= 0) return 0;
  const dealt = computeDamage(amount, type, statsAt(h.kind[i]!), pierce);
  h.hp[i]! -= dealt;
  if (flash) h.flash[i] = 1;
  return dealt;
}

export function damageArea(
  world: World,
  x: number,
  y: number,
  radius: number,
  amount: number,
  type: DamageType,
  hitsAir: boolean,
): number {
  const h = world.horde;
  const found = world.grid.queryCircle(x, y, radius, world.query);
  let hits = 0;
  for (let n = 0; n < found; n += 1) {
    const i = world.query[n]!;
    if (!hitsAir && h.flying[i]) continue;
    if (applyDamage(world, i, amount, type) > 0) hits += 1;
  }
  return hits;
}

export function applySlow(world: World, i: number, slow: number, seconds: number): void {
  const h = world.horde;
  const scale = statsAt(h.kind[i]!).slowScale;
  if (scale <= 0) return;
  const factor = 1 - slow * scale;
  if (h.slowTimer[i]! <= 0 || factor < h.slowFactor[i]!) h.slowFactor[i] = factor;
  if (seconds > h.slowTimer[i]!) h.slowTimer[i] = seconds;
}
