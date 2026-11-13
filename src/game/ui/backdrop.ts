import Phaser from 'phaser';
import { BACKDROP_KEY, generateBackdrop, PORTRAIT_KEY, portraitFrame } from '../art';
import type { GoblinKind } from '../balance';
import { levels } from '../levels';
import { currentScreen } from './screen';

const PARADE: readonly GoblinKind[] = [
  'grunt',
  'grunt',
  'runner',
  'grunt',
  'shield',
  'grunt',
  'brute',
  'grunt',
  'shaman',
  'grunt',
  'runner',
  'glider',
  'grunt',
  'shield',
];

interface Walker {
  image: Phaser.GameObjects.Image;
  kind: GoblinKind;
  step: 0 | 1;
}

export function addBackdrop(scene: Phaser.Scene, dim = 0.55): void {
  const { width, height } = currentScreen();
  const level = levels[2] ?? levels[0];
  if (!level) return;
  generateBackdrop(scene.textures, level);
  const image = scene.add.image(width / 2, height / 2, BACKDROP_KEY).setScrollFactor(0);
  const cover = Math.max(width / image.width, height / image.height) * 1.12;
  image.setScale(cover);
  scene.tweens.add({
    targets: image,
    x: width / 2 + width * 0.04,
    y: height / 2 - height * 0.03,
    duration: 24000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.add.rectangle(0, 0, width, height, 0x0d1410, dim).setOrigin(0).setScrollFactor(0);
}

export function addParade(scene: Phaser.Scene, y: number, size = 70): void {
  const { width } = currentScreen();
  const spacing = size * 1.15;
  const total = PARADE.length * spacing;
  const walkers = PARADE.map((kind, index): Walker => {
    const image = scene.add.image(-index * spacing, y, PORTRAIT_KEY, portraitFrame(kind, 0));
    const scale = (size / Math.max(image.width, image.height)) * (kind === 'brute' ? 1.3 : 1);
    image.setScale(scale).setOrigin(0.5, 1);
    return { image, kind, step: index % 2 === 0 ? 0 : 1 };
  });
  scene.time.addEvent({
    delay: 260,
    loop: true,
    callback: () => {
      for (const walker of walkers) {
        walker.step = walker.step === 0 ? 1 : 0;
        walker.image.setFrame(portraitFrame(walker.kind, walker.step));
      }
    },
  });
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
    for (const walker of walkers) {
      walker.image.x += (delta / 1000) * 70;
      if (walker.image.x > width + size) walker.image.x -= Math.max(total, width + size * 2);
    }
  });
}
