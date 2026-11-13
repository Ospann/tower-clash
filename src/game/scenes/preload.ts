import Phaser from 'phaser';
import { generateArt } from '../art';
import { generateSfx } from '../audio/sfx';
import { debugFlags } from '../debug/flags';
import { SceneKey } from '../keys';
import { services } from '../services';
import { addLabel } from '../ui/text';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Preload);
  }

  preload(): void {
    const { i18n } = services();
    const { width, height } = this.scale;
    const barWidth = width * 0.7;
    const barHeight = 28;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    const frame = this.add.graphics();
    frame.fillStyle(0xffffff, 0.15);
    frame.fillRoundedRect(x, y, barWidth, barHeight, barHeight / 2);

    const bar = this.add.graphics();
    const label = addLabel(this, width / 2, y - 60, i18n.t('loading', { percent: 0 }), 36);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      bar.clear();
      bar.fillStyle(0x4f7cff, 1);
      bar.fillRoundedRect(x, y, Math.max(barHeight, barWidth * progress), barHeight, barHeight / 2);
      label.setText(i18n.t('loading', { percent: Math.round(progress * 100) }));
    });
  }

  create(): void {
    generateArt(this.textures);
    generateSfx(this);
    services().platform.gameReady();
    if (import.meta.env.DEV && debugFlags.editor) {
      void import('./editor').then(({ EditorScene }) => {
        this.scene.add(SceneKey.Editor, EditorScene, false);
        this.scene.start(SceneKey.Editor);
      });
      return;
    }
    this.scene.start(debugFlags.stress > 0 ? SceneKey.Game : SceneKey.Menu);
  }
}
