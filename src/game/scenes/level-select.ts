import Phaser from 'phaser';
import { translateKey } from '../../i18n';
import { ATLAS_KEY, Frame, hexToInt, palette } from '../art';
import { SceneKey } from '../keys';
import { chapters, isUnlocked, levels } from '../levels';
import { services } from '../services';
import { Button } from '../ui/button';
import { isLandscape, restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';
import type { GameSceneData } from './game';

const CARD = { width: 330, height: 122, gap: 10 } as const;

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.LevelSelect);
  }

  create(): void {
    const { i18n, save, gameplay } = services();
    const { width, height } = this.scale;
    gameplay.stop();
    this.cameras.main.fadeIn(200);
    restartOnResize(this);
    const columns = isLandscape() ? 4 : 2;

    addLabel(this, width / 2, 60, i18n.t('levels.title'), 46).setFontStyle('bold');
    this.add.image(width / 2 - 46, 116, ATLAS_KEY, Frame.Crystal).setScale(0.9);
    addLabel(this, width / 2 - 20, 116, String(save.data.currency), 32, palette.crystal).setOrigin(
      0,
      0.5,
    );

    let y = 176;
    for (const chapter of chapters()) {
      addLabel(this, width / 2, y, i18n.t('levels.chapter', { chapter }), 30, palette.gold);
      y += 34;
      const items = levels.filter((level) => level.chapter === chapter);
      items.forEach((level, position) => {
        const index = levels.indexOf(level);
        const column = position % columns;
        const row = Math.floor(position / columns);
        const x = width / 2 + (column - (columns - 1) / 2) * (CARD.width + 12);
        const cy = y + CARD.height / 2 + row * (CARD.height + CARD.gap);
        const unlocked = isUnlocked(index, save.data.stars);
        const stars = save.data.stars[level.id] ?? 0;
        const card = new Button(
          this,
          x,
          cy,
          '',
          () => {
            this.scene.start(SceneKey.Game, { levelId: level.id } satisfies GameSceneData);
          },
          {
            width: CARD.width,
            height: CARD.height,
            color: hexToInt(unlocked ? palette.uiPanelLight : palette.uiPanel),
          },
        );
        const number = addLabel(this, -CARD.width / 2 + 40, 0, String(index + 1), 50, palette.gold);
        number.setFontStyle('bold');
        const name = addLabel(this, 34, -28, translateKey(i18n, level.name), 24)
          .setWordWrapWidth(CARD.width - 110)
          .setAlpha(unlocked ? 1 : 0.6);
        card.add([number, name]);
        if (unlocked) {
          for (let s = 0; s < 3; s += 1) {
            card.add(
              this.add
                .image(-22 + s * 56, 26, ATLAS_KEY, s < stars ? Frame.Star : Frame.StarEmpty)
                .setScale(0.8),
            );
          }
        } else {
          card.add(this.add.image(34, 26, ATLAS_KEY, Frame.Lock).setScale(0.8));
          card.setEnabled(false);
        }
      });
      y += Math.ceil(items.length / columns) * (CARD.height + CARD.gap) + 14;
    }

    Button.create(
      this,
      width / 2 - 172,
      height - 62,
      i18n.t('common.back'),
      () => {
        this.scene.start(SceneKey.Menu);
      },
      { color: 0x3a3f58, height: 92, width: 320, fontSize: 36 },
    );
    Button.create(
      this,
      width / 2 + 172,
      height - 62,
      i18n.t('result.tree'),
      () => {
        this.scene.start(SceneKey.Tree);
      },
      { color: 0x7d4bc4, height: 92, width: 320, fontSize: 34 },
    );
  }
}
