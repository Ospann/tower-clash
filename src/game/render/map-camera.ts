import type Phaser from 'phaser';
import {
  clampView,
  fitZoom,
  panBy,
  pinch,
  startView,
  zoomAt,
  type Insets,
  type Point,
  type Size,
  type View,
} from './camera-math';

const FRICTION = 6;
const MIN_FLING = 30;
const MAX_FLING = 4000;

export class MapCamera {
  private view: View;
  private vx = 0;
  private vy = 0;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly map: Size,
    private readonly insets: () => Insets,
    private readonly screen: () => Size,
    focus: Point,
    comfortable: number,
    private readonly maxZoom: number,
  ) {
    this.view = startView(map, screen(), insets(), focus, comfortable, maxZoom);
    this.apply();
  }

  get zoom(): number {
    return this.view.zoom;
  }

  get fitZoom(): number {
    return fitZoom(this.map, this.screen(), this.insets());
  }

  worldRect(): { x: number; y: number; width: number; height: number } {
    const screen = this.screen();
    const width = screen.width / this.view.zoom;
    const height = screen.height / this.view.zoom;
    return { x: this.view.cx - width / 2, y: this.view.cy - height / 2, width, height };
  }

  resize(width: number, height: number): void {
    this.camera.setSize(width, height);
    this.apply();
  }

  pan(dx: number, dy: number): void {
    this.view = panBy(this.view, dx, dy);
    this.apply();
  }

  zoomBy(factor: number, anchor?: Point): void {
    const screen = this.screen();
    const point = anchor ?? { x: screen.width / 2, y: screen.height / 2 };
    this.view = zoomAt(this.view, screen, point, this.view.zoom * factor);
    this.apply();
  }

  pinch(before: readonly [Point, Point], after: readonly [Point, Point]): void {
    this.view = pinch(this.view, this.screen(), before, after);
    this.apply();
  }

  focus(x: number, y: number): void {
    this.stop();
    this.view = { ...this.view, cx: x, cy: y };
    this.apply();
  }

  fit(): void {
    this.stop();
    this.view = { cx: this.map.width / 2, cy: this.map.height / 2, zoom: this.fitZoom };
    this.apply();
  }

  fling(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    if (speed < MIN_FLING) return;
    const scale = speed > MAX_FLING ? MAX_FLING / speed : 1;
    this.vx = vx * scale;
    this.vy = vy * scale;
  }

  stop(): void {
    this.vx = 0;
    this.vy = 0;
  }

  update(dt: number): void {
    if (this.vx === 0 && this.vy === 0) return;
    this.pan(this.vx * dt, this.vy * dt);
    const decay = Math.exp(-FRICTION * dt);
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) < MIN_FLING) this.stop();
  }

  private apply(): void {
    this.view = clampView(this.view, this.map, this.screen(), this.insets(), this.maxZoom);
    this.camera.setZoom(this.view.zoom);
    this.camera.centerOn(this.view.cx, this.view.cy);
  }
}
