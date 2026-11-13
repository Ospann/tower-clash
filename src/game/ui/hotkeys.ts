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

export function trackHeldKeys(scene: Phaser.Scene, codes: readonly string[]): Set<string> {
  const held = new Set<string>();
  const down = (event: KeyboardEvent): void => {
    if (!codes.includes(event.code) || !scene.sys.isActive()) return;
    event.preventDefault();
    held.add(event.code);
  };
  const up = (event: KeyboardEvent): void => {
    held.delete(event.code);
  };
  const clear = (): void => {
    held.clear();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', clear);
  });
  return held;
}
