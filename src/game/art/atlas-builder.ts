export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const PADDING = 2;

export class AtlasBuilder {
  readonly canvas: HTMLCanvasElement;
  readonly frames: AtlasFrame[] = [];
  private readonly ctx: CanvasRenderingContext2D;
  private cursorX = PADDING;
  private cursorY = PADDING;
  private rowHeight = 0;

  constructor(size: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
  }

  add(name: string, width: number, height: number, draw: DrawFn): void {
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    if (this.cursorX + w + PADDING > this.canvas.width) {
      this.cursorX = PADDING;
      this.cursorY += this.rowHeight + PADDING;
      this.rowHeight = 0;
    }
    if (this.cursorY + h + PADDING > this.canvas.height) {
      throw new Error(`Atlas is full, cannot place "${name}"`);
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.cursorX, this.cursorY);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    draw(ctx, w, h);
    ctx.restore();
    this.frames.push({ name, x: this.cursorX, y: this.cursorY, w, h });
    this.cursorX += w + PADDING;
    this.rowHeight = Math.max(this.rowHeight, h);
  }
}
