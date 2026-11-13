import Phaser from 'phaser';
import { Frame, palette, uiImage, UI_RATIO } from '../art';
import { economy } from '../balance';
import { SceneKey } from '../keys';
import { services } from '../services';
import { addBackdrop } from '../ui/backdrop';
import { Button } from '../ui/button';
import { currentScreen, fitUiCamera, restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';
import type { GameSceneData, ResultData } from './game';

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;
  private busy = false;
  private doubled = false;

  constructor() {
    super(SceneKey.Result);
  }

  init(data: ResultData): void {
    this.result = data;
    this.busy = false;
    this.doubled = false;
  }

  create(): void {
    const { i18n, ads, save } = services();
    fitUiCamera(this);
    const { width, height } = currentScreen();
    addBackdrop(this, 0.72);
    const cx = width / 2;
    const result = this.result;
    this.cameras.main.fadeIn(220);
    restartOnResize(this, result);

    const title = addLabel(
      this,
      cx,
      height * 0.13,
      i18n.t(result.won ? 'result.win' : 'result.lose'),
      84,
      result.won ? palette.gold : palette.danger,
    );
    title.setStroke(palette.outline, 10).setFontStyle('bold');

    if (result.won) {
      for (let s = 0; s < 3; s += 1) {
        const star = uiImage(
          this,
          cx + (s - 1) * 120,
          height * 0.24,
          s < result.stars ? Frame.Star : Frame.StarEmpty,
          0,
        );
        this.tweens.add({
          targets: star,
          scale: (s === 1 ? 2 : 1.7) / UI_RATIO,
          duration: 320,
          delay: 150 + s * 180,
          ease: 'Back.easeOut',
        });
      }
    } else {
      addLabel(
        this,
        cx,
        height * 0.24,
        i18n.t('tutorial.tree'),
        28,
        palette.uiMuted,
      ).setWordWrapWidth(width - 100);
    }

    addLabel(
      this,
      cx,
      height * 0.335,
      i18n.t('result.kills', { count: result.kills }),
      32,
      palette.uiMuted,
    );
    addLabel(
      this,
      cx,
      height * 0.375,
      i18n.t('result.leaked', { count: result.leaked }),
      32,
      palette.uiMuted,
    );

    uiImage(this, cx - 190, height * 0.45, Frame.Crystal, 1.3);
    const reward = addLabel(this, cx + 20, height * 0.45, '', 42, palette.crystal);
    const renderReward = (): void => {
      const total = result.reward * (this.doubled ? economy.rewardedMultiplier : 1);
      reward.setText(i18n.t(this.doubled ? 'result.doubled' : 'result.reward', { count: total }));
      if (this.doubled) reward.setFontSize(32);
    };
    renderReward();

    let y = height * 0.56;
    const step = 124;
    const double = new Button(
      this,
      cx,
      y,
      i18n.t('result.double'),
      () => {
        void this.guard(async () => {
          const rewarded = await ads.showRewarded();
          if (!rewarded || this.doubled) return;
          this.doubled = true;
          save.update((data) => {
            data.currency += result.reward * (economy.rewardedMultiplier - 1);
          });
          double.setEnabled(false);
          renderReward();
        });
      },
      { width: 600, fontSize: 32, color: 0x7d4bc4 },
    );
    y += step;

    Button.create(this, cx, y, i18n.t('result.tree'), () => this.leave(SceneKey.Tree), {
      width: 520,
      fontSize: 38,
      color: 0x2eb872,
    });
    y += step;
    Button.create(
      this,
      cx,
      y,
      i18n.t('result.retry'),
      () => {
        if (this.busy) return;
        this.scene.start(SceneKey.Game, { levelId: result.levelId } satisfies GameSceneData);
      },
      { width: 520, fontSize: 38 },
    );
    y += step;
    Button.create(this, cx, y, i18n.t('result.levels'), () => this.leave(SceneKey.LevelSelect), {
      width: 520,
      color: 0x3a3f58,
      fontSize: 38,
    });
  }

  private leave(target: typeof SceneKey.Tree | typeof SceneKey.LevelSelect): void {
    void this.guard(async () => {
      await services().ads.showInterstitial();
      this.scene.start(target);
    });
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
  }
}
