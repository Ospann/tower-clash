import Phaser from 'phaser';
import { MAP_HEIGHT, MAP_WIDTH, screenFor, type ScreenLayout } from './screen-layout';

export * from './screen-layout';

export const SCREEN_CHANGED = 'screen-changed';

const RESIZE_DEBOUNCE_MS = 150;

let current: ScreenLayout = screenFor(
  typeof window === 'undefined' ? MAP_WIDTH : window.innerWidth,
  typeof window === 'undefined' ? MAP_HEIGHT : window.innerHeight,
);

export function currentScreen(): ScreenLayout {
  return current;
}

export function isLandscape(): boolean {
  return current.mode === 'landscape';
}

export function watchScreen(game: Phaser.Game): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const apply = (): void => {
    timer = null;
    const next = screenFor(window.innerWidth, window.innerHeight);
    if (next.width === current.width && next.mode === current.mode) return;
    current = next;
    game.scale.setGameSize(next.width, next.height);
    game.events.emit(SCREEN_CHANGED, next);
  };
  const onResize = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(apply, RESIZE_DEBOUNCE_MS);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  return () => {
    if (timer !== null) clearTimeout(timer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
  };
}

export function onScreenChange(scene: Phaser.Scene, handler: (layout: ScreenLayout) => void): void {
  const events = scene.game.events;
  events.on(SCREEN_CHANGED, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    events.off(SCREEN_CHANGED, handler);
  });
}

export function restartOnResize(scene: Phaser.Scene, data?: object): void {
  onScreenChange(scene, () => {
    scene.scene.restart(data);
  });
}
