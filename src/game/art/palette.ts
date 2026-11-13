import type { GoblinKind } from '../balance';
import type { ObstacleType, TileTheme } from '../levels/level-types';

export const palette = {
  outline: '#1c2415',
  shadow: 'rgba(10, 16, 10, 0.28)',
  white: '#fdf8e7',
  eye: '#fffbe8',
  pupil: '#1c2415',
  tooth: '#fff6d6',
  wood: '#8b5a2b',
  woodDark: '#5e3b1c',
  stone: '#9aa39a',
  stoneDark: '#6b746d',
  stoneLight: '#c3cabf',
  steel: '#7fa6c9',
  steelDark: '#4b6f91',
  gold: '#ffd166',
  goldDark: '#c9952c',
  fire: '#ff8c42',
  fireHot: '#ffe066',
  tar: '#2b2233',
  bolt: '#9be7ff',
  boltHot: '#ffffff',
  crystal: '#b98bff',
  danger: '#e4572e',
  ok: '#6fcf5b',
  uiDark: '#141b17',
  uiPanel: '#243029',
  uiPanelLight: '#33443a',
  uiText: '#fdf8e7',
  uiMuted: '#a9b8a6',
} as const;

export interface GoblinColors {
  skin: string;
  skinDark: string;
  skinLight: string;
  accent: string;
  accentDark: string;
}

export const goblinColors: Readonly<Record<GoblinKind, GoblinColors>> = {
  grunt: {
    skin: '#a8cf45',
    skinDark: '#6f9628',
    skinLight: '#cfe97a',
    accent: '#9c6b3c',
    accentDark: '#6e4824',
  },
  runner: {
    skin: '#c9dc4a',
    skinDark: '#93a52a',
    skinLight: '#e8f089',
    accent: '#e4572e',
    accentDark: '#a8361a',
  },
  shield: {
    skin: '#93c356',
    skinDark: '#5f8c33',
    skinLight: '#bfe08a',
    accent: '#7fa6c9',
    accentDark: '#4b6f91',
  },
  brute: {
    skin: '#7fb04a',
    skinDark: '#4f7a2a',
    skinLight: '#a9d277',
    accent: '#8e5bb5',
    accentDark: '#5e3880',
  },
  glider: {
    skin: '#b5d04a',
    skinDark: '#7e9727',
    skinLight: '#dbec86',
    accent: '#f29e4c',
    accentDark: '#b9661f',
  },
  shaman: {
    skin: '#9fd17a',
    skinDark: '#649a45',
    skinLight: '#c9ecab',
    accent: '#2ec4b6',
    accentDark: '#1b8177',
  },
  boss: {
    skin: '#8fbf3f',
    skinDark: '#587f22',
    skinLight: '#b9de72',
    accent: '#c0392b',
    accentDark: '#7d2118',
  },
};

export const obstacleColors: Readonly<
  Record<ObstacleType, { fill: string; dark: string; light: string }>
> = {
  rock: { fill: '#8d948c', dark: '#5d655f', light: '#b9c0b5' },
  forest: { fill: '#2f6b45', dark: '#1e4a30', light: '#4c9160' },
  water: { fill: '#3f8fc4', dark: '#2a6a99', light: '#8fd0f0' },
  ruins: { fill: '#a39a86', dark: '#6f6757', light: '#cfc6b0' },
};

export interface ThemeColors {
  land: string;
  landDark: string;
  landLight: string;
  speck: string;
}

export const themeColors: Readonly<Record<TileTheme, ThemeColors>> = {
  meadow: {
    land: '#c9b47a',
    landDark: '#b8a36a',
    landLight: '#d8c58d',
    speck: '#a8c070',
  },
  swamp: {
    land: '#9fa98a',
    landDark: '#8d9879',
    landLight: '#b1ba9c',
    speck: '#6f8f7a',
  },
  dunes: {
    land: '#e2c88f',
    landDark: '#d2b77d',
    landLight: '#eed8a6',
    speck: '#c9a868',
  },
  ash: {
    land: '#b3aaa0',
    landDark: '#a0978d',
    landLight: '#c5bdb3',
    speck: '#8a8290',
  },
};

export function hexToInt(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
