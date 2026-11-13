export type ScreenMode = 'portrait' | 'landscape';

export interface ScreenLayout {
  mode: ScreenMode;
  width: number;
  height: number;
  mapX: number;
  panelWidth: number;
}

export const MAP_WIDTH = 720;
export const MAP_HEIGHT = 1280;

const LANDSCAPE_ASPECT = 1.2;
const MIN_LANDSCAPE_WIDTH = 1600;
const MAX_LANDSCAPE_WIDTH = 2276;

export function screenFor(viewportWidth: number, viewportHeight: number): ScreenLayout {
  const aspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 0;
  if (aspect < LANDSCAPE_ASPECT) {
    return { mode: 'portrait', width: MAP_WIDTH, height: MAP_HEIGHT, mapX: 0, panelWidth: 0 };
  }
  const width = Math.round(
    Math.min(MAX_LANDSCAPE_WIDTH, Math.max(MIN_LANDSCAPE_WIDTH, MAP_HEIGHT * aspect)),
  );
  const mapX = Math.round((width - MAP_WIDTH) / 2);
  return { mode: 'landscape', width, height: MAP_HEIGHT, mapX, panelWidth: mapX };
}
