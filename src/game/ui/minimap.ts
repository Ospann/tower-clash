import Phaser from 'phaser';
import { hexToInt, palette } from '../art';
import type { Rect } from '../levels/level-types';

export interface MinimapSample {
  xs: Float32Array;
  ys: Float32Array;
  count: number;
  flying: Uint8Array;
  turrets: readonly { x: number; y: number }[];
}

export interface MinimapSetup {
  width: number;
  height: number;
  thumb: string;
  zones: readonly Rect[];
  sample: () => MinimapSample;
  onJump: (x: number, y: number) => void;
}

const REFRESH_MS = 100;
const MAX_DOTS = 700;

export class Minimap {
  readonly root: Phaser.GameObjects.Container;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly scale: number;
  private readonly w: number;
  private readonly h: number;
  private elapsed = REFRESH_MS;

  constructor(
    scene: Phaser.Scene,
    right: number,
    top: number,
    box: number,
    private readonly setup: MinimapSetup,
  ) {
    this.scale = Math.min(box / setup.width, box / setup.height);
    this.w = setup.width * this.scale;
    this.h = setup.height * this.scale;
    this.root = scene.add.container(right - this.w, top);
    const back = scene.add
      .rectangle(-4, -4, this.w + 8, this.h + 8, hexToInt(palette.uiDark), 0.9)
      .setOrigin(0)
      .setStrokeStyle(2, hexToInt(palette.uiPanelLight));
    const image = scene.add.image(0, 0, setup.thumb).setOrigin(0).setDisplaySize(this.w, this.h);
    const zones = scene.add.graphics();
    zones.fillStyle(hexToInt(palette.danger), 0.8);
    for (const zone of setup.zones) {
      zones.fillRect(
        zone.x * this.scale,
        zone.y * this.scale,
        Math.max(2, zone.w * this.scale),
        Math.max(2, zone.h * this.scale),
      );
    }
    this.dots = scene.add.graphics();
    this.frame = scene.add.graphics();
    const hit = scene.add
      .rectangle(0, 0, this.w, this.h, 0x000000, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const jump = (pointer: Phaser.Input.Pointer): void => {
      const x = (pointer.worldX - this.root.x) / this.scale;
      const y = (pointer.worldY - this.root.y) / this.scale;
      setup.onJump(Phaser.Math.Clamp(x, 0, setup.width), Phaser.Math.Clamp(y, 0, setup.height));
    };
    hit.on(Phaser.Input.Events.POINTER_DOWN, jump);
    hit.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) jump(pointer);
    });
    this.root.add([back, image, zones, this.dots, this.frame, hit]);
  }

  get height(): number {
    return this.h;
  }

  update(delta: number, view: { x: number; y: number; width: number; height: number }): void {
    const s = this.scale;
    const g = this.frame.clear();
    const x0 = Math.max(0, view.x * s);
    const y0 = Math.max(0, view.y * s);
    const x1 = Math.min(this.w, (view.x + view.width) * s);
    const y1 = Math.min(this.h, (view.y + view.height) * s);
    g.lineStyle(2, 0xffffff, 0.9).strokeRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0));

    this.elapsed += delta;
    if (this.elapsed < REFRESH_MS || !this.root.visible) return;
    this.elapsed = 0;
    const sample = this.setup.sample();
    const dots = this.dots.clear();
    const step = Math.max(1, Math.ceil(sample.count / MAX_DOTS));
    dots.fillStyle(hexToInt(palette.ok), 1);
    for (let i = 0; i < sample.count; i += step) {
      if (sample.flying[i]) continue;
      dots.fillRect((sample.xs[i] ?? 0) * s - 1, (sample.ys[i] ?? 0) * s - 1, 2.5, 2.5);
    }
    dots.fillStyle(hexToInt(palette.bolt), 1);
    for (let i = 0; i < sample.count; i += step) {
      if (!sample.flying[i]) continue;
      dots.fillRect((sample.xs[i] ?? 0) * s - 1, (sample.ys[i] ?? 0) * s - 1, 2.5, 2.5);
    }
    dots.fillStyle(0xffffff, 1);
    for (const turret of sample.turrets) {
      dots.fillCircle(turret.x * s, turret.y * s, 3);
    }
  }
}
