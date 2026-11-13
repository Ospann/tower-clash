import type { LevelData, Obstacle, Rect } from '../levels/level-types';
import { mapHeight, mapWidth } from '../levels/level-types';
import { layout } from '../config';
import { createRng, type Rng } from '../sim/rng';
import { entryOutward } from '../sim/world';
import { obstacleColors, palette, themeColors } from './palette';

function trace(ctx: CanvasRenderingContext2D, obstacle: Obstacle, grow = 0): void {
  const shape = obstacle.shape;
  ctx.beginPath();
  if (shape.kind === 'rect') {
    ctx.roundRect(shape.x - grow, shape.y - grow, shape.w + grow * 2, shape.h + grow * 2, 14);
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
  ctx.strokeStyle = colors.speck;
  ctx.lineWidth = 2;
  for (let i = 0; i < 160; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    for (const lean of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(x + lean * 4, y + 4);
      ctx.lineTo(x + lean * 9, y - 5);
      ctx.stroke();
    }
  }

  for (const zone of level.zones) drawZone(ctx, zone);

  for (const entry of level.entries) {
    const out = entryOutward(entry, width, height);
    const inward = Math.atan2(-out.y, -out.x);
    const hud = out.y < 0 ? layout.hudHeight : 0;
    ctx.save();
    ctx.translate(entry.x - out.x * (hud + 34), entry.y - out.y * (hud + 34));
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

  const order = { water: 0, ruins: 1, rock: 2, forest: 3 } as const;
  const sorted = level.obstacles.toSorted((a, b) => order[a.type] - order[b.type]);
  for (const obstacle of sorted) drawObstacle(ctx, obstacle, rng);
}
