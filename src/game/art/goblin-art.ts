import { GOBLIN_KINDS, type GoblinKind } from '../balance';
import type { AtlasBuilder } from './atlas-builder';
import { corpseFrame, goblinFrame, PORTRAIT_BOX, portraitFrame, type WalkStep } from './frames';
import { goblinColors, palette, type GoblinColors } from './palette';

type Gear = 'none' | 'bandana' | 'shield' | 'club' | 'glider' | 'staff' | 'crown';

interface GoblinLook {
  head: number;
  ear: number;
  gear: Gear;
  angry: boolean;
}

const looks: Readonly<Record<GoblinKind, GoblinLook>> = {
  grunt: { head: 7, ear: 7, gear: 'none', angry: false },
  runner: { head: 6.5, ear: 9, gear: 'bandana', angry: false },
  shield: { head: 7.5, ear: 6, gear: 'shield', angry: false },
  brute: { head: 12, ear: 8, gear: 'club', angry: true },
  shaman: { head: 7.5, ear: 10, gear: 'staff', angry: false },
  glider: { head: 6.5, ear: 6, gear: 'glider', angry: false },
  boss: { head: 22, ear: 15, gear: 'crown', angry: true },
};

function frameSize(look: GoblinLook): { w: number; h: number } {
  return {
    w: Math.ceil(2 * (look.head + look.ear) + 12 + (look.gear === 'glider' ? look.head * 4 : 0)),
    h: Math.ceil(look.head * 3.25 + 12),
  };
}

function outline(ctx: CanvasRenderingContext2D, width: number): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = palette.outline;
  ctx.stroke();
}

function drawEar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: -1 | 1,
  look: GoblinLook,
  colors: GoblinColors,
  lift: number,
  line: number,
): void {
  const r = look.head;
  ctx.beginPath();
  ctx.moveTo(cx + side * r * 0.62, cy - r * 0.5);
  ctx.lineTo(cx + side * (r + look.ear), cy - r * 0.62 + lift);
  ctx.lineTo(cx + side * r * 0.78, cy + r * 0.34);
  ctx.closePath();
  ctx.fillStyle = colors.skin;
  ctx.fill();
  outline(ctx, line);
  ctx.beginPath();
  ctx.moveTo(cx + side * r * 0.86, cy - r * 0.32);
  ctx.lineTo(cx + side * (r + look.ear * 0.66), cy - r * 0.46 + lift);
  ctx.lineTo(cx + side * r * 0.9, cy + r * 0.1);
  ctx.closePath();
  ctx.fillStyle = colors.skinDark;
  ctx.fill();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  look: GoblinLook,
  colors: GoblinColors,
): void {
  const r = look.head;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.4, cy - r * 0.08, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = palette.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.36, cy - r * 0.02, r * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = palette.pupil;
    ctx.fill();
    if (look.angry) {
      ctx.beginPath();
      ctx.moveTo(cx + side * r * 0.75, cy - r * 0.52);
      ctx.lineTo(cx + side * r * 0.12, cy - r * 0.24);
      ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.strokeStyle = palette.outline;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.24, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.skinDark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.3, r * 0.48, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = palette.outline;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.12, cy + r * 0.72);
  ctx.lineTo(cx + r * 0.24, cy + r * 0.46);
  ctx.lineTo(cx + r * 0.36, cy + r * 0.66);
  ctx.closePath();
  ctx.fillStyle = palette.tooth;
  ctx.fill();
}

function drawGear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  bodyTop: number,
  bodyH: number,
  ground: number,
  look: GoblinLook,
  colors: GoblinColors,
  step: WalkStep,
  line: number,
): void {
  const r = look.head;
  if (look.gear === 'bandana') {
    ctx.beginPath();
    ctx.arc(cx, headY, r, Math.PI * 1.08, Math.PI * 1.92);
    ctx.lineTo(cx + r * 0.94, headY - r * 0.1);
    ctx.lineTo(cx - r * 0.94, headY - r * 0.1);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line * 0.7);
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.9, headY - r * 0.4);
    ctx.lineTo(cx + r * 1.9, headY - r * (step ? 0.9 : 0.5));
    ctx.lineTo(cx + r * 1.7, headY - r * 0.05);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.fill();
  } else if (look.gear === 'shield') {
    ctx.beginPath();
    ctx.arc(cx, headY, r * 1.02, Math.PI * 1.1, Math.PI * 1.9);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line * 0.8);
    const sy = bodyTop + bodyH * 0.55;
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, sy, r * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line);
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, sy, r * 0.58, 0, Math.PI * 2);
    ctx.lineWidth = line * 0.8;
    ctx.strokeStyle = colors.accentDark;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, sy, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = palette.white;
    ctx.fill();
  } else if (look.gear === 'club') {
    const hx = cx + r * 0.9;
    const hy = bodyTop + bodyH * 0.4;
    const tx = hx + r * 0.55;
    const ty = hy - r * (step ? 1.5 : 1.3);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.lineWidth = r * 0.42;
    ctx.strokeStyle = palette.outline;
    ctx.stroke();
    ctx.lineWidth = r * 0.26;
    ctx.strokeStyle = palette.wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line);
  } else if (look.gear === 'glider') {
    const span = r * 3.6;
    const lift = step ? -1.5 : 1.5;
    const tail = headY - r * 1.75 + lift;
    const nose = headY - r * 0.8 + lift;
    const notch = tail + r * 0.32;
    const handY = bodyTop + bodyH * 0.45;
    ctx.lineWidth = line * 0.9;
    ctx.strokeStyle = palette.outline;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + side * r * 1.35, tail + (nose - tail) * 0.6);
      ctx.lineTo(cx + side * r * 0.85, handY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, nose);
    ctx.lineTo(cx + span, tail);
    ctx.lineTo(cx + span * 0.5, notch);
    ctx.lineTo(cx, tail);
    ctx.lineTo(cx - span * 0.5, notch);
    ctx.lineTo(cx - span, tail);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line);
    ctx.beginPath();
    ctx.moveTo(cx, tail);
    ctx.lineTo(cx, nose);
    ctx.moveTo(cx + span * 0.5, notch);
    ctx.lineTo(cx + r * 0.4, nose - r * 0.1);
    ctx.moveTo(cx - span * 0.5, notch);
    ctx.lineTo(cx - r * 0.4, nose - r * 0.1);
    ctx.lineWidth = line * 0.8;
    ctx.strokeStyle = colors.accentDark;
    ctx.stroke();
  } else if (look.gear === 'staff') {
    const sx = cx + r * 1.25;
    ctx.beginPath();
    ctx.moveTo(sx, ground);
    ctx.lineTo(sx, headY - r * 1.05);
    ctx.lineWidth = line * 1.6;
    ctx.strokeStyle = palette.woodDark;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, headY - r * 1.2, r * (step ? 0.46 : 0.38), 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    outline(ctx, line * 0.8);
    for (const offset of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(cx + r * (offset - 0.18), headY - r * 0.9);
      ctx.lineTo(cx + r * offset * 1.5, headY - r * 1.75);
      ctx.lineTo(cx + r * (offset + 0.18), headY - r * 0.9);
      ctx.closePath();
      ctx.fillStyle = offset === 0 ? palette.white : colors.accent;
      ctx.fill();
      outline(ctx, line * 0.6);
    }
  } else if (look.gear === 'crown') {
    const top = headY - r * 1.5;
    const baseY = headY - r * 0.82;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, baseY);
    ctx.lineTo(cx - r * 0.78, top);
    ctx.lineTo(cx - r * 0.36, top + r * 0.34);
    ctx.lineTo(cx, top - r * 0.12);
    ctx.lineTo(cx + r * 0.36, top + r * 0.34);
    ctx.lineTo(cx + r * 0.78, top);
    ctx.lineTo(cx + r * 0.7, baseY);
    ctx.closePath();
    ctx.fillStyle = palette.gold;
    ctx.fill();
    outline(ctx, line);
    ctx.beginPath();
    ctx.arc(cx, top + r * 0.42, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    const hx = cx + r * 1.05;
    const hy = bodyTop + bodyH * 0.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + r * 0.4, hy - r * (step ? 1.25 : 1.1));
    ctx.lineWidth = r * 0.3;
    ctx.strokeStyle = palette.outline;
    ctx.stroke();
    ctx.lineWidth = r * 0.18;
    ctx.strokeStyle = palette.wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx + r * 0.4, hy - r * (step ? 1.25 : 1.1), r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = palette.stoneDark;
    ctx.fill();
    outline(ctx, line);
  }
}

function drawGoblin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: GoblinLook,
  colors: GoblinColors,
  step: WalkStep,
): void {
  const r = look.head;
  const line = Math.max(1.4, r * 0.16);
  const cx = w / 2;
  const ground = h - 4;
  const bodyH = r * 0.95;
  const bodyW = r * 1.3;
  const bodyTop = ground - bodyH - 1;
  const headY = bodyTop - r * 0.7 + (step ? 1 : 0);

  const airborne = look.gear === 'glider';
  if (!airborne) {
    ctx.beginPath();
    ctx.ellipse(cx, ground + 1, r * 1.15, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.shadow;
    ctx.fill();

    for (const side of [-1, 1] as const) {
      const lifted = (side === -1) === (step === 0);
      ctx.beginPath();
      ctx.ellipse(
        cx + side * bodyW * 0.32,
        ground - (lifted ? r * 0.22 : 0),
        r * 0.36,
        r * 0.24,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = colors.skinDark;
      ctx.fill();
      outline(ctx, line * 0.7);
    }
  } else {
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.ellipse(
        cx + side * bodyW * 0.3,
        ground + 1,
        r * 0.22,
        r * 0.4,
        side * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = colors.skinDark;
      ctx.fill();
      outline(ctx, line * 0.7);
    }
  }

  ctx.beginPath();
  ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyH, r * 0.3);
  ctx.fillStyle = look.gear === 'shield' ? colors.accentDark : colors.accent;
  ctx.fill();
  outline(ctx, line);
  ctx.fillStyle = colors.accentDark;
  ctx.fillRect(cx - bodyW / 2 + line, bodyTop + bodyH * 0.62, bodyW - line * 2, bodyH * 0.16);

  for (const side of [-1, 1] as const) {
    const swing = (side === -1) === (step === 0) ? -r * 0.12 : r * 0.12;
    ctx.beginPath();
    ctx.arc(cx + side * bodyW * 0.62, bodyTop + bodyH * 0.45 + swing, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = colors.skin;
    ctx.fill();
    outline(ctx, line * 0.7);
  }

  drawEar(ctx, cx, headY, -1, look, colors, step ? 1 : -1, line);
  drawEar(ctx, cx, headY, 1, look, colors, step ? -1 : 1, line);

  ctx.beginPath();
  ctx.arc(cx, headY, r, 0, Math.PI * 2);
  ctx.fillStyle = colors.skin;
  ctx.fill();
  outline(ctx, line);
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, headY - r * 0.38, r * 0.42, Math.PI * 1.05, Math.PI * 1.75);
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = colors.skinLight;
  ctx.stroke();

  drawFace(ctx, cx, headY, look, colors);
  drawGear(ctx, cx, headY, bodyTop, bodyH, ground, look, colors, step, line);
}

function drawCorpse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: GoblinLook,
  colors: GoblinColors,
): void {
  const r = look.head;
  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.2, r * 1.5, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.skinDark;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.skin;
  ctx.fill();
  outline(ctx, Math.max(1.2, r * 0.14));
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = palette.outline;
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.4;
    const s = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(ex - s, cy - s);
    ctx.lineTo(ex + s, cy + s);
    ctx.moveTo(ex + s, cy - s);
    ctx.lineTo(ex - s, cy + s);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.9, cy + r * 0.25, r * 0.4, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.accent;
  ctx.fill();
}

export function addGoblinFrames(atlas: AtlasBuilder): void {
  for (const kind of GOBLIN_KINDS) {
    const look = looks[kind];
    const colors = goblinColors[kind];
    const { w, h } = frameSize(look);
    for (const step of [0, 1] as const) {
      atlas.add(goblinFrame(kind, step), w, h, (ctx) => drawGoblin(ctx, w, h, look, colors, step));
    }
    const cw = Math.ceil(look.head * 3.4 + 4);
    const ch = Math.ceil(look.head * 1.9 + 4);
    atlas.add(corpseFrame(kind), cw, ch, (ctx) => drawCorpse(ctx, cw, ch, look, colors));
  }
}

export function addGoblinPortraits(atlas: AtlasBuilder): void {
  for (const kind of GOBLIN_KINDS) {
    const look = looks[kind];
    const colors = goblinColors[kind];
    const { w, h } = frameSize(look);
    const scale = Math.min(4, PORTRAIT_BOX.width / w, PORTRAIT_BOX.height / h);
    for (const step of [0, 1] as const) {
      atlas.add(portraitFrame(kind, step), w * scale, h * scale, (ctx) => {
        ctx.scale(scale, scale);
        drawGoblin(ctx, w, h, look, colors, step);
      });
    }
  }
}
