import Phaser from 'phaser';
import type { TranslationKey } from '../../i18n';
import { ATLAS_KEY, Frame, generateLevelMap, hexToInt, palette } from '../art';
import { Sfx, type SfxName } from '../audio/sfx';
import { fxLimits, TURRET_KINDS, type TurretKind } from '../balance';
import { gameConfig, layout, simConfig } from '../config';
import { DebugOverlay } from '../debug/debug-overlay';
import { debugFlags } from '../debug/flags';
import { StressDriver, stressLevel, stressTurrets } from '../debug/stress';
import { GameEvent, SceneKey } from '../keys';
import { levelById, levelIndex, levels } from '../levels';
import type { LevelData } from '../levels/level-types';
import { FxRenderer } from '../render/fx-renderer';
import { HordeRenderer } from '../render/horde-renderer';
import { ProjectileRenderer } from '../render/projectile-renderer';
import { TurretRenderer } from '../render/turret-renderer';
import { sanitizePlacement } from '../save';
import { services } from '../services';
import { rewardFor, starsFor } from '../sim/economy';
import { FX_STRIDE, FxKind, type FxEvents } from '../sim/events';
import { neutralLoadout, unlockedTurrets, type AbilityKind } from '../sim/loadout';
import { loadoutFrom, sanitizeTree } from '../sim/tree';
import type { Turret } from '../sim/turrets';
import { World } from '../sim/world';
import { Button } from '../ui/button';
import { Hud, UI_DEPTH, type AbilityView } from '../ui/hud';
import { addLabel } from '../ui/text';
import { pauseGame } from './pause';

export interface GameSceneData {
  levelId?: string;
}

export interface ResultData {
  levelId: string;
  won: boolean;
  stars: number;
  reward: number;
  kills: number;
  leaked: number;
}

const Depth = {
  Map: 0,
  Decals: 2,
  Ground: 4,
  Cones: 6,
  Horde: 20,
  Turrets: 30,
  Projectiles: 40,
  Air: 50,
  Handles: 60,
  Overlay: UI_DEPTH + 50,
} as const;

const shotSound: Readonly<Record<TurretKind, SfxName | null>> = {
  ballista: 'shot',
  mortar: 'cannon',
  gatling: 'shot',
  tar: 'flask',
  tesla: 'zap',
  beam: null,
};

type Mode = 'none' | 'drag' | 'rotate' | 'new' | 'swipe';

interface Ghost {
  kind: TurretKind;
  x: number;
  y: number;
  angle: number;
  ok: boolean;
}

const RESULT_DELAY_MS = 900;
const HINT_MS = 1600;

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private world!: World;
  private hordeRenderer!: HordeRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private turretRenderer!: TurretRenderer;
  private fx!: FxRenderer;
  private sfx!: Sfx;
  private hud!: Hud;
  private rotateHandle!: Phaser.GameObjects.Image;
  private removeHandle!: Phaser.GameObjects.Image;
  private swipeLine!: Phaser.GameObjects.Graphics;
  private stress: StressDriver | null = null;
  private overlay: DebugOverlay | null = null;
  private defeat: Phaser.GameObjects.Container | null = null;
  private levelId = '';
  private accumulator = 0;
  private speed = 1;
  private mode: Mode = 'none';
  private selected = -1;
  private armedKind: TurretKind | null = null;
  private armedAbility: AbilityKind | null = null;
  private ghost: Ghost | null = null;
  private dragX = 0;
  private dragY = 0;
  private swipeX = 0;
  private swipeY = 0;
  private hintKey: TranslationKey | null = null;
  private hintUntil = 0;
  private rotated = false;
  private bigBangAdUsed = false;
  private ended = false;
  private busy = false;
  private tutorial = false;
  private lastShakeAt = 0;

  constructor() {
    super(SceneKey.Game);
  }

  init(data: GameSceneData): void {
    this.levelId = data.levelId ?? '';
  }

  create(): void {
    const { platform, gameplay, save, i18n } = services();
    const stress = debugFlags.stress > 0;
    const level = stress ? stressLevel() : (levelById(this.levelId) ?? levels[0]);
    if (!level) throw new Error('No levels are available');
    this.level = level;

    this.accumulator = 0;
    this.speed = 1;
    this.mode = 'none';
    this.selected = -1;
    this.armedKind = null;
    this.armedAbility = null;
    this.ghost = null;
    this.hintKey = null;
    this.rotated = false;
    this.bigBangAdUsed = false;
    this.ended = false;
    this.busy = false;
    this.defeat = null;
    this.tutorial = !stress && !save.data.tutorialSeen && levelIndex(level.id) < 2;

    const loadout = stress ? neutralLoadout() : loadoutFrom(sanitizeTree(save.data.tree));
    this.world = new World({
      level,
      loadout,
      seed: (Date.now() % 100000) + 1,
      invulnerable: stress,
      manualSpawns: stress,
    });
    const world = this.world;

    this.add.image(0, 0, generateLevelMap(this.textures, level)).setOrigin(0).setDepth(Depth.Map);
    this.fx = new FxRenderer(this, world.map.width, world.map.height, {
      decals: Depth.Decals,
      ground: Depth.Ground,
      air: Depth.Air,
    });
    this.turretRenderer = new TurretRenderer(this, {
      cones: Depth.Cones,
      turrets: Depth.Turrets,
      beams: Depth.Projectiles,
    });
    this.hordeRenderer = new HordeRenderer(this, Depth.Horde);
    this.projectileRenderer = new ProjectileRenderer(this, Depth.Projectiles);
    this.sfx = new Sfx(this);
    this.rotateHandle = this.add
      .image(0, 0, ATLAS_KEY, Frame.Handle)
      .setDepth(Depth.Handles)
      .setScale(1.3)
      .setVisible(false);
    this.removeHandle = this.add
      .image(0, 0, ATLAS_KEY, Frame.Remove)
      .setDepth(Depth.Handles)
      .setScale(1.35)
      .setVisible(false);
    this.swipeLine = this.add.graphics().setDepth(Depth.Handles);

    this.hud = new Hud(this, i18n, unlockedTurrets(loadout), {
      onPause: () => pauseGame(this.game),
      onSpeed: () => {
        this.speed = this.speed === 1 ? 2 : 1;
        this.sfx.play('click');
      },
      onFight: () => this.fight(),
      onReset: () => {
        if (world.phase !== 'prep') return;
        world.clearTurrets();
        this.selected = -1;
        this.sfx.play('click');
        this.savePlacement();
      },
      onPick: (kind) => {
        if (world.phase !== 'prep') return;
        const same = this.armedKind === kind;
        this.armedKind = same ? null : kind;
        this.selected = -1;
        this.mode = same ? 'none' : 'new';
        this.ghost = null;
        this.sfx.play('click');
      },
      onAbility: (kind) => this.onAbility(kind),
    });

    if (stress) {
      for (const spot of stressTurrets) world.addTurret(spot.kind, spot.x, spot.y, spot.angle);
      world.startBattle();
      this.stress = new StressDriver(world, debugFlags.stress);
    } else {
      this.stress = null;
      for (const item of sanitizePlacement(save.data.placements[level.id])) {
        world.addTurret(item.kind, item.x, item.y, item.angle);
      }
    }

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        this.onDown(pointer, over);
      },
    );
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.onMove(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.onUp(pointer);
    });

    if (debugFlags.debug) {
      this.overlay = new DebugOverlay(this.game);
      if (import.meta.env.DEV) Object.assign(window, { __debug: this.overlay, __world: world });
    }

    platform.levelStart({ level: level.id });
    gameplay.start();

    this.events.once(GameEvent.Abandon, () => {
      this.ended = true;
      platform.levelFail({ level: level.id });
      this.scene.start(SceneKey.LevelSelect);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(GameEvent.Abandon);
      this.input.removeAllListeners();
      this.hordeRenderer.destroy();
      this.projectileRenderer.destroy();
      this.turretRenderer.destroy();
      this.fx.destroy();
      this.overlay?.destroy();
      this.overlay = null;
    });
    this.cameras.main.fadeIn(220);
  }

  override update(_time: number, delta: number): void {
    const { ads } = services();
    const world = this.world;
    const started = performance.now();
    const frozen = this.ended || this.defeat !== null || ads.isBusy;

    if (!frozen && world.phase === 'battle') {
      this.accumulator += Math.min(delta, 100) / 1000;
      let steps = 0;
      while (this.accumulator >= simConfig.stepSec && steps < simConfig.maxStepsPerFrame) {
        this.accumulator -= simConfig.stepSec;
        for (let n = 0; n < this.speed; n += 1) {
          this.stress?.update();
          world.step(simConfig.stepSec);
        }
        steps += 1;
      }
      if (steps === simConfig.maxStepsPerFrame) this.accumulator = 0;
    }
    const simMs = performance.now() - started;

    this.fx.consume(world.events);
    this.react(world.events);
    world.events.clear();

    const now = this.time.now / 1000;
    const dt = Math.min(delta, 100) / 1000;
    this.hordeRenderer.sync(world.horde, world.time);
    this.projectileRenderer.sync(world.projectiles);
    this.turretRenderer.sync(world, now);
    this.fx.update(frozen ? 0 : dt * this.speed, world.zones, now);
    this.syncPrep();
    this.syncHud(now);

    if (!this.ended && !this.stress) {
      if (world.phase === 'won') this.finish(true);
      else if (world.phase === 'lost' && !this.defeat) {
        if (world.revived) this.finish(false);
        else this.openDefeat();
      }
    }

    this.overlay?.frame({
      enemies: world.horde.count,
      projectiles: world.projectiles.count,
      particles: this.fx.particleCount,
      simMs,
    });
  }

  private inMap(y: number): boolean {
    return y > layout.hudHeight && y < layout.bottomBarY;
  }

  private handlePoint(turret: Turret, back: boolean): { x: number; y: number } {
    const spec = this.world.specs[turret.kind];
    const reach = back ? 62 : Math.min(Math.max(spec.range * 0.5, 90), 140);
    const angle = back ? turret.angle + Math.PI : turret.angle;
    return {
      x: Phaser.Math.Clamp(turret.x + Math.cos(angle) * reach, 34, gameConfig.width - 34),
      y: Phaser.Math.Clamp(
        turret.y + Math.sin(angle) * reach,
        layout.hudHeight + 34,
        layout.bottomBarY - 34,
      ),
    };
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length > 0 || this.ended || this.defeat) return;
    const world = this.world;
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (!this.inMap(y)) return;

    if (world.phase === 'battle') {
      if (this.armedAbility === 'pillar') {
        if (world.usePillar(x, y)) this.sfx.play('zap');
        this.armedAbility = null;
      } else if (this.armedAbility === 'airstrike') {
        this.mode = 'swipe';
        this.swipeX = x;
        this.swipeY = y;
      }
      return;
    }
    if (world.phase !== 'prep') return;

    const current = world.turretById(this.selected);
    if (current) {
      const rotate = this.handlePoint(current, false);
      if (current.kind !== 'tesla' && Math.hypot(rotate.x - x, rotate.y - y) < 40) {
        this.mode = 'rotate';
        return;
      }
      const remove = this.handlePoint(current, true);
      if (Math.hypot(remove.x - x, remove.y - y) < 36) {
        world.removeTurret(current.id);
        this.selected = -1;
        this.sfx.play('click');
        this.savePlacement();
        return;
      }
    }
    const turret = world.turretAt(x, y);
    if (turret) {
      this.selected = turret.id;
      this.armedKind = null;
      this.mode = 'drag';
      this.dragX = turret.x - x;
      this.dragY = turret.y - y;
      return;
    }
    if (this.armedKind) {
      this.place(this.armedKind, x, y);
      return;
    }
    this.selected = -1;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.ended) return;
    const world = this.world;
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (this.mode === 'drag') {
      const turret = world.turretById(this.selected);
      if (!turret) return;
      const tx = x + this.dragX;
      const ty = y + this.dragY;
      if (world.moveTurret(turret.id, tx, ty)) this.ghost = null;
      else this.ghost = { kind: turret.kind, x: tx, y: ty, angle: turret.angle, ok: false };
    } else if (this.mode === 'rotate') {
      const turret = world.turretById(this.selected);
      if (!turret) return;
      if (Math.hypot(x - turret.x, y - turret.y) > 12) {
        world.rotateTurret(turret.id, Math.atan2(y - turret.y, x - turret.x));
        this.rotated = true;
      }
    } else if (this.mode === 'new' && this.armedKind) {
      if (!this.inMap(y)) {
        this.ghost = null;
        return;
      }
      this.ghost = {
        kind: this.armedKind,
        x,
        y,
        angle: world.defaultAngle(x, y),
        ok: world.placementIssue(this.armedKind, x, y) === 'ok',
      };
    } else if (this.mode === 'swipe') {
      this.swipeLine
        .clear()
        .lineStyle(10, hexToInt(palette.danger), 0.5)
        .lineBetween(this.swipeX, this.swipeY, x, y);
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const mode = this.mode;
    this.mode = 'none';
    const ghost = this.ghost;
    this.ghost = null;
    if (this.ended) return;
    if (mode === 'drag' || mode === 'rotate') {
      this.savePlacement();
    } else if (mode === 'new') {
      if (ghost && this.armedKind) this.place(this.armedKind, ghost.x, ghost.y);
    } else if (mode === 'swipe') {
      this.swipeLine.clear();
      if (this.world.useAirstrike(this.swipeX, this.swipeY, pointer.worldX, pointer.worldY)) {
        this.sfx.play('click');
      }
      this.armedAbility = null;
    }
  }

  private place(kind: TurretKind, x: number, y: number): void {
    const world = this.world;
    const issue = world.placementIssue(kind, x, y);
    if (issue !== 'ok') {
      this.hintKey = issue === 'limit' ? 'prep.limit' : 'prep.blocked';
      this.hintUntil = this.time.now + HINT_MS;
      return;
    }
    const turret = world.addTurret(kind, x, y);
    if (!turret) return;
    this.selected = turret.id;
    this.armedKind = null;
    this.sfx.play('build');
    this.fx.ring(x, y, 16, 60, 0.3, hexToInt(palette.white), 0.9);
    this.savePlacement();
  }

  private savePlacement(): void {
    if (this.stress) return;
    const placed = this.world.turrets.map((turret) => ({
      kind: turret.kind,
      x: Math.round(turret.x),
      y: Math.round(turret.y),
      angle: Math.round(turret.angle * 1000) / 1000,
    }));
    services().save.update((data) => {
      data.placements[this.level.id] = placed;
    });
  }

  private fight(): void {
    const world = this.world;
    if (world.phase !== 'prep') return;
    if (world.turrets.length === 0) {
      this.hintKey = 'prep.empty';
      this.hintUntil = this.time.now + HINT_MS;
      return;
    }
    this.savePlacement();
    this.selected = -1;
    this.armedKind = null;
    this.mode = 'none';
    this.ghost = null;
    world.startBattle();
    this.sfx.play('click');
  }

  private syncPrep(): void {
    const world = this.world;
    const prep = world.phase === 'prep';
    this.turretRenderer.drawCones(world, this.selected, prep);
    const turret = prep ? world.turretById(this.selected) : undefined;
    if (prep && this.ghost) this.turretRenderer.drawGhost(world, this.ghost, this.ghost.ok);
    if (!turret) {
      this.rotateHandle.setVisible(false);
      this.removeHandle.setVisible(false);
      return;
    }
    const rotate = this.handlePoint(turret, false);
    const remove = this.handlePoint(turret, true);
    this.rotateHandle.setVisible(turret.kind !== 'tesla').setPosition(rotate.x, rotate.y);
    this.removeHandle.setVisible(this.mode !== 'drag').setPosition(remove.x, remove.y);
  }

  private abilityView(kind: AbilityKind): AbilityView {
    const world = this.world;
    const unlocked = world.loadout.abilities[kind].unlocked;
    return {
      unlocked,
      ready: world.abilityReady(kind),
      cooldown: world.abilityCooldown[kind],
      armed: this.armedAbility === kind,
      adOffer:
        kind === 'bigBang' &&
        unlocked &&
        world.bigBangCharges <= 0 &&
        !this.bigBangAdUsed &&
        !this.stress,
    };
  }

  private syncHud(now: number): void {
    const world = this.world;
    const { i18n } = services();
    const battle = world.phase !== 'prep';
    let status = i18n.t('hud.prep');
    if (battle) {
      status =
        this.level.win.type === 'timer'
          ? i18n.t('hud.timer', { seconds: Math.ceil(world.timeLeft) })
          : i18n.t('hud.wave', {
              current: Math.max(1, world.runner.index + 1),
              total: this.level.waves.length,
            });
    }
    this.hud.update(
      {
        hp: world.baseHp,
        maxHp: world.baseMaxHp,
        turrets: world.turrets.length,
        turretLimit: world.turretLimit,
        status,
        battle,
        speed: this.speed,
        armedKind: this.armedKind,
        abilities: {
          airstrike: this.abilityView('airstrike'),
          pillar: this.abilityView('pillar'),
          bigBang: this.abilityView('bigBang'),
        },
      },
      now,
    );

    let hint: TranslationKey | null = null;
    if (this.hintKey && this.time.now < this.hintUntil) hint = this.hintKey;
    else if (this.armedAbility === 'airstrike') hint = 'ability.hint.airstrike';
    else if (this.armedAbility === 'pillar') hint = 'ability.hint.pillar';
    else if (this.tutorial && world.phase === 'prep' && this.mode === 'none') {
      if (world.turrets.length === 0) hint = 'tutorial.place';
      else if (!this.rotated) hint = 'tutorial.rotate';
      else hint = 'tutorial.fight';
    }
    this.hud.setHint(hint ? i18n.t(hint) : null);
  }

  private onAbility(kind: AbilityKind): void {
    const world = this.world;
    if (world.phase !== 'battle' || this.ended) return;
    if (kind === 'bigBang') {
      if (world.useBigBang()) this.sfx.play('blast');
      else if (!this.bigBangAdUsed && world.bigBangCharges <= 0) void this.rechargeBigBang();
      return;
    }
    if (!world.abilityReady(kind)) return;
    this.armedAbility = this.armedAbility === kind ? null : kind;
    this.sfx.play('click');
  }

  private async rechargeBigBang(): Promise<void> {
    if (this.busy || this.bigBangAdUsed || this.ended) return;
    this.busy = true;
    try {
      const rewarded = await services().ads.showRewarded();
      if (rewarded && !this.ended) {
        this.bigBangAdUsed = true;
        this.world.grantBigBang();
      }
    } finally {
      this.busy = false;
    }
  }

  private react(events: FxEvents): void {
    const d = events.data;
    let shake = 0;
    for (let e = 0; e < events.count; e += 1) {
      const o = e * FX_STRIDE;
      const kind = d[o]!;
      if (kind === FxKind.Death) {
        this.sfx.play('death');
      } else if (kind === FxKind.Shot) {
        const turret = TURRET_KINDS[d[o + 3]!];
        const sound = turret ? shotSound[turret] : null;
        if (sound) this.sfx.play(sound);
      } else if (kind === FxKind.Blast) {
        const strength = d[o + 4]!;
        if (strength !== 1) this.sfx.play('blast');
        shake = Math.max(shake, strength === 2 ? 0.8 : 0.3);
      } else if (kind === FxKind.Leak) {
        this.sfx.play('wall');
        shake = Math.max(shake, Math.min(0.7, 0.2 + d[o + 3]! / 20));
      } else if (kind === FxKind.BossDeath || kind === FxKind.BigBang) {
        this.sfx.play('blast');
        shake = 1;
      }
    }
    if (shake > 0) this.shake(shake);
  }

  private shake(strength: number): void {
    const now = this.time.now;
    if (now - this.lastShakeAt < fxLimits.shakeCooldownMs) return;
    this.lastShakeAt = now;
    const intensity = (fxLimits.shakeMaxPx * Math.min(1, strength)) / gameConfig.width;
    this.cameras.main.shake(140, intensity, true);
  }

  private openDefeat(): void {
    const { i18n, gameplay } = services();
    const { width, height } = this.scale;
    gameplay.stop();
    this.armedAbility = null;
    this.mode = 'none';
    this.swipeLine.clear();
    this.sfx.play('lose');

    const container = this.add.container(0, 0).setDepth(Depth.Overlay);
    const dim = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    const title = addLabel(this, width / 2, height * 0.34, i18n.t('defeat.title'), 60);
    const revive = new Button(
      this,
      width / 2,
      height * 0.48,
      i18n.t('defeat.revive'),
      () => void this.revive(),
      { width: 520, height: 150, fontSize: 38, color: 0x7d4bc4 },
    );
    const giveUp = new Button(
      this,
      width / 2,
      height * 0.62,
      i18n.t('defeat.giveUp'),
      () => {
        if (!this.busy) this.finish(false);
      },
      { width: 400, height: 100, fontSize: 36, color: 0x3a3f58 },
    );
    container.add([dim, title, revive, giveUp]);
    this.defeat = container;
  }

  private async revive(): Promise<void> {
    if (this.busy || this.ended) return;
    this.busy = true;
    try {
      const { ads, gameplay } = services();
      const rewarded = await ads.showRewarded();
      if (!rewarded || this.ended) return;
      if (!this.world.revive()) return;
      this.defeat?.destroy();
      this.defeat = null;
      gameplay.start();
    } finally {
      this.busy = false;
    }
  }

  private finish(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    const { platform, gameplay, ads, save } = services();
    const world = this.world;
    const id = this.level.id;
    const index = Math.max(0, levelIndex(id));
    const stars = won ? starsFor(world.baseHp / world.baseMaxHp, world.revived) : 0;
    const reward = rewardFor({
      levelIndex: index,
      bounty: world.bounty,
      won,
      stars,
      multiplier: world.loadout.reward,
    });

    gameplay.stop();
    if (won) platform.levelComplete({ level: id });
    else platform.levelFail({ level: id });
    ads.markLevelCompleted();
    save.update((data) => {
      data.currency += reward;
      if (won) {
        data.stars[id] = Math.max(stars, data.stars[id] ?? 0);
        if (index >= 1) data.tutorialSeen = true;
      }
    });
    this.armedAbility = null;
    if (won) this.sfx.play('win');
    else if (!this.defeat) this.sfx.play('lose');

    const result: ResultData = {
      levelId: id,
      won,
      stars,
      reward,
      kills: world.kills,
      leaked: world.leaked,
    };
    this.time.delayedCall(RESULT_DELAY_MS, () => {
      this.scene.start(SceneKey.Result, result);
    });
  }
}
