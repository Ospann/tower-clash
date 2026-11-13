import type { SaveSchema } from '@core/save';
import type { Language } from '../i18n';
import { TURRET_KINDS, type TurretKind } from './balance';

export interface PlacedTurret {
  kind: TurretKind;
  x: number;
  y: number;
  angle: number;
}

export interface GameSave extends Record<string, unknown> {
  stars: Record<string, number>;
  currency: number;
  tree: Record<string, number>;
  placements: Record<string, PlacedTurret[]>;
  tutorialSeen: boolean;
  soundEnabled: boolean;
  language: Language | null;
}

export const saveSchema: SaveSchema<GameSave> = {
  version: 3,
  defaults: () => ({
    stars: {},
    currency: 0,
    tree: {},
    placements: {},
    tutorialSeen: false,
    soundEnabled: true,
    language: null,
  }),
  migrations: {
    2: (data) => {
      const { highScore, ...rest } = data;
      return { ...rest, bestScore: typeof highScore === 'number' ? highScore : 0 };
    },
    3: (data) => {
      const { bestScore: _bestScore, levelsCompleted: _levelsCompleted, ...rest } = data;
      return { ...rest, stars: {}, currency: 0, tree: {}, placements: {}, tutorialSeen: false };
    },
  },
};

function isTurretKind(value: unknown): value is TurretKind {
  return typeof value === 'string' && TURRET_KINDS.some((kind) => kind === value);
}

export function sanitizePlacement(value: unknown): PlacedTurret[] {
  if (!Array.isArray(value)) return [];
  const result: PlacedTurret[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const kind: unknown = Reflect.get(item, 'kind');
    const x: unknown = Reflect.get(item, 'x');
    const y: unknown = Reflect.get(item, 'y');
    const angle: unknown = Reflect.get(item, 'angle');
    if (!isTurretKind(kind)) continue;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof angle !== 'number') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) continue;
    result.push({ kind, x, y, angle });
  }
  return result;
}
