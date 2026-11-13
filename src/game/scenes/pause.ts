import Phaser from 'phaser';
import { GameEvent, SceneKey } from '../keys';
import { services } from '../services';
import { Button } from '../ui/button';
import { addLabel } from '../ui/text';

let resumeGameplay = false;

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Pause);
  }

  create(): void {
    const { i18n } = services();
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setInteractive();
    addLabel(this, width / 2, height * 0.36, i18n.t('pause.title'), 80);
    Button.create(this, width / 2, height * 0.5, i18n.t('pause.resume'), () => {
      resumeGame(this.game);
    });
    Button.create(
      this,
      width / 2,
      height * 0.61,
      i18n.t('pause.quit'),
      () => {
        quitLevel(this.game);
      },
      { color: 0x3a3f58, fontSize: 38 },
    );
  }
}

export function pauseGame(game: Phaser.Game): void {
  const { scene } = game;
  if (!scene.isActive(SceneKey.Game) || scene.isActive(SceneKey.Pause)) return;
  const { gameplay, mute } = services();
  resumeGameplay = gameplay.isActive;
  scene.pause(SceneKey.Game);
  gameplay.stop();
  mute.set('pause', true);
  scene.run(SceneKey.Pause);
  scene.bringToTop(SceneKey.Pause);
}

export function resumeGame(game: Phaser.Game): void {
  const { gameplay, mute } = services();
  game.scene.stop(SceneKey.Pause);
  game.scene.resume(SceneKey.Game);
  mute.set('pause', false);
  if (resumeGameplay) gameplay.start();
}

function quitLevel(game: Phaser.Game): void {
  const { mute } = services();
  mute.set('pause', false);
  game.scene.stop(SceneKey.Pause);
  game.scene.getScene(SceneKey.Game).events.emit(GameEvent.Abandon);
}
