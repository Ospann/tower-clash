import Phaser from 'phaser';

export function onHotkey(scene: Phaser.Scene, handler: (event: KeyboardEvent) => void): void {
  const listener = (event: KeyboardEvent): void => {
    if (event.repeat || !scene.sys.isActive()) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLSelectElement) return;
    handler(event);
  };
  window.addEventListener('keydown', listener);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('keydown', listener);
  });
}
