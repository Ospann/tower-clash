import { TURRET_KINDS, type TurretKind } from '../balance';
import type { AtlasBuilder } from './atlas-builder';
import { Frame, turretFrame } from './frames';
import { palette } from './palette';

export const TURRET_SIZE = 64;

export const turretColors: Readonly<
  Record<TurretKind, { main: string; dark: string; glow: string }>
> = {
  ballista: { main: '#c98f4a', dark: '#7d5324', glow: '#ffe7a3' },
  mortar: { main: '#6d7f8c', dark: '#3f4d57', glow: '#ffb35c' },
  gatling: { main: '#8f9aa3', dark: '#4d565e', glow: '#fff1a8' },
  tar: { main: '#b0563a', dark: '#6e2f1d', glow: '#ff8c42' },
  tesla: { main: '#5c7cfa', dark: '#3147a8', glow: '#9be7ff' },
  beam: { main: '#c0496f', dark: '#7a2643', glow: '#ff9ec4' },
};

function line(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = palette.outline;
  ctx.stroke();
}

type Draw = (ctx: CanvasRenderingContext2D, c: number) => void;

const heads: Readonly<Record<TurretKind, Draw>> = {
  ballista: (ctx, c) => {
    const col = turretColors.ballista;
    ctx.beginPath();
    ctx.roundRect(c - 20, c - 5, 40, 10, 4);
    ctx.fillStyle = col.main;
    ctx.fill();
    line(ctx);
    ctx.beginPath();
    ctx.moveTo(c + 6, c - 24);
    ctx.quadraticCurveTo(c + 24, c, c + 6, c + 24);
    ctx.lineWidth = 6;
    ctx.strokeStyle = palette.outline;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = col.dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c + 6, c - 24);
    ctx.lineTo(c - 12, c);
    ctx.lineTo(c + 6, c + 24);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.white;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - 12, c);
    ctx.lineTo(c + 26, c);
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.woodDark;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c + 31, c);
    ctx.lineTo(c + 23, c - 4);
    ctx.lineTo(c + 23, c + 4);
    ctx.closePath();
    ctx.fillStyle = palette.white;
    ctx.fill();
  },
  mortar: (ctx, c) => {
    const col = turretColors.mortar;
    ctx.beginPath();
    ctx.roundRect(c - 16, c - 15, 34, 30, 9);
    ctx.fillStyle = col.main;
    ctx.fill();
    line(ctx);
    ctx.beginPath();
    ctx.ellipse(c + 12, c, 9, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = col.dark;
    ctx.fill();
    line(ctx);
    ctx.beginPath();
    ctx.ellipse(c + 13, c, 5, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#12161a';
    ctx.fill();
    ctx.fillStyle = col.dark;
    ctx.fillRect(c - 8, c - 15, 4, 30);
  },
  gatling: (ctx, c) => {
    const col = turretColors.gatling;
    for (const offset of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.roundRect(c - 2, c + offset - 2.5, 30, 5, 2);
      ctx.fillStyle = col.dark;
      ctx.fill();
      line(ctx, 1.5);
    }
    ctx.beginPath();
    ctx.roundRect(c - 18, c - 13, 24, 26, 6);
    ctx.fillStyle = col.main;
    ctx.fill();
    line(ctx);
    ctx.beginPath();
    ctx.roundRect(c + 16, c - 11, 5, 22, 2);
    ctx.fillStyle = palette.gold;
    ctx.fill();
    line(ctx, 1.5);
  },
  tar: (ctx, c) => {
    const col = turretColors.tar;
    ctx.beginPath();
    ctx.moveTo(c - 18, c);
    ctx.lineTo(c + 12, c);
    ctx.lineWidth = 9;
    ctx.strokeStyle = palette.outline;
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = palette.wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c + 16, c, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#34383d';
    ctx.fill();
    line(ctx);
    ctx.beginPath();
    ctx.arc(c + 16, c, 8, 0, Math.PI * 2);
    ctx.fillStyle = col.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(c - 22, c - 12, 8, 24, 3);
    ctx.fillStyle = col.main;
    ctx.fill();
    line(ctx);
  },
  tesla: (ctx, c) => {
    const col = turretColors.tesla;
    for (const radius of [22, 15]) {
      ctx.beginPath();
      ctx.arc(c, c, radius, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = palette.outline;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = radius === 22 ? col.main : palette.gold;
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(c, c, 1, c, c, 14);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.5, col.glow);
    glow.addColorStop(1, 'rgba(155,231,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c, c, 14, 0, Math.PI * 2);
    ctx.fill();
  },
  beam: (ctx, c) => {
    const col = turretColors.beam;
    ctx.beginPath();
    ctx.roundRect(c - 18, c - 9, 36, 18, 7);
    ctx.fillStyle = col.main;
    ctx.fill();
    line(ctx);
    ctx.fillStyle = col.dark;
    ctx.fillRect(c - 8, c - 9, 5, 18);
    ctx.fillRect(c + 2, c - 9, 5, 18);
    ctx.beginPath();
    ctx.moveTo(c + 16, c - 8);
    ctx.lineTo(c + 30, c);
    ctx.lineTo(c + 16, c + 8);
    ctx.closePath();
    ctx.fillStyle = col.glow;
    ctx.fill();
    line(ctx, 2);
  },
};

export function addTurretFrames(atlas: AtlasBuilder): void {
  const c = TURRET_SIZE / 2;
  atlas.add(Frame.TurretBase, TURRET_SIZE, TURRET_SIZE, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(c + 2, c + 5, 27, 25, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.shadow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 26, 0, Math.PI * 2);
    ctx.fillStyle = palette.stone;
    ctx.fill();
    line(ctx, 3);
    ctx.beginPath();
    ctx.arc(c, c, 18, 0, Math.PI * 2);
    ctx.fillStyle = palette.stoneDark;
    ctx.fill();
    for (let bolt = 0; bolt < 6; bolt += 1) {
      const angle = (bolt / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(angle) * 22, c + Math.sin(angle) * 22, 2, 0, Math.PI * 2);
      ctx.fillStyle = palette.stoneLight;
      ctx.fill();
    }
  });
  for (const kind of TURRET_KINDS) {
    atlas.add(turretFrame(kind), TURRET_SIZE, TURRET_SIZE, (ctx) => heads[kind](ctx, c));
  }
  atlas.add(Frame.Handle, 52, 52, (ctx) => {
    ctx.beginPath();
    ctx.arc(26, 26, 22, 0, Math.PI * 2);
    ctx.fillStyle = palette.white;
    ctx.fill();
    line(ctx, 3);
    ctx.beginPath();
    ctx.arc(26, 26, 11, Math.PI * 0.2, Math.PI * 1.6);
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(26 + 11, 26 - 12);
    ctx.lineTo(26 + 13, 26 - 1);
    ctx.lineTo(26 + 2, 26 - 5);
    ctx.closePath();
    ctx.fillStyle = palette.outline;
    ctx.fill();
  });
  atlas.add(Frame.Remove, 48, 48, (ctx) => {
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, Math.PI * 2);
    ctx.fillStyle = palette.danger;
    ctx.fill();
    line(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(15, 15);
    ctx.lineTo(33, 33);
    ctx.moveTo(33, 15);
    ctx.lineTo(15, 33);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.white;
    ctx.stroke();
  });
}
