import type Phaser from 'phaser';
import type { LevelData } from '../levels/level-types';
import { mapHeight, mapWidth } from '../levels/level-types';
import { AtlasBuilder } from './atlas-builder';
import { ATLAS_KEY, PORTRAIT_KEY } from './frames';
import { addFxFrames } from './fx-art';
import { addGoblinFrames, addGoblinPortraits } from './goblin-art';
import { drawLevelBackground } from './map-art';
import { addTurretFrames } from './turret-art';

export * from './frames';
export { turretColors, TURRET_SIZE } from './turret-art';
export { goblinColors, hexToInt, obstacleColors, palette, themeColors } from './palette';

const MAP_KEY = 'level-map';

function register(
  textures: Phaser.Textures.TextureManager,
  key: string,
  atlas: AtlasBuilder,
): void {
  const texture = textures.addCanvas(key, atlas.canvas);
  if (!texture) throw new Error(`Failed to register the generated texture "${key}"`);
  for (const frame of atlas.frames) {
    texture.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
  }
}

export function generateArt(textures: Phaser.Textures.TextureManager): void {
  if (!textures.exists(ATLAS_KEY)) {
    const atlas = new AtlasBuilder(1024);
    addGoblinFrames(atlas);
    addFxFrames(atlas);
    addTurretFrames(atlas);
    register(textures, ATLAS_KEY, atlas);
  }
  if (!textures.exists(PORTRAIT_KEY)) {
    const portraits = new AtlasBuilder(1024, 512);
    addGoblinPortraits(portraits);
    register(textures, PORTRAIT_KEY, portraits);
  }
}

export function generateLevelMap(
  textures: Phaser.Textures.TextureManager,
  level: LevelData,
): string {
  if (textures.exists(MAP_KEY)) textures.remove(MAP_KEY);
  const canvas = document.createElement('canvas');
  canvas.width = mapWidth(level);
  canvas.height = mapHeight(level);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  drawLevelBackground(ctx, level);
  textures.addCanvas(MAP_KEY, canvas);
  return MAP_KEY;
}
