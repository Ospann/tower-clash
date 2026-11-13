import Phaser from 'phaser';
import { translateKey, type TranslationKey } from '../../i18n';
import {
  Frame,
  generateLevelMap,
  hexToInt,
  MAP_THUMB_KEY,
  palette,
  themeColors,
  UI_KEY,
  UI_RATIO,
} from '../art';
import { Sfx, type SfxName } from '../audio/sfx';
import { fxLimits, gameSpeed, rocket, TURRET_KINDS, type TurretKind } from '../balance';
import { simConfig } from '../config';
import { DebugOverlay } from '../debug/debug-overlay';
import { debugFlags } from '../debug/flags';
import { StressDriver, stressLevel, stressTurrets } from '../debug/stress';
import { GameEvent, SceneKey } from '../keys';
import { levelById, levelIndex, levels } from '../levels';
import type { LevelData } from '../levels/level-types';
import { MAX_ZOOM, type Point } from '../render/camera-math';
import { FxRenderer } from '../render/fx-renderer';
import { HordeRenderer } from '../render/horde-renderer';
import { MapCamera } from '../render/map-camera';
import { ProjectileRenderer } from '../render/projectile-renderer';
import { TurretRenderer } from '../render/turret-renderer';
import { sanitizePlacement } from '../save';
import { services } from '../services';
import { rewardFor, starsFor } from '../sim/economy';
import { FX_STRIDE, FxKind, type FxEvents } from '../sim/events';
import { ProjectileKind } from '../sim/projectiles';
import { neutralLoadout, unlockedTurrets, type AbilityKind } from '../sim/loadout';
import { loadoutFrom, sanitizeTree } from '../sim/tree';
import type { Turret } from '../sim/turrets';
import { World } from '../sim/world';
import { onHotkey, trackHeldKeys } from '../ui/hotkeys';
import { hudInsets, type AbilityView, type HudSetup } from '../ui/hud';
import { currentScreen, onScreenChange, renderScale } from '../ui/screen';
import type { HudScene } from './hud';
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
} as const;

const shotSound: Readonly<Record<TurretKind, SfxName | null>> = {
  ballista: 'shot',
  mortar: 'cannon',
  gatling: 'shot',
  tar: 'flask',
  tesla: 'zap',
  beam: null,
};

type Gesture = 'none' | 'pending' | 'pan' | 'pinch' | 'drag' | 'rotate' | 'swipe';

interface Ghost {
  kind: TurretKind;
  x: number;
  y: number;
  angle: number;
  ok: boolean;
}

const RESULT_DELAY_MS = 900;
const HINT_MS = 1600;
const ROTATE_STEP = Math.PI / 12;
const TAP_SLOP = 10;
const COMFORT_ZOOM = 0.6;
const KEY_PAN_SPEED = 900;
const PAN_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private world!: World;
  private mapCamera!: MapCamera;
  private hordeRenderer!: HordeRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private turretRenderer!: TurretRenderer;
  private fx!: FxRenderer;
  private sfx!: Sfx;
  private rotateHandle!: Phaser.GameObjects.Image;
  private removeHandle!: Phaser.GameObjects.Image;
  private swipeLine!: Phaser.GameObjects.Graphics;
  private heldKeys: Set<string> = new Set();
  private stress: StressDriver | null = null;
  private overlay: DebugOverlay | null = null;
  private levelId = '';
  private accumulator = 0;
  private gesture: Gesture = 'none';
  private readonly pointers = new Map<number, Point>();
  private pinchPrev: [Point, Point] | null = null;
  private downAt: Point = { x: 0, y: 0 };
  private downButton = 0;
  private downTime = 0;
  private holdFired = false;
  private lastMove: Point = { x: 0, y: 0 };
  private lastMoveTime = 0;
  private velocity: Point = { x: 0, y: 0 };
  private dropping = false;
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
  private kinds: readonly TurretKind[] = [];
  private cursor = 'default';
  private defeated = false;
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
    this.gesture = 'none';
    this.pointers.clear();
    this.pinchPrev = null;
    this.dropping = false;
    this.selected = -1;
    this.armedKind = null;
    this.armedAbility = null;
    this.ghost = null;
    this.hintKey = null;
    this.rotated = false;
    this.defeated = false;
    this.bigBangAdUsed = false;
    this.ended = false;
    this.busy = false;
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
    const map = { width: world.map.width, height: world.map.height };

    this.add.image(0, 0, generateLevelMap(this.textures, level)).setOrigin(0).setDepth(Depth.Map);
    this.fx = new FxRenderer(this, map.width, map.height, {
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
      .image(0, 0, UI_KEY, Frame.Handle)
      .setDepth(Depth.Handles)
      .setVisible(false);
    this.removeHandle = this.add
      .image(0, 0, UI_KEY, Frame.Remove)
      .setDepth(Depth.Handles)
      .setVisible(false);
    this.swipeLine = this.add.graphics().setDepth(Depth.Handles);

    const zone = level.zones[0];
    const focus = zone
      ? { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }
      : { x: map.width / 2, y: map.height / 2 };
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.setBackgroundColor(themeColors[level.tiles].plateauFace);
    this.mapCamera = new MapCamera(
      this.cameras.main,
      map,
      () => {
        const screen = currentScreen();
        const insets = hudInsets(screen);
        return {
          top: insets.top * screen.scale,
          bottom: insets.bottom * screen.scale,
          left: insets.left * screen.scale,
          right: insets.right * screen.scale,
        };
      },
      () => ({ width: this.scale.width, height: this.scale.height }),
      focus,
      COMFORT_ZOOM * renderScale(),
      MAX_ZOOM * renderScale(),
    );
    onScreenChange(this, (screen) =>
      this.mapCamera.resize(screen.width * screen.scale, screen.height * screen.scale),
    );

    const kinds = unlockedTurrets(loadout);
    this.kinds = kinds;
    const hudSetup: HudSetup = {
      kinds,
      specs: world.specs,
      levelName: translateKey(i18n, level.name),
      handlers: {
        onPause: () => pauseGame(this.game),
        onFight: () => this.fight(),
        onReset: () => {
          if (world.phase !== 'prep') return;
          world.clearTurrets();
          this.selected = -1;
          this.sfx.play('click');
          this.savePlacement();
        },
        onPick: (kind) => this.pick(kind),
        onAbility: (kind) => this.onAbility(kind),
        onRevive: () => void this.revive(),
        onGiveUp: () => {
          if (!this.busy) this.finish(false);
        },
      },
      minimap: {
        width: map.width,
        height: map.height,
        thumb: MAP_THUMB_KEY,
        zones: level.zones,
        sample: () => ({
          xs: world.horde.x,
          ys: world.horde.y,
          count: world.horde.count,
          flying: world.horde.flying,
          turrets: world.turrets,
        }),
        onJump: (x, y) => this.mapCamera.focus(x, y),
      },
    };
    this.scene.launch(SceneKey.Hud, hudSetup);

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
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (pointer: Phaser.Input.Pointer) => {
      this.onUp(pointer);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        this.onWheel(pointer, dy);
      },
    );
    onHotkey(this, (event) => {
      this.onKey(event);
    });
    this.heldKeys = trackHeldKeys(this, PAN_KEYS);

    if (debugFlags.debug) {
      this.overlay = new DebugOverlay(this.game);
      if (import.meta.env.DEV) Object.assign(window, { __debug: this.overlay, __world: world });
    }
    if (import.meta.env.DEV) Object.assign(window, { __camera: this.mapCamera });

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
      this.input.setDefaultCursor('default');
      this.scene.stop(SceneKey.Hud);
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
    const frozen = this.ended || this.defeated || ads.isBusy;
    const dt = Math.min(delta, 100) / 1000;

    if (!frozen && world.phase === 'battle') {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= simConfig.stepSec && steps < simConfig.maxStepsPerFrame) {
        this.accumulator -= simConfig.stepSec;
        for (let n = 0; n < gameSpeed; n += 1) {
          this.stress?.update();
          world.step(simConfig.stepSec);
        }
        steps += 1;
      }
      if (steps === simConfig.maxStepsPerFrame) this.accumulator = 0;
    }
    const simMs = performance.now() - started;

    this.holdFire();
    this.panWithKeys(dt);
    this.mapCamera.update(dt);

    this.fx.consume(world.events);
    this.react(world.events);
    world.events.clear();

    const now = this.time.now / 1000;
    this.hordeRenderer.sync(world.horde, world.time);
    this.projectileRenderer.sync(world.projectiles);
    if (!frozen) this.rocketTrails();
    this.turretRenderer.sync(world, now);
    this.fx.update(frozen ? 0 : dt * gameSpeed, world.zones, now);
    this.syncPrep();
    this.syncHud(now, delta);
    this.syncCursor();

    if (!this.ended && !this.stress) {
      if (world.phase === 'won') this.finish(true);
      else if (world.phase === 'lost' && !this.defeated) {
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

  private get hud(): HudScene['hud'] {
    if (!this.scene.isActive(SceneKey.Hud) && !this.scene.isPaused(SceneKey.Hud)) return null;
    return this.game.scene.getScene<HudScene>(SceneKey.Hud).hud;
  }

  private inMap(x: number, y: number): boolean {
    return this.world.map.inside(x, y);
  }

  private screenPx(pixels: number): number {
    return (pixels * renderScale()) / this.mapCamera.zoom;
  }

  private handlePoint(turret: Turret, back: boolean): Point {
    const spec = this.world.specs[turret.kind];
    const reach = back
      ? Math.max(62, this.screenPx(56))
      : Math.max(Math.min(Math.max(spec.range * 0.5, 90), 140), this.screenPx(80));
    const angle = back ? turret.angle + Math.PI : turret.angle;
    const pad = this.screenPx(30);
    return {
      x: Phaser.Math.Clamp(turret.x + Math.cos(angle) * reach, pad, this.world.map.width - pad),
      y: Phaser.Math.Clamp(turret.y + Math.sin(angle) * reach, pad, this.world.map.height - pad),
    };
  }

  private turretUnder(x: number, y: number): Turret | undefined {
    return this.world.turretAt(x, y, Math.max(36, this.screenPx(34)));
  }

  private pick(kind: TurretKind): void {
    if (this.world.phase !== 'prep' || this.ended) return;
    const same = this.armedKind === kind;
    this.armedKind = same ? null : kind;
    this.selected = -1;
    this.ghost = null;
    this.dropping = !same && this.input.activePointer.isDown;
    this.sfx.play('click');
  }

  private removeSelected(): void {
    if (this.world.phase !== 'prep' || !this.world.removeTurret(this.selected)) return;
    this.selected = -1;
    this.sfx.play('click');
    this.savePlacement();
  }

  private rotateSelected(step: number): void {
    const turret = this.world.turretById(this.selected);
    if (!turret || turret.kind === 'tesla' || this.world.phase !== 'prep') return;
    this.world.rotateTurret(turret.id, turret.angle + step);
    this.rotated = true;
    this.savePlacement();
  }

  private cancel(): boolean {
    if (this.armedKind || this.armedAbility || this.selected >= 0 || this.gesture !== 'none') {
      this.armedKind = null;
      this.armedAbility = null;
      this.selected = -1;
      this.gesture = 'none';
      this.ghost = null;
      this.dropping = false;
      this.swipeLine.clear();
      return true;
    }
    return false;
  }

  private onKey(event: KeyboardEvent): void {
    if (this.ended || this.defeated) return;
    const world = this.world;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (digit) {
      const kind = this.kinds[Number(digit[1]) - 1];
      if (kind) this.pick(kind);
      return;
    }
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        if (world.phase === 'prep') this.fight();
        return;
      case 'KeyQ':
        this.onAbility('airstrike');
        return;
      case 'KeyW':
        this.onAbility('pillar');
        return;
      case 'KeyE':
        this.onAbility('bigBang');
        return;
      case 'KeyR':
        this.rotateSelected(event.shiftKey ? -ROTATE_STEP : ROTATE_STEP);
        return;
      case 'Delete':
      case 'Backspace':
        this.removeSelected();
        return;
      case 'Equal':
      case 'NumpadAdd':
        this.mapCamera.zoomBy(1.25);
        return;
      case 'Minus':
      case 'NumpadSubtract':
        this.mapCamera.zoomBy(0.8);
        return;
      case 'Home':
        this.mapCamera.fit();
        return;
      case 'Escape':
        if (!this.cancel()) pauseGame(this.game);
        return;
      default:
    }
  }

  private panWithKeys(dt: number): void {
    if (this.heldKeys.size === 0) return;
    let dx = 0;
    let dy = 0;
    if (this.heldKeys.has('ArrowLeft')) dx += 1;
    if (this.heldKeys.has('ArrowRight')) dx -= 1;
    if (this.heldKeys.has('ArrowUp')) dy += 1;
    if (this.heldKeys.has('ArrowDown')) dy -= 1;
    const speed = KEY_PAN_SPEED * renderScale() * dt;
    if (dx !== 0 || dy !== 0) this.mapCamera.pan(dx * speed, dy * speed);
  }

  private onWheel(pointer: Phaser.Input.Pointer, dy: number): void {
    if (this.ended || dy === 0) return;
    const event = pointer.event;
    if (event instanceof WheelEvent && event.shiftKey && this.world.phase === 'prep') {
      const hovered = this.turretUnder(pointer.worldX, pointer.worldY);
      if (hovered) this.selected = hovered.id;
      this.rotateSelected(Math.sign(dy) * (ROTATE_STEP / 1.5));
      return;
    }
    this.mapCamera.stop();
    this.mapCamera.zoomBy(Math.exp(-dy * 0.0015), { x: pointer.x, y: pointer.y });
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length > 0 || this.ended || this.defeated) return;
    this.pointers.set(pointer.id, { x: pointer.x, y: pointer.y });
    this.mapCamera.stop();

    if (this.pointers.size >= 2) {
      if (this.gesture === 'drag' || this.gesture === 'rotate') this.savePlacement();
      this.swipeLine.clear();
      this.ghost = null;
      this.gesture = 'pinch';
      this.pinchPrev = this.pinchPoints();
      return;
    }

    const world = this.world;
    const x = pointer.worldX;
    const y = pointer.worldY;
    this.downAt = { x: pointer.x, y: pointer.y };
    this.lastMove = { x: pointer.x, y: pointer.y };
    this.lastMoveTime = this.time.now;
    this.velocity = { x: 0, y: 0 };
    this.downButton = pointer.button;
    this.downTime = this.time.now;
    this.holdFired = false;
    this.gesture = 'pending';
    if (pointer.button !== 0 || !this.inMap(x, y)) return;

    if (world.phase === 'battle') {
      if (this.armedAbility === 'airstrike') {
        this.gesture = 'swipe';
        this.swipeX = x;
        this.swipeY = y;
      }
      return;
    }
    if (world.phase !== 'prep') return;

    const current = world.turretById(this.selected);
    if (current) {
      const rotate = this.handlePoint(current, false);
      const grab = Math.max(40, this.screenPx(40));
      if (current.kind !== 'tesla' && Math.hypot(rotate.x - x, rotate.y - y) < grab) {
        this.gesture = 'rotate';
        return;
      }
      const remove = this.handlePoint(current, true);
      if (Math.hypot(remove.x - x, remove.y - y) < Math.max(36, this.screenPx(36))) {
        this.removeSelected();
        this.gesture = 'none';
        return;
      }
    }
    const turret = this.turretUnder(x, y);
    if (turret) {
      this.selected = turret.id;
      this.armedKind = null;
      this.gesture = 'drag';
      this.dragX = turret.x - x;
      this.dragY = turret.y - y;
    }
  }

  private pinchPoints(): [Point, Point] | null {
    const points = [...this.pointers.values()];
    const a = points[0];
    const b = points[1];
    return a && b ? [a, b] : null;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.ended) return;
    const world = this.world;
    const x = pointer.worldX;
    const y = pointer.worldY;

    if (this.pointers.has(pointer.id))
      this.pointers.set(pointer.id, { x: pointer.x, y: pointer.y });

    if (this.gesture === 'pinch') {
      const now = this.pinchPoints();
      if (now && this.pinchPrev) this.mapCamera.pinch(this.pinchPrev, now);
      this.pinchPrev = now;
      return;
    }

    const hovering = !pointer.isDown && !pointer.wasTouch;
    if ((hovering || this.dropping) && this.armedKind && world.phase === 'prep') {
      this.ghost = this.inMap(x, y)
        ? {
            kind: this.armedKind,
            x,
            y,
            angle: world.defaultAngle(x, y),
            ok: world.placementIssue(this.armedKind, x, y) === 'ok',
          }
        : null;
      if (this.dropping) return;
    }
    if (!pointer.isDown || !this.pointers.has(pointer.id)) return;

    if (this.gesture === 'pending') {
      if (
        Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y) >
        TAP_SLOP * renderScale()
      ) {
        this.gesture = 'pan';
      }
    }
    if (this.gesture === 'pan') {
      const dx = pointer.x - this.lastMove.x;
      const dy = pointer.y - this.lastMove.y;
      this.mapCamera.pan(dx, dy);
      const elapsed = Math.max(1, this.time.now - this.lastMoveTime) / 1000;
      this.velocity = { x: dx / elapsed, y: dy / elapsed };
    } else if (this.gesture === 'drag') {
      const turret = world.turretById(this.selected);
      if (turret) {
        const tx = x + this.dragX;
        const ty = y + this.dragY;
        if (world.moveTurret(turret.id, tx, ty)) this.ghost = null;
        else this.ghost = { kind: turret.kind, x: tx, y: ty, angle: turret.angle, ok: false };
      }
    } else if (this.gesture === 'rotate') {
      const turret = world.turretById(this.selected);
      if (turret && Math.hypot(x - turret.x, y - turret.y) > 12) {
        world.rotateTurret(turret.id, Math.atan2(y - turret.y, x - turret.x));
        this.rotated = true;
      }
    } else if (this.gesture === 'swipe') {
      this.swipeLine
        .clear()
        .lineStyle(Math.max(10, this.screenPx(8)), hexToInt(palette.danger), 0.5)
        .lineBetween(this.swipeX, this.swipeY, x, y);
    }
    this.lastMove = { x: pointer.x, y: pointer.y };
    this.lastMoveTime = this.time.now;
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const tracked = this.pointers.delete(pointer.id);
    if (this.ended) return;
    const world = this.world;
    const x = pointer.worldX;
    const y = pointer.worldY;

    if (this.dropping) {
      this.dropping = false;
      const ghost = this.ghost;
      this.ghost = null;
      if (ghost && this.armedKind) this.place(this.armedKind, ghost.x, ghost.y);
      return;
    }
    if (this.gesture === 'pinch') {
      if (this.pointers.size < 2) {
        this.pinchPrev = null;
        this.gesture = this.pointers.size === 0 ? 'none' : 'pinch';
      }
      return;
    }
    if (!tracked) return;
    const gesture = this.gesture;
    this.gesture = 'none';

    if (gesture === 'pending') {
      this.tap(x, y);
    } else if (gesture === 'pan') {
      if (this.time.now - this.lastMoveTime < 80)
        this.mapCamera.fling(-this.velocity.x, -this.velocity.y);
    } else if (gesture === 'drag') {
      this.ghost = null;
      this.savePlacement();
    } else if (gesture === 'rotate') {
      this.savePlacement();
    } else if (gesture === 'swipe') {
      this.swipeLine.clear();
      if (world.useAirstrike(this.swipeX, this.swipeY, x, y)) this.sfx.play('click');
      this.armedAbility = null;
    }
  }

  private tap(x: number, y: number): void {
    const world = this.world;
    if (!this.inMap(x, y)) return;
    if (this.downButton === 2) {
      const target = world.phase === 'prep' ? this.turretUnder(x, y) : undefined;
      if (target) {
        this.selected = target.id;
        this.removeSelected();
      } else {
        this.cancel();
      }
      return;
    }
    if (this.downButton !== 0) return;
    if (world.phase === 'battle') {
      if (this.armedAbility === 'pillar') {
        if (world.usePillar(x, y)) this.sfx.play('zap');
        this.armedAbility = null;
      } else if (!this.armedAbility && !this.holdFired) {
        this.fireRocket(x, y);
      }
      return;
    }
    if (world.phase !== 'prep') return;
    if (this.armedKind) this.place(this.armedKind, x, y);
    else this.selected = -1;
  }

  private fireRocket(x: number, y: number): void {
    if (this.world.fireRocket(x, y)) this.sfx.play('rocket');
  }

  private holdFire(): void {
    const world = this.world;
    if (this.gesture !== 'pending' || this.downButton !== 0 || this.armedAbility) return;
    if (world.phase !== 'battle' || this.pointers.size !== 1) return;
    if (this.time.now - this.downTime < rocket.holdDelayMs || !world.rocketReady) return;
    const pointer = this.input.activePointer;
    if (!pointer.isDown) return;
    this.holdFired = true;
    this.fireRocket(pointer.worldX, pointer.worldY);
  }

  private rocketTrails(): void {
    const list = this.world.projectiles;
    for (let i = 0; i < list.count; i += 1) {
      const p = list.items[i];
      if (!p || p.kind !== ProjectileKind.Rocket || p.delay > 0) continue;
      this.fx.burst(p.x, p.y, 1, 25, 0xd8d4cc, 0.45, -30);
    }
  }

  private syncCursor(): void {
    const world = this.world;
    const pointer = this.input.activePointer;
    let cursor = 'default';
    if (this.gesture === 'pan' || this.gesture === 'drag' || this.gesture === 'rotate') {
      cursor = 'grabbing';
    } else if (this.armedKind || this.armedAbility || world.phase === 'battle') {
      cursor = 'crosshair';
    } else if (
      world.phase === 'prep' &&
      !pointer.wasTouch &&
      this.turretUnder(pointer.worldX, pointer.worldY)
    ) {
      cursor = 'grab';
    }
    if (cursor !== this.cursor) {
      this.cursor = cursor;
      this.input.setDefaultCursor(cursor);
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
    this.ghost = null;
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
    this.gesture = 'none';
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
    const scale = Math.max(1, renderScale() / this.mapCamera.zoom);
    const rotate = this.handlePoint(turret, false);
    const remove = this.handlePoint(turret, true);
    this.rotateHandle
      .setVisible(turret.kind !== 'tesla')
      .setPosition(rotate.x, rotate.y)
      .setScale((1.3 * scale) / UI_RATIO);
    this.removeHandle
      .setVisible(this.gesture !== 'drag')
      .setPosition(remove.x, remove.y)
      .setScale((1.35 * scale) / UI_RATIO);
  }

  private abilityView(kind: AbilityKind): AbilityView {
    const world = this.world;
    const unlocked = world.loadout.abilities[kind].unlocked;
    return {
      unlocked,
      ready: world.abilityReady(kind),
      cooldown: world.abilityCooldown[kind] / gameSpeed,
      armed: this.armedAbility === kind,
      adOffer:
        kind === 'bigBang' &&
        unlocked &&
        world.bigBangCharges <= 0 &&
        !this.bigBangAdUsed &&
        !this.stress,
    };
  }

  private syncHud(now: number, delta: number): void {
    const world = this.world;
    const hud = this.hud;
    if (!hud) return;
    const { i18n } = services();
    const battle = world.phase !== 'prep';
    const timed = this.level.win.type === 'timer';
    let status = battle ? '' : i18n.t('hud.prep');
    if (battle && timed) {
      status = i18n.t('hud.timer', { seconds: Math.ceil(world.timeLeft / gameSpeed) });
    }
    const selected = world.turretById(this.selected);
    hud.update(
      {
        hp: world.baseHp,
        maxHp: world.baseMaxHp,
        turrets: world.turrets.length,
        turretLimit: world.turretLimit,
        goblins: timed ? world.horde.count : world.goblinsLeft,
        status,
        battle,
        defeat: this.defeated,
        armedKind: this.armedKind,
        infoKind: selected?.kind ?? null,
        abilities: {
          airstrike: this.abilityView('airstrike'),
          pillar: this.abilityView('pillar'),
          bigBang: this.abilityView('bigBang'),
        },
        camera: this.mapCamera.worldRect(),
      },
      now,
      delta,
    );

    let hint: TranslationKey | null = null;
    if (this.hintKey && this.time.now < this.hintUntil) hint = this.hintKey;
    else if (this.armedAbility === 'airstrike') hint = 'ability.hint.airstrike';
    else if (this.armedAbility === 'pillar') hint = 'ability.hint.pillar';
    else if (this.tutorial && world.phase === 'battle' && world.rocketsFired === 0) {
      hint = 'tutorial.rocket';
    } else if (this.tutorial && world.phase === 'prep' && this.gesture === 'none') {
      if (world.turrets.length === 0) hint = 'tutorial.place';
      else if (!this.rotated) hint = 'tutorial.rotate';
      else hint = 'tutorial.fight';
    }
    let text = hint ? i18n.t(hint) : null;
    if (!text && this.armedKind && currentScreen().mode === 'portrait') {
      text = i18n.t(`turret.${this.armedKind}.desc`);
    }
    hud.setHint(text);
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
    const intensity = (fxLimits.shakeMaxPx * Math.min(1, strength)) / this.scale.width;
    this.cameras.main.shake(140, intensity, true);
  }

  private openDefeat(): void {
    services().gameplay.stop();
    this.armedAbility = null;
    this.gesture = 'none';
    this.swipeLine.clear();
    this.sfx.play('lose');
    this.defeated = true;
  }

  private async revive(): Promise<void> {
    if (this.busy || this.ended) return;
    this.busy = true;
    try {
      const { ads, gameplay } = services();
      const rewarded = await ads.showRewarded();
      if (!rewarded || this.ended) return;
      if (!this.world.revive()) return;
      this.defeated = false;
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
    else if (!this.defeated) this.sfx.play('lose');

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
