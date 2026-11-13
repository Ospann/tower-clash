import Phaser from 'phaser';
import { gameConfig } from './config';
import { currentScreen } from './ui/screen';
import { BestiaryScene } from './scenes/bestiary';
import { BootScene } from './scenes/boot';
import { GameScene } from './scenes/game';
import { HudScene } from './scenes/hud';
import { LevelSelectScene } from './scenes/level-select';
import { MenuScene } from './scenes/menu';
import { PauseScene } from './scenes/pause';
import { PreloadScene } from './scenes/preload';
import { ResultScene } from './scenes/result';
import { TreeScene } from './scenes/tree';

export function createGame(parent: HTMLElement): Phaser.Game {
  const screen = currentScreen();
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: screen.width,
    height: screen.height,
    backgroundColor: gameConfig.backgroundColor,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 3,
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
    scene: [
      BootScene,
      PreloadScene,
      MenuScene,
      LevelSelectScene,
      TreeScene,
      BestiaryScene,
      GameScene,
      HudScene,
      PauseScene,
      ResultScene,
    ],
  });
}
