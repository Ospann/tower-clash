import type { GoblinKind } from '../balance';

export const TILE_THEMES = ['meadow', 'swamp', 'dunes', 'ash'] as const;
export type TileTheme = (typeof TILE_THEMES)[number];

export const OBSTACLE_TYPES = ['rock', 'forest', 'water', 'ruins'] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ObstacleShape = ({ kind: 'rect' } & Rect) | { kind: 'poly'; points: Point[] };

export interface Obstacle {
  type: ObstacleType;
  shape: ObstacleShape;
}

export interface Entry {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface WaveGroup {
  goblin: GoblinKind;
  count: number;
  duration: number;
  entry: string;
  delay: number;
}

export interface Wave {
  groups: WaveGroup[];
}

export type WinCondition = { type: 'waves' } | { type: 'timer'; seconds: number };

export interface LevelData {
  id: string;
  name: string;
  chapter: number;
  grid: { cols: number; rows: number; cell: number };
  tiles: TileTheme;
  obstacles: Obstacle[];
  entries: Entry[];
  zones: Rect[];
  baseHp: number;
  turretLimit: number;
  win: WinCondition;
  difficulty: { hp: number; speed: number };
  waves: Wave[];
}

export function mapWidth(level: Pick<LevelData, 'grid'>): number {
  return level.grid.cols * level.grid.cell;
}

export function mapHeight(level: Pick<LevelData, 'grid'>): number {
  return level.grid.rows * level.grid.cell;
}
