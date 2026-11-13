export const FxKind = {
  Death: 0,
  Blast: 1,
  Bolt: 2,
  Leak: 3,
  Shot: 4,
  Heal: 5,
  Zone: 6,
  BombMark: 7,
  Hit: 8,
  BossDeath: 9,
  Tracer: 10,
  Strike: 11,
  BigBang: 12,
} as const;

export const FX_STRIDE = 6;

export class FxEvents {
  count = 0;
  readonly data: Float32Array;

  constructor(readonly capacity = 512) {
    this.data = new Float32Array(capacity * FX_STRIDE);
  }

  push(kind: number, x: number, y: number, a = 0, b = 0, c = 0): void {
    if (this.count >= this.capacity) return;
    const o = this.count * FX_STRIDE;
    const d = this.data;
    d[o] = kind;
    d[o + 1] = x;
    d[o + 2] = y;
    d[o + 3] = a;
    d[o + 4] = b;
    d[o + 5] = c;
    this.count += 1;
  }

  clear(): void {
    this.count = 0;
  }
}
