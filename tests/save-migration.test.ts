import { describe, expect, it } from 'vitest';
import { migrate } from '@core/save';
import { sanitizePlacement, saveSchema } from '../src/game/save';

describe('save migration', () => {
  it('starts a new player with defaults', () => {
    expect(migrate(null, saveSchema)).toEqual({
      stars: {},
      currency: 0,
      tree: {},
      placements: {},
      tutorialSeen: false,
      soundEnabled: true,
      language: null,
    });
  });

  it('migrates the template v2 save, keeping settings and dropping demo fields', () => {
    const data = migrate(
      { v: 2, data: { bestScore: 41, levelsCompleted: 3, soundEnabled: false, language: 'ru' } },
      saveSchema,
    );
    expect(data.soundEnabled).toBe(false);
    expect(data.language).toBe('ru');
    expect(data.currency).toBe(0);
    expect(data.stars).toEqual({});
    expect(data.tree).toEqual({});
    expect(data.placements).toEqual({});
    expect(data).not.toHaveProperty('bestScore');
    expect(data).not.toHaveProperty('levelsCompleted');
  });

  it('migrates the template v1 save through every step', () => {
    const data = migrate({ v: 1, data: { highScore: 7, soundEnabled: true } }, saveSchema);
    expect(data.soundEnabled).toBe(true);
    expect(data).not.toHaveProperty('highScore');
    expect(data).not.toHaveProperty('bestScore');
  });

  it('keeps a current save untouched', () => {
    const current = {
      stars: { 'level-01': 3 },
      currency: 55,
      tree: { baseHp: 2 },
      placements: { 'level-01': [{ kind: 'ballista', x: 100, y: 500, angle: -1.57 }] },
      tutorialSeen: true,
      soundEnabled: true,
      language: 'tr',
    };
    expect(migrate({ v: 3, data: current }, saveSchema)).toEqual(current);
  });

  it('refuses a save from a newer version', () => {
    expect(() => migrate({ v: 99, data: {} }, saveSchema)).toThrow('newer');
  });

  it('drops broken placement entries', () => {
    expect(sanitizePlacement(null)).toEqual([]);
    expect(
      sanitizePlacement([
        { kind: 'ballista', x: 1, y: 2, angle: 0 },
        { kind: 'laser', x: 1, y: 2, angle: 0 },
        { kind: 'mortar', x: 'a', y: 2, angle: 0 },
        { kind: 'tesla', x: 1, y: Number.NaN, angle: 0 },
        7,
      ]),
    ).toEqual([{ kind: 'ballista', x: 1, y: 2, angle: 0 }]);
  });
});
