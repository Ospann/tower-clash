import Phaser from 'phaser';

export interface DebugCounters {
  enemies: number;
  projectiles: number;
  particles: number;
  simMs: number;
}

export interface DebugSnapshot extends DebugCounters {
  fps: number;
  minFps: number;
  frameMs: number;
  worstFrameMs: number;
  workMs: number;
}

const WINDOW_MS = 1000;

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private simTotal = 0;
  private workTotal = 0;
  private workStart = 0;
  private last = performance.now();
  private snapshot: DebugSnapshot = {
    fps: 0,
    minFps: 0,
    frameMs: 0,
    worstFrameMs: 0,
    workMs: 0,
    enemies: 0,
    projectiles: 0,
    particles: 0,
    simMs: 0,
  };
  readonly history: DebugSnapshot[] = [];

  private readonly onPreStep = (): void => {
    this.workStart = performance.now();
  };

  private readonly onPostRender = (): void => {
    this.workTotal += performance.now() - this.workStart;
  };

  constructor(private readonly game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.PRE_STEP, this.onPreStep);
    game.events.on(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed',
      left: '6px',
      top: '6px',
      zIndex: '900',
      padding: '6px 8px',
      font: '12px/1.35 ui-monospace, Menlo, Consolas, monospace',
      color: '#d8ffd0',
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '6px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });
    document.body.append(this.element);
  }

  get current(): DebugSnapshot {
    return this.snapshot;
  }

  frame(counters: DebugCounters): void {
    const now = performance.now();
    const delta = now - this.last;
    this.last = now;
    this.frames += 1;
    this.elapsed += delta;
    this.simTotal += counters.simMs;
    if (delta > this.worst) this.worst = delta;
    if (this.elapsed < WINDOW_MS) return;

    const frameMs = this.elapsed / this.frames;
    this.snapshot = {
      fps: 1000 / frameMs,
      minFps: 1000 / this.worst,
      frameMs,
      worstFrameMs: this.worst,
      workMs: this.workTotal / this.frames,
      enemies: counters.enemies,
      projectiles: counters.projectiles,
      particles: counters.particles,
      simMs: this.simTotal / this.frames,
    };
    this.history.push(this.snapshot);
    if (this.history.length > 120) this.history.shift();
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
    this.simTotal = 0;
    this.workTotal = 0;
    const s = this.snapshot;
    this.element.textContent =
      `fps ${s.fps.toFixed(1)} (min ${s.minFps.toFixed(0)})\n` +
      `cpu ${s.workMs.toFixed(2)} ms, sim ${s.simMs.toFixed(2)} ms\n` +
      `enemies ${s.enemies}\nprojectiles ${s.projectiles}\nparticles ${s.particles}`;
  }

  destroy(): void {
    this.game.events.off(Phaser.Core.Events.PRE_STEP, this.onPreStep);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    this.element.remove();
  }
}
