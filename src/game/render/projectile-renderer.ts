import type Phaser from 'phaser';
import { ATLAS_KEY, Frame } from '../art';
import { ProjectileKind, type Projectiles } from '../sim/projectiles';

const frameOf: Readonly<Record<number, string>> = {
  [ProjectileKind.Arrow]: Frame.Arrow,
  [ProjectileKind.Shell]: Frame.Ball,
  [ProjectileKind.Flask]: Frame.Flask,
  [ProjectileKind.Bomb]: Frame.Bomb,
  [ProjectileKind.Rocket]: Frame.Rocket,
};

const ARC_HEIGHT = 80;

export class ProjectileRenderer {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly kinds: number[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  sync(projectiles: Projectiles): void {
    const images = this.images;
    while (images.length < projectiles.count) {
      images.push(this.scene.add.image(0, 0, ATLAS_KEY, Frame.Arrow).setDepth(this.depth));
      this.kinds.push(-1);
    }
    for (let i = 0; i < images.length; i += 1) {
      const image = images[i]!;
      const p = i < projectiles.count ? projectiles.items[i]! : null;
      if (!p || p.delay > 0) {
        if (image.visible) image.setVisible(false);
        continue;
      }
      if (this.kinds[i] !== p.kind) {
        this.kinds[i] = p.kind;
        image.setFrame(frameOf[p.kind] ?? Frame.Ball);
      }
      if (!image.visible) image.setVisible(true);
      if (p.kind === ProjectileKind.Arrow) {
        image.setPosition(p.x, p.y);
        image.rotation = Math.atan2(p.ty - p.y, p.tx - p.x);
        image.setScale(1.3);
      } else if (p.kind === ProjectileKind.Rocket) {
        image.setPosition(p.x, p.y);
        image.rotation = Math.atan2(p.ty - p.sy, p.tx - p.sx);
        image.setScale(1.4);
      } else if (p.kind === ProjectileKind.Bomb) {
        image.setPosition(p.x, p.y);
        image.rotation = 0.12;
        image.setScale(1);
      } else {
        const lift = Math.sin(Math.PI * p.t);
        image.setPosition(p.x, p.y - lift * ARC_HEIGHT);
        image.rotation = p.t * 6;
        image.setScale(1 + lift * 0.5);
      }
    }
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
    this.images.length = 0;
  }
}
