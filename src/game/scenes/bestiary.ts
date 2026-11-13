import Phaser from 'phaser';
import {
  goblinColors,
  hexToInt,
  palette,
  PORTRAIT_BOX,
  PORTRAIT_KEY,
  portraitFrame,
  type WalkStep,
} from '../art';
import { GOBLIN_KINDS, goblins, type GoblinKind } from '../balance';
import { SceneKey } from '../keys';
import { services } from '../services';
import { Button } from '../ui/button';
import { isLandscape, restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';

const HEADER = 96;
const FOOTER = 104;
const CARD = { x: 16, top: HEADER + 14, height: 196, gap: 10 } as const;
const STEP_MS = 280;
const UI = 100;
const DRAG_THRESHOLD = 6;

interface Portrait {
  image: Phaser.GameObjects.Image;
  kind: GoblinKind;
  step: WalkStep;
}

export class BestiaryScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Bestiary);
  }

  create(): void {
    const { i18n, gameplay } = services();
    const { width, height } = this.scale;
    gameplay.stop();
    this.cameras.main.fadeIn(200);

    restartOnResize(this);
    const columns = isLandscape() ? 2 : 1;
    const cardWidth = Math.min(720 - CARD.x * 2, (width - CARD.x * (columns + 1)) / columns);
    const gridLeft = (width - (columns * cardWidth + (columns - 1) * CARD.x)) / 2;
    const portraits: Portrait[] = [];

    GOBLIN_KINDS.forEach((kind, index) => {
      const left = gridLeft + (index % columns) * (cardWidth + CARD.x);
      const portraitX = left + 18 + PORTRAIT_BOX.width / 2;
      const textX = left + 18 + PORTRAIT_BOX.width + 20;
      const textWidth = left + cardWidth - 16 - textX;
      const top = CARD.top + Math.floor(index / columns) * (CARD.height + CARD.gap);
      const middle = top + CARD.height / 2;
      const colors = goblinColors[kind];
      const stats = goblins[kind];

      this.add
        .rectangle(left, top, cardWidth, CARD.height, hexToInt(palette.uiPanel))
        .setOrigin(0)
        .setStrokeStyle(2, hexToInt(palette.uiPanelLight));
      this.add.rectangle(left, top, 8, CARD.height, hexToInt(colors.accent)).setOrigin(0);
      this.add
        .ellipse(portraitX, middle + 6, PORTRAIT_BOX.width, PORTRAIT_BOX.height - 20)
        .setFillStyle(hexToInt(palette.uiPanelLight), 0.7);
      const image = this.add.image(portraitX, middle, PORTRAIT_KEY, portraitFrame(kind, 0));
      portraits.push({ image, kind, step: 0 });

      addLabel(this, textX, top + 16, i18n.t(`goblin.${kind}.name`), 32, colors.skinLight)
        .setOrigin(0, 0)
        .setFontStyle('bold');
      addLabel(
        this,
        textX,
        top + 60,
        i18n.t('bestiary.stats', { hp: stats.hp, speed: stats.speed, leak: stats.leak }),
        22,
        palette.gold,
      ).setOrigin(0, 0);
      addLabel(this, textX, top + 96, i18n.t(`goblin.${kind}.desc`), 22, palette.uiText)
        .setOrigin(0, 0)
        .setAlign('left')
        .setWordWrapWidth(textWidth)
        .setMaxLines(4);
    });

    this.time.addEvent({
      delay: STEP_MS,
      loop: true,
      callback: () => {
        for (const item of portraits) {
          item.step = item.step === 0 ? 1 : 0;
          item.image.setFrame(portraitFrame(item.kind, item.step));
        }
      },
    });

    const dark = hexToInt(palette.uiDark);
    this.add
      .rectangle(0, 0, width, HEADER, dark, 0.97)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(UI)
      .setInteractive();
    addLabel(this, width / 2, HEADER / 2, i18n.t('bestiary.title'), 42)
      .setFontStyle('bold')
      .setScrollFactor(0)
      .setDepth(UI);
    this.add
      .rectangle(0, height - FOOTER, width, FOOTER, dark, 0.97)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(UI)
      .setInteractive();
    new Button(
      this,
      width / 2,
      height - FOOTER / 2,
      i18n.t('common.back'),
      () => {
        this.scene.start(SceneKey.Menu);
      },
      { color: 0x3a3f58, height: 80, width: 400, fontSize: 34 },
    )
      .setScrollFactor(0)
      .setDepth(UI);

    const contentBottom =
      CARD.top +
      Math.ceil(GOBLIN_KINDS.length / columns) * (CARD.height + CARD.gap) -
      CARD.gap +
      FOOTER +
      14;
    const camera = this.cameras.main;
    camera.setBounds(0, 0, width, Math.max(height, contentBottom));

    let dragging = false;
    let travelled = 0;
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        dragging = over.length === 0;
        travelled = 0;
      },
    );
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) return;
      const dy = pointer.y - pointer.prevPosition.y;
      travelled += Math.abs(dy);
      if (travelled > DRAG_THRESHOLD) camera.scrollY -= dy;
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      dragging = false;
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        camera.scrollY += dy;
      },
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
    });
  }
}
