import type Phaser from 'phaser';
import { ATLAS_KEY, Frame, goblinColors, hexToInt, palette, splatFrame } from '../art';
import { abilities, GOBLIN_KINDS, goblins } from '../balance';
import { simConfig } from '../config';
import { FX_STRIDE, FxKind, type FxEvents } from '../sim/events';
import type { Zone } from '../sim/projectiles';

const RING_RADIUS = 42;
const PUDDLE_RADIUS = 62;
const MAX_RINGS = 24;
const MAX_LINES = 60;
const MAX_DEATH_BURSTS_PER_FRAME = 24;
const GRAVITY = 260;

interface Ring {
  image: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  from: number;
  to: number;
  alpha: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  jagged: boolean;
}

export interface FxDepths {
  decals: number;
  ground: number;
  air: number;
}

export class FxRenderer {
  private readonly limit = simConfig.particleLimit;
  private readonly px = new Float32Array(this.limit);
  private readonly py = new Float32Array(this.limit);
  private readonly pvx = new Float32Array(this.limit);
  private readonly pvy = new Float32Array(this.limit);
  private readonly plife = new Float32Array(this.limit);
  private readonly pmax = new Float32Array(this.limit);
  private readonly pgrav = new Float32Array(this.limit);
  private readonly ptint = new Int32Array(this.limit);
  private particles = 0;
  private shownParticles = 0;
  private readonly particleBlitter: Phaser.GameObjects.Blitter;
  private readonly particleBobs: Phaser.GameObjects.Bob[] = [];
  private readonly sparkFrame: Phaser.Textures.Frame;
  private readonly decals: Phaser.GameObjects.RenderTexture;
  private readonly rings: Ring[] = [];
  private readonly lines: Line[] = [];
  private readonly lineGraphics: Phaser.GameObjects.Graphics;
  private readonly puddles: Phaser.GameObjects.Image[] = [];
  private readonly skinTints: number[];
  private readonly splatScale: number[];
  private readonly groundDepth: number;
  private flash: Phaser.GameObjects.Rectangle;
  private flashLife = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    depths: FxDepths,
  ) {
    this.groundDepth = depths.ground;
    this.sparkFrame = scene.textures.get(ATLAS_KEY).get(Frame.Spark);
    this.skinTints = GOBLIN_KINDS.map((kind) => hexToInt(goblinColors[kind].skinDark));
    this.splatScale = GOBLIN_KINDS.map((kind) => goblins[kind].radius / 7);
    this.decals = scene.add.renderTexture(0, 0, width, height).setOrigin(0).setDepth(depths.decals);
    this.particleBlitter = scene.add.blitter(0, 0, ATLAS_KEY).setDepth(depths.air);
    this.lineGraphics = scene.add.graphics().setDepth(depths.air);
    for (let i = 0; i < MAX_RINGS; i += 1) {
      this.rings.push({
        image: scene.add.image(0, 0, ATLAS_KEY, Frame.Ring).setDepth(depths.air).setVisible(false),
        life: 0,
        maxLife: 1,
        from: 0,
        to: 1,
        alpha: 1,
      });
    }
    this.flash = scene.add
      .rectangle(0, 0, width, height, 0xffffff, 1)
      .setOrigin(0)
      .setDepth(depths.air + 1)
      .setVisible(false);
  }

  get particleCount(): number {
    return this.particles;
  }

  consume(events: FxEvents): void {
    const d = events.data;
    let bursts = 0;
    let stamped = 0;
    for (let e = 0; e < events.count; e += 1) {
      const o = e * FX_STRIDE;
      const kind = d[o]!;
      const x = d[o + 1]!;
      const y = d[o + 2]!;
      const a = d[o + 3]!;
      const b = d[o + 4]!;
      if (kind === FxKind.Death) {
        if (stamped < simConfig.decalsPerFrame) {
          stamped += 1;
          this.decals.stamp(ATLAS_KEY, splatFrame((x + y) | 0), x, y, {
            tint: this.skinTints[a] ?? 0x6f9628,
            alpha: 0.75,
            angle: ((x * 7 + y * 13) | 0) % 360,
            scale: (this.splatScale[a] ?? 1) * 1.1,
          });
        }
        if (bursts < MAX_DEATH_BURSTS_PER_FRAME) {
          bursts += 1;
          this.burst(x, y - 6, 3, 70, this.skinTints[a] ?? 0xffffff, 0.4, GRAVITY);
        }
      } else if (kind === FxKind.Hit) {
        this.burst(x, y, 2, 60, 0xfff3c4, 0.22, 0);
      } else if (kind === FxKind.Blast) {
        if (b === 1) {
          this.ring(x, y, a * 0.4, a, 0.3, hexToInt(palette.fire), 0.8);
          this.burst(x, y, 6, 90, hexToInt(palette.fire), 0.4, 0);
        } else if (b === 2) {
          this.ring(x, y, a * 0.3, a * 1.15, 0.42, 0xfff0b0, 1);
          this.ring(x, y, a * 0.2, a * 0.8, 0.3, hexToInt(palette.fire), 0.9);
          this.burst(x, y, 10, 190, hexToInt(palette.fireHot), 0.55, GRAVITY);
          this.burst(x, y, 5, 80, 0x4a4a4a, 0.8, -40);
        } else {
          this.ring(x, y, a * 0.3, a, 0.28, 0xffd9a0, 0.95);
          this.burst(x, y, 6, 140, hexToInt(palette.fire), 0.4, GRAVITY);
        }
      } else if (kind === FxKind.Bolt || kind === FxKind.Tracer) {
        if (this.lines.length < MAX_LINES) {
          const jagged = kind === FxKind.Bolt;
          this.lines.push({ x1: x, y1: y, x2: a, y2: b, life: jagged ? 0.14 : 0.05, jagged });
        }
        if (kind === FxKind.Bolt) this.burst(a, b, 2, 70, hexToInt(palette.bolt), 0.2, 0);
      } else if (kind === FxKind.Leak) {
        this.ring(x, y, 6, 26, 0.3, hexToInt(palette.danger), 0.9);
      } else if (kind === FxKind.Heal) {
        this.ring(x, y, a * 0.2, a, 0.45, hexToInt(palette.ok), 0.55);
      } else if (kind === FxKind.Strike) {
        if (this.lines.length < MAX_LINES) {
          this.lines.push({ x1: x, y1: y, x2: a, y2: b, life: 0.6, jagged: false });
        }
      } else if (kind === FxKind.BossDeath) {
        this.ring(x, y, 20, 150, 0.6, hexToInt(palette.gold), 1);
        this.burst(x, y - 20, 30, 240, hexToInt(palette.gold), 0.8, GRAVITY);
      } else if (kind === FxKind.BigBang) {
        this.flashLife = 0.5;
        this.ring(x, y, 40, 900, 0.7, 0xfff0b0, 1);
        this.ring(x, y, 20, 600, 0.9, hexToInt(palette.fire), 0.9);
      }
    }
    if (stamped > 0) this.decals.render();
  }

  burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    tint: number,
    life: number,
    gravity: number,
  ): void {
    for (let n = 0; n < count; n += 1) {
      if (this.particles >= this.limit) return;
      const i = this.particles;
      this.particles += 1;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.4 + Math.random() * 0.6);
      this.px[i] = x;
      this.py[i] = y;
      this.pvx[i] = Math.cos(angle) * velocity;
      this.pvy[i] = Math.sin(angle) * velocity - (gravity > 0 ? speed * 0.5 : 0);
      this.plife[i] = life * (0.7 + Math.random() * 0.3);
      this.pmax[i] = this.plife[i]!;
      this.pgrav[i] = gravity;
      this.ptint[i] = tint;
    }
  }

  ring(
    x: number,
    y: number,
    from: number,
    to: number,
    life: number,
    tint: number,
    alpha: number,
  ): void {
    const slot = this.rings.find((candidate) => candidate.life <= 0);
    if (!slot) return;
    slot.life = life;
    slot.maxLife = life;
    slot.from = from / RING_RADIUS;
    slot.to = to / RING_RADIUS;
    slot.alpha = alpha;
    slot.image.setPosition(x, y).setTint(tint).setVisible(true);
  }

  update(dt: number, zones: readonly Zone[], time: number): void {
    this.updateParticles(dt);
    this.updateRings(dt);
    this.updateLines(dt);
    this.syncZones(zones, time);
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.setVisible(this.flashLife > 0).setAlpha(Math.max(0, this.flashLife / 0.5) * 0.85);
    }
  }

  destroy(): void {
    this.particleBlitter.destroy();
    this.decals.destroy();
    this.lineGraphics.destroy();
    this.flash.destroy();
    for (const ring of this.rings) ring.image.destroy();
    for (const puddle of this.puddles) puddle.destroy();
  }

  private updateParticles(dt: number): void {
    let i = 0;
    while (i < this.particles) {
      this.plife[i]! -= dt;
      if (this.plife[i]! <= 0) {
        const last = this.particles - 1;
        this.px[i] = this.px[last]!;
        this.py[i] = this.py[last]!;
        this.pvx[i] = this.pvx[last]!;
        this.pvy[i] = this.pvy[last]!;
        this.plife[i] = this.plife[last]!;
        this.pmax[i] = this.pmax[last]!;
        this.pgrav[i] = this.pgrav[last]!;
        this.ptint[i] = this.ptint[last]!;
        this.particles = last;
        continue;
      }
      this.pvy[i]! += this.pgrav[i]! * dt;
      this.px[i]! += this.pvx[i]! * dt;
      this.py[i]! += this.pvy[i]! * dt;
      i += 1;
    }
    const bobs = this.particleBobs;
    while (bobs.length < this.particles) {
      bobs.push(this.particleBlitter.create(0, 0, this.sparkFrame, false));
    }
    for (let p = 0; p < this.particles; p += 1) {
      const bob = bobs[p]!;
      bob.x = this.px[p]! - 4;
      bob.y = this.py[p]! - 4;
      bob.alpha = this.plife[p]! / this.pmax[p]!;
      bob.tint = this.ptint[p]!;
      if (p >= this.shownParticles) bob.visible = true;
    }
    for (let p = this.particles; p < this.shownParticles; p += 1) bobs[p]!.visible = false;
    this.shownParticles = this.particles;
  }

  private updateRings(dt: number): void {
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.image.setVisible(false);
        continue;
      }
      const t = 1 - ring.life / ring.maxLife;
      ring.image.setScale(ring.from + (ring.to - ring.from) * t);
      ring.image.setAlpha(ring.alpha * (1 - t * t));
    }
  }

  private updateLines(dt: number): void {
    const g = this.lineGraphics;
    g.clear();
    for (let i = this.lines.length - 1; i >= 0; i -= 1) {
      const item = this.lines[i]!;
      item.life -= dt;
      if (item.life <= 0) {
        this.lines[i] = this.lines[this.lines.length - 1]!;
        this.lines.pop();
        continue;
      }
      if (!item.jagged) {
        const strike = item.life > 0.06;
        g.lineStyle(
          strike ? 8 : 2,
          strike ? hexToInt(palette.danger) : 0xfff1a8,
          strike ? 0.35 : 0.9,
        );
        g.lineBetween(item.x1, item.y1, item.x2, item.y2);
        continue;
      }
      const alpha = Math.min(1, item.life / 0.1);
      const dx = item.x2 - item.x1;
      const dy = item.y2 - item.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (const [width, color] of [
        [6, hexToInt(palette.bolt)],
        [2, 0xffffff],
      ] as const) {
        g.lineStyle(width, color, alpha * (width > 3 ? 0.55 : 1));
        g.beginPath();
        g.moveTo(item.x1, item.y1);
        for (let s = 1; s < 4; s += 1) {
          const jitter = (Math.random() - 0.5) * Math.min(22, len * 0.25);
          g.lineTo(item.x1 + (dx * s) / 4 + nx * jitter, item.y1 + (dy * s) / 4 + ny * jitter);
        }
        g.lineTo(item.x2, item.y2);
        g.strokePath();
      }
    }
  }

  private syncZones(zones: readonly Zone[], time: number): void {
    while (this.puddles.length < zones.length) {
      this.puddles.push(
        this.scene.add.image(0, 0, ATLAS_KEY, Frame.Puddle).setDepth(this.groundDepth),
      );
    }
    for (let i = 0; i < this.puddles.length; i += 1) {
      const puddle = this.puddles[i]!;
      const zone = zones[i];
      if (!zone) {
        puddle.setVisible(false);
        continue;
      }
      const fade = Math.min(1, zone.ttl / 0.4);
      if (zone.kind === 'pillar') {
        const pulse = 1 + Math.sin(time * 18) * 0.06;
        puddle
          .setFrame(Frame.Smoke)
          .setTint(0xfff3b0)
          .setScale((abilities.pillar.radius / 16) * pulse)
          .setAlpha(0.85 * fade);
      } else {
        puddle
          .setFrame(Frame.Puddle)
          .clearTint()
          .setScale(zone.radius / PUDDLE_RADIUS)
          .setAlpha(fade);
      }
      puddle.setVisible(true).setPosition(zone.x, zone.y);
    }
  }
}
