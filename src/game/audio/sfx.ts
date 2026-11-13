import type Phaser from 'phaser';
import { audioLimits } from '../balance';

export const SFX_NAMES = [
  'shot',
  'cannon',
  'flask',
  'zap',
  'blast',
  'death',
  'wall',
  'click',
  'build',
  'win',
  'lose',
  'rocket',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

type Category = keyof typeof audioLimits.maxVoices;

interface SfxSpec {
  category: Category;
  volume: number;
  seconds: number;
  pitchJitter: number;
  render: (t: number, seconds: number, noise: () => number) => number;
}

const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;

function sweep(t: number, from: number, to: number, seconds: number): number {
  const k = Math.min(1, t / seconds);
  return TAU * (from * t + ((to - from) * k * t) / 2);
}

function notes(t: number, sequence: readonly number[], step: number): number {
  const index = Math.min(sequence.length - 1, Math.floor(t / step));
  const local = t - index * step;
  const frequency = sequence[index] ?? 440;
  const envelope = Math.exp(-local * 6);
  return (
    (Math.sin(TAU * frequency * local) + 0.4 * Math.sin(TAU * frequency * 2 * local)) * envelope
  );
}

const specs: Readonly<Record<SfxName, SfxSpec>> = {
  shot: {
    category: 'shot',
    volume: 0.25,
    seconds: 0.08,
    pitchJitter: 0.2,
    render: (t, s, noise) =>
      (Math.sin(sweep(t, 1100, 380, s)) * 0.6 + noise() * 0.4) * Math.exp(-t * 55),
  },
  cannon: {
    category: 'shot',
    volume: 0.5,
    seconds: 0.26,
    pitchJitter: 0.1,
    render: (t, s, noise) =>
      Math.sin(sweep(t, 190, 48, s)) * Math.exp(-t * 14) + noise() * 0.5 * Math.exp(-t * 40),
  },
  flask: {
    category: 'shot',
    volume: 0.3,
    seconds: 0.2,
    pitchJitter: 0.15,
    render: (t, s, noise) =>
      noise() * Math.sin((Math.PI * t) / s) * 0.6 + Math.sin(sweep(t, 300, 520, s)) * 0.2,
  },
  zap: {
    category: 'shot',
    volume: 0.3,
    seconds: 0.16,
    pitchJitter: 0.2,
    render: (t, s, noise) =>
      Math.sign(Math.sin(sweep(t, 1500, 260, s) + noise() * 2.2)) * 0.5 * Math.exp(-t * 20),
  },
  blast: {
    category: 'blast',
    volume: 0.6,
    seconds: 0.5,
    pitchJitter: 0.15,
    render: (t, s, noise) =>
      noise() * Math.exp(-t * 9) * 0.8 + Math.sin(sweep(t, 110, 36, s)) * Math.exp(-t * 7),
  },
  death: {
    category: 'death',
    volume: 0.22,
    seconds: 0.13,
    pitchJitter: 0.35,
    render: (t, s) =>
      Math.sin(sweep(t, 620, 240, s) + Math.sin(TAU * 38 * t) * 1.4) * Math.exp(-t * 22),
  },
  wall: {
    category: 'wall',
    volume: 0.45,
    seconds: 0.14,
    pitchJitter: 0.15,
    render: (t, s, noise) =>
      Math.sin(sweep(t, 130, 58, s)) * Math.exp(-t * 26) + noise() * 0.5 * Math.exp(-t * 90),
  },
  rocket: {
    category: 'shot',
    volume: 0.35,
    seconds: 0.22,
    pitchJitter: 0.15,
    render: (t, s, noise) =>
      noise() * Math.sin((Math.PI * t) / s) * 0.5 +
      Math.sin(sweep(t, 700, 220, s)) * 0.25 * Math.exp(-t * 8),
  },
  click: {
    category: 'ui',
    volume: 0.3,
    seconds: 0.05,
    pitchJitter: 0,
    render: (t) => Math.sin(TAU * 880 * t) * Math.exp(-t * 90),
  },
  build: {
    category: 'ui',
    volume: 0.45,
    seconds: 0.22,
    pitchJitter: 0,
    render: (t, s, noise) =>
      Math.sin(sweep(t, 220, 520, s)) * Math.exp(-t * 12) * 0.7 + noise() * 0.4 * Math.exp(-t * 70),
  },
  win: {
    category: 'jingle',
    volume: 0.5,
    seconds: 0.9,
    pitchJitter: 0,
    render: (t) => notes(t, [523.25, 659.25, 783.99, 1046.5], 0.16) * 0.6,
  },
  lose: {
    category: 'jingle',
    volume: 0.5,
    seconds: 1,
    pitchJitter: 0,
    render: (t) => notes(t, [440, 349.23, 293.66, 220], 0.22) * 0.6,
  },
};

function key(name: SfxName): string {
  return `sfx-${name}`;
}

function audioContext(sound: Phaser.Sound.BaseSoundManager): AudioContext | null {
  const context: unknown = Reflect.get(sound, 'context');
  return context instanceof AudioContext ? context : null;
}

export function generateSfx(scene: Phaser.Scene): void {
  const context = audioContext(scene.sound);
  if (!context) return;
  let seed = 1234567;
  const noise = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  for (const name of SFX_NAMES) {
    const spec = specs[name];
    if (scene.cache.audio.exists(key(name))) continue;
    const length = Math.ceil(spec.seconds * SAMPLE_RATE);
    const buffer = context.createBuffer(1, length, SAMPLE_RATE);
    const data = buffer.getChannelData(0);
    const fade = Math.min(length, Math.floor(SAMPLE_RATE * 0.008));
    for (let i = 0; i < length; i += 1) {
      const t = i / SAMPLE_RATE;
      let sample = spec.render(t, spec.seconds, noise);
      if (i > length - fade) sample *= (length - i) / fade;
      data[i] = Math.max(-1, Math.min(1, sample));
    }
    scene.cache.audio.add(key(name), buffer);
  }
}

export class Sfx {
  private readonly ends: Record<Category, number[]> = {
    shot: [],
    blast: [],
    death: [],
    wall: [],
    ui: [],
    jingle: [],
  };
  private readonly last: Record<Category, number> = {
    shot: 0,
    blast: 0,
    death: 0,
    wall: 0,
    ui: 0,
    jingle: 0,
  };

  constructor(private readonly scene: Phaser.Scene) {}

  play(name: SfxName): void {
    const { sound, cache } = this.scene;
    if (sound.mute || sound.locked || !cache.audio.exists(key(name))) return;
    const spec = specs[name];
    const now = performance.now();
    const category = spec.category;
    if (now - this.last[category] < audioLimits.minGapMs[category]) return;
    const ends = this.ends[category];
    for (let i = ends.length - 1; i >= 0; i -= 1) {
      if (ends[i]! <= now) ends.splice(i, 1);
    }
    if (ends.length >= audioLimits.maxVoices[category]) return;
    const rate = 1 + (Math.random() * 2 - 1) * spec.pitchJitter;
    ends.push(now + (spec.seconds * 1000) / rate);
    this.last[category] = now;
    sound.play(key(name), { volume: spec.volume, rate });
  }
}
