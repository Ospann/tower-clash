import { upgradeTree, type TreeNode } from '../balance';
import { neutralLoadout, type Loadout } from './loadout';

export type TreeLevels = Readonly<Record<string, number>>;

const byId = new Map<string, TreeNode>(upgradeTree.map((node) => [node.id, node]));

export function treeNode(id: string): TreeNode | undefined {
  return byId.get(id);
}

export function nodeLevel(levels: TreeLevels, id: string): number {
  const node = byId.get(id);
  if (!node) return 0;
  if (node.effect.type === 'core') return 1;
  const value = Object.hasOwn(levels, id) ? levels[id] : 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(node.maxLevel, Math.max(0, Math.floor(value)));
}

export function nodeCost(id: string, level: number): number | null {
  const node = byId.get(id);
  if (!node || level < 0 || level >= node.maxLevel) return null;
  return Math.round(node.baseCost * node.costGrowth ** level);
}

export function nodeAvailable(levels: TreeLevels, id: string): boolean {
  const node = byId.get(id);
  if (!node) return false;
  return node.parent === null || nodeLevel(levels, node.parent) > 0;
}

export interface Purchase {
  currency: number;
  level: number;
}

export function purchaseNode(levels: TreeLevels, id: string, currency: number): Purchase | null {
  if (!nodeAvailable(levels, id)) return null;
  const level = nodeLevel(levels, id);
  const cost = nodeCost(id, level);
  if (cost === null || currency < cost) return null;
  return { currency: currency - cost, level: level + 1 };
}

export function sanitizeTree(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (typeof value !== 'object' || value === null) return result;
  for (const node of upgradeTree) {
    const raw: unknown = Reflect.get(value, node.id);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      result[node.id] = Math.min(node.maxLevel, Math.floor(raw));
    }
  }
  return result;
}

export function loadoutFrom(levels: TreeLevels): Loadout {
  const loadout = neutralLoadout(false);
  for (const node of upgradeTree) {
    const level = nodeLevel(levels, node.id);
    if (level <= 0) continue;
    const bonus = node.perLevel * level;
    const effect = node.effect;
    if (effect.type === 'unlockTurret') loadout.turrets[effect.turret].unlocked = true;
    else if (effect.type === 'turret') loadout.turrets[effect.turret][effect.stat] += bonus;
    else if (effect.type === 'unlockAbility') loadout.abilities[effect.ability].unlocked = true;
    else if (effect.type === 'ability') {
      if (effect.stat === 'cooldown') loadout.abilities[effect.ability].cooldown -= bonus;
      else loadout.abilities[effect.ability].power += bonus;
    } else if (effect.type === 'limit') loadout.turretLimitBonus += Math.round(bonus);
    else if (effect.type === 'baseHp') loadout.baseHp += bonus;
    else if (effect.type === 'reward') loadout.reward += bonus;
  }
  return loadout;
}
