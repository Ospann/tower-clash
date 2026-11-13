import {
  ABILITY_IDS,
  TURRET_KINDS,
  turretCounts,
  type AbilityId,
  type TurretKind,
} from '../balance';

export interface TurretMods {
  unlocked: boolean;
  damage: number;
  rate: number;
  range: number;
  arc: number;
  special: number;
  count: number;
}

export const ABILITY_KINDS = ABILITY_IDS;
export type AbilityKind = AbilityId;

export interface AbilityMods {
  unlocked: boolean;
  cooldown: number;
  power: number;
}

export interface Loadout {
  turrets: Record<TurretKind, TurretMods>;
  abilities: Record<AbilityKind, AbilityMods>;
  baseHp: number;
  reward: number;
  rocket: { damage: number; rate: number; radius: number };
}

function turret(kind: TurretKind, unlocked: boolean, open: boolean): TurretMods {
  return {
    unlocked,
    damage: 1,
    rate: 1,
    range: 1,
    arc: 1,
    special: 1,
    count: open ? OPEN_COUNT : turretCounts[kind].base,
  };
}

function ability(unlocked: boolean): AbilityMods {
  return { unlocked, cooldown: 1, power: 1 };
}

const OPEN_COUNT = 99;

export function neutralLoadout(unlockAll = true): Loadout {
  return {
    turrets: {
      ballista: turret('ballista', true, unlockAll),
      mortar: turret('mortar', unlockAll, unlockAll),
      gatling: turret('gatling', unlockAll, unlockAll),
      tar: turret('tar', unlockAll, unlockAll),
      tesla: turret('tesla', unlockAll, unlockAll),
      beam: turret('beam', unlockAll, unlockAll),
    },
    abilities: {
      airstrike: ability(unlockAll),
      pillar: ability(unlockAll),
      bigBang: ability(unlockAll),
    },
    baseHp: 1,
    reward: 1,
    rocket: { damage: 1, rate: 1, radius: 1 },
  };
}

export function unlockedTurrets(loadout: Loadout): TurretKind[] {
  return TURRET_KINDS.filter((kind) => loadout.turrets[kind].unlocked);
}

export function turretCap(loadout: Loadout, kind: TurretKind): number {
  const mods = loadout.turrets[kind];
  return mods.unlocked ? mods.count : 0;
}
