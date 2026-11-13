import { describe, expect, it } from 'vitest';
import { LANDSCAPE_HEIGHT, PORTRAIT_WIDTH, screenFor } from '../src/game/ui/screen-layout';

describe('screenFor', () => {
  it('follows the phone aspect in portrait', () => {
    expect(screenFor(390, 844)).toEqual({
      mode: 'portrait',
      width: PORTRAIT_WIDTH,
      height: 1558,
      scale: 1,
    });
    expect(screenFor(768, 1024)).toEqual({
      mode: 'portrait',
      width: PORTRAIT_WIDTH,
      height: 1100,
      scale: 1,
    });
  });

  it('clamps very tall phones', () => {
    expect(screenFor(300, 900).height).toBe(1700);
  });

  it('fills wide windows in landscape', () => {
    expect(screenFor(1920, 1080)).toEqual({
      mode: 'landscape',
      width: 1920,
      height: LANDSCAPE_HEIGHT,
      scale: 1,
    });
    expect(screenFor(1500, 900)).toEqual({
      mode: 'landscape',
      width: 1800,
      height: LANDSCAPE_HEIGHT,
      scale: 1,
    });
  });

  it('clamps ultra-wide and nearly square windows', () => {
    expect(screenFor(3440, 1000).width).toBe(2560);
    expect(screenFor(1210, 1000).width).toBe(1440);
  });

  it('renders sharp on high-density screens', () => {
    expect(screenFor(390, 844, 3)).toMatchObject({ width: PORTRAIT_WIDTH, scale: 1.75 });
    expect(screenFor(1490, 733, 2)).toMatchObject({ mode: 'landscape', scale: 1.25 });
    expect(screenFor(1920, 1080, 4).scale).toBe(2);
    expect(screenFor(1920, 1080, 1).scale).toBe(1);
  });

  it('handles an empty viewport', () => {
    expect(screenFor(0, 0).mode).toBe('portrait');
  });
});
