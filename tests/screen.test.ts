import { describe, expect, it } from 'vitest';
import { MAP_HEIGHT, MAP_WIDTH, screenFor } from '../src/game/ui/screen-layout';

describe('screenFor', () => {
  it('keeps the portrait layout on phones and tall windows', () => {
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
      [1000, 900],
    ] as const) {
      expect(screenFor(w, h)).toEqual({
        mode: 'portrait',
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        mapX: 0,
        panelWidth: 0,
      });
    }
  });

  it('switches to side panels on wide windows', () => {
    const wide = screenFor(1920, 1080);
    expect(wide.mode).toBe('landscape');
    expect(wide.height).toBe(MAP_HEIGHT);
    expect(wide.width).toBe(2276);
    expect(wide.mapX).toBe((2276 - MAP_WIDTH) / 2);
    expect(wide.mapX * 2 + MAP_WIDTH).toBe(wide.width);
  });

  it('clamps very wide and nearly square windows', () => {
    expect(screenFor(3440, 1000).width).toBe(2276);
    expect(screenFor(1300, 1000).width).toBe(1664);
    expect(screenFor(1210, 1000).width).toBe(1600);
  });

  it('handles an empty viewport', () => {
    expect(screenFor(0, 0).mode).toBe('portrait');
  });
});
