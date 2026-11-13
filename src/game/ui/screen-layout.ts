export type ScreenMode = 'portrait' | 'landscape';

export interface ScreenLayout {
  mode: ScreenMode;
  width: number;
  height: number;
  scale: number;
}

export const PORTRAIT_WIDTH = 720;
export const LANDSCAPE_HEIGHT = 1080;

const LANDSCAPE_ASPECT = 1.2;
const PORTRAIT_MIN_HEIGHT = 1100;
const PORTRAIT_MAX_HEIGHT = 1700;
const LANDSCAPE_MIN_WIDTH = 1440;
const LANDSCAPE_MAX_WIDTH = 2560;
const MAX_RENDER_SCALE = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function renderScaleFor(deviceHeight: number, logicalHeight: number): number {
  if (logicalHeight <= 0) return 1;
  return clamp(Math.round((deviceHeight / logicalHeight) * 4) / 4, 1, MAX_RENDER_SCALE);
}

export function screenFor(
  viewportWidth: number,
  viewportHeight: number,
  pixelRatio = 1,
): ScreenLayout {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { mode: 'portrait', width: PORTRAIT_WIDTH, height: 1280, scale: 1 };
  }
  const aspect = viewportWidth / viewportHeight;
  const deviceHeight = viewportHeight * pixelRatio;
  if (aspect < LANDSCAPE_ASPECT) {
    const height = Math.round(
      clamp(PORTRAIT_WIDTH / aspect, PORTRAIT_MIN_HEIGHT, PORTRAIT_MAX_HEIGHT),
    );
    return {
      mode: 'portrait',
      width: PORTRAIT_WIDTH,
      height,
      scale: renderScaleFor(deviceHeight, height),
    };
  }
  const width = Math.round(
    clamp(LANDSCAPE_HEIGHT * aspect, LANDSCAPE_MIN_WIDTH, LANDSCAPE_MAX_WIDTH),
  );
  return {
    mode: 'landscape',
    width,
    height: LANDSCAPE_HEIGHT,
    scale: renderScaleFor(deviceHeight, LANDSCAPE_HEIGHT),
  };
}
