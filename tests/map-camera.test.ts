import { describe, expect, it } from 'vitest';
import {
  clampView,
  fitZoom,
  MAX_ZOOM,
  panBy,
  pinch,
  screenToWorld,
  startView,
  zoomAt,
  zoomLimits,
  type Insets,
} from '../src/game/render/camera-math';

const map = { width: 2400, height: 2400 };
const phone = { width: 720, height: 1400 };
const bars: Insets = { top: 100, bottom: 160, left: 0, right: 0 };

describe('zoom limits', () => {
  it('fits the whole map between the HUD bars at minimum zoom', () => {
    expect(fitZoom(map, phone, bars)).toBeCloseTo(720 / 2400);
    expect(zoomLimits(map, phone, bars)).toEqual({ min: 720 / 2400, max: MAX_ZOOM });
  });

  it('never lets the maximum fall below the fitting zoom', () => {
    const tiny = { width: 200, height: 200 };
    const limits = zoomLimits(tiny, phone, bars);
    expect(limits.max).toBeCloseTo(3.6);
    expect(limits.min).toBe(MAX_ZOOM);
  });
});

describe('clampView', () => {
  it('keeps map edges from leaving the usable area', () => {
    const view = clampView({ cx: -500, cy: -500, zoom: 1 }, map, phone, bars);
    expect(view.cx).toBe(360);
    expect(screenToWorld(view, phone, { x: 0, y: bars.top }).y).toBeCloseTo(0);
    const far = clampView({ cx: 9999, cy: 9999, zoom: 1 }, map, phone, bars);
    expect(screenToWorld(far, phone, { x: 720, y: 0 }).x).toBeCloseTo(2400);
    expect(screenToWorld(far, phone, { x: 0, y: phone.height - bars.bottom }).y).toBeCloseTo(2400);
  });

  it('centres a map that is smaller than the view', () => {
    const view = clampView({ cx: 0, cy: 0, zoom: 0.3 }, map, phone, bars);
    expect(view.cx).toBeCloseTo(1200);
    const top = screenToWorld(view, phone, { x: 0, y: bars.top });
    const bottom = screenToWorld(view, phone, { x: 0, y: phone.height - bars.bottom });
    expect((top.y + bottom.y) / 2).toBeCloseTo(1200);
  });

  it('clamps the zoom into its limits', () => {
    expect(clampView({ cx: 1200, cy: 1200, zoom: 10 }, map, phone, bars).zoom).toBe(MAX_ZOOM);
    expect(clampView({ cx: 1200, cy: 1200, zoom: 0.01 }, map, phone, bars).zoom).toBeCloseTo(0.3);
  });
});

describe('gestures', () => {
  it('keeps the world point under the cursor when zooming', () => {
    const view = { cx: 1000, cy: 900, zoom: 1 };
    const anchor = { x: 100, y: 300 };
    const before = screenToWorld(view, phone, anchor);
    const after = screenToWorld(zoomAt(view, phone, anchor, 1.5), phone, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('moves the map with the finger', () => {
    const view = panBy({ cx: 1000, cy: 1000, zoom: 0.5 }, 50, -20);
    expect(view.cx).toBe(900);
    expect(view.cy).toBe(1040);
  });

  it('zooms by the finger distance and follows the midpoint', () => {
    const view = { cx: 1000, cy: 1000, zoom: 1 };
    const before = [
      { x: 300, y: 600 },
      { x: 400, y: 600 },
    ] as const;
    const after = [
      { x: 250, y: 700 },
      { x: 450, y: 700 },
    ] as const;
    const next = pinch(view, phone, before, after);
    expect(next.zoom).toBeCloseTo(2);
    const grabbed = screenToWorld(view, phone, { x: 350, y: 600 });
    const now = screenToWorld(next, phone, { x: 350, y: 700 });
    expect(now.x).toBeCloseTo(grabbed.x);
    expect(now.y).toBeCloseTo(grabbed.y);
  });
});

describe('startView', () => {
  it('shows the whole map when it is comfortable to read', () => {
    const small = { width: 1400, height: 1800 };
    const desktop = { width: 1920, height: 1080 };
    const view = startView(small, desktop, bars, { x: 700, y: 1700 }, 0.45);
    expect(view.zoom).toBeCloseTo(fitZoom(small, desktop, bars));
  });

  it('zooms in on the focus when the whole map would be too small', () => {
    const view = startView(map, phone, bars, { x: 1200, y: 2300 }, 0.6);
    expect(view.zoom).toBe(0.6);
    expect(screenToWorld(view, phone, { x: 0, y: phone.height - bars.bottom }).y).toBeCloseTo(2400);
  });
});
