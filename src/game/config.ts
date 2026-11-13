export type Orientation = 'portrait' | 'landscape';

const orientation: Orientation = 'portrait';
const baseSize = { width: 720, height: 1280 };

export const gameConfig = {
  id: 'tower-clash',
  orientation,
  width: orientation === 'portrait' ? baseSize.width : baseSize.height,
  height: orientation === 'portrait' ? baseSize.height : baseSize.width,
  backgroundColor: '#1b2420',
  ads: {
    interstitialCooldownSec: 60,
  },
  save: {
    key: 'save',
    debounceMs: 500,
  },
} as const;

export const layout = {
  hudHeight: 88,
  bottomBarY: 1130,
} as const;

export const simConfig = {
  stepSec: 1 / 60,
  maxStepsPerFrame: 5,
  hordeCapacity: 4096,
  hashCellSize: 24,
  projectileCapacity: 512,
  particleLimit: 400,
  decalsPerFrame: 40,
} as const;
