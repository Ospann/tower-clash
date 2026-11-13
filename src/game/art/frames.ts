import type { GoblinKind } from '../balance';

export const ATLAS_KEY = 'atlas';

export type WalkStep = 0 | 1;

export function goblinFrame(kind: GoblinKind, step: WalkStep): string {
  return `goblin-${kind}-${step}`;
}

export function corpseFrame(kind: GoblinKind): string {
  return `corpse-${kind}`;
}

export function turretFrame(kind: string): string {
  return `turret-${kind}`;
}

export function splatFrame(variant: number): string {
  return `splat-${variant % 3}`;
}

export const Frame = {
  Dot: 'fx-dot',
  Spark: 'fx-spark',
  Ring: 'fx-ring',
  Smoke: 'fx-smoke',
  Flame: 'fx-flame',
  Puddle: 'fx-puddle',
  Arrow: 'proj-arrow',
  Ball: 'proj-ball',
  Flask: 'proj-flask',
  Bomb: 'proj-bomb',
  Slot: 'slot',
  Gold: 'icon-gold',
  Crystal: 'icon-crystal',
  Heart: 'icon-heart',
  Star: 'icon-star',
  StarEmpty: 'icon-star-empty',
  Lock: 'icon-lock',
  BombIcon: 'icon-bomb',
  Pause: 'icon-pause',
  Target: 'fx-target',
  Shadow: 'fx-shadow',
  TurretBase: 'turret-base',
  Handle: 'ui-handle',
  Remove: 'ui-remove',
  Shell: 'proj-ball',
} as const;

export const GOBLIN_FOOT_OFFSET = 4;
