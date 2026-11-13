import type Phaser from 'phaser';
import type { GameI18n } from '../../i18n';
import { ATLAS_KEY, Frame, hexToInt, palette, turretFrame } from '../art';
import type { TurretKind } from '../balance';
import { layout } from '../config';
import { ABILITY_KINDS, type AbilityKind } from '../sim/loadout';
import type { TurretSpec } from '../sim/turrets';
import { Button } from './button';
import { MAP_HEIGHT, MAP_WIDTH, type ScreenLayout } from './screen-layout';
import { addLabel } from './text';

export const UI_DEPTH = 100;

export const ABILITY_KEYS: Readonly<Record<AbilityKind, string>> = {
  airstrike: 'Q',
  pillar: 'W',
  bigBang: 'E',
};

export interface HudHandlers {
  onPause: () => void;
  onSpeed: () => void;
  onFight: () => void;
  onReset: () => void;
  onPick: (kind: TurretKind) => void;
  onAbility: (kind: AbilityKind) => void;
}

export interface HudSetup {
  kinds: readonly TurretKind[];
  specs: Readonly<Record<TurretKind, TurretSpec>>;
  levelName: string;
  handlers: HudHandlers;
}

export interface AbilityView {
  unlocked: boolean;
  ready: boolean;
  cooldown: number;
  armed: boolean;
  adOffer: boolean;
}

export interface HudView {
  hp: number;
  maxHp: number;
  turrets: number;
  turretLimit: number;
  status: string;
  battle: boolean;
  speed: number;
  armedKind: TurretKind | null;
  infoKind: TurretKind | null;
  abilities: Record<AbilityKind, AbilityView>;
}

interface AbilityButton {
  button: Button;
  label: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
}

interface InfoCard {
  root: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text;
}

const DARK = hexToInt(palette.uiDark);
const PANEL_LIGHT = hexToInt(palette.uiPanelLight);

export class Hud {
  private readonly landscape: boolean;
  private readonly prepGroup: Phaser.GameObjects.Container;
  private readonly battleGroup: Phaser.GameObjects.Container;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpWidth: number;
  private readonly hpHeight: number;
  private readonly turretText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly speedButton: Button;
  private readonly fightButton: Button;
  private readonly paletteButtons = new Map<TurretKind, Button>();
  private readonly paletteBaseY = new Map<TurretKind, number>();
  private readonly abilityButtons = new Map<AbilityKind, AbilityButton>();
  private readonly hintBack: Phaser.GameObjects.Rectangle;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly info: InfoCard | null;
  private noAbilities: Phaser.GameObjects.Text | null = null;
  private hovered: TurretKind | null = null;
  private shownInfo: TurretKind | null = null;
  private lastHp = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly i18n: GameI18n,
    private readonly setup: HudSetup,
    screen: ScreenLayout,
  ) {
    this.landscape = screen.mode === 'landscape';
    const { handlers } = setup;

    if (this.landscape) {
      const left = screen.mapX;
      const right = screen.mapX + MAP_WIDTH;
      const panel = screen.panelWidth;
      const content = Math.min(panel - 56, 440);
      const lx = left / 2;
      const rx = right + panel / 2;
      scene.add.rectangle(0, 0, left, MAP_HEIGHT, DARK, 1).setOrigin(0).setInteractive();
      scene.add.rectangle(right, 0, panel, MAP_HEIGHT, DARK, 1).setOrigin(0).setInteractive();
      scene.add.rectangle(left - 4, 0, 4, MAP_HEIGHT, PANEL_LIGHT, 1).setOrigin(0);
      scene.add.rectangle(right, 0, 4, MAP_HEIGHT, PANEL_LIGHT, 1).setOrigin(0);

      addLabel(scene, lx, 76, setup.levelName, 40, palette.gold)
        .setFontStyle('bold')
        .setWordWrapWidth(content);
      scene.add.image(lx - content / 2 + 22, 170, ATLAS_KEY, Frame.Heart).setScale(1.2);
      this.hpWidth = content - 60;
      this.hpHeight = 40;
      const barX = lx - content / 2 + 56;
      scene.add.rectangle(barX, 150, this.hpWidth, this.hpHeight, 0x000000, 0.55).setOrigin(0);
      this.hpFill = scene.add
        .rectangle(barX + 3, 153, this.hpWidth - 6, this.hpHeight - 6, hexToInt(palette.ok))
        .setOrigin(0);
      this.hpText = addLabel(scene, barX + this.hpWidth / 2, 170, '', 28);
      this.statusText = addLabel(scene, lx, 260, '', 40);
      scene.add.image(lx - 60, 340, ATLAS_KEY, Frame.TurretBase).setScale(0.8);
      this.turretText = addLabel(scene, lx - 22, 340, '', 36).setOrigin(0, 0.5);

      const pause = new Button(scene, lx, MAP_HEIGHT - 90, '', handlers.onPause, {
        width: content,
        height: 100,
        color: PANEL_LIGHT,
      });
      pause.add(scene.add.image(-content / 2 + 50, 0, ATLAS_KEY, Frame.Pause));
      pause.add(addLabel(scene, 20, 0, `${i18n.t('hud.pause')}  (Esc)`, 30));

      this.prepGroup = scene.add.container(0, 0);
      this.battleGroup = scene.add.container(0, 0);
      this.prepGroup.add(addLabel(scene, rx, 70, i18n.t('hud.turrets'), 36).setFontStyle('bold'));
      const cell = (content - 16) / 2;
      setup.kinds.forEach((kind, index) => {
        const x = rx - content / 2 + cell / 2 + (index % 2) * (cell + 16);
        const y = 200 + Math.floor(index / 2) * 170;
        const button = new Button(scene, x, y, '', () => undefined, {
          width: cell,
          height: 156,
          color: PANEL_LIGHT,
        });
        button.add([
          scene.add.image(0, -20, ATLAS_KEY, Frame.TurretBase).setScale(1.2),
          scene.add.image(0, -20, ATLAS_KEY, turretFrame(kind)).setScale(1.2).setAngle(-90),
          addLabel(scene, 0, 50, i18n.t(`turret.${kind}`), 24),
          addLabel(scene, -cell / 2 + 22, -58, String(index + 1), 26, palette.gold).setFontStyle(
            'bold',
          ),
        ]);
        this.bindPalette(button, kind, y);
        this.prepGroup.add(button);
      });

      this.info = this.buildInfo(rx, 760, content);
      this.prepGroup.add(this.info.root);

      const reset = new Button(
        scene,
        rx,
        MAP_HEIGHT - 220,
        i18n.t('prep.reset'),
        handlers.onReset,
        {
          width: content,
          height: 90,
          fontSize: 30,
          color: 0x3a3f58,
        },
      );
      this.fightButton = new Button(
        scene,
        rx,
        MAP_HEIGHT - 90,
        `${i18n.t('prep.fight')}  (Space)`,
        handlers.onFight,
        { width: content, height: 120, fontSize: 40, color: 0x2eb872 },
      );
      this.prepGroup.add([reset, this.fightButton]);

      this.battleGroup.add(
        addLabel(scene, rx, 70, i18n.t('hud.abilities'), 36).setFontStyle('bold'),
      );
      ABILITY_KINDS.forEach((kind, index) => {
        const item = this.buildAbility(rx, 220 + index * 190, content, 170, 30, kind);
        item.button.add(
          addLabel(
            scene,
            -content / 2 + 26,
            -60,
            ABILITY_KEYS[kind],
            26,
            palette.gold,
          ).setFontStyle('bold'),
        );
        this.battleGroup.add(item.button);
      });
      this.speedButton = new Button(scene, rx, MAP_HEIGHT - 90, '', handlers.onSpeed, {
        width: content,
        height: 120,
        fontSize: 40,
        color: PANEL_LIGHT,
      });
      this.noAbilities = addLabel(scene, rx, 220, i18n.t('hud.noAbilities'), 26, palette.uiMuted)
        .setWordWrapWidth(content)
        .setVisible(false);
      this.battleGroup.add([this.speedButton, this.noAbilities]);

      this.hintBack = scene.add
        .rectangle(left + MAP_WIDTH / 2, 70, MAP_WIDTH - 40, 64, DARK, 0.86)
        .setVisible(false);
      this.hintText = addLabel(scene, left + MAP_WIDTH / 2, 70, '', 25)
        .setVisible(false)
        .setWordWrapWidth(MAP_WIDTH - 70);
      return;
    }

    scene.add
      .rectangle(0, 0, MAP_WIDTH, layout.hudHeight, DARK, 0.94)
      .setOrigin(0)
      .setInteractive();
    scene.add.image(34, 44, ATLAS_KEY, Frame.Heart);
    this.hpWidth = 170;
    this.hpHeight = 32;
    scene.add.rectangle(62, 28, this.hpWidth, this.hpHeight, 0x000000, 0.55).setOrigin(0);
    this.hpFill = scene.add
      .rectangle(65, 31, this.hpWidth - 6, this.hpHeight - 6, hexToInt(palette.ok))
      .setOrigin(0);
    this.hpText = addLabel(scene, 62 + this.hpWidth / 2, 44, '', 24);
    scene.add.image(274, 44, ATLAS_KEY, Frame.TurretBase).setScale(0.62);
    this.turretText = addLabel(scene, 300, 44, '', 28).setOrigin(0, 0.5);
    this.statusText = addLabel(scene, 500, 44, '', 28);
    const pause = new Button(scene, 670, 44, '', handlers.onPause, {
      width: 72,
      height: 68,
      color: PANEL_LIGHT,
    });
    pause.add(scene.add.image(0, 0, ATLAS_KEY, Frame.Pause));

    const barHeight = MAP_HEIGHT - layout.bottomBarY;
    const cy = barHeight / 2;
    const back = (): Phaser.GameObjects.Rectangle =>
      scene.add.rectangle(0, 0, MAP_WIDTH, barHeight, DARK, 0.95).setOrigin(0).setInteractive();

    this.prepGroup = scene.add.container(0, layout.bottomBarY);
    this.prepGroup.add(back());
    setup.kinds.forEach((kind, index) => {
      const button = new Button(scene, 44 + index * 78, cy, '', () => undefined, {
        width: 72,
        height: 108,
        color: PANEL_LIGHT,
      });
      button.add([
        scene.add.image(0, -8, ATLAS_KEY, Frame.TurretBase).setScale(0.9),
        scene.add.image(0, -8, ATLAS_KEY, turretFrame(kind)).setScale(0.9).setAngle(-90),
      ]);
      this.bindPalette(button, kind, cy);
      this.prepGroup.add(button);
    });
    const reset = new Button(scene, 532, cy, i18n.t('prep.reset'), handlers.onReset, {
      width: 96,
      height: 108,
      fontSize: 22,
      color: 0x3a3f58,
    });
    this.fightButton = new Button(scene, 650, cy, i18n.t('prep.fight'), handlers.onFight, {
      width: 124,
      height: 108,
      fontSize: 30,
      color: 0x2eb872,
    });
    this.prepGroup.add([reset, this.fightButton]);

    this.battleGroup = scene.add.container(0, layout.bottomBarY);
    this.speedButton = new Button(scene, 62, cy, '', handlers.onSpeed, {
      width: 100,
      height: 108,
      fontSize: 36,
      color: PANEL_LIGHT,
    });
    this.battleGroup.add([back(), this.speedButton]);
    ABILITY_KINDS.forEach((kind, index) => {
      const item = this.buildAbility(222 + index * 196, cy, 186, 108, 21, kind);
      this.battleGroup.add(item.button);
    });
    this.info = null;

    this.hintBack = scene.add
      .rectangle(MAP_WIDTH / 2, 134, MAP_WIDTH - 40, 64, DARK, 0.86)
      .setVisible(false);
    this.hintText = addLabel(scene, MAP_WIDTH / 2, 134, '', 25)
      .setVisible(false)
      .setWordWrapWidth(MAP_WIDTH - 70);
  }

  setHint(text: string | null): void {
    const visible = text !== null && text !== '';
    this.hintBack.setVisible(visible);
    this.hintText.setVisible(visible);
    if (visible && this.hintText.text !== text) {
      this.hintText.setText(text);
      this.hintBack.setSize(this.hintBack.width, Math.max(64, this.hintText.height + 24));
      this.hintBack.setOrigin(0.5);
    }
  }

  update(view: HudView, time: number): void {
    const { i18n } = this;
    const hp = Math.ceil(view.hp);
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      const share = Math.max(0, Math.min(1, view.hp / view.maxHp));
      this.hpFill.setSize((this.hpWidth - 6) * share, this.hpHeight - 6);
      this.hpFill.setFillStyle(
        hexToInt(share > 0.5 ? palette.ok : share > 0.25 ? palette.gold : palette.danger),
      );
      this.hpText.setText(`${hp}/${view.maxHp}`);
    }
    const turrets = `${view.turrets}/${view.turretLimit}`;
    if (this.turretText.text !== turrets) this.turretText.setText(turrets);
    if (this.statusText.text !== view.status) this.statusText.setText(view.status);

    this.prepGroup.setVisible(!view.battle);
    this.battleGroup.setVisible(view.battle);
    if (!view.battle) {
      for (const [kind, button] of this.paletteButtons) {
        const armed = view.armedKind === kind;
        button.setAlpha(view.armedKind === null || armed ? 1 : 0.6);
        button.y = (this.paletteBaseY.get(kind) ?? button.y) - (armed ? 8 : 0);
      }
      const canFight = view.turrets > 0;
      this.fightButton.setEnabled(canFight);
      if (canFight) this.fightButton.setScale(1 + Math.sin(time * 5) * 0.03);
      this.showInfo(this.hovered ?? view.armedKind ?? view.infoKind);
      return;
    }
    const speed = i18n.t('hud.speed', { speed: view.speed });
    this.speedButton.setText(this.landscape ? `${speed}  (Space)` : speed);
    this.noAbilities?.setVisible(!ABILITY_KINDS.some((kind) => view.abilities[kind].unlocked));
    for (const [kind, item] of this.abilityButtons) {
      const state = view.abilities[kind];
      item.button.setVisible(state.unlocked);
      if (!state.unlocked) continue;
      item.button.setEnabled(state.ready || state.adOffer);
      item.button.setScale(state.armed ? 1.05 : 1);
      const text = state.adOffer
        ? i18n.t('ability.ad')
        : state.ready
          ? ''
          : kind === 'bigBang'
            ? '—'
            : String(Math.ceil(state.cooldown));
      if (item.timer.text !== text) item.timer.setText(text);
      item.label.setY(text === '' ? 0 : -22);
    }
  }

  private bindPalette(button: Button, kind: TurretKind, baseY: number): void {
    button.on('pointerdown', () => this.setup.handlers.onPick(kind));
    button.on('pointerover', () => {
      this.hovered = kind;
    });
    button.on('pointerout', () => {
      if (this.hovered === kind) this.hovered = null;
    });
    this.paletteButtons.set(kind, button);
    this.paletteBaseY.set(kind, baseY);
  }

  private buildAbility(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    kind: AbilityKind,
  ): AbilityButton {
    const { scene, i18n } = this;
    const button = new Button(scene, x, y, '', () => this.setup.handlers.onAbility(kind), {
      width,
      height,
      color: 0xc0562b,
    });
    const label = addLabel(scene, 0, -22, i18n.t(`ability.${kind}`), fontSize).setWordWrapWidth(
      width - 16,
    );
    const timer = addLabel(scene, 0, 24, '', fontSize + 9, palette.gold);
    button.add([label, timer]);
    const item = { button, label, timer };
    this.abilityButtons.set(kind, item);
    return item;
  }

  private buildInfo(x: number, y: number, width: number): InfoCard {
    const { scene } = this;
    const root = scene.add.container(x, y);
    const back = scene.add
      .rectangle(0, 0, width, 300, hexToInt(palette.uiPanel), 1)
      .setStrokeStyle(2, PANEL_LIGHT);
    const base = scene.add.image(-width / 2 + 60, -90, ATLAS_KEY, Frame.TurretBase).setScale(1.3);
    const head = scene.add
      .image(-width / 2 + 60, -90, ATLAS_KEY, Frame.TurretBase)
      .setScale(1.3)
      .setAngle(-90);
    const name = addLabel(scene, -width / 2 + 110, -90, '', 30, palette.gold)
      .setOrigin(0, 0.5)
      .setFontStyle('bold');
    const desc = addLabel(scene, -width / 2 + 20, -40, '', 22)
      .setOrigin(0, 0)
      .setAlign('left')
      .setWordWrapWidth(width - 40);
    const stats = addLabel(scene, -width / 2 + 20, 140, '', 21, palette.uiMuted)
      .setOrigin(0, 1)
      .setAlign('left')
      .setWordWrapWidth(width - 40);
    root.add([back, base, head, name, desc, stats]);
    root.setVisible(false);
    return { root, head, name, desc, stats };
  }

  private showInfo(kind: TurretKind | null): void {
    const info = this.info;
    if (!info || kind === this.shownInfo) return;
    this.shownInfo = kind;
    info.root.setVisible(kind !== null);
    if (!kind) return;
    const { i18n } = this;
    const spec = this.setup.specs[kind];
    const arc = Math.round((spec.halfArc * 360) / Math.PI);
    info.head.setFrame(turretFrame(kind));
    info.name.setText(i18n.t(`turret.${kind}`));
    info.desc.setText(i18n.t(`turret.${kind}.desc`));
    info.stats.setText(
      [
        `${i18n.t('hud.range', { value: Math.round(spec.range) })} · ${i18n.t('hud.sector', { value: arc })}`,
        i18n.t(spec.stats.hitsAir ? 'hud.air.yes' : 'hud.air.no'),
        i18n.t(spec.stats.needsSight ? 'hud.sight.yes' : 'hud.sight.no'),
      ].join('\n'),
    );
  }
}
