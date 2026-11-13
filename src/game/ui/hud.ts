import type Phaser from 'phaser';
import type { GameI18n } from '../../i18n';
import { Frame, hexToInt, palette, turretFrame, uiImage } from '../art';
import type { TurretKind } from '../balance';
import type { Insets } from '../render/camera-math';
import { ABILITY_KINDS, type AbilityKind } from '../sim/loadout';
import type { TurretSpec } from '../sim/turrets';
import { Button } from './button';
import { Minimap, type MinimapSetup } from './minimap';
import type { ScreenLayout } from './screen-layout';
import { addLabel } from './text';

export const UI_DEPTH = 100;

export const ABILITY_KEYS: Readonly<Record<AbilityKind, string>> = {
  airstrike: 'Q',
  pillar: 'W',
  bigBang: 'E',
};

const BARS = {
  portrait: { top: 88, bottom: 150 },
  landscape: { top: 96, bottom: 180 },
} as const;

export function hudInsets(screen: ScreenLayout): Insets {
  const bars = BARS[screen.mode];
  return { top: bars.top, bottom: bars.bottom, left: 0, right: 0 };
}

export interface HudHandlers {
  onPause: () => void;
  onFight: () => void;
  onReset: () => void;
  onPick: (kind: TurretKind) => void;
  onAbility: (kind: AbilityKind) => void;
  onRevive: () => void;
  onGiveUp: () => void;
}

export interface HudSetup {
  kinds: readonly TurretKind[];
  specs: Readonly<Record<TurretKind, TurretSpec>>;
  levelName: string;
  handlers: HudHandlers;
  minimap: MinimapSetup;
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
  defeat: boolean;
  armedKind: TurretKind | null;
  infoKind: TurretKind | null;
  abilities: Record<AbilityKind, AbilityView>;
  camera: { x: number; y: number; width: number; height: number };
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
  private readonly fightButton: Button;
  private readonly paletteButtons = new Map<TurretKind, Button>();
  private readonly paletteBaseY = new Map<TurretKind, number>();
  private readonly abilityButtons = new Map<AbilityKind, AbilityButton>();
  private readonly hintBack: Phaser.GameObjects.Rectangle;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly info: InfoCard | null;
  private readonly noAbilities: Phaser.GameObjects.Text;
  private readonly minimap: Minimap;
  private readonly defeatLayer: Phaser.GameObjects.Container;
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
    const { width, height } = screen;
    const bars = BARS[screen.mode];

    scene.add.rectangle(0, 0, width, bars.top, DARK, 0.92).setOrigin(0).setInteractive();
    const topY = bars.top / 2;

    if (this.landscape) {
      addLabel(scene, 30, topY, setup.levelName, 34, palette.gold)
        .setOrigin(0, 0.5)
        .setFontStyle('bold');
      const hpX = Math.max(420, width * 0.24);
      uiImage(scene, hpX, topY, Frame.Heart, 1.1);
      this.hpWidth = 260;
      this.hpHeight = 38;
      scene.add
        .rectangle(hpX + 30, topY - 19, this.hpWidth, this.hpHeight, 0x000000, 0.55)
        .setOrigin(0);
      this.hpFill = scene.add
        .rectangle(hpX + 33, topY - 16, this.hpWidth - 6, this.hpHeight - 6, hexToInt(palette.ok))
        .setOrigin(0);
      this.hpText = addLabel(scene, hpX + 30 + this.hpWidth / 2, topY, '', 26);
      this.statusText = addLabel(scene, width / 2 + 160, topY, '', 36);
      uiImage(scene, width / 2 + 380, topY, Frame.TurretBase, 0.75);
      this.turretText = addLabel(scene, width / 2 + 410, topY, '', 32).setOrigin(0, 0.5);
      const pause = new Button(scene, width - 130, topY, '', handlers.onPause, {
        width: 220,
        height: 72,
        color: PANEL_LIGHT,
      });
      pause.add([
        uiImage(scene, -70, 0, Frame.Pause),
        addLabel(scene, 20, 0, `${i18n.t('hud.pause')} (Esc)`, 24),
      ]);
    } else {
      uiImage(scene, 34, topY, Frame.Heart);
      this.hpWidth = 170;
      this.hpHeight = 32;
      scene.add.rectangle(62, topY - 16, this.hpWidth, this.hpHeight, 0x000000, 0.55).setOrigin(0);
      this.hpFill = scene.add
        .rectangle(65, topY - 13, this.hpWidth - 6, this.hpHeight - 6, hexToInt(palette.ok))
        .setOrigin(0);
      this.hpText = addLabel(scene, 62 + this.hpWidth / 2, topY, '', 24);
      uiImage(scene, 274, topY, Frame.TurretBase, 0.62);
      this.turretText = addLabel(scene, 300, topY, '', 28).setOrigin(0, 0.5);
      this.statusText = addLabel(scene, 500, topY, '', 28);
      const pause = new Button(scene, width - 50, topY, '', handlers.onPause, {
        width: 72,
        height: 68,
        color: PANEL_LIGHT,
      });
      pause.add(uiImage(scene, 0, 0, Frame.Pause));
    }

    const panelWidth = this.landscape ? Math.min(width - 40, 1180) : width;
    const panelX = (width - panelWidth) / 2;
    const panelHeight = this.landscape ? bars.bottom - 20 : bars.bottom;
    const panelY = this.landscape ? height - bars.bottom + 10 : height - bars.bottom;
    const cy = panelHeight / 2;
    const back = (): Phaser.GameObjects.Shape =>
      this.landscape
        ? scene.add
            .rectangle(0, 0, panelWidth, panelHeight, DARK, 0.92)
            .setOrigin(0)
            .setStrokeStyle(3, PANEL_LIGHT)
            .setInteractive()
        : scene.add
            .rectangle(0, 0, panelWidth, panelHeight, DARK, 0.94)
            .setOrigin(0)
            .setInteractive();

    this.prepGroup = scene.add.container(panelX, panelY);
    this.prepGroup.add(back());
    const cell = this.landscape ? 140 : 72;
    const cellGap = this.landscape ? 12 : 6;
    setup.kinds.forEach((kind, index) => {
      const x = (this.landscape ? 20 : 8) + cell / 2 + index * (cell + cellGap);
      const button = new Button(scene, x, cy, '', () => undefined, {
        width: cell,
        height: this.landscape ? 140 : 108,
        color: PANEL_LIGHT,
      });
      const iconScale = this.landscape ? 1.1 : 0.9;
      const iconY = this.landscape ? -16 : -8;
      button.add([
        uiImage(scene, 0, iconY, Frame.TurretBase, iconScale),
        uiImage(scene, 0, iconY, turretFrame(kind), iconScale).setAngle(-90),
      ]);
      if (this.landscape) {
        button.add([
          addLabel(scene, 0, 46, i18n.t(`turret.${kind}`), 20),
          addLabel(scene, -cell / 2 + 18, -52, String(index + 1), 24, palette.gold).setFontStyle(
            'bold',
          ),
        ]);
      }
      this.bindPalette(button, kind, cy);
      this.prepGroup.add(button);
    });
    const resetWidth = this.landscape ? 170 : 96;
    const fightWidth = this.landscape ? 280 : 124;
    const reset = new Button(
      scene,
      panelWidth - fightWidth - resetWidth / 2 - (this.landscape ? 34 : 14),
      cy,
      i18n.t('prep.reset'),
      handlers.onReset,
      {
        width: resetWidth,
        height: this.landscape ? 110 : 108,
        fontSize: this.landscape ? 28 : 22,
        color: 0x3a3f58,
      },
    );
    this.fightButton = new Button(
      scene,
      panelWidth - fightWidth / 2 - (this.landscape ? 20 : 8),
      cy,
      this.landscape ? `${i18n.t('prep.fight')} (Space)` : i18n.t('prep.fight'),
      handlers.onFight,
      {
        width: fightWidth,
        height: this.landscape ? 120 : 108,
        fontSize: this.landscape ? 34 : 30,
        color: 0x2eb872,
      },
    );
    this.prepGroup.add([reset, this.fightButton]);

    this.battleGroup = scene.add.container(panelX, panelY);
    this.battleGroup.add(back());
    const abilityWidth = this.landscape ? 300 : 220;
    const abilityGap = this.landscape ? 24 : 12;
    const abilitiesWidth =
      ABILITY_KINDS.length * abilityWidth + (ABILITY_KINDS.length - 1) * abilityGap;
    ABILITY_KINDS.forEach((kind, index) => {
      const x =
        (panelWidth - abilitiesWidth) / 2 + abilityWidth / 2 + index * (abilityWidth + abilityGap);
      const item = this.buildAbility(
        x,
        cy,
        abilityWidth,
        this.landscape ? 120 : 108,
        this.landscape ? 28 : 22,
        kind,
      );
      if (this.landscape) {
        item.button.add(
          addLabel(
            scene,
            -abilityWidth / 2 + 22,
            -42,
            ABILITY_KEYS[kind],
            24,
            palette.gold,
          ).setFontStyle('bold'),
        );
      }
      this.battleGroup.add(item.button);
    });
    this.noAbilities = addLabel(
      scene,
      panelWidth / 2,
      cy,
      i18n.t('hud.noAbilities'),
      26,
      palette.uiMuted,
    )
      .setWordWrapWidth(panelWidth - 40)
      .setVisible(false);
    this.battleGroup.add(this.noAbilities);

    this.info = this.landscape
      ? this.buildInfo(width - 220, height - bars.bottom - 170, 400)
      : null;

    const box = this.landscape ? 230 : 150;
    this.minimap = new Minimap(scene, width - 14, bars.top + 14, box, setup.minimap);
    const toggle = new Button(
      scene,
      width - 14 - 26,
      bars.top + 14 + this.minimap.height + 36,
      '▣',
      () => this.minimap.root.setVisible(!this.minimap.root.visible),
      { width: 52, height: 52, fontSize: 26, color: PANEL_LIGHT },
    );
    toggle.setAlpha(0.85);

    const hintY = bars.top + 46;
    const hintWidth = Math.min(width - 40 - (this.landscape ? 0 : box + 24), 760);
    const hintX = this.landscape ? width / 2 : 20 + hintWidth / 2;
    this.hintBack = scene.add.rectangle(hintX, hintY, hintWidth, 64, DARK, 0.86).setVisible(false);
    this.hintText = addLabel(scene, hintX, hintY, '', this.landscape ? 26 : 23)
      .setVisible(false)
      .setWordWrapWidth(hintWidth - 30);

    this.defeatLayer = this.buildDefeat(width, height);
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

  update(view: HudView, time: number, delta: number): void {
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
    this.minimap.update(delta, view.camera);
    this.defeatLayer.setVisible(view.defeat);

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
    this.showInfo(null);
    this.noAbilities.setVisible(!ABILITY_KINDS.some((kind) => view.abilities[kind].unlocked));
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
      item.label.setY(text === '' ? 0 : -18);
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
    const label = addLabel(scene, 0, -18, i18n.t(`ability.${kind}`), fontSize).setWordWrapWidth(
      width - 16,
    );
    const timer = addLabel(scene, 0, 26, '', fontSize + 6, palette.gold);
    button.add([label, timer]);
    const item = { button, label, timer };
    this.abilityButtons.set(kind, item);
    return item;
  }

  private buildInfo(x: number, y: number, width: number): InfoCard {
    const { scene } = this;
    const root = scene.add.container(x, y);
    const back = scene.add.rectangle(0, 0, width, 300, DARK, 0.92).setStrokeStyle(2, PANEL_LIGHT);
    const base = uiImage(scene, -width / 2 + 60, -90, Frame.TurretBase, 1.3);
    const head = uiImage(scene, -width / 2 + 60, -90, Frame.TurretBase, 1.3).setAngle(-90);
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

  private buildDefeat(width: number, height: number): Phaser.GameObjects.Container {
    const { scene, i18n } = this;
    const { handlers } = this.setup;
    const layer = scene.add.container(0, 0).setDepth(UI_DEPTH);
    const dim = scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    const title = addLabel(scene, width / 2, height * 0.34, i18n.t('defeat.title'), 60);
    const revive = new Button(
      scene,
      width / 2,
      height * 0.48,
      i18n.t('defeat.revive'),
      handlers.onRevive,
      {
        width: 520,
        height: 150,
        fontSize: 38,
        color: 0x7d4bc4,
      },
    );
    const giveUp = new Button(
      scene,
      width / 2,
      height * 0.62,
      i18n.t('defeat.giveUp'),
      handlers.onGiveUp,
      {
        width: 400,
        height: 100,
        fontSize: 36,
        color: 0x3a3f58,
      },
    );
    layer.add([dim, title, revive, giveUp]);
    layer.setVisible(false);
    return layer;
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
