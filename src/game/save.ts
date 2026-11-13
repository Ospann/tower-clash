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

const LEGACY_LIMIT = { cost: 30, growth: 2, maxLevel: 6 } as const;

export const saveSchema: SaveSchema<GameSave> = {
  version: 4,
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
    4: (data) => {
      const tree: unknown = data.tree;
      if (typeof tree !== 'object' || tree === null) return data;
      const raw: unknown = Reflect.get(tree, 'limit');
      const levels = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
      const rest = Object.fromEntries(Object.entries(tree).filter(([key]) => key !== 'limit'));
      let refund = 0;
      for (let level = 0; level < Math.min(levels, LEGACY_LIMIT.maxLevel); level += 1) {
        refund += Math.round(LEGACY_LIMIT.cost * LEGACY_LIMIT.growth ** level);
      }
      const currency = typeof data.currency === 'number' ? data.currency : 0;
      return { ...data, tree: rest, currency: currency + refund };
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
