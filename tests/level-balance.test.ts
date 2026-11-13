import { describe, expect, it } from 'vitest';
import { levels } from '../src/game/levels';
import type { LevelData } from '../src/game/levels/level-types';
import { loadoutAt, playLevel } from './helpers/bot';

function levelAt(index: number): LevelData {
  const level = levels[index];
  if (!level) throw new Error(`Level ${index} is missing`);
  return level;
}

describe('level balance (bot with a naive turret line)', () => {
  it('lets a fresh save win the first level', () => {
    expect(playLevel(levelAt(0), loadoutAt(0)).won).toBe(true);
  });

  it('makes a fresh save lose from the middle of chapter 1', () => {
    expect(playLevel(levelAt(2), loadoutAt(0)).won).toBe(false);
    expect(playLevel(levelAt(3), loadoutAt(0)).won).toBe(false);
  });

  it('never leaves a goblin stuck: every run ends well before the time cap', () => {
    for (const index of [2, 6, 7]) {
      expect(playLevel(levelAt(index), loadoutAt(0.5)).seconds).toBeLessThan(600);
    }
  });

  it('keeps the last levels beatable with a full tree', () => {
    expect(playLevel(levelAt(8), loadoutAt(1)).won).toBe(true);
    expect(playLevel(levelAt(11), loadoutAt(1)).won).toBe(true);
  }, 120000);
});
