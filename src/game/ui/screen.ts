import Phaser from 'phaser';
import { screenFor, type ScreenLayout } from './screen-layout';

export * from './screen-layout';

export const SCREEN_CHANGED = 'screen-changed';

const RESIZE_DEBOUNCE_MS = 150;

function measure(): ScreenLayout {
  if (typeof window === 'undefined') return screenFor(0, 0);
  return screenFor(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}

let current: ScreenLayout = measure();

export function currentScreen(): ScreenLayout {
  return current;
}

export function renderScale(): number {
  return current.scale;
}

export function fitUiCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const camera = scene.cameras.main;
  camera.setViewport(0, 0, current.width * current.scale, current.height * current.scale);
  camera.setOrigin(0, 0);
  camera.setZoom(current.scale);
  camera.setScroll(0, 0);
  return camera;
}

export function isLandscape(): boolean {
  return current.mode === 'landscape';
}

export function watchScreen(game: Phaser.Game): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const apply = (): void => {
    timer = null;
    const next = measure();
    if (
      next.width === current.width &&
      next.height === current.height &&
      next.scale === current.scale
    ) {
      return;
    }
    current = next;
    game.scale.setGameSize(next.width * next.scale, next.height * next.scale);
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
