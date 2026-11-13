import type { AtlasBuilder } from './atlas-builder';
import { Frame, splatFrame } from './frames';
import { palette } from './palette';

function stroke(ctx: CanvasRenderingContext2D, width = 2): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = palette.outline;
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : outer * 0.46;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function addFxFrames(atlas: AtlasBuilder): void {
  for (let variant = 0; variant < 3; variant += 1) {
    atlas.add(splatFrame(variant), 30, 22, (ctx) => {
      ctx.fillStyle = '#ffffff';
      const blobs = [
        [15, 11, 9, 6],
        [7 + variant * 2, 8, 4, 3],
        [22 - variant, 14, 5, 3.5],
        [12 + variant * 3, 17, 3, 2],
        [24, 6 + variant, 2.5, 2],
      ] as const;
      for (const [x, y, rx, ry] of blobs) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, variant * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  atlas.add(Frame.Shadow, 28, 14, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(14, 7, 13, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 16, 10, 0.32)';
    ctx.fill();
  });
  atlas.add(Frame.Dot, 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  atlas.add(Frame.Spark, 8, 8, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  atlas.add(Frame.Ring, 96, 96, (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 48, 42, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
  atlas.add(Frame.Smoke, 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  atlas.add(Frame.Flame, 20, 26, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(10, 1);
    ctx.quadraticCurveTo(19, 12, 16, 20);
    ctx.quadraticCurveTo(10, 27, 4, 20);
    ctx.quadraticCurveTo(1, 12, 10, 1);
    ctx.fillStyle = palette.fire;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 9);
    ctx.quadraticCurveTo(15, 16, 13, 21);
    ctx.quadraticCurveTo(10, 24, 7, 21);
    ctx.quadraticCurveTo(5, 16, 10, 9);
    ctx.fillStyle = palette.fireHot;
    ctx.fill();
  });
  atlas.add(Frame.Puddle, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    g.addColorStop(0, 'rgba(43,34,51,0.85)');
    g.addColorStop(0.75, 'rgba(43,34,51,0.7)');
    g.addColorStop(1, 'rgba(43,34,51,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,140,66,0.35)';
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34, 7 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  atlas.add(Frame.Target, 96, 96, (ctx) => {
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(48, 48, 42, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });

  atlas.add(Frame.Arrow, 20, 6, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(1, 3);
    ctx.lineTo(15, 3);
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.woodDark;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, 3);
    ctx.lineTo(13, 0.5);
    ctx.lineTo(13, 5.5);
    ctx.closePath();
    ctx.fillStyle = palette.white;
    ctx.fill();
  });
  atlas.add(Frame.Ball, 14, 14, (ctx) => {
    ctx.beginPath();
    ctx.arc(7, 7, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2f3438';
    ctx.fill();
    stroke(ctx, 1.5);
    ctx.beginPath();
    ctx.arc(5.5, 5.5, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  });
  atlas.add(Frame.Flask, 14, 16, (ctx) => {
    ctx.beginPath();
    ctx.arc(7, 10, 5, 0, Math.PI * 2);
    ctx.fillStyle = palette.fire;
    ctx.fill();
    stroke(ctx, 1.5);
    ctx.fillStyle = palette.woodDark;
    ctx.fillRect(5, 1, 4, 5);
  });
  atlas.add(Frame.Bomb, 22, 28, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(11, 16, 8, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2f3438';
    ctx.fill();
    stroke(ctx, 2);
    ctx.fillStyle = palette.danger;
    ctx.fillRect(6, 2, 10, 5);
    ctx.beginPath();
    ctx.arc(8, 12, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  });

  atlas.add(Frame.Slot, 76, 76, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(38, 42, 34, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(38, 38, 34, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.stone;
    ctx.fill();
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.ellipse(38, 38, 24, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.stoneDark;
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = palette.stoneLight;
    ctx.stroke();
  });

  atlas.add(Frame.Gold, 36, 36, (ctx) => {
    ctx.beginPath();
    ctx.arc(18, 18, 15, 0, Math.PI * 2);
    ctx.fillStyle = palette.gold;
    ctx.fill();
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.arc(18, 18, 9, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = palette.goldDark;
    ctx.stroke();
  });
  atlas.add(Frame.Crystal, 36, 40, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(18, 3);
    ctx.lineTo(32, 15);
    ctx.lineTo(18, 37);
    ctx.lineTo(4, 15);
    ctx.closePath();
    ctx.fillStyle = palette.crystal;
    ctx.fill();
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(18, 3);
    ctx.lineTo(24, 15);
    ctx.lineTo(18, 37);
    ctx.lineTo(12, 15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  });
  atlas.add(Frame.Heart, 38, 36, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(19, 32);
    ctx.bezierCurveTo(-4, 16, 6, -2, 19, 10);
    ctx.bezierCurveTo(32, -2, 42, 16, 19, 32);
    ctx.fillStyle = palette.danger;
    ctx.fill();
    stroke(ctx, 3);
  });
  atlas.add(Frame.Star, 56, 56, (ctx) => {
    star(ctx, 28, 30, 24);
    ctx.fillStyle = palette.gold;
    ctx.fill();
    stroke(ctx, 3);
  });
  atlas.add(Frame.StarEmpty, 56, 56, (ctx) => {
    star(ctx, 28, 30, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    stroke(ctx, 3);
  });
  atlas.add(Frame.Lock, 44, 52, (ctx) => {
    ctx.beginPath();
    ctx.arc(22, 20, 11, Math.PI, 0);
    ctx.lineWidth = 6;
    ctx.strokeStyle = palette.stoneLight;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(6, 20, 32, 28, 6);
    ctx.fillStyle = palette.stone;
    ctx.fill();
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.arc(22, 32, 4, 0, Math.PI * 2);
    ctx.fillStyle = palette.outline;
    ctx.fill();
  });
  atlas.add(Frame.BombIcon, 56, 56, (ctx) => {
    ctx.beginPath();
    ctx.arc(26, 32, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#2f3438';
    ctx.fill();
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(36, 18);
    ctx.quadraticCurveTo(44, 8, 50, 12);
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, 11, 5, 0, Math.PI * 2);
    ctx.fillStyle = palette.fireHot;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, 26, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
  });
  atlas.add(Frame.Pause, 40, 40, (ctx) => {
    ctx.fillStyle = palette.white;
    ctx.beginPath();
    ctx.roundRect(8, 6, 9, 28, 3);
    ctx.roundRect(23, 6, 9, 28, 3);
    ctx.fill();
  });
}
