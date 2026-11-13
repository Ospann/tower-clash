import type Phaser from 'phaser';
import type { LevelData } from '../levels/level-types';
import { mapHeight, mapWidth } from '../levels/level-types';
import { AtlasBuilder } from './atlas-builder';
import { TURRET_KINDS } from '../balance';
import { ATLAS_KEY, Frame, PORTRAIT_KEY, turretFrame } from './frames';
import { addFxFrames } from './fx-art';
import { addGoblinFrames, addGoblinPortraits } from './goblin-art';
import { drawLevelBackground } from './map-art';
import { addTurretFrames } from './turret-art';

export * from './frames';
export { turretColors, TURRET_SIZE } from './turret-art';
export { goblinColors, hexToInt, obstacleColors, palette, themeColors } from './palette';

const MAP_KEY = 'level-map';
export const UI_KEY = 'ui-hd';
export const UI_RATIO = 2;
const UI_FRAMES: readonly string[] = [
  Frame.Gold,
  Frame.Crystal,
  Frame.Heart,
  Frame.Star,
  Frame.StarEmpty,
  Frame.Lock,
  Frame.BombIcon,
  Frame.Pause,
  Frame.TurretBase,
  Frame.Handle,
  Frame.Remove,
];

export function uiImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: string,
  scale = 1,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, UI_KEY, frame).setScale(scale / UI_RATIO);
}
export const MAP_THUMB_KEY = 'level-map-thumb';
const THUMB_SIZE = 320;

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
  if (!textures.exists(UI_KEY)) {
    const frames = new Set<string>([
      ...UI_FRAMES,
      ...TURRET_KINDS.map((kind) => turretFrame(kind)),
    ]);
    const ui = new AtlasBuilder(1024, 512, UI_RATIO, frames);
    addFxFrames(ui);
    addTurretFrames(ui);
    register(textures, UI_KEY, ui);
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
  if (textures.exists(MAP_THUMB_KEY)) textures.remove(MAP_THUMB_KEY);
  const ratio = THUMB_SIZE / Math.max(canvas.width, canvas.height);
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(canvas.width * ratio));
  thumb.height = Math.max(1, Math.round(canvas.height * ratio));
  const thumbCtx = thumb.getContext('2d');
  if (thumbCtx) {
    thumbCtx.imageSmoothingQuality = 'high';
    thumbCtx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  }
  textures.addCanvas(MAP_THUMB_KEY, thumb);
  return MAP_KEY;
}

export const BACKDROP_KEY = 'menu-backdrop';

export function generateBackdrop(
  textures: Phaser.Textures.TextureManager,
  level: LevelData,
): string {
  if (textures.exists(BACKDROP_KEY)) return BACKDROP_KEY;
  const full = document.createElement('canvas');
  full.width = mapWidth(level);
  full.height = mapHeight(level);
  const ctx = full.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  drawLevelBackground(ctx, level);
  const half = document.createElement('canvas');
  half.width = Math.round(full.width / 2);
  half.height = Math.round(full.height / 2);
  const halfCtx = half.getContext('2d');
  if (halfCtx) {
    halfCtx.imageSmoothingQuality = 'high';
    halfCtx.drawImage(full, 0, 0, half.width, half.height);
  }
  textures.addCanvas(BACKDROP_KEY, half);
  return BACKDROP_KEY;
}
