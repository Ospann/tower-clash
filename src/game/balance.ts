export const GOBLIN_KINDS = [
  'grunt',
  'runner',
  'shield',
  'brute',
  'shaman',
  'glider',
  'boss',
] as const;
export type GoblinKind = (typeof GOBLIN_KINDS)[number];

export const DAMAGE_TYPES = ['bolt', 'blast', 'fire', 'shock', 'beam'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface GoblinStats {
  hp: number;
  speed: number;
  radius: number;
  leak: number;
  bounty: number;
  armor: number;
  slowScale: number;
  flying: boolean;
  resist: Readonly<Record<DamageType, number>>;
}

const noResist: Readonly<Record<DamageType, number>> = {
  bolt: 1,
  blast: 1,
  fire: 1,
  shock: 1,
  beam: 1,
};

export const goblins: Readonly<Record<GoblinKind, GoblinStats>> = {
  grunt: {
    hp: 30,
    speed: 46,
    radius: 7,
    leak: 1,
    bounty: 1,
    armor: 0,
    slowScale: 1,
    flying: false,
    resist: noResist,
  },
  runner: {
    hp: 18,
    speed: 92,
    radius: 6.5,
    leak: 1,
    bounty: 1,
    armor: 0,
    slowScale: 1,
    flying: false,
    resist: noResist,
  },
  shield: {
    hp: 80,
    speed: 40,
    radius: 8,
    leak: 2,
    bounty: 3,
    armor: 6,
    slowScale: 1,
    flying: false,
    resist: { bolt: 0.6, blast: 1.8, fire: 1, shock: 1, beam: 0.8 },
  },
  brute: {
    hp: 520,
    speed: 28,
    radius: 13,
    leak: 10,
    bounty: 12,
    armor: 0,
    slowScale: 0.8,
    flying: false,
    resist: { bolt: 1, blast: 0.85, fire: 1, shock: 1, beam: 1 },
  },
  shaman: {
    hp: 100,
    speed: 40,
    radius: 8,
    leak: 3,
    bounty: 5,
    armor: 0,
    slowScale: 1,
    flying: false,
    resist: noResist,
  },
  glider: {
    hp: 42,
    speed: 74,
    radius: 8,
    leak: 2,
    bounty: 3,
    armor: 0,
    slowScale: 0,
    flying: true,
    resist: { bolt: 1, blast: 1, fire: 1, shock: 1.3, beam: 1 },
  },
  boss: {
    hp: 8000,
    speed: 18,
    radius: 26,
    leak: 50,
    bounty: 120,
    armor: 2,
    slowScale: 0.5,
    flying: false,
    resist: { bolt: 1, blast: 0.8, fire: 0.8, shock: 0.8, beam: 0.9 },
  },
};

export const gameSpeed = 2;

export const goblinTraits = {
  speedJitter: 0.14,
  shaman: { heal: 14, radius: 90, interval: 1.4 },
  boss: { splitKind: 'grunt' as GoblinKind, splitCount: 28, splitRadius: 60 },
} as const;

export const spawnRules = {
  minDepth: 30,
  depthSpread: 110,
  inset: 30,
  edgeTolerance: 40,
} as const;

export const crowd = {
  spacing: 1.7,
  push: 4.5,
  wander: 0.35,
  steer: 0.2,
  maxNeighbours: 10,
  wallSlide: true,
} as const;

export const audioLimits = {
  maxVoices: { shot: 4, blast: 3, death: 3, wall: 2, ui: 2, jingle: 1 },
  minGapMs: { shot: 45, blast: 70, death: 60, wall: 120, ui: 0, jingle: 0 },
} as const;

export const fxLimits = {
  shakeMaxPx: 7,
  shakeCooldownMs: 160,
} as const;

export const TURRET_KINDS = ['ballista', 'mortar', 'gatling', 'tar', 'tesla', 'beam'] as const;
export type TurretKind = (typeof TURRET_KINDS)[number];

export interface TurretStats {
  damageType: DamageType;
  damage: number;
  cooldown: number;
  range: number;
  minRange: number;
  arcDeg: number;
  projectileSpeed: number;
  splash: number;
  special: number;
  duration: number;
  hitsAir: boolean;
  needsSight: boolean;
}

export const turrets: Readonly<Record<TurretKind, TurretStats>> = {
  ballista: {
    damageType: 'bolt',
    damage: 26,
    cooldown: 0.6,
    range: 340,
    minRange: 0,
    arcDeg: 40,
    projectileSpeed: 780,
    splash: 0,
    special: 0,
    duration: 0,
    hitsAir: true,
    needsSight: true,
  },
  mortar: {
    damageType: 'blast',
    damage: 38,
    cooldown: 2.3,
    range: 310,
    minRange: 95,
    arcDeg: 110,
    projectileSpeed: 300,
    splash: 54,
    special: 0,
    duration: 0,
    hitsAir: false,
    needsSight: false,
  },
  gatling: {
    damageType: 'bolt',
    damage: 5,
    cooldown: 0.09,
    range: 215,
    minRange: 0,
    arcDeg: 70,
    projectileSpeed: 0,
    splash: 0,
    special: 0,
    duration: 0,
    hitsAir: true,
    needsSight: true,
  },
  tar: {
    damageType: 'fire',
    damage: 10,
    cooldown: 3.4,
    range: 250,
    minRange: 60,
    arcDeg: 100,
    projectileSpeed: 280,
    splash: 58,
    special: 0.45,
    duration: 3.2,
    hitsAir: false,
    needsSight: false,
  },
  tesla: {
    damageType: 'shock',
    damage: 24,
    cooldown: 1.1,
    range: 135,
    minRange: 0,
    arcDeg: 360,
    projectileSpeed: 0,
    splash: 0,
    special: 4,
    duration: 0,
    hitsAir: true,
    needsSight: true,
  },
  beam: {
    damageType: 'beam',
    damage: 55,
    cooldown: 0,
    range: 280,
    minRange: 0,
    arcDeg: 50,
    projectileSpeed: 0,
    splash: 9,
    special: 0,
    duration: 0,
    hitsAir: true,
    needsSight: true,
  },
};

export const turretRules = {
  baseRadius: 26,
  spacing: 58,
  chainRange: 76,
  chainFalloff: 0.82,
  piercePerBonus: 20,
  zoneTickSec: 0.25,
  slowLingerSec: 0.4,
  arcDegMax: 170,
  waveGapSec: 3,
  timerCycleGrowth: 0.25,
} as const;

export const abilities = {
  airstrike: { cooldown: 26, damage: 70, radius: 52, blasts: 7, maxLength: 440, interval: 0.09 },
  pillar: { cooldown: 34, dps: 95, radius: 70, duration: 4 },
  bigBang: { cooldown: 0, damage: 650, bossShare: 0.25, charges: 1 },
} as const;

export const rocket = {
  cooldown: 1.2,
  damage: 34,
  radius: 46,
  speed: 1500,
  minFlight: 0.18,
  holdDelayMs: 220,
} as const;

export type RocketStat = 'damage' | 'rate' | 'radius';

export const economy = {
  starThresholds: [0.75, 0.35] as const,
  reviveHpFraction: 0.5,
  reviveClearCells: 9,
  maxStarsAfterRevive: 1,
  bountyShare: 0.12,
  winBonus: 20,
  winBonusPerLevel: 6,
  starBonus: 6,
  lossFactor: 0.6,
  lossFloor: 4,
  rewardedMultiplier: 2,
} as const;

export const ABILITY_IDS = ['airstrike', 'pillar', 'bigBang'] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

export type TurretStat = 'damage' | 'rate' | 'range' | 'arc' | 'special';
export type AbilityStat = 'cooldown' | 'power';

export type TreeEffect =
  | { type: 'core' }
  | { type: 'unlockTurret'; turret: TurretKind }
  | { type: 'turret'; turret: TurretKind; stat: TurretStat }
  | { type: 'unlockAbility'; ability: AbilityId }
  | { type: 'ability'; ability: AbilityId; stat: AbilityStat }
  | { type: 'limit' }
  | { type: 'baseHp' }
  | { type: 'reward' }
  | { type: 'rocket'; stat: RocketStat };

export interface TreeNode {
  id: string;
  parent: string | null;
  effect: TreeEffect;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  perLevel: number;
}

const statNodes: Readonly<
  Record<TurretStat, { maxLevel: number; cost: number; growth: number; perLevel: number }>
> = {
  damage: { maxLevel: 5, cost: 10, growth: 1.6, perLevel: 0.14 },
  rate: { maxLevel: 5, cost: 12, growth: 1.6, perLevel: 0.1 },
  range: { maxLevel: 3, cost: 14, growth: 1.8, perLevel: 0.07 },
  arc: { maxLevel: 3, cost: 12, growth: 1.8, perLevel: 0.15 },
  special: { maxLevel: 3, cost: 22, growth: 1.9, perLevel: 0.1 },
};

const turretBranches: readonly {
  turret: TurretKind;
  unlockCost: number;
  parent: string;
  costScale: number;
  stats: readonly TurretStat[];
}[] = [
  {
    turret: 'ballista',
    unlockCost: 0,
    parent: 'core',
    costScale: 1,
    stats: ['damage', 'rate', 'range', 'arc', 'special'],
  },
  {
    turret: 'mortar',
    unlockCost: 25,
    parent: 'core',
    costScale: 1.3,
    stats: ['damage', 'rate', 'range', 'arc', 'special'],
  },
  {
    turret: 'gatling',
    unlockCost: 70,
    parent: 'ballista.damage',
    costScale: 1.7,
    stats: ['damage', 'rate', 'range', 'arc', 'special'],
  },
  {
    turret: 'tar',
    unlockCost: 130,
    parent: 'mortar.damage',
    costScale: 2.1,
    stats: ['damage', 'rate', 'range', 'arc', 'special'],
  },
  {
    turret: 'tesla',
    unlockCost: 220,
    parent: 'gatling.damage',
    costScale: 2.6,
    stats: ['damage', 'rate', 'range', 'special'],
  },
  {
    turret: 'beam',
    unlockCost: 360,
    parent: 'tar.damage',
    costScale: 3.2,
    stats: ['damage', 'range', 'arc', 'special'],
  },
];

const abilityBranches: readonly { ability: AbilityId; unlockCost: number; parent: string }[] = [
  { ability: 'airstrike', unlockCost: 45, parent: 'core' },
  { ability: 'pillar', unlockCost: 160, parent: 'airstrike.power' },
  { ability: 'bigBang', unlockCost: 320, parent: 'pillar.power' },
];

function buildTree(): TreeNode[] {
  const nodes: TreeNode[] = [
    {
      id: 'core',
      parent: null,
      effect: { type: 'core' },
      maxLevel: 1,
      baseCost: 0,
      costGrowth: 1,
      perLevel: 0,
    },
    {
      id: 'limit',
      parent: 'core',
      effect: { type: 'limit' },
      maxLevel: 6,
      baseCost: 30,
      costGrowth: 2,
      perLevel: 1,
    },
    {
      id: 'baseHp',
      parent: 'core',
      effect: { type: 'baseHp' },
      maxLevel: 8,
      baseCost: 12,
      costGrowth: 1.6,
      perLevel: 0.15,
    },
    {
      id: 'reward',
      parent: 'baseHp',
      effect: { type: 'reward' },
      maxLevel: 8,
      baseCost: 20,
      costGrowth: 1.7,
      perLevel: 0.1,
    },
    {
      id: 'rocket.damage',
      parent: 'core',
      effect: { type: 'rocket', stat: 'damage' },
      maxLevel: 6,
      baseCost: 15,
      costGrowth: 1.6,
      perLevel: 0.2,
    },
    {
      id: 'rocket.rate',
      parent: 'rocket.damage',
      effect: { type: 'rocket', stat: 'rate' },
      maxLevel: 5,
      baseCost: 22,
      costGrowth: 1.7,
      perLevel: 0.15,
    },
    {
      id: 'rocket.radius',
      parent: 'rocket.damage',
      effect: { type: 'rocket', stat: 'radius' },
      maxLevel: 4,
      baseCost: 25,
      costGrowth: 1.8,
      perLevel: 0.12,
    },
  ];
  for (const branch of turretBranches) {
    const { turret } = branch;
    let anchor = branch.parent;
    if (branch.unlockCost > 0) {
      nodes.push({
        id: `${turret}.unlock`,
        parent: branch.parent,
        effect: { type: 'unlockTurret', turret },
        maxLevel: 1,
        baseCost: branch.unlockCost,
        costGrowth: 1,
        perLevel: 0,
      });
      anchor = `${turret}.unlock`;
    }
    branch.stats.forEach((stat, index) => {
      const spec = statNodes[stat];
      const previous = branch.stats[index - 1];
      const parent =
        index === 0 ? anchor : index === 1 ? `${turret}.damage` : `${turret}.${previous}`;
      nodes.push({
        id: `${turret}.${stat}`,
        parent: index === 2 ? `${turret}.damage` : parent,
        effect: { type: 'turret', turret, stat },
        maxLevel: spec.maxLevel,
        baseCost: Math.round(spec.cost * branch.costScale),
        costGrowth: spec.growth,
        perLevel: spec.perLevel,
      });
    });
  }
  for (const branch of abilityBranches) {
    const { ability } = branch;
    nodes.push({
      id: `${ability}.unlock`,
      parent: branch.parent,
      effect: { type: 'unlockAbility', ability },
      maxLevel: 1,
      baseCost: branch.unlockCost,
      costGrowth: 1,
      perLevel: 0,
    });
    nodes.push({
      id: `${ability}.power`,
      parent: `${ability}.unlock`,
      effect: { type: 'ability', ability, stat: 'power' },
      maxLevel: 5,
      baseCost: Math.round(branch.unlockCost * 0.5),
      costGrowth: 1.6,
      perLevel: 0.15,
    });
    if (ability !== 'bigBang') {
      nodes.push({
        id: `${ability}.cooldown`,
        parent: `${ability}.unlock`,
        effect: { type: 'ability', ability, stat: 'cooldown' },
        maxLevel: 5,
        baseCost: Math.round(branch.unlockCost * 0.5),
        costGrowth: 1.6,
        perLevel: 0.08,
      });
    }
  }
  return nodes;
}

export const upgradeTree: readonly TreeNode[] = buildTree();
