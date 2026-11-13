export interface Size {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface View {
  cx: number;
  cy: number;
  zoom: number;
}

export const MAX_ZOOM = 1.6;

export function fitZoom(map: Size, screen: Size, insets: Insets): number {
  const width = Math.max(1, screen.width - insets.left - insets.right);
  const height = Math.max(1, screen.height - insets.top - insets.bottom);
  return Math.min(width / map.width, height / map.height);
}

export function zoomLimits(
  map: Size,
  screen: Size,
  insets: Insets,
  max = MAX_ZOOM,
): { min: number; max: number } {
  const fit = fitZoom(map, screen, insets);
  return { min: Math.min(fit, max), max: Math.max(fit, max) };
}

function clampAxis(
  center: number,
  zoom: number,
  mapSize: number,
  screenSize: number,
  before: number,
  after: number,
): number {
  const half = screenSize / 2;
  const low = (half - before) / zoom;
  const high = mapSize - (half - after) / zoom;
  if (low > high) {
    const usableCenter = (before + screenSize - after) / 2;
    return mapSize / 2 - (usableCenter - half) / zoom;
  }
  return Math.min(high, Math.max(low, center));
}

export function clampView(
  view: View,
  map: Size,
  screen: Size,
  insets: Insets,
  max = MAX_ZOOM,
): View {
  const limits = zoomLimits(map, screen, insets, max);
  const zoom = Math.min(limits.max, Math.max(limits.min, view.zoom));
  return {
    zoom,
    cx: clampAxis(view.cx, zoom, map.width, screen.width, insets.left, insets.right),
    cy: clampAxis(view.cy, zoom, map.height, screen.height, insets.top, insets.bottom),
  };
}

export function screenToWorld(view: View, screen: Size, point: Point): Point {
  return {
    x: view.cx + (point.x - screen.width / 2) / view.zoom,
    y: view.cy + (point.y - screen.height / 2) / view.zoom,
  };
}

export function zoomAt(view: View, screen: Size, anchor: Point, zoom: number): View {
  const world = screenToWorld(view, screen, anchor);
  return {
    zoom,
    cx: world.x - (anchor.x - screen.width / 2) / zoom,
    cy: world.y - (anchor.y - screen.height / 2) / zoom,
  };
}

export function panBy(view: View, dx: number, dy: number): View {
  return { zoom: view.zoom, cx: view.cx - dx / view.zoom, cy: view.cy - dy / view.zoom };
}

export function pinch(
  view: View,
  screen: Size,
  before: readonly [Point, Point],
  after: readonly [Point, Point],
): View {
  const [a0, b0] = before;
  const [a1, b1] = after;
  const d0 = Math.max(1, Math.hypot(b0.x - a0.x, b0.y - a0.y));
  const d1 = Math.max(1, Math.hypot(b1.x - a1.x, b1.y - a1.y));
  const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const world = screenToWorld(view, screen, mid0);
  const zoom = view.zoom * (d1 / d0);
  return {
    zoom,
    cx: world.x - (mid1.x - screen.width / 2) / zoom,
    cy: world.y - (mid1.y - screen.height / 2) / zoom,
  };
}

export function startView(
  map: Size,
  screen: Size,
  insets: Insets,
  focus: Point,
  comfortable: number,
  max = MAX_ZOOM,
): View {
  const fit = fitZoom(map, screen, insets);
  if (fit >= comfortable) {
    return clampView(
      { cx: map.width / 2, cy: map.height / 2, zoom: fit },
      map,
      screen,
      insets,
      max,
    );
  }
  return clampView({ cx: focus.x, cy: focus.y, zoom: comfortable }, map, screen, insets, max);
}
