import { economy } from '../balance';

export function starsFor(hpFraction: number, revived: boolean): number {
  if (hpFraction <= 0) return 0;
  const [three, two] = economy.starThresholds;
  const stars = hpFraction >= three ? 3 : hpFraction >= two ? 2 : 1;
  return revived ? Math.min(stars, economy.maxStarsAfterRevive) : stars;
}

export interface RewardInput {
  levelIndex: number;
  bounty: number;
  won: boolean;
  stars: number;
  multiplier: number;
}

export function rewardFor(input: RewardInput): number {
  const fromKills = input.bounty * economy.bountyShare;
  const base = input.won
    ? fromKills +
      economy.winBonus +
      economy.winBonusPerLevel * input.levelIndex +
      economy.starBonus * input.stars
    : fromKills * economy.lossFactor;
  return Math.max(economy.lossFloor, Math.floor(base * input.multiplier));
}
