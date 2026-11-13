import { turretRules, turrets, type TurretKind, type TurretStats } from '../balance';
import { applyDamage } from './damage';
import { FxKind } from './events';
import type { TurretMods } from './loadout';
import { ProjectileKind } from './projectiles';
import type { World } from './world';

export interface Turret {
  id: number;
  kind: TurretKind;
  x: number;
  y: number;
  angle: number;
  aim: number;
  cooldown: number;
  recoil: number;
  beamLength: number;
  spin: number;
}

export interface TurretSpec {
  stats: TurretStats;
  damage: number;
  cooldown: number;
  range: number;
  minRange: number;
  halfArc: number;
  splash: number;
  special: number;
  duration: number;
  pierce: number;
}

export function turretSpec(kind: TurretKind, mods: TurretMods): TurretSpec {
  const stats = turrets[kind];
  const arcDeg =
    stats.arcDeg >= 360 ? 360 : Math.min(turretRules.arcDegMax, stats.arcDeg * mods.arc);
  const chained = kind === 'tesla';
  return {
    stats,
    damage: stats.damage * mods.damage,
    cooldown: stats.cooldown / mods.rate,
    range: stats.range * mods.range,
    minRange: stats.minRange,
    halfArc: (arcDeg * Math.PI) / 360,
    splash:
      stats.splash * (kind === 'mortar' || kind === 'tar' || kind === 'beam' ? mods.special : 1),
    special: chained
      ? Math.round(stats.special + (mods.special - 1) * 10)
      : kind === 'tar'
        ? Math.min(0.8, stats.special * (0.5 + mods.special * 0.5))
        : stats.special,
    duration: stats.duration,
    pierce:
      kind === 'ballista' || kind === 'gatling'
        ? (mods.special - 1) * turretRules.piercePerBonus
        : 0,
  };
}

export function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function inSector(
  turret: Pick<Turret, 'x' | 'y' | 'angle'>,
  spec: Pick<TurretSpec, 'range' | 'minRange' | 'halfArc'>,
  x: number,
  y: number,
): boolean {
  const dx = x - turret.x;
  const dy = y - turret.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > spec.range * spec.range || d2 < spec.minRange * spec.minRange) return false;
  if (spec.halfArc >= Math.PI) return true;
  return Math.abs(angleDelta(Math.atan2(dy, dx), turret.angle)) <= spec.halfArc;
}

export function pickTarget(world: World, turret: Turret, spec: TurretSpec): number {
  const h = world.horde;
  const map = world.map;
  const found = world.grid.queryCircle(turret.x, turret.y, spec.range, world.query);
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let n = 0; n < found; n += 1) {
    const i = world.query[n]!;
    if (h.hp[i]! <= 0) continue;
    const flying = h.flying[i] === 1;
    if (flying && !spec.stats.hitsAir) continue;
    const x = h.x[i]!;
    const y = h.y[i]!;
    if (!map.inside(x, y) || !inSector(turret, spec, x, y)) continue;
    const score = flying
      ? Math.hypot(h.tx[i]! - x, h.ty[i]! - y) / map.cell
      : world.flow.dist[map.cellAt(x, y)]!;
    if (score >= bestScore) continue;
    if (spec.stats.needsSight && !flying && !map.hasSight(turret.x, turret.y, x, y)) continue;
    bestScore = score;
    best = i;
  }
  return best;
}

const chainHits: number[] = [];

function fireTesla(world: World, turret: Turret, spec: TurretSpec, first: number): void {
  const h = world.horde;
  let damage = spec.damage;
  let px = turret.x;
  let py = turret.y - 18;
  let current = first;
  chainHits.length = 0;
  for (let n = 0; n < spec.special && current >= 0; n += 1) {
    const cx = h.x[current]!;
    const cy = h.y[current]! - 6;
    world.events.push(FxKind.Bolt, px, py, cx, cy);
    applyDamage(world, current, damage, 'shock');
    chainHits.push(current);
    damage *= turretRules.chainFalloff;
    px = cx;
    py = cy;
    const found = world.grid.queryCircle(cx, cy, turretRules.chainRange, world.query);
    let next = -1;
    let nearest = Number.POSITIVE_INFINITY;
    for (let k = 0; k < found; k += 1) {
      const i = world.query[k]!;
      if (h.hp[i]! <= 0 || chainHits.includes(i)) continue;
      const dx = h.x[i]! - cx;
      const dy = h.y[i]! - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearest) {
        nearest = d2;
        next = i;
      }
    }
    current = next;
  }
}

function fireBeam(world: World, turret: Turret, spec: TurretSpec, dt: number): void {
  const h = world.horde;
  const cos = Math.cos(turret.aim);
  const sin = Math.sin(turret.aim);
  const length = world.map.sightLimit(turret.x, turret.y, turret.aim, spec.range);
  turret.beamLength = length;
  const found = world.grid.queryCircle(turret.x, turret.y, length + 12, world.query);
  for (let n = 0; n < found; n += 1) {
    const i = world.query[n]!;
    const dx = h.x[i]! - turret.x;
    const dy = h.y[i]! - turret.y;
    const along = dx * cos + dy * sin;
    if (along < 0 || along > length) continue;
    const across = Math.abs(dy * cos - dx * sin);
    if (across > spec.splash + h.radius[i]!) continue;
    applyDamage(world, i, spec.damage * dt, 'beam', false);
    h.burnTimer[i] = 0.12;
  }
}

function fire(world: World, turret: Turret, spec: TurretSpec, target: number): boolean {
  const h = world.horde;
  const tx = h.x[target]!;
  const ty = h.y[target]!;
  const kind = turret.kind;
  if (kind === 'tesla') {
    fireTesla(world, turret, spec, target);
    return true;
  }
  const mx = turret.x + Math.cos(turret.aim) * 22;
  const my = turret.y + Math.sin(turret.aim) * 22;
  if (kind === 'gatling') {
    applyDamage(world, target, spec.damage, 'bolt', true, spec.pierce);
    world.events.push(FxKind.Tracer, mx, my, tx, ty - 6);
    return true;
  }
  if (kind === 'ballista') {
    const p = world.projectiles.spawn(ProjectileKind.Arrow, mx, my, tx, ty - 6);
    if (!p) return false;
    p.targetId = h.id[target]!;
    p.speed = spec.stats.projectileSpeed;
    p.damage = spec.damage;
    p.damageType = 'bolt';
    p.pierce = spec.pierce;
    return true;
  }
  const lob = kind === 'mortar' ? ProjectileKind.Shell : ProjectileKind.Flask;
  const lead = kind === 'mortar' ? 0.5 : 0.3;
  const lx = tx + h.vx[target]! * lead;
  const ly = ty + h.vy[target]! * lead;
  const p = world.projectiles.spawn(lob, mx, my, lx, ly);
  if (!p) return false;
  p.duration = Math.max(0.35, Math.hypot(lx - mx, ly - my) / spec.stats.projectileSpeed);
  p.damage = spec.damage;
  p.damageType = spec.stats.damageType;
  p.splash = spec.splash;
  p.slow = spec.special;
  p.zoneDuration = spec.duration;
  return true;
}

export function updateTurrets(world: World, dt: number): void {
  for (const turret of world.turrets) {
    const spec = world.specs[turret.kind];
    if (turret.recoil > 0) turret.recoil -= dt * 6;
    if (turret.kind === 'beam') {
      const target = pickTarget(world, turret, spec);
      if (target < 0) {
        turret.beamLength = 0;
        continue;
      }
      turret.aim = Math.atan2(world.horde.y[target]! - turret.y, world.horde.x[target]! - turret.x);
      fireBeam(world, turret, spec, dt);
      turret.spin += dt;
      if (turret.spin > 0.12) {
        turret.spin = 0;
        world.events.push(FxKind.Shot, turret.x, turret.y, world.kindOrder.indexOf(turret.kind));
      }
      continue;
    }
    if (turret.cooldown > 0) {
      turret.cooldown -= dt;
      continue;
    }
    const target = pickTarget(world, turret, spec);
    if (target < 0) continue;
    turret.aim = Math.atan2(world.horde.y[target]! - turret.y, world.horde.x[target]! - turret.x);
    if (!fire(world, turret, spec, target)) continue;
    turret.cooldown += spec.cooldown;
    turret.recoil = 1;
    world.events.push(FxKind.Shot, turret.x, turret.y, world.kindOrder.indexOf(turret.kind));
  }
}
