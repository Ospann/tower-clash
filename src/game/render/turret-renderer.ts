import type Phaser from 'phaser';
import { ATLAS_KEY, Frame, hexToInt, palette, turretColors, turretFrame } from '../art';
import type { Turret, TurretSpec } from '../sim/turrets';
import type { World } from '../sim/world';

interface View {
  base: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
}

const RAY_STEP = (4 * Math.PI) / 180;

export class TurretRenderer {
  private readonly views = new Map<number, View>();
  private readonly cones: Phaser.GameObjects.Graphics;
  private readonly beams: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: { cones: number; turrets: number; beams: number },
  ) {
    this.cones = scene.add.graphics().setDepth(depth.cones);
    this.beams = scene.add.graphics().setDepth(depth.beams);
  }

  sync(world: World, time: number): void {
    const seen = new Set<number>();
    const beams = this.beams.clear();
    for (const turret of world.turrets) {
      seen.add(turret.id);
      let view = this.views.get(turret.id);
      if (!view) {
        view = {
          base: this.scene.add
            .image(turret.x, turret.y, ATLAS_KEY, Frame.TurretBase)
            .setDepth(this.depth.turrets),
          head: this.scene.add
            .image(turret.x, turret.y, ATLAS_KEY, turretFrame(turret.kind))
            .setDepth(this.depth.turrets + 0.1),
        };
        this.views.set(turret.id, view);
      }
      const recoil = Math.max(0, turret.recoil);
      const kick = turret.kind === 'tesla' ? 0 : recoil * 5;
      view.base.setPosition(turret.x, turret.y);
      view.head.setPosition(
        turret.x - Math.cos(turret.aim) * kick,
        turret.y - Math.sin(turret.aim) * kick,
      );
      view.head.rotation = turret.kind === 'tesla' ? time * 1.5 : turret.aim;
      if (turret.kind === 'tesla') view.head.setScale(1 + recoil * 0.15);

      if (turret.kind === 'beam' && turret.beamLength > 0 && world.phase === 'battle') {
        const ex = turret.x + Math.cos(turret.aim) * turret.beamLength;
        const ey = turret.y + Math.sin(turret.aim) * turret.beamLength;
        const sx = turret.x + Math.cos(turret.aim) * 28;
        const sy = turret.y + Math.sin(turret.aim) * 28;
        const width = world.specs.beam.splash;
        const flicker = 0.75 + Math.sin(time * 40) * 0.25;
        beams.lineStyle(width * 2.2, hexToInt(turretColors.beam.glow), 0.35 * flicker);
        beams.lineBetween(sx, sy, ex, ey);
        beams.lineStyle(width * 0.9, 0xffffff, 0.9);
        beams.lineBetween(sx, sy, ex, ey);
      }
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.base.destroy();
      view.head.destroy();
      this.views.delete(id);
    }
  }

  drawCones(world: World, selectedId: number, visible: boolean): void {
    const g = this.cones.clear();
    if (!visible) return;
    for (const turret of world.turrets) {
      this.cone(g, world, turret, world.specs[turret.kind], turret.id === selectedId);
    }
  }

  drawGhost(world: World, turret: Pick<Turret, 'kind' | 'x' | 'y' | 'angle'>, ok: boolean): void {
    const g = this.cones;
    const color = hexToInt(ok ? palette.ok : palette.danger);
    g.fillStyle(color, 0.3).fillCircle(turret.x, turret.y, 26);
    g.lineStyle(3, color, 0.95).strokeCircle(turret.x, turret.y, 26);
    if (ok) this.cone(g, world, turret, world.specs[turret.kind], true);
  }

  destroy(): void {
    for (const view of this.views.values()) {
      view.base.destroy();
      view.head.destroy();
    }
    this.views.clear();
    this.cones.destroy();
    this.beams.destroy();
  }

  private cone(
    g: Phaser.GameObjects.Graphics,
    world: World,
    turret: Pick<Turret, 'kind' | 'x' | 'y' | 'angle'>,
    spec: TurretSpec,
    highlight: boolean,
  ): void {
    const color = hexToInt(turretColors[turret.kind].glow);
    const from = turret.angle - spec.halfArc;
    const to = turret.angle + spec.halfArc;
    const rays = Math.max(2, Math.ceil((to - from) / RAY_STEP));
    const full = spec.halfArc >= Math.PI;
    const outer: number[] = [];
    for (let r = 0; r <= rays; r += 1) {
      const angle = from + ((to - from) * r) / rays;
      const reach = spec.stats.needsSight
        ? world.map.sightLimit(turret.x, turret.y, angle, spec.range)
        : spec.range;
      outer.push(turret.x + Math.cos(angle) * reach, turret.y + Math.sin(angle) * reach);
    }
    g.fillStyle(color, highlight ? 0.26 : 0.12);
    g.lineStyle(highlight ? 3 : 1.5, color, highlight ? 0.95 : 0.5);
    g.beginPath();
    if (spec.minRange > 0) {
      g.moveTo(outer[0]!, outer[1]!);
      for (let i = 2; i < outer.length; i += 2) g.lineTo(outer[i]!, outer[i + 1]!);
      for (let r = rays; r >= 0; r -= 1) {
        const angle = from + ((to - from) * r) / rays;
        g.lineTo(
          turret.x + Math.cos(angle) * spec.minRange,
          turret.y + Math.sin(angle) * spec.minRange,
        );
      }
    } else {
      if (full) g.moveTo(outer[0]!, outer[1]!);
      else g.moveTo(turret.x, turret.y);
      for (let i = full ? 2 : 0; i < outer.length; i += 2) g.lineTo(outer[i]!, outer[i + 1]!);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}
