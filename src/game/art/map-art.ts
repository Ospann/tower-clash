import type { LevelData, Obstacle, Rect } from '../levels/level-types';
import { mapHeight, mapWidth } from '../levels/level-types';
import { createRng, type Rng } from '../sim/rng';
import { entryOutward } from '../sim/world';
import { obstacleColors, palette, themeColors, type ThemeColors } from './palette';

function trace(ctx: CanvasRenderingContext2D, obstacle: Obstacle, grow = 0): void {
  const shape = obstacle.shape;
  ctx.beginPath();
  if (shape.kind === 'rect') {
    const radius = obstacle.type === 'cliff' ? 6 : 14;
    ctx.roundRect(shape.x - grow, shape.y - grow, shape.w + grow * 2, shape.h + grow * 2, radius);
    return;
  }
  if (shape.kind === 'circle') {
    ctx.arc(shape.x, shape.y, shape.r + grow, 0, Math.PI * 2);
    return;
  }
  shape.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function bounds(obstacle: Obstacle): Rect {
  const shape = obstacle.shape;
  if (shape.kind === 'rect') return shape;
  if (shape.kind === 'circle') {
    return { x: shape.x - shape.r, y: shape.y - shape.r, w: shape.r * 2, h: shape.r * 2 };
  }
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function scatter(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  rng: Rng,
  step: number,
  draw: (x: number, y: number) => void,
): void {
  const box = bounds(obstacle);
  ctx.save();
  trace(ctx, obstacle);
  ctx.clip();
  for (let y = box.y; y < box.y + box.h + step; y += step) {
    for (let x = box.x; x < box.x + box.w + step; x += step) {
      draw(x + (rng() - 0.5) * step * 0.7, y + (rng() - 0.5) * step * 0.7);
    }
  }
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, rng: Rng): void {
  const colors = obstacleColors[obstacle.type];
  ctx.lineJoin = 'round';

  if (obstacle.type !== 'water') {
    ctx.save();
    ctx.translate(5, 7);
    trace(ctx, obstacle);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    ctx.restore();
  }

  trace(ctx, obstacle);
  ctx.fillStyle = colors.fill;
  ctx.fill();

  if (obstacle.type === 'water') {
    scatter(ctx, obstacle, rng, 38, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.quadraticCurveTo(x - 4, y - 4, x, y);
      ctx.quadraticCurveTo(x + 4, y + 4, x + 9, y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.light;
      ctx.stroke();
    });
    trace(ctx, obstacle);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.dark;
    ctx.stroke();
    return;
  }

  if (obstacle.type === 'forest') {
    scatter(ctx, obstacle, rng, 26, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = rng() > 0.5 ? colors.light : colors.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.dark;
      ctx.stroke();
    });
  } else if (obstacle.type === 'rock') {
    scatter(ctx, obstacle, rng, 34, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 6);
      ctx.lineTo(x - 3, y - 8);
      ctx.lineTo(x + 9, y - 3);
      ctx.lineTo(x + 11, y + 7);
      ctx.closePath();
      ctx.fillStyle = rng() > 0.5 ? colors.light : colors.dark;
      ctx.fill();
    });
  } else {
    scatter(ctx, obstacle, rng, 30, (x, y) => {
      ctx.fillStyle = rng() > 0.5 ? colors.light : colors.dark;
      ctx.fillRect(x - 11, y - 7, 22, 14);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = palette.outline;
      ctx.strokeRect(x - 11, y - 7, 22, 14);
    });
  }
  trace(ctx, obstacle);
  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.outline;
  ctx.stroke();
}

const FACE = 14;
const SHADOW = 8;
const OUTLINE = 3;

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return [canvas, ctx];
}

function tinted(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(mask.width, mask.height);
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  pools: readonly Obstacle[],
  rng: Rng,
  width: number,
  height: number,
): void {
  if (pools.length === 0) return;
  const colors = obstacleColors.water;
  const [mask, maskCtx] = makeCanvas(width, height);
  maskCtx.fillStyle = '#ffffff';
  for (const pool of pools) {
    trace(maskCtx, { ...pool, type: 'cliff' });
    maskCtx.fill();
  }
  const shore = tinted(mask, 'rgba(255, 255, 255, 0.45)');
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx !== 0 || dy !== 0) ctx.drawImage(shore, dx * 5, dy * 5);
    }
  }
  const rim = tinted(mask, colors.dark);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx !== 0 || dy !== 0) ctx.drawImage(rim, dx * 2, dy * 2);
    }
  }
  const [surface, surfaceCtx] = makeCanvas(width, height);
  surfaceCtx.fillStyle = colors.fill;
  surfaceCtx.fillRect(0, 0, width, height);
  surfaceCtx.strokeStyle = colors.light;
  surfaceCtx.lineWidth = 2;
  for (let y = 10; y < height; y += 38) {
    for (let x = (y / 38) % 2 === 0 ? 10 : 29; x < width; x += 38) {
      const wx = x + (rng() - 0.5) * 18;
      const wy = y + (rng() - 0.5) * 18;
      surfaceCtx.beginPath();
      surfaceCtx.moveTo(wx - 9, wy);
      surfaceCtx.quadraticCurveTo(wx - 4, wy - 4, wx, wy);
      surfaceCtx.quadraticCurveTo(wx + 4, wy + 4, wx + 9, wy);
      surfaceCtx.stroke();
    }
  }
  surfaceCtx.globalCompositeOperation = 'destination-in';
  surfaceCtx.drawImage(mask, 0, 0);
  ctx.drawImage(surface, 0, 0);
}

function drawCliffs(
  ctx: CanvasRenderingContext2D,
  cliffs: readonly Obstacle[],
  colors: ThemeColors,
  rng: Rng,
  width: number,
  height: number,
): void {
  if (cliffs.length === 0) return;
  const [mask, maskCtx] = makeCanvas(width, height);
  maskCtx.fillStyle = '#ffffff';
  for (const cliff of cliffs) {
    trace(maskCtx, cliff);
    maskCtx.fill();
  }

  const shadow = tinted(mask, 'rgba(20, 16, 8, 0.28)');
  ctx.drawImage(shadow, SHADOW, FACE + SHADOW);

  const outline = tinted(mask, palette.outline);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      ctx.drawImage(outline, dx * OUTLINE, dy * OUTLINE);
      ctx.drawImage(outline, dx * OUTLINE, FACE + dy * OUTLINE);
    }
  }
  const face = tinted(mask, colors.plateauFace);
  for (let offset = 1; offset <= FACE; offset += 1) ctx.drawImage(face, 0, offset);

  const [top, topCtx] = makeCanvas(width, height);
  topCtx.fillStyle = colors.plateau;
  topCtx.fillRect(0, 0, width, height);
  for (let i = 0; i < 90; i += 1) {
    topCtx.globalAlpha = 0.45;
    topCtx.fillStyle = rng() > 0.5 ? colors.plateauDark : colors.plateauLight;
    topCtx.beginPath();
    topCtx.ellipse(
      rng() * width,
      rng() * height,
      24 + rng() * 40,
      14 + rng() * 22,
      rng() * Math.PI,
      0,
      Math.PI * 2,
    );
    topCtx.fill();
  }
  topCtx.globalAlpha = 1;
  topCtx.strokeStyle = colors.plateauDark;
  topCtx.lineWidth = 2;
  for (let i = 0; i < 420; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    for (const lean of [-0.5, 0, 0.5]) {
      topCtx.beginPath();
      topCtx.moveTo(x + lean * 3, y + 3);
      topCtx.lineTo(x + lean * 7, y - 4);
      topCtx.stroke();
    }
  }
  topCtx.globalCompositeOperation = 'destination-in';
  topCtx.drawImage(mask, 0, 0);
  ctx.drawImage(top, 0, 0);

  const rim = tinted(mask, colors.plateauLight);
  const [edge, edgeCtx] = makeCanvas(width, height);
  edgeCtx.drawImage(rim, 0, 0);
  edgeCtx.globalCompositeOperation = 'destination-out';
  edgeCtx.drawImage(mask, 0, 3);
  ctx.globalAlpha = 0.8;
  ctx.drawImage(edge, 0, 0);
  ctx.globalAlpha = 1;
}

function drawZone(ctx: CanvasRenderingContext2D, zone: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.x, zone.y, zone.w, zone.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(214, 60, 44, 0.38)';
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(214, 60, 44, 0.3)';
  for (let x = zone.x - zone.h; x < zone.x + zone.w; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, zone.y + zone.h);
    ctx.lineTo(x + zone.h, zone.y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = palette.danger;
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(zone.x + 2, zone.y + 2, zone.w - 4, zone.h - 4);
  ctx.setLineDash([]);
}

export function drawLevelBackground(ctx: CanvasRenderingContext2D, level: LevelData): void {
  const width = mapWidth(level);
  const height = mapHeight(level);
  const colors = themeColors[level.tiles];
  let seed = 7;
  for (const char of level.id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const rng = createRng(seed);

  ctx.fillStyle = colors.land;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 70; i += 1) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = rng() > 0.5 ? colors.landDark : colors.landLight;
    ctx.beginPath();
    ctx.ellipse(
      rng() * width,
      rng() * height,
      30 + rng() * 50,
      16 + rng() * 26,
      rng() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.speck;
  for (let i = 0; i < 360; i += 1) {
    ctx.globalAlpha = 0.35 + rng() * 0.4;
    ctx.beginPath();
    ctx.ellipse(
      rng() * width,
      rng() * height,
      1.5 + rng() * 2.5,
      1 + rng() * 1.6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawWater(
    ctx,
    level.obstacles.filter((obstacle) => obstacle.type === 'water'),
    rng,
    width,
    height,
  );
  drawCliffs(
    ctx,
    level.obstacles.filter((obstacle) => obstacle.type === 'cliff'),
    colors,
    rng,
    width,
    height,
  );
  for (const zone of level.zones) drawZone(ctx, zone);

  for (const entry of level.entries) {
    const out = entryOutward(entry, width, height);
    const inward = Math.atan2(-out.y, -out.x);
    ctx.save();
    ctx.translate(entry.x - out.x * 34, entry.y - out.y * 34);
    ctx.rotate(inward);
    for (let chevron = 0; chevron < 3; chevron += 1) {
      ctx.globalAlpha = 0.75 - chevron * 0.2;
      ctx.beginPath();
      ctx.moveTo(-22 + chevron * 20, -entry.radius * 0.7);
      ctx.lineTo(-4 + chevron * 20, 0);
      ctx.lineTo(-22 + chevron * 20, entry.radius * 0.7);
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = palette.danger;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const order = { cliff: -1, water: 0, ruins: 1, rock: 2, forest: 3 } as const;
  const sorted = level.obstacles
    .filter((obstacle) => obstacle.type !== 'cliff' && obstacle.type !== 'water')
    .toSorted((a, b) => order[a.type] - order[b.type]);
  for (const obstacle of sorted) drawObstacle(ctx, obstacle, rng);
}
