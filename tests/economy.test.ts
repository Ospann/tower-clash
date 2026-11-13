import { describe, expect, it } from 'vitest';
import { economy, upgradeTree } from '../src/game/balance';
import { rewardFor, starsFor } from '../src/game/sim/economy';
import { neutralLoadout } from '../src/game/sim/loadout';
import {
  loadoutFrom,
  nodeAvailable,
  nodeCost,
  nodeLevel,
  nodeVisible,
  purchaseNode,
  sanitizeTree,
  treeNode,
} from '../src/game/sim/tree';

describe('stars', () => {
  it('awards 1-3 stars by the remaining base hp', () => {
    const [three, two] = economy.starThresholds;
    expect(starsFor(1, false)).toBe(3);
    expect(starsFor(three - 0.01, false)).toBe(2);
    expect(starsFor(two - 0.01, false)).toBe(1);
    expect(starsFor(0, false)).toBe(0);
    expect(starsFor(1, true)).toBe(economy.maxStarsAfterRevive);
  });
});

describe('run reward', () => {
  const base = { levelIndex: 3, bounty: 400, stars: 2, multiplier: 1 };

  it('pays more for a win, but never zero for a loss', () => {
    const win = rewardFor({ ...base, won: true });
    const loss = rewardFor({ ...base, won: false, stars: 0 });
    expect(win).toBeGreaterThan(loss);
    expect(loss).toBeGreaterThan(0);
    expect(rewardFor({ levelIndex: 0, bounty: 0, won: false, stars: 0, multiplier: 1 })).toBe(
      economy.lossFloor,
    );
  });

  it('grows with kills, level, stars and the tree multiplier', () => {
    const win = rewardFor({ ...base, won: true });
    expect(rewardFor({ ...base, won: true, bounty: 800 })).toBeGreaterThan(win);
    expect(rewardFor({ ...base, won: true, levelIndex: 9 })).toBeGreaterThan(win);
    expect(rewardFor({ ...base, won: true, stars: 3 })).toBe(win + economy.starBonus);
    expect(rewardFor({ ...base, won: true, multiplier: 2 })).toBeGreaterThanOrEqual(win * 2 - 1);
  });
});

describe('upgrade tree', () => {
  it('has 40-60 nodes with unique ids and existing parents', () => {
    expect(upgradeTree.length).toBeGreaterThanOrEqual(40);
    expect(upgradeTree.length).toBeLessThanOrEqual(60);
    const ids = new Set(upgradeTree.map((node) => node.id));
    expect(ids.size).toBe(upgradeTree.length);
    for (const node of upgradeTree) {
      expect(node.parent === null || ids.has(node.parent)).toBe(true);
    }
    expect(upgradeTree.filter((node) => node.parent === null).map((node) => node.id)).toEqual([
      'core',
    ]);
  });

  it('connects every node to the root without cycles', () => {
    for (const node of upgradeTree) {
      let current = node;
      let hops = 0;
      while (current.parent !== null) {
        const parent = treeNode(current.parent);
        expect(parent).toBeDefined();
        if (!parent) break;
        current = parent;
        hops += 1;
        expect(hops).toBeLessThan(upgradeTree.length);
      }
      expect(current.id).toBe('core');
    }
  });

  it('raises the price with each level and stops at the cap', () => {
    for (const node of upgradeTree) {
      let previous = -1;
      for (let level = 0; level < node.maxLevel; level += 1) {
        const cost = nodeCost(node.id, level);
        expect(cost).not.toBeNull();
        expect(node.maxLevel === 1 || (cost ?? 0) > previous).toBe(true);
        previous = cost ?? 0;
      }
      expect(nodeCost(node.id, node.maxLevel)).toBeNull();
    }
    expect(nodeCost('nope', 0)).toBeNull();
  });

  it('requires the parent before a node can be bought', () => {
    expect(nodeAvailable({}, 'mortar.unlock')).toBe(true);
    expect(nodeAvailable({}, 'mortar.damage')).toBe(false);
    expect(purchaseNode({}, 'mortar.damage', 9999)).toBeNull();
    expect(nodeAvailable({ 'mortar.unlock': 1 }, 'mortar.damage')).toBe(true);
    expect(nodeAvailable({}, 'ballista.damage')).toBe(true);
  });

  it('buys a level only with enough currency', () => {
    const cost = nodeCost('baseHp', 0) ?? 0;
    expect(purchaseNode({}, 'baseHp', cost - 1)).toBeNull();
    expect(purchaseNode({}, 'baseHp', cost + 3)).toEqual({ currency: 3, level: 1 });
    const max = treeNode('baseHp')?.maxLevel ?? 0;
    expect(purchaseNode({ baseHp: max }, 'baseHp', 1e9)).toBeNull();
  });

  it('starts with only the ballista and no abilities', () => {
    const fresh = loadoutFrom({});
    expect(fresh).toEqual(neutralLoadout(false));
    expect(fresh.turrets.ballista.unlocked).toBe(true);
    expect(fresh.turrets.mortar.unlocked).toBe(false);
    expect(fresh.abilities.airstrike.unlocked).toBe(false);
  });

  it('turns node levels into a loadout', () => {
    const loadout = loadoutFrom({
      'mortar.unlock': 1,
      'mortar.damage': 2,
      'ballista.rate': 3,
      'ballista.count': 2,
      'mortar.count': 1,
      baseHp: 4,
      reward: 1,
      'airstrike.unlock': 1,
      'airstrike.cooldown': 2,
      'airstrike.power': 1,
    });
    expect(loadout.turrets.mortar.unlocked).toBe(true);
    expect(loadout.turrets.mortar.damage).toBeCloseTo(
      1 + 2 * (treeNode('mortar.damage')?.perLevel ?? 0),
    );
    expect(loadout.turrets.ballista.rate).toBeCloseTo(
      1 + 3 * (treeNode('ballista.rate')?.perLevel ?? 0),
    );
    expect(loadout.turrets.ballista.count).toBe(3);
    expect(loadout.turrets.mortar.count).toBe(2);
    expect(loadout.turrets.gatling.unlocked).toBe(false);
    expect(loadout.baseHp).toBeGreaterThan(1);
    expect(loadout.reward).toBeGreaterThan(1);
    expect(loadout.abilities.airstrike.unlocked).toBe(true);
    expect(loadout.abilities.airstrike.cooldown).toBeLessThan(1);
    expect(loadout.abilities.airstrike.power).toBeGreaterThan(1);
  });

  it('reveals only purchased nodes and their children', () => {
    expect(nodeVisible({}, 'ballista.count')).toBe(true);
    expect(nodeVisible({}, 'mortar.unlock')).toBe(true);
    expect(nodeVisible({}, 'mortar.count')).toBe(false);
    expect(nodeVisible({}, 'gatling.unlock')).toBe(false);
    expect(nodeVisible({ 'mortar.unlock': 1 }, 'mortar.count')).toBe(true);
  });

  it('clamps and cleans stored levels', () => {
    expect(nodeLevel({ baseHp: 999 }, 'baseHp')).toBe(treeNode('baseHp')?.maxLevel);
    expect(nodeLevel({ baseHp: -3 }, 'baseHp')).toBe(0);
    expect(nodeLevel({}, 'core')).toBe(1);
    expect(sanitizeTree({ baseHp: 2.9, hacked: 5, limit: 'x', reward: -1 })).toEqual({ baseHp: 2 });
    expect(sanitizeTree(null)).toEqual({});
  });
});
