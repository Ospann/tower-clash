import Phaser from 'phaser';
import { gameConfig } from './config';
import { BootScene } from './scenes/boot';
import { GameScene } from './scenes/game';
import { LevelSelectScene } from './scenes/level-select';
import { MenuScene } from './scenes/menu';
import { PauseScene } from './scenes/pause';
import { PreloadScene } from './scenes/preload';
import { ResultScene } from './scenes/result';
import { TreeScene } from './scenes/tree';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: gameConfig.width,
    height: gameConfig.height,
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
      GameScene,
      PauseScene,
      ResultScene,
    ],
  });
}
