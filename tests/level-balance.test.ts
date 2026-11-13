import { describe, expect, it } from 'vitest';
import { levels } from '../src/game/levels';
import type { LevelData } from '../src/game/levels/level-types';
import { loadoutAt, playLevel } from './helpers/bot';

function levelAt(index: number): LevelData {
  const level = levels[index];
  if (!level) throw new Error(`Level ${index} is missing`);
  return level;
}

describe('level balance (bot with greedy turret placement)', () => {
  it('lets a fresh save win the first level', () => {
    expect(playLevel(levelAt(0), loadoutAt(0)).won).toBe(true);
  }, 120000);

  it('makes a fresh save lose from the middle of chapter 1', () => {
    expect(playLevel(levelAt(2), loadoutAt(0)).won).toBe(false);
  }, 120000);

  it('keeps chapter 2 beatable with three quarters of the tree', () => {
    expect(playLevel(levelAt(5), loadoutAt(0.75)).won).toBe(true);
  }, 300000);

  it('keeps chapter 3 beatable with a full tree', () => {
    expect(playLevel(levelAt(8), loadoutAt(1)).won).toBe(true);
  }, 300000);
});
