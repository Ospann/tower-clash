import type Phaser from 'phaser';
import { FONT_FAMILY } from '../keys';
import { renderScale } from './screen';

export function addLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 48,
  color = '#ffffff',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      color,
      align: 'center',
      resolution: renderScale(),
    })
    .setOrigin(0.5);
}
