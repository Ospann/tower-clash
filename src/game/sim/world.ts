import {
  abilities,
  crowd,
  economy,
  GOBLIN_KINDS,
  goblins,
  goblinTraits,
  rocket,
  spawnRules,
  TURRET_KINDS,
  turretRules,
  type GoblinKind,
  type GoblinStats,
  type TurretKind,
} from '../balance';
import { simConfig } from '../config';
import type { LevelData, Rect } from '../levels/level-types';
import { rectContains } from './grid-map';
import { FxEvents, FxKind } from './events';
import { FlowField } from './flow-field';
import { GridMap } from './grid-map';
import { Horde } from './horde';
import { neutralLoadout, turretCap, type AbilityKind, type Loadout } from './loadout';
import {
  ProjectileKind,
  Projectiles,
  updateProjectiles,
  updateZones,
  type Zone,
} from './projectiles';
import { createRng, type Rng } from './rng';
import { SpatialGrid } from './spatial-grid';
import { turretSpec, updateTurrets, type Turret, type TurretSpec } from './turrets';
import { WaveRunner } from './waves';

export type WorldPhase = 'prep' | 'battle' | 'won' | 'lost';
export type PlacementIssue = 'ok' | 'limit' | 'locked' | 'blocked';

export interface WorldOptions {
  level: LevelData;
  loadout?: Loadout;
  seed?: number;
  invulnerable?: boolean;
  manualSpawns?: boolean;
}

export const kindIndex: Readonly<Record<GoblinKind, number>> = {
  grunt: GOBLIN_KINDS.indexOf('grunt'),
  runner: GOBLIN_KINDS.indexOf('runner'),
  shield: GOBLIN_KINDS.indexOf('shield'),
  brute: GOBLIN_KINDS.indexOf('brute'),
  shaman: GOBLIN_KINDS.indexOf('shaman'),
  glider: GOBLIN_KINDS.indexOf('glider'),
  boss: GOBLIN_KINDS.indexOf('boss'),
};

const statsByIndex: readonly GoblinStats[] = GOBLIN_KINDS.map((kind) => goblins[kind]);

export function statsAt(index: number): GoblinStats {
  return statsByIndex[index] ?? goblins.grunt;
}

export const SILENT = Number.NEGATIVE_INFINITY;

export function entryOutward(
  entry: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const left = entry.x;
  const right = width - entry.x;
  const top = entry.y;
  const bottom = height - entry.y;
  const nearest = Math.min(left, right, top, bottom);
  if (nearest === top) return { x: 0, y: -1 };
  if (nearest === bottom) return { x: 0, y: 1 };
  if (nearest === left) return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function nearestOnRect(rect: Rect, x: number, y: number): { x: number; y: number; d: number } {
  const px = Math.min(Math.max(x, rect.x + 4), rect.x + rect.w - 4);
  const py = Math.min(Math.max(y, rect.y + 4), rect.y + rect.h - 4);
  return { x: px, y: py, d: Math.hypot(px - x, py - y) };
}

export class World {
  readonly level: LevelData;
  readonly loadout: Loadout;
  readonly map: GridMap;
  readonly flow: FlowField;
  readonly horde: Horde;
  readonly grid: SpatialGrid;
  readonly events = new FxEvents();
  readonly projectiles = new Projectiles(simConfig.projectileCapacity);
  readonly zones: Zone[] = [];
  readonly turrets: Turret[] = [];
  readonly specs: Record<TurretKind, TurretSpec>;
  readonly kindOrder: readonly TurretKind[] = TURRET_KINDS;
  readonly rng: Rng;
  readonly query = new Int32Array(4096);
  readonly invulnerable: boolean;
  readonly turretLimit: number;
  readonly runner: WaveRunner;
  readonly abilityCooldown: Record<AbilityKind, number> = { airstrike: 0, pillar: 0, bigBang: 0 };
  private readonly manualSpawns: boolean;
  private nextTurretId = 1;
  time = 0;
  phase: WorldPhase = 'prep';
  baseHp: number;
  baseMaxHp: number;
  bigBangCharges: number = abilities.bigBang.charges;
  rocketCooldown = 0;
  rocketsFired = 0;
  kills = 0;
  bounty = 0;
  leaked = 0;
  revived = false;

  constructor(options: WorldOptions) {
    const { level } = options;
    this.level = level;
    this.loadout = options.loadout ?? neutralLoadout();
    this.rng = createRng(options.seed ?? 1);
    this.invulnerable = options.invulnerable ?? false;
    this.manualSpawns = options.manualSpawns ?? false;
    this.map = new GridMap(level);
    this.flow = new FlowField(this.map);
    this.horde = new Horde(simConfig.hordeCapacity);
    this.grid = new SpatialGrid(
      this.map.width,
      this.map.height,
      simConfig.hashCellSize,
      simConfig.hordeCapacity,
    );
    this.runner = new WaveRunner(level);
    this.baseMaxHp = Math.round(level.baseHp * this.loadout.baseHp);
    this.baseHp = this.baseMaxHp;
    this.turretLimit = Math.min(
      level.turretLimit,
      TURRET_KINDS.reduce((sum, kind) => sum + turretCap(this.loadout, kind), 0),
    );
    this.specs = {
      ballista: turretSpec('ballista', this.loadout.turrets.ballista),
      mortar: turretSpec('mortar', this.loadout.turrets.mortar),
      gatling: turretSpec('gatling', this.loadout.turrets.gatling),
      tar: turretSpec('tar', this.loadout.turrets.tar),
      tesla: turretSpec('tesla', this.loadout.turrets.tesla),
      beam: turretSpec('beam', this.loadout.turrets.beam),
    };
  }

  get timeLeft(): number {
    return this.level.win.type === 'timer' ? Math.max(0, this.level.win.seconds - this.time) : 0;
  }

  get pending(): number {
    return this.runner.remaining;
  }

  get goblinsLeft(): number {
    return this.runner.upcoming + this.horde.count;
  }

  spawnGoblin(kind: GoblinKind, x: number, y: number): number {
    const stats = goblins[kind];
    const jitter = 1 + (this.rng() * 2 - 1) * goblinTraits.speedJitter;
    const h = this.horde;
    const i = h.spawn(
      kindIndex[kind],
      x,
      y,
      stats.hp * this.level.difficulty.hp,
      stats.speed * this.level.difficulty.speed * jitter,
      stats.radius,
    );
    if (i < 0) return -1;
    h.phase[i] = this.rng() * 10;
    h.aux[i] = goblinTraits.shaman.interval * this.rng();
    if (stats.flying) {
      h.flying[i] = 1;
      let best = Number.POSITIVE_INFINITY;
      for (const zone of this.level.zones) {
        const point = nearestOnRect(zone, x, y);
        if (point.d < best) {
          best = point.d;
          h.tx[i] = point.x;
          h.ty[i] = point.y;
        }
      }
    }
    return i;
  }

  spawnAtEntry(kind: GoblinKind, entryId: string): number {
    const entry = this.level.entries.find((item) => item.id === entryId) ?? this.level.entries[0];
    if (!entry) return -1;
    const out = entryOutward(entry, this.map.width, this.map.height);
    const depth = spawnRules.minDepth + this.rng() * spawnRules.depthSpread;
    const side = (this.rng() * 2 - 1) * entry.radius;
    const x = entry.x + out.x * depth - out.y * side;
    const y = entry.y + out.y * depth + out.x * side;
    const i = this.spawnGoblin(kind, x, y);
    if (i >= 0 && !this.horde.flying[i]) {
      this.horde.tx[i] = entry.x - out.x * spawnRules.inset - out.y * side;
      this.horde.ty[i] = entry.y - out.y * spawnRules.inset + out.x * side;
    }
    return i;
  }

  turretCount(kind: TurretKind): number {
    let count = 0;
    for (const turret of this.turrets) if (turret.kind === kind) count += 1;
    return count;
  }

  placementIssue(kind: TurretKind, x: number, y: number, ignoreId = -1): PlacementIssue {
    if (!this.loadout.turrets[kind].unlocked) return 'locked';
    if (ignoreId < 0) {
      if (this.turrets.length >= this.turretLimit) return 'limit';
      if (this.turretCount(kind) >= turretCap(this.loadout, kind)) return 'limit';
    }
    const r = turretRules.baseRadius;
    if (x < r || x > this.map.width - r) return 'blocked';
    if (y < r || y > this.map.height - r) return 'blocked';
    if (!this.map.circleBuildable(x, y, r)) return 'blocked';
    for (const zone of this.level.zones) {
      if (
        rectContains({ x: zone.x - r, y: zone.y - r, w: zone.w + r * 2, h: zone.h + r * 2 }, x, y)
      ) {
        return 'blocked';
      }
    }
    for (const turret of this.turrets) {
      if (turret.id === ignoreId) continue;
      if (Math.hypot(turret.x - x, turret.y - y) < turretRules.spacing) return 'blocked';
    }
    return 'ok';
  }

  defaultAngle(x: number, y: number): number {
    let best = -Math.PI / 2;
    let nearest = Number.POSITIVE_INFINITY;
    for (const entry of this.level.entries) {
      const d = Math.hypot(entry.x - x, entry.y - y);
      if (d < nearest) {
        nearest = d;
        best = Math.atan2(entry.y - y, entry.x - x);
      }
    }
    return best;
  }

  addTurret(kind: TurretKind, x: number, y: number, angle?: number): Turret | null {
    if (this.phase !== 'prep' || this.placementIssue(kind, x, y) !== 'ok') return null;
    const facing = angle ?? this.defaultAngle(x, y);
    const turret: Turret = {
      id: this.nextTurretId,
      kind,
      x,
      y,
      angle: facing,
      aim: facing,
      cooldown: 0,
      recoil: 0,
      beamLength: 0,
      spin: 0,
    };
    this.nextTurretId += 1;
    this.turrets.push(turret);
    return turret;
  }

  turretById(id: number): Turret | undefined {
    return this.turrets.find((turret) => turret.id === id);
  }

  turretAt(x: number, y: number, reach: number = turretRules.baseRadius + 10): Turret | undefined {
    let best: Turret | undefined;
    let nearest = reach;
    for (const turret of this.turrets) {
      const d = Math.hypot(turret.x - x, turret.y - y);
      if (d < nearest) {
        nearest = d;
        best = turret;
      }
    }
    return best;
  }

  moveTurret(id: number, x: number, y: number): boolean {
    const turret = this.turretById(id);
    if (!turret || this.phase !== 'prep') return false;
    if (this.placementIssue(turret.kind, x, y, id) !== 'ok') return false;
    turret.x = x;
    turret.y = y;
    return true;
  }

  rotateTurret(id: number, angle: number): boolean {
    const turret = this.turretById(id);
    if (!turret || this.phase !== 'prep') return false;
    turret.angle = angle;
    turret.aim = angle;
    return true;
  }

  removeTurret(id: number): boolean {
    const index = this.turrets.findIndex((turret) => turret.id === id);
    if (index < 0 || this.phase !== 'prep') return false;
    this.turrets.splice(index, 1);
    return true;
  }

  clearTurrets(): void {
    if (this.phase === 'prep') this.turrets.length = 0;
  }

  startBattle(): boolean {
    if (this.phase !== 'prep') return false;
    this.phase = 'battle';
    return true;
  }

  step(dt: number): void {
    if (this.phase !== 'battle') return;
    this.time += dt;
    if (this.rocketCooldown > 0) this.rocketCooldown = Math.max(0, this.rocketCooldown - dt);
    for (const kind of ['airstrike', 'pillar'] as const) {
      if (this.abilityCooldown[kind] > 0) {
        this.abilityCooldown[kind] = Math.max(0, this.abilityCooldown[kind] - dt);
      }
    }
    if (!this.manualSpawns) this.runner.update(this, dt);
    this.moveHorde(dt);
    this.grid.rebuild(this.horde.x, this.horde.y, this.horde.count);
    this.healAround(dt);
    updateTurrets(this, dt);
    updateProjectiles(this, dt);
    updateZones(this, dt);
    this.reap();
    if (this.manualSpawns || this.phase !== 'battle') return;
    if (this.level.win.type === 'timer') {
      if (this.time >= this.level.win.seconds) this.phase = 'won';
    } else if (this.runner.allSpawned && this.horde.count === 0) {
      this.phase = 'won';
    }
  }

  get rocketReady(): boolean {
    return this.phase === 'battle' && this.rocketCooldown <= 0;
  }

  rocketOrigin(x: number, y: number): { x: number; y: number } {
    let best = { x: this.map.width / 2, y: this.map.height };
    let nearest = Number.POSITIVE_INFINITY;
    for (const zone of this.level.zones) {
      const cx = zone.x + zone.w / 2;
      const cy = zone.y + zone.h / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < nearest) {
        nearest = d;
        best = { x: cx, y: cy };
      }
    }
    return best;
  }

  fireRocket(x: number, y: number): boolean {
    if (!this.rocketReady || !this.map.inside(x, y)) return false;
    const mods = this.loadout.rocket;
    const origin = this.rocketOrigin(x, y);
    const p = this.projectiles.spawn(ProjectileKind.Rocket, origin.x, origin.y, x, y);
    if (!p) return false;
    p.duration = Math.max(rocket.minFlight, Math.hypot(x - origin.x, y - origin.y) / rocket.speed);
    p.damage = rocket.damage * mods.damage;
    p.splash = rocket.radius * mods.radius;
    p.damageType = 'blast';
    this.rocketCooldown = rocket.cooldown / mods.rate;
    this.rocketsFired += 1;
    return true;
  }

  abilityReady(kind: AbilityKind): boolean {
    if (this.phase !== 'battle' || !this.loadout.abilities[kind].unlocked) return false;
    if (kind === 'bigBang') return this.bigBangCharges > 0;
    return this.abilityCooldown[kind] <= 0;
  }

  useAirstrike(x1: number, y1: number, x2: number, y2: number): boolean {
    if (!this.abilityReady('airstrike')) return false;
    const spec = abilities.airstrike;
    const mods = this.loadout.abilities.airstrike;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 40) {
      y1 += spec.maxLength * 0.25;
      x2 = x1;
      y2 = y1 - spec.maxLength * 0.5;
    } else if (length > spec.maxLength) {
      x2 = x1 + (dx / length) * spec.maxLength;
      y2 = y1 + (dy / length) * spec.maxLength;
    }
    this.abilityCooldown.airstrike = spec.cooldown * mods.cooldown;
    this.events.push(FxKind.Strike, x1, y1, x2, y2);
    for (let n = 0; n < spec.blasts; n += 1) {
      const t = n / Math.max(1, spec.blasts - 1);
      const tx = x1 + (x2 - x1) * t + (this.rng() - 0.5) * 16;
      const ty = y1 + (y2 - y1) * t + (this.rng() - 0.5) * 16;
      const p = this.projectiles.spawn(ProjectileKind.Bomb, tx + 50, ty - 480, tx, ty);
      if (!p) break;
      p.delay = 0.25 + n * spec.interval;
      p.duration = 0.4;
      p.damage = spec.damage * mods.power;
      p.splash = spec.radius;
      p.damageType = 'blast';
    }
    return true;
  }

  usePillar(x: number, y: number): boolean {
    if (!this.abilityReady('pillar')) return false;
    const spec = abilities.pillar;
    const mods = this.loadout.abilities.pillar;
    this.abilityCooldown.pillar = spec.cooldown * mods.cooldown;
    this.zones.push({
      x,
      y,
      radius: spec.radius,
      ttl: spec.duration,
      life: spec.duration,
      dps: spec.dps * mods.power,
      slow: 0,
      tick: 0,
      kind: 'pillar',
    });
    this.events.push(FxKind.Blast, x, y, spec.radius, 0);
    return true;
  }

  useBigBang(): boolean {
    if (!this.abilityReady('bigBang')) return false;
    this.bigBangCharges -= 1;
    const spec = abilities.bigBang;
    const power = this.loadout.abilities.bigBang.power;
    const h = this.horde;
    for (let i = 0; i < h.count; i += 1) {
      if (h.hp[i]! <= 0 || !this.map.inside(h.x[i]!, h.y[i]!)) continue;
      const cap = h.kind[i] === kindIndex.boss ? h.maxHp[i]! * spec.bossShare : spec.damage;
      h.hp[i]! -= Math.min(spec.damage, cap) * power;
      h.flash[i] = 1;
    }
    this.events.push(FxKind.BigBang, this.map.width / 2, this.map.height / 2);
    return true;
  }

  grantBigBang(): void {
    this.bigBangCharges += 1;
  }

  revive(): boolean {
    if (this.phase !== 'lost' || this.revived) return false;
    this.revived = true;
    this.baseHp = Math.ceil(this.baseMaxHp * economy.reviveHpFraction);
    const h = this.horde;
    for (let i = 0; i < h.count; i += 1) {
      if (!this.map.inside(h.x[i]!, h.y[i]!)) continue;
      const near = h.flying[i]
        ? Math.hypot(h.tx[i]! - h.x[i]!, h.ty[i]! - h.y[i]!) / this.map.cell
        : this.flow.dist[this.map.cellAt(h.x[i]!, h.y[i]!)]!;
      if (near < economy.reviveClearCells) h.hp[i] = 0;
    }
    this.phase = 'battle';
    return true;
  }

  damageBase(amount: number, x: number, y: number): void {
    this.leaked += 1;
    this.events.push(FxKind.Leak, x, y, amount);
    if (this.invulnerable || amount <= 0) return;
    this.baseHp = Math.max(0, this.baseHp - amount);
    if (this.baseHp <= 0) this.phase = 'lost';
  }

  private moveHorde(dt: number): void {
    const h = this.horde;
    const map = this.map;
    const flow = this.flow;
    const grid = this.grid;
    const start = grid.cellStart;
    const sorted = grid.sorted;
    const cols = grid.cols;
    const rows = grid.rows;
    const inv = 1 / grid.cellSize;
    const count = h.count;

    for (let i = 0; i < count; i += 1) {
      if (h.flash[i]! > 0) h.flash[i]! -= dt * 6;
      if (h.burnTimer[i]! > 0) h.burnTimer[i]! -= dt;
      let speed = h.speed[i]!;
      if (h.slowTimer[i]! > 0) {
        h.slowTimer[i]! -= dt;
        speed *= h.slowFactor[i]!;
      }
      const x = h.x[i]!;
      const y = h.y[i]!;

      if (h.flying[i]) {
        const dx = h.tx[i]! - x;
        const dy = h.ty[i]! - y;
        const d = Math.hypot(dx, dy);
        if (d <= speed * dt + 2) {
          this.leak(i);
          continue;
        }
        h.vx[i] = (dx / d) * speed;
        h.vy[i] = (dy / d) * speed;
        h.x[i] = x + h.vx[i]! * dt;
        h.y[i] = y + h.vy[i]! * dt;
        continue;
      }

      if (!map.inside(x, y)) {
        const dx = h.tx[i]! - x;
        const dy = h.ty[i]! - y;
        const d = Math.hypot(dx, dy) || 1;
        h.vx[i] = (dx / d) * speed;
        h.vy[i] = (dy / d) * speed;
        h.x[i] = x + h.vx[i]! * dt;
        h.y[i] = y + h.vy[i]! * dt;
        continue;
      }
      const c = map.cellAt(x, y);
      if (map.zone[c]) {
        this.leak(i);
        continue;
      }
      const fx = flow.dirX[c]!;
      const fy = flow.dirY[c]!;
      if (map.blockMove[c]) {
        h.x[i] = x + fx * speed * dt;
        h.y[i] = y + fy * speed * dt;
        h.vx[i] = fx * speed;
        h.vy[i] = fy * speed;
        continue;
      }
      const drift = Math.sin(this.time * 0.9 + h.phase[i]! * 3) * crowd.wander;
      let wantX = (fx - fy * drift) * speed;
      let wantY = (fy + fx * drift) * speed;

      const radius = h.radius[i]!;
      let pushX = 0;
      let pushY = 0;
      let seen = 0;
      const gx = (x * inv) | 0;
      const gy = (y * inv) | 0;
      const y0 = gy > 0 ? gy - 1 : 0;
      const y1 = gy < rows - 1 ? gy + 1 : rows - 1;
      const x0 = gx > 0 ? gx - 1 : 0;
      const x1 = gx < cols - 1 ? gx + 1 : cols - 1;
      scan: for (let cy = y0; cy <= y1; cy += 1) {
        for (let cx = x0; cx <= x1; cx += 1) {
          const cell = cy * cols + cx;
          const end = start[cell + 1]!;
          for (let k = start[cell]!; k < end; k += 1) {
            const j = sorted[k]!;
            if (j === i || j >= count || h.flying[j]) continue;
            const dx = x - h.x[j]!;
            const dy = y - h.y[j]!;
            const min = (radius + h.radius[j]!) * crowd.spacing;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            if (d2 > 0.0001) {
              const d = Math.sqrt(d2);
              const force = (min - d) / min / d;
              pushX += dx * force;
              pushY += dy * force;
            } else {
              pushX += ((i * 7919) % 13) - 6;
              pushY += ((i * 104729) % 11) - 5;
            }
            seen += 1;
            if (seen >= crowd.maxNeighbours) break scan;
          }
        }
      }
      if (seen > 0) {
        const base = h.speed[i]! * crowd.push;
        wantX += pushX * base;
        wantY += pushY * base;
      }

      const vx = h.vx[i]! + (wantX - h.vx[i]!) * crowd.steer;
      const vy = h.vy[i]! + (wantY - h.vy[i]!) * crowd.steer;
      const nx = Math.fround(x + vx * dt);
      const ny = Math.fround(y + vy * dt);
      if (!map.blocked(nx, ny)) {
        h.x[i] = nx;
        h.y[i] = ny;
        h.vx[i] = vx;
        h.vy[i] = vy;
      } else if (!map.blocked(nx, y)) {
        h.x[i] = nx;
        h.vx[i] = vx;
        h.vy[i] = 0;
      } else if (!map.blocked(x, ny)) {
        h.y[i] = ny;
        h.vx[i] = 0;
        h.vy[i] = vy;
      } else {
        h.vx[i] = 0;
        h.vy[i] = 0;
      }
    }
  }

  private leak(i: number): void {
    const h = this.horde;
    if (h.hp[i]! <= 0) return;
    h.hp[i] = SILENT;
    this.damageBase(statsAt(h.kind[i]!).leak, h.x[i]!, h.y[i]!);
  }

  private healAround(dt: number): void {
    const h = this.horde;
    const trait = goblinTraits.shaman;
    for (let i = 0; i < h.count; i += 1) {
      if (h.kind[i] !== kindIndex.shaman || h.hp[i]! <= 0) continue;
      h.aux[i]! -= dt;
      if (h.aux[i]! > 0) continue;
      h.aux[i] = trait.interval;
      const found = this.grid.queryCircle(h.x[i]!, h.y[i]!, trait.radius, this.query);
      let healed = 0;
      for (let n = 0; n < found; n += 1) {
        const j = this.query[n]!;
        if (j === i || h.hp[j]! <= 0 || h.hp[j]! >= h.maxHp[j]!) continue;
        h.hp[j] = Math.min(h.maxHp[j]!, h.hp[j]! + trait.heal);
        healed += 1;
      }
      if (healed > 0) this.events.push(FxKind.Heal, h.x[i]!, h.y[i]!, trait.radius);
    }
  }

  private reap(): void {
    const h = this.horde;
    for (let i = h.count - 1; i >= 0; i -= 1) {
      if (h.hp[i]! > 0) continue;
      const kind = GOBLIN_KINDS[h.kind[i]!] ?? 'grunt';
      const x = h.x[i]!;
      const y = h.y[i]!;
      const silent = h.hp[i] === SILENT;
      h.remove(i);
      if (silent) continue;
      this.kills += 1;
      this.bounty += goblins[kind].bounty;
      this.events.push(FxKind.Death, x, y, kindIndex[kind]);
      if (kind === 'boss') this.splitBoss(x, y);
    }
  }

  private splitBoss(x: number, y: number): void {
    const trait = goblinTraits.boss;
    this.events.push(FxKind.BossDeath, x, y);
    for (let n = 0; n < trait.splitCount; n += 1) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const angle = this.rng() * Math.PI * 2;
        const reach = Math.sqrt(this.rng()) * trait.splitRadius;
        const sx = x + Math.cos(angle) * reach;
        const sy = y + Math.sin(angle) * reach;
        if (this.map.blocked(sx, sy)) continue;
        this.spawnGoblin(trait.splitKind, sx, sy);
        break;
      }
    }
  }
}
