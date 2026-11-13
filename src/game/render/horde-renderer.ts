import type Phaser from 'phaser';
import { ATLAS_KEY, Frame, GOBLIN_FOOT_OFFSET, goblinFrame } from '../art';
import { GOBLIN_KINDS } from '../balance';
import type { Horde } from '../sim/horde';

interface KindFrames {
  frames: [Phaser.Textures.Frame, Phaser.Textures.Frame];
  offsetX: number;
  offsetY: number;
}

const FLASH_TINT = 0xff7a66;
const SLOW_TINT = 0x9aa0c8;
const BURN_TINT = 0xffb070;
const STEP_RATE = 7;
const FLY_HEIGHT = 34;

export class HordeRenderer {
  private readonly blitter: Phaser.GameObjects.Blitter;
  private readonly bobs: Phaser.GameObjects.Bob[] = [];
  private readonly kinds: KindFrames[];
  private shown = 0;
  private readonly shadows: Phaser.GameObjects.Blitter;
  private readonly shadowBobs: Phaser.GameObjects.Bob[] = [];
  private readonly shadowFrame: Phaser.Textures.Frame;
  private shownShadows = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    const texture = scene.textures.get(ATLAS_KEY);
    this.kinds = GOBLIN_KINDS.map((kind) => {
      const a = texture.get(goblinFrame(kind, 0));
      const b = texture.get(goblinFrame(kind, 1));
      return { frames: [a, b], offsetX: a.width / 2, offsetY: a.height - GOBLIN_FOOT_OFFSET };
    });
    this.shadowFrame = texture.get(Frame.Shadow);
    this.shadows = scene.add.blitter(0, 0, ATLAS_KEY).setDepth(depth - 1);
    this.blitter = scene.add.blitter(0, 0, ATLAS_KEY).setDepth(depth);
  }

  sync(horde: Horde, time: number): void {
    const count = horde.count;
    const bobs = this.bobs;
    while (bobs.length < count) {
      bobs.push(this.blitter.create(0, 0, this.kinds[0]!.frames[0], false));
    }
    const beat = time * STEP_RATE;
    let flyers = 0;
    for (let i = 0; i < count; i += 1) {
      const bob = bobs[i]!;
      const kind = this.kinds[horde.kind[i]!]!;
      const step = ((beat + horde.phase[i]!) | 0) & 1;
      bob.x = horde.x[i]! - kind.offsetX;
      const flying = horde.flying[i] === 1;
      const lift = flying ? FLY_HEIGHT + Math.sin(beat * 0.5 + horde.phase[i]!) * 4 : 0;
      bob.y = horde.y[i]! - kind.offsetY - lift;
      if (flying) {
        let shadow = this.shadowBobs[flyers];
        if (!shadow) {
          shadow = this.shadows.create(0, 0, this.shadowFrame, false);
          this.shadowBobs.push(shadow);
        }
        shadow.x = horde.x[i]! - 14;
        shadow.y = horde.y[i]! - 7;
        if (flyers >= this.shownShadows) shadow.visible = true;
        flyers += 1;
      }
      bob.setFrame(step === 0 ? kind.frames[0] : kind.frames[1]);
      bob.flipX = horde.vx[i]! < -4;
      bob.tint =
        horde.flash[i]! > 0
          ? FLASH_TINT
          : horde.slowTimer[i]! > 0
            ? SLOW_TINT
            : horde.burnTimer[i]! > 0
              ? BURN_TINT
              : 0xffffff;
      if (i >= this.shown) bob.visible = true;
    }
    for (let i = count; i < this.shown; i += 1) bobs[i]!.visible = false;
    this.shown = count;
    for (let i = flyers; i < this.shownShadows; i += 1) this.shadowBobs[i]!.visible = false;
    this.shownShadows = flyers;
  }

  destroy(): void {
    this.blitter.destroy();
    this.shadows.destroy();
    this.bobs.length = 0;
  }
}
