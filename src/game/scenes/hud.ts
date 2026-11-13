import Phaser from 'phaser';
import { SceneKey } from '../keys';
import { services } from '../services';
import { Hud, type HudSetup } from '../ui/hud';
import { currentScreen, fitUiCamera, onScreenChange } from '../ui/screen';

export class HudScene extends Phaser.Scene {
  hud: Hud | null = null;
  private setup!: HudSetup;

  constructor() {
    super(SceneKey.Hud);
  }

  init(setup: HudSetup): void {
    this.setup = setup;
    this.hud = null;
  }

  create(): void {
    fitUiCamera(this);
    this.hud = new Hud(this, services().i18n, this.setup, currentScreen());
    onScreenChange(this, () => {
      this.scene.restart(this.setup);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud = null;
    });
  }
}
