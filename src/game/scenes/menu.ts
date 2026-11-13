import Phaser from 'phaser';
import type { Language } from '../../i18n';
import { Frame, palette, uiImage } from '../art';
import { SceneKey } from '../keys';
import { services } from '../services';
import { addBackdrop, addParade } from '../ui/backdrop';
import { Button } from '../ui/button';
import { currentScreen, fitUiCamera, restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const { i18n, save, mute, gameplay } = services();
    fitUiCamera(this);
    const { width, height, mode } = currentScreen();
    const cx = width / 2;
    gameplay.stop();
    this.cameras.main.fadeIn(250);
    restartOnResize(this);
    addBackdrop(this, 0.5);

    const [first = '', second = ''] = i18n.t('menu.title').split('\n');
    const titleY = height * (mode === 'landscape' ? 0.16 : 0.15);
    const titleSize = mode === 'landscape' ? 104 : 84;
    const title = addLabel(
      this,
      cx,
      titleY,
      first.replace(/:$/, '').toUpperCase(),
      titleSize,
      palette.gold,
    )
      .setFontStyle('900')
      .setStroke(palette.outline, 16)
      .setShadow(0, 8, '#000000', 0, true, true);
    const subtitle = addLabel(
      this,
      cx,
      titleY + titleSize * 0.95,
      second.toUpperCase(),
      titleSize * 0.5,
      '#bde66b',
    )
      .setFontStyle('bold')
      .setStroke(palette.outline, 10)
      .setShadow(0, 5, '#000000', 0, true, true);
    this.tweens.add({
      targets: [title, subtitle],
      scale: 1.03,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    uiImage(this, width - 120, 50, Frame.Crystal, 1.1);
    addLabel(this, width - 92, 50, String(save.data.currency), 36, palette.crystal).setOrigin(
      0,
      0.5,
    );

    const columnWidth = mode === 'landscape' ? 480 : 520;
    let y = height * (mode === 'landscape' ? 0.42 : 0.4);
    const play = new Button(this, cx, y, '', () => this.scene.start(SceneKey.LevelSelect), {
      width: columnWidth,
      height: 124,
      fontSize: 52,
      color: 0x2eb872,
    });
    y += 124 / 2 + 22 + 96 / 2;
    const tree = new Button(this, cx, y, '', () => this.scene.start(SceneKey.Tree), {
      width: columnWidth,
      height: 96,
      fontSize: 36,
      color: 0x7d4bc4,
    });
    y += 96 + 18;
    const bestiary = new Button(this, cx, y, '', () => this.scene.start(SceneKey.Bestiary), {
      width: columnWidth,
      height: 96,
      fontSize: 36,
      color: 0x2e7d8a,
    });
    y += 96 / 2 + 30 + 80 / 2;
    const half = (columnWidth - 16) / 2;
    const sound = new Button(
      this,
      cx - half / 2 - 8,
      y,
      '',
      () => {
        const enabled = !save.data.soundEnabled;
        save.set('soundEnabled', enabled);
        mute.set('settings', !enabled);
        render();
      },
      { width: half, height: 80, fontSize: 28, color: 0x3a3f58 },
    );
    const language = new Button(
      this,
      cx + half / 2 + 8,
      y,
      '',
      () => {
        const list = i18n.languages;
        const next: Language = list[(list.indexOf(i18n.language) + 1) % list.length] ?? 'en';
        i18n.setLanguage(next);
        save.set('language', next);
        this.scene.restart();
      },
      { width: half, height: 80, fontSize: 28, color: 0x3a3f58 },
    );

    addParade(this, height - 24, mode === 'landscape' ? 86 : 72);

    const render = (): void => {
      play.setText(i18n.t('menu.play'));
      tree.setText(i18n.t('menu.tree'));
      bestiary.setText(i18n.t('menu.bestiary'));
      sound.setText(i18n.t(save.data.soundEnabled ? 'menu.sound.on' : 'menu.sound.off'));
      language.setText(i18n.t(`language.${i18n.language}`));
    };
    render();
  }
}
