import Phaser from 'phaser';
import type { Language } from '../../i18n';
import { ATLAS_KEY, goblinFrame, palette } from '../art';
import { GOBLIN_KINDS } from '../balance';
import { SceneKey } from '../keys';
import { services } from '../services';
import { Button } from '../ui/button';
import { restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const { i18n, save, mute, gameplay } = services();
    const { width, height } = this.scale;
    const cx = width / 2;
    gameplay.stop();
    this.cameras.main.fadeIn(200);
    restartOnResize(this);

    const title = addLabel(this, cx, height * 0.17, i18n.t('menu.title'), 68, palette.gold);
    title.setStroke(palette.outline, 10).setFontStyle('bold');

    GOBLIN_KINDS.forEach((kind, index) => {
      if (kind === 'boss') return;
      const goblin = this.add
        .image(cx - 200 + index * 80, height * 0.31, ATLAS_KEY, goblinFrame(kind, 0))
        .setScale(2.4);
      this.tweens.add({
        targets: goblin,
        y: goblin.y - 10,
        duration: 320 + index * 40,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    const play = new Button(this, cx, height * 0.44, '', () => {
      this.scene.start(SceneKey.LevelSelect);
    });
    const tree = new Button(
      this,
      cx,
      height * 0.54,
      '',
      () => {
        this.scene.start(SceneKey.Tree);
      },
      { color: 0x7d4bc4, fontSize: 38 },
    );
    const bestiary = new Button(
      this,
      cx,
      height * 0.64,
      '',
      () => {
        this.scene.start(SceneKey.Bestiary);
      },
      { color: 0x2e8a6e, fontSize: 36 },
    );
    const sound = new Button(
      this,
      cx,
      height * 0.76,
      '',
      () => {
        const enabled = !save.data.soundEnabled;
        save.set('soundEnabled', enabled);
        mute.set('settings', !enabled);
        render();
      },
      { color: 0x3a3f58, fontSize: 36 },
    );
    const language = new Button(
      this,
      cx,
      height * 0.86,
      '',
      () => {
        const list = i18n.languages;
        const next: Language = list[(list.indexOf(i18n.language) + 1) % list.length] ?? 'en';
        i18n.setLanguage(next);
        save.set('language', next);
        render();
      },
      { color: 0x3a3f58, fontSize: 34 },
    );

    const render = (): void => {
      title.setText(i18n.t('menu.title'));
      play.setText(i18n.t('menu.play'));
      tree.setText(i18n.t('menu.tree'));
      bestiary.setText(i18n.t('menu.bestiary'));
      sound.setText(i18n.t(save.data.soundEnabled ? 'menu.sound.on' : 'menu.sound.off'));
      language.setText(i18n.t('menu.language', { language: i18n.t(`language.${i18n.language}`) }));
    };
    render();
  }
}
