import type { LevelData } from './level-types';
import { parseLevel } from './validate-level';

const modules = import.meta.glob<unknown>('./level-*.json', { eager: true, import: 'default' });

export const levels: readonly LevelData[] = Object.keys(modules)
  .toSorted()
  .map((file) => parseLevel(modules[file], file));

export function levelById(id: string): LevelData | undefined {
  return levels.find((level) => level.id === id);
}

export function levelIndex(id: string): number {
  return levels.findIndex((level) => level.id === id);
}

export function isUnlocked(index: number, stars: Readonly<Record<string, number>>): boolean {
  if (index <= 0) return true;
  const previous = levels[index - 1];
  return previous !== undefined && (stars[previous.id] ?? 0) > 0;
}

export function chapters(): number[] {
  return [...new Set(levels.map((level) => level.chapter))].toSorted((a, b) => a - b);
}
