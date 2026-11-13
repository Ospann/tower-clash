export const SceneKey = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  LevelSelect: 'LevelSelect',
  Tree: 'Tree',
  Game: 'Game',
  Pause: 'Pause',
  Result: 'Result',
  Editor: 'Editor',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];

export const GameEvent = {
  Abandon: 'abandon',
} as const;

export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
