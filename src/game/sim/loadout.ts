import { ABILITY_IDS, TURRET_KINDS, type AbilityId, type TurretKind } from '../balance';

export interface TurretMods {
  unlocked: boolean;
  damage: number;
  rate: number;
  range: number;
  arc: number;
  special: number;
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
  turretLimitBonus: number;
  baseHp: number;
  reward: number;
}

function turret(unlocked: boolean): TurretMods {
  return { unlocked, damage: 1, rate: 1, range: 1, arc: 1, special: 1 };
}

function ability(unlocked: boolean): AbilityMods {
  return { unlocked, cooldown: 1, power: 1 };
}

export function neutralLoadout(unlockAll = true): Loadout {
  return {
    turrets: {
      ballista: turret(true),
      mortar: turret(unlockAll),
      gatling: turret(unlockAll),
      tar: turret(unlockAll),
      tesla: turret(unlockAll),
      beam: turret(unlockAll),
    },
    abilities: {
      airstrike: ability(unlockAll),
      pillar: ability(unlockAll),
      bigBang: ability(unlockAll),
    },
    turretLimitBonus: 0,
    baseHp: 1,
    reward: 1,
  };
}

export function unlockedTurrets(loadout: Loadout): TurretKind[] {
  return TURRET_KINDS.filter((kind) => loadout.turrets[kind].unlocked);
}
