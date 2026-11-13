import { turretRules, type DamageType } from '../balance';
import { applyDamage, applySlow, damageArea } from './damage';
import { FxKind } from './events';
import type { World } from './world';

export const ProjectileKind = {
  Arrow: 0,
  Shell: 1,
  Flask: 2,
  Bomb: 3,
} as const;

export interface Projectile {
  kind: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  targetId: number;
  speed: number;
  t: number;
  duration: number;
  delay: number;
  damage: number;
  splash: number;
  damageType: DamageType;
  slow: number;
  zoneDuration: number;
  pierce: number;
}

export interface Zone {
  x: number;
  y: number;
  radius: number;
  ttl: number;
  life: number;
  dps: number;
  slow: number;
  tick: number;
  kind: 'tar' | 'pillar';
}

function blank(): Projectile {
  return {
    kind: 0,
    x: 0,
    y: 0,
    sx: 0,
    sy: 0,
    tx: 0,
    ty: 0,
    targetId: -1,
    speed: 0,
    t: 0,
    duration: 0,
    delay: 0,
    damage: 0,
    splash: 0,
    damageType: 'bolt',
    slow: 0,
    zoneDuration: 0,
    pierce: 0,
  };
}

export class Projectiles {
  count = 0;
  readonly items: Projectile[] = [];

  constructor(readonly capacity: number) {
    for (let i = 0; i < capacity; i += 1) this.items.push(blank());
  }

  spawn(kind: number, x: number, y: number, tx: number, ty: number): Projectile | null {
    if (this.count >= this.capacity) return null;
    const p = this.items[this.count]!;
    this.count += 1;
    Object.assign(p, blank());
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.sx = x;
    p.sy = y;
    p.tx = tx;
    p.ty = ty;
    return p;
  }

  remove(i: number): void {
    const last = this.count - 1;
    if (i < 0 || i > last) return;
    const a = this.items[i]!;
    this.items[i] = this.items[last]!;
    this.items[last] = a;
    this.count = last;
  }
}

const ARROW_HIT_RADIUS = 16;

function arrowHit(world: World, p: Projectile, index: number): void {
  let target = index;
  if (target < 0) {
    const found = world.grid.queryCircle(p.x, p.y, ARROW_HIT_RADIUS, world.query);
    for (let n = 0; n < found; n += 1) {
      const candidate = world.query[n]!;
      if (world.horde.hp[candidate]! > 0) {
        target = candidate;
        break;
      }
    }
  }
  if (target < 0) return;
  applyDamage(world, target, p.damage, p.damageType, true, p.pierce);
  world.events.push(FxKind.Hit, p.x, p.y);
}

function land(world: World, p: Projectile): void {
  if (p.kind === ProjectileKind.Flask) {
    world.zones.push({
      x: p.tx,
      y: p.ty,
      radius: p.splash,
      ttl: p.zoneDuration,
      life: p.zoneDuration,
      dps: p.damage,
      slow: p.slow,
      tick: 0,
      kind: 'tar',
    });
    world.events.push(FxKind.Blast, p.tx, p.ty, p.splash * 0.7, 1);
    return;
  }
  const bomb = p.kind === ProjectileKind.Bomb;
  damageArea(world, p.tx, p.ty, p.splash, p.damage, p.damageType, bomb);
  world.events.push(FxKind.Blast, p.tx, p.ty, p.splash, bomb ? 2 : 0);
}

export function updateProjectiles(world: World, dt: number): void {
  const list = world.projectiles;
  const h = world.horde;
  for (let i = list.count - 1; i >= 0; i -= 1) {
    const p = list.items[i]!;
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    if (p.kind === ProjectileKind.Arrow) {
      const target = h.indexOf(p.targetId);
      if (target >= 0) {
        p.tx = h.x[target]!;
        p.ty = h.y[target]! - 6;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= move + 4) {
        p.x = p.tx;
        p.y = p.ty;
        arrowHit(world, p, target);
        list.remove(i);
      } else {
        p.x += (dx / dist) * move;
        p.y += (dy / dist) * move;
      }
      continue;
    }
    p.t += dt / p.duration;
    if (p.t >= 1) {
      land(world, p);
      list.remove(i);
      continue;
    }
    p.x = p.sx + (p.tx - p.sx) * p.t;
    p.y = p.sy + (p.ty - p.sy) * p.t;
  }
}

export function updateZones(world: World, dt: number): void {
  const zones = world.zones;
  const h = world.horde;
  for (let z = zones.length - 1; z >= 0; z -= 1) {
    const zone = zones[z]!;
    zone.ttl -= dt;
    zone.tick += dt;
    if (zone.tick >= turretRules.zoneTickSec) {
      zone.tick -= turretRules.zoneTickSec;
      const pillar = zone.kind === 'pillar';
      const found = world.grid.queryCircle(zone.x, zone.y, zone.radius, world.query);
      for (let n = 0; n < found; n += 1) {
        const i = world.query[n]!;
        if (!pillar && h.flying[i]) continue;
        applyDamage(world, i, zone.dps * turretRules.zoneTickSec, pillar ? 'beam' : 'fire', pillar);
        if (!pillar) {
          h.burnTimer[i] = turretRules.slowLingerSec;
          applySlow(world, i, zone.slow, turretRules.slowLingerSec);
        }
      }
    }
    if (zone.ttl <= 0) {
      zones[z] = zones[zones.length - 1]!;
      zones.pop();
    }
  }
}
