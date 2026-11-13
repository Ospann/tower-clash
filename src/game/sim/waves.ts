import { turretRules } from '../balance';
import type { LevelData, WaveGroup } from '../levels/level-types';
import type { World } from './world';

interface GroupState {
  group: WaveGroup;
  total: number;
  spawned: number;
  elapsed: number;
}

const MAX_SPAWNS_PER_STEP = 24;

export class WaveRunner {
  index = -1;
  cycle = 0;
  private groups: GroupState[] = [];
  private gap = 0;
  private readonly timed: boolean;

  constructor(private readonly level: LevelData) {
    this.timed = level.win.type === 'timer';
  }

  get waveFinished(): boolean {
    return this.groups.every((state) => state.spawned >= state.total);
  }

  get allSpawned(): boolean {
    return !this.timed && this.index >= this.level.waves.length - 1 && this.waveFinished;
  }

  get upcoming(): number {
    if (this.timed) return 0;
    let total = this.remaining;
    const from = this.index < 0 ? 0 : this.index + 1;
    for (const wave of this.level.waves.slice(from)) {
      for (const group of wave.groups) total += group.count;
    }
    return total;
  }

  get remaining(): number {
    let total = 0;
    for (const state of this.groups) total += state.total - state.spawned;
    return total;
  }

  update(world: World, dt: number): void {
    if (this.index < 0) {
      this.begin(0);
    } else if (this.waveFinished) {
      const last = this.index >= this.level.waves.length - 1;
      if (last && !this.timed) return;
      this.gap += dt;
      if (this.gap < turretRules.waveGapSec) return;
      if (last) {
        this.cycle += 1;
        this.begin(0);
      } else {
        this.begin(this.index + 1);
      }
    }
    let budget = MAX_SPAWNS_PER_STEP;
    for (const state of this.groups) {
      if (state.spawned >= state.total) continue;
      state.elapsed += dt;
      const active = state.elapsed - state.group.delay;
      if (active < 0) continue;
      const due =
        state.group.duration <= 0
          ? state.total
          : Math.min(state.total, Math.floor((active / state.group.duration) * state.total) + 1);
      while (state.spawned < due && budget > 0) {
        if (world.spawnAtEntry(state.group.goblin, state.group.entry) < 0) return;
        state.spawned += 1;
        budget -= 1;
      }
    }
  }

  private begin(index: number): void {
    const wave = this.level.waves[index];
    this.index = index;
    this.gap = 0;
    const growth = 1 + this.cycle * turretRules.timerCycleGrowth;
    this.groups = (wave?.groups ?? []).map((group) => ({
      group,
      total: Math.max(1, Math.round(group.count * growth)),
      spawned: 0,
      elapsed: 0,
    }));
  }
}

export function levelGoblinCount(level: LevelData): number {
  let total = 0;
  for (const wave of level.waves) for (const group of wave.groups) total += group.count;
  return total;
}
