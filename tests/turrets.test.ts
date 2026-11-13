import { describe, expect, it } from 'vitest';
import { abilities, goblins, rocket, turretRules, turrets } from '../src/game/balance';
import type { LevelData, Obstacle } from '../src/game/levels/level-types';
import { applyDamage, applySlow, computeDamage } from '../src/game/sim/damage';
import { neutralLoadout } from '../src/game/sim/loadout';
import { angleDelta, inSector, pickTarget, turretSpec } from '../src/game/sim/turrets';
import { World } from '../src/game/sim/world';

function level(obstacles: Obstacle[] = [], extra: Partial<LevelData> = {}): LevelData {
  return {
    id: 'test',
    name: 'level.stress',
    chapter: 1,
    grid: { cols: 36, rows: 64, cell: 20 },
    tiles: 'meadow',
    obstacles,
    entries: [{ id: 'a', x: 360, y: 0, radius: 40 }],
    zones: [{ x: 0, y: 1040, w: 720, h: 80 }],
    baseHp: 100,
    turretLimit: 4,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 3, duration: 1, entry: 'a', delay: 0 }] }],
    ...extra,
  };
}

function battle(obstacles: Obstacle[] = [], extra: Partial<LevelData> = {}): World {
  return new World({ level: level(obstacles, extra), manualSpawns: true, seed: 3 });
}

function run(world: World, seconds: number): void {
  for (let i = 0; i < seconds * 60; i += 1) world.step(1 / 60);
}

const UP = -Math.PI / 2;

describe('sector', () => {
  const spec = { range: 200, minRange: 50, halfArc: Math.PI / 6 };
  const turret = { x: 100, y: 100, angle: 0 };

  it('accepts points inside the cone and range', () => {
    expect(inSector(turret, spec, 250, 100)).toBe(true);
    expect(inSector(turret, spec, 250, 160)).toBe(true);
  });

  it('rejects points outside the angle, beyond range or in the dead zone', () => {
    expect(inSector(turret, spec, 100, 250)).toBe(false);
    expect(inSector(turret, spec, 20, 100)).toBe(false);
    expect(inSector(turret, spec, 320, 100)).toBe(false);
    expect(inSector(turret, spec, 130, 100)).toBe(false);
  });

  it('wraps angles across the -PI/PI seam', () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
    const west = { x: 100, y: 100, angle: Math.PI };
    expect(inSector(west, spec, -50, 110)).toBe(true);
    expect(inSector(west, spec, -50, 90)).toBe(true);
  });

  it('treats a full circle as always in angle', () => {
    expect(inSector(turret, { range: 200, minRange: 0, halfArc: Math.PI }, 0, 100)).toBe(true);
  });

  it('caps a widened arc and scales stats by modifiers', () => {
    const mods = { ...neutralLoadout().turrets.ballista, arc: 10, damage: 2, rate: 2, range: 1.5 };
    const wide = turretSpec('ballista', mods);
    expect(wide.halfArc).toBeCloseTo((turretRules.arcDegMax * Math.PI) / 360);
    expect(wide.damage).toBe(turrets.ballista.damage * 2);
    expect(wide.cooldown).toBeCloseTo(turrets.ballista.cooldown / 2);
    expect(wide.range).toBeCloseTo(turrets.ballista.range * 1.5);
  });
});

describe('targeting and line of sight', () => {
  const rock: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 300, y: 500, w: 120, h: 40 } };

  it('does not see through rock but a mortar lobs over it', () => {
    const world = battle([rock]);
    const ballista = world.addTurret('ballista', 360, 620, UP);
    const mortar = world.addTurret('mortar', 440, 640, UP);
    expect(ballista && mortar).toBeTruthy();
    world.startBattle();
    const hidden = world.spawnGoblin('brute', 360, 440);
    world.step(1 / 60);
    if (!ballista || !mortar) return;
    expect(pickTarget(world, ballista, world.specs.ballista)).toBe(-1);
    expect(pickTarget(world, mortar, world.specs.mortar)).toBe(hidden);
  });

  it('sees across water', () => {
    const world = battle([
      { type: 'water', shape: { kind: 'rect', x: 300, y: 500, w: 120, h: 40 } },
    ]);
    const ballista = world.addTurret('ballista', 360, 620, UP);
    world.startBattle();
    const target = world.spawnGoblin('brute', 360, 440);
    world.step(1 / 60);
    expect(ballista && pickTarget(world, ballista, world.specs.ballista)).toBe(target);
  });

  it('ignores goblins outside the sector and prefers the one closest to the zone', () => {
    const world = battle();
    const turret = world.addTurret('ballista', 360, 700, UP);
    world.startBattle();
    world.spawnGoblin('grunt', 600, 760);
    const far = world.spawnGoblin('grunt', 360, 420);
    const near = world.spawnGoblin('grunt', 360, 560);
    world.step(1 / 60);
    if (!turret) throw new Error('turret was not placed');
    expect(far).not.toBe(near);
    expect(pickTarget(world, turret, world.specs.ballista)).toBe(near);
  });

  it('keeps the mortar dead zone and its ban on flying targets', () => {
    const world = battle();
    const mortar = world.addTurret('mortar', 360, 700, UP);
    world.startBattle();
    world.spawnGoblin('grunt', 360, 660);
    world.spawnGoblin('glider', 360, 500);
    world.step(1 / 60);
    if (!mortar) throw new Error('turret was not placed');
    expect(pickTarget(world, mortar, world.specs.mortar)).toBe(-1);
  });
});

describe('placement', () => {
  it('rejects obstacles, the red zone, other turrets and the limit', () => {
    const rock: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 300, y: 500, w: 120, h: 40 } };
    const world = battle([rock], { turretLimit: 2 });
    expect(world.placementIssue('ballista', 360, 520)).toBe('blocked');
    expect(world.placementIssue('ballista', 360, 1060)).toBe('blocked');
    expect(world.placementIssue('ballista', 360, 300)).toBe('ok');
    const first = world.addTurret('ballista', 360, 300);
    expect(world.placementIssue('ballista', 380, 310)).toBe('blocked');
    expect(world.addTurret('mortar', 200, 300)).not.toBeNull();
    expect(world.placementIssue('ballista', 500, 300)).toBe('limit');
    if (!first) throw new Error('turret was not placed');
    expect(world.moveTurret(first.id, 500, 300)).toBe(true);
    expect(world.moveTurret(first.id, 210, 310)).toBe(false);
  });

  it('locks turrets that are not unlocked and freezes placement in battle', () => {
    const world = new World({ level: level(), loadout: neutralLoadout(false), manualSpawns: true });
    expect(world.placementIssue('tesla', 360, 300)).toBe('locked');
    const turret = world.addTurret('ballista', 360, 300);
    world.startBattle();
    expect(world.addTurret('ballista', 200, 300)).toBeNull();
    expect(turret && world.moveTurret(turret.id, 200, 300)).toBe(false);
    expect(turret && world.removeTurret(turret.id)).toBe(false);
  });
});

describe('damage and armour', () => {
  it('subtracts armour from bolts before the resistance', () => {
    const { armor, resist } = goblins.shield;
    expect(computeDamage(26, 'bolt', goblins.shield)).toBeCloseTo((26 - armor) * resist.bolt);
    expect(computeDamage(26, 'bolt', goblins.grunt)).toBe(26);
  });

  it('ignores armour for explosions and applies the weakness', () => {
    expect(computeDamage(20, 'blast', goblins.shield)).toBeCloseTo(
      20 * goblins.shield.resist.blast,
    );
    expect(goblins.shield.resist.blast).toBeGreaterThan(1);
  });

  it('never drops below 10% of raw damage', () => {
    expect(computeDamage(5, 'bolt', goblins.shield)).toBeCloseTo(0.5);
    expect(computeDamage(0, 'bolt', goblins.shield)).toBe(0);
  });

  it('kills a goblin and counts its bounty', () => {
    const world = battle();
    world.startBattle();
    const i = world.spawnGoblin('grunt', 360, 400);
    expect(applyDamage(world, i, 1000, 'blast')).toBe(1000);
    world.step(1 / 60);
    expect(world.kills).toBe(1);
    expect(world.bounty).toBe(goblins.grunt.bounty);
  });

  it('slows ground goblins but not gliders', () => {
    const world = battle();
    world.startBattle();
    const grunt = world.spawnGoblin('grunt', 360, 400);
    const glider = world.spawnGoblin('glider', 360, 400);
    applySlow(world, grunt, 0.5, 1);
    applySlow(world, glider, 0.5, 1);
    expect(world.horde.slowFactor[grunt]).toBeCloseTo(0.5);
    expect(world.horde.slowTimer[glider]).toBe(0);
  });
});

describe('turrets in battle', () => {
  it('lets every turret type damage a brute in its sector', () => {
    for (const kind of ['ballista', 'mortar', 'gatling', 'tar', 'tesla', 'beam'] as const) {
      const world = battle();
      const turret = world.addTurret(kind, 360, 700, UP);
      expect(turret).not.toBeNull();
      world.startBattle();
      const brute = world.spawnGoblin('brute', 360, 580);
      world.horde.speed[brute] = 0;
      run(world, 4);
      expect(world.horde.hp[brute]).toBeLessThan(goblins.brute.hp);
    }
  });

  it('chains tesla lightning with falling damage', () => {
    const world = battle();
    world.addTurret('tesla', 360, 700, UP);
    world.startBattle();
    const ids = [0, 1, 2, 3, 4, 5].map((n) => {
      const i = world.spawnGoblin('brute', 300 + n * 24, 640);
      world.horde.speed[i] = 0;
      return i;
    });
    run(world, 0.3);
    const lost = ids.map((i) => goblins.brute.hp - (world.horde.hp[i] ?? 0)).filter((d) => d > 0);
    expect(lost).toHaveLength(turrets.tesla.special);
    const sorted = lost.toSorted((a, b) => b - a);
    expect(sorted[0]).toBeCloseTo(turrets.tesla.damage, 3);
    expect(sorted[1]).toBeCloseTo(turrets.tesla.damage * turretRules.chainFalloff, 3);
  });

  it('pierces the whole line with the beam and stops at rock', () => {
    const rock: Obstacle = { type: 'rock', shape: { kind: 'rect', x: 300, y: 400, w: 120, h: 40 } };
    const world = battle([rock]);
    world.addTurret('beam', 360, 700, UP);
    world.startBattle();
    const a = world.spawnGoblin('brute', 360, 620);
    const b = world.spawnGoblin('brute', 360, 520);
    const behind = world.spawnGoblin('brute', 360, 340);
    for (const i of [a, b, behind]) world.horde.speed[i] = 0;
    run(world, 1);
    expect(world.horde.hp[a]).toBeLessThan(goblins.brute.hp);
    expect(world.horde.hp[b]).toBeLessThan(goblins.brute.hp);
    expect(world.horde.hp[behind]).toBe(goblins.brute.hp);
  });

  it('heals near a shaman and splits the boss', () => {
    const world = battle();
    world.startBattle();
    const brute = world.spawnGoblin('brute', 360, 400);
    world.spawnGoblin('shaman', 370, 400);
    applyDamage(world, brute, 200, 'blast');
    const wounded = world.horde.hp[brute] ?? 0;
    run(world, 3);
    expect(world.horde.hp[brute]).toBeGreaterThan(wounded);
    const boss = world.spawnGoblin('boss', 360, 300);
    applyDamage(world, boss, 1e6, 'blast');
    world.step(1 / 60);
    expect(world.horde.count).toBeGreaterThan(15);
  });
});

describe('run flow', () => {
  it('wins after all waves are spawned and killed', () => {
    const world = new World({ level: level(), seed: 5 });
    world.addTurret('gatling', 360, 300, UP);
    world.addTurret('gatling', 300, 420, UP);
    world.addTurret('tesla', 360, 600, UP);
    world.startBattle();
    run(world, 40);
    expect(world.phase).toBe('won');
    expect(world.kills).toBe(3);
  });

  it('loses hp per leaked goblin and loses the run at zero', () => {
    const world = new World({ level: level([], { baseHp: 2 }), seed: 5 });
    world.startBattle();
    run(world, 60);
    expect(world.phase).toBe('lost');
    expect(world.baseHp).toBe(0);
    expect(world.revive()).toBe(true);
    expect(world.baseHp).toBe(1);
    expect(world.revive()).toBe(false);
  });

  it('wins a timer level when the clock runs out', () => {
    const world = new World({
      level: level([], { win: { type: 'timer', seconds: 5 }, baseHp: 1000 }),
      seed: 5,
    });
    world.startBattle();
    run(world, 4);
    expect(world.phase).toBe('battle');
    run(world, 1.1);
    expect(world.phase).toBe('won');
  });

  it('uses abilities with cooldowns and a single big bang', () => {
    const world = battle();
    expect(world.useBigBang()).toBe(false);
    world.startBattle();
    const targets = [0, 1, 2].map((n) => {
      const i = world.spawnGoblin('brute', 300 + n * 60, 500);
      world.horde.speed[i] = 0;
      return i;
    });
    expect(world.useAirstrike(280, 500, 440, 500)).toBe(true);
    expect(world.useAirstrike(280, 500, 440, 500)).toBe(false);
    expect(world.abilityCooldown.airstrike).toBeCloseTo(abilities.airstrike.cooldown);
    run(world, 2);
    for (const i of targets) expect(world.horde.hp[i]).toBeLessThan(goblins.brute.hp);
    const before = world.horde.hp[targets[0] ?? 0] ?? 0;
    expect(world.usePillar(300, 500)).toBe(true);
    run(world, 1);
    expect(world.horde.hp[targets[0] ?? 0]).toBeLessThan(before);
    world.spawnGoblin('grunt', 100, 300);
    expect(world.useBigBang()).toBe(true);
    world.step(1 / 60);
    expect(world.useBigBang()).toBe(false);
    world.grantBigBang();
    expect(world.abilityReady('bigBang')).toBe(true);
  });
});

describe('player rocket', () => {
  it('flies from the base to the tap and blows up the crowd there', () => {
    const world = battle();
    world.startBattle();
    const near = world.spawnGoblin('brute', 360, 400);
    const far = world.spawnGoblin('brute', 600, 900);
    const flyer = world.spawnGoblin('glider', 380, 410);
    for (const i of [near, far, flyer]) world.horde.speed[i] = 0;
    expect(world.fireRocket(360, 400)).toBe(true);
    expect(world.projectiles.count).toBe(1);
    expect(world.projectiles.items[0]?.sy).toBeGreaterThan(1000);
    run(world, 1.5);
    expect(world.horde.hp[near]).toBeLessThan(goblins.brute.hp);
    expect(world.horde.hp[far]).toBe(goblins.brute.hp);
    expect(world.horde.hp[flyer]).toBeLessThan(goblins.glider.hp);
  });

  it('reloads between shots and only works in battle', () => {
    const world = battle();
    expect(world.fireRocket(360, 400)).toBe(false);
    world.startBattle();
    expect(world.fireRocket(360, 400)).toBe(true);
    expect(world.fireRocket(360, 400)).toBe(false);
    run(world, rocket.cooldown + 0.05);
    expect(world.fireRocket(360, 400)).toBe(true);
    expect(world.rocketsFired).toBe(2);
  });

  it('scales with the upgrade tree', () => {
    const loadout = neutralLoadout();
    loadout.rocket = { damage: 2, rate: 2, radius: 1.5 };
    const world = new World({ level: level(), loadout, manualSpawns: true });
    world.startBattle();
    world.fireRocket(360, 400);
    const shot = world.projectiles.items[0];
    expect(shot?.damage).toBe(rocket.damage * 2);
    expect(shot?.splash).toBe(rocket.radius * 1.5);
    expect(world.rocketCooldown).toBeCloseTo(rocket.cooldown / 2);
  });
});

describe('goblins left counter', () => {
  it('counts every goblin of every wave and goes down as they die or leak', () => {
    const twoWaves = level([], {
      waves: [
        { groups: [{ goblin: 'grunt', count: 3, duration: 1, entry: 'a', delay: 0 }] },
        { groups: [{ goblin: 'runner', count: 4, duration: 1, entry: 'a', delay: 0 }] },
      ],
    });
    const world = new World({ level: twoWaves, seed: 2 });
    expect(world.goblinsLeft).toBe(7);
    world.startBattle();
    run(world, 0.5);
    expect(world.goblinsLeft).toBe(7);
    for (let i = 0; i < world.horde.count; i += 1) world.horde.hp[i] = 0;
    const alive = world.horde.count;
    world.step(1 / 60);
    expect(world.goblinsLeft).toBe(7 - alive);
    run(world, 60);
    expect(world.goblinsLeft).toBe(0);
  });
});
