import type Phaser from 'phaser';
import type { GameI18n } from '../../i18n';
import { ATLAS_KEY, Frame, hexToInt, palette, turretFrame } from '../art';
import type { TurretKind } from '../balance';
import { gameConfig, layout } from '../config';
import { ABILITY_KINDS, type AbilityKind } from '../sim/loadout';
import { Button } from './button';
import { addLabel } from './text';

export const UI_DEPTH = 100;

export interface HudHandlers {
  onPause: () => void;
  onSpeed: () => void;
  onFight: () => void;
  onReset: () => void;
  onPick: (kind: TurretKind, pointer: Phaser.Input.Pointer) => void;
  onAbility: (kind: AbilityKind) => void;
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
  abilities: Record<AbilityKind, AbilityView>;
}

const HP_BAR = { x: 62, y: 28, width: 170, height: 32 } as const;

export class Hud {
  private readonly prepBar: Phaser.GameObjects.Container;
  private readonly battleBar: Phaser.GameObjects.Container;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly turretText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly speedButton: Button;
  private readonly fightButton: Button;
  private readonly palette = new Map<TurretKind, Button>();
  private readonly abilityButtons = new Map<
    AbilityKind,
    { button: Button; label: Phaser.GameObjects.Text; timer: Phaser.GameObjects.Text }
  >();
  private readonly hintBack: Phaser.GameObjects.Rectangle;
  private readonly hintText: Phaser.GameObjects.Text;
  private lastHp = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly i18n: GameI18n,
    kinds: readonly TurretKind[],
    handlers: HudHandlers,
  ) {
    const width = gameConfig.width;
    const dark = hexToInt(palette.uiDark);

    scene.add
      .rectangle(0, 0, width, layout.hudHeight, dark, 0.94)
      .setOrigin(0)
      .setDepth(UI_DEPTH)
      .setInteractive();
    scene.add.image(34, 44, ATLAS_KEY, Frame.Heart).setDepth(UI_DEPTH);
    scene.add
      .rectangle(HP_BAR.x, HP_BAR.y, HP_BAR.width, HP_BAR.height, 0x000000, 0.55)
      .setOrigin(0)
      .setDepth(UI_DEPTH);
    this.hpFill = scene.add
      .rectangle(
        HP_BAR.x + 3,
        HP_BAR.y + 3,
        HP_BAR.width - 6,
        HP_BAR.height - 6,
        hexToInt(palette.ok),
      )
      .setOrigin(0)
      .setDepth(UI_DEPTH);
    this.hpText = addLabel(scene, HP_BAR.x + HP_BAR.width / 2, 44, '', 24).setDepth(UI_DEPTH);
    this.hpText.setStroke(palette.outline, 4);

    scene.add.image(274, 44, ATLAS_KEY, Frame.TurretBase).setScale(0.62).setDepth(UI_DEPTH);
    this.turretText = addLabel(scene, 300, 44, '', 28).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.statusText = addLabel(scene, 500, 44, '', 28).setDepth(UI_DEPTH);

    const pause = new Button(scene, 670, 44, '', handlers.onPause, {
      width: 72,
      height: 68,
      color: hexToInt(palette.uiPanelLight),
    }).setDepth(UI_DEPTH);
    pause.add(scene.add.image(0, 0, ATLAS_KEY, Frame.Pause));

    const barHeight = gameConfig.height - layout.bottomBarY;
    const cy = barHeight / 2;
    const back = (): Phaser.GameObjects.Rectangle =>
      scene.add.rectangle(0, 0, width, barHeight, dark, 0.95).setOrigin(0).setInteractive();

    this.prepBar = scene.add.container(0, layout.bottomBarY).setDepth(UI_DEPTH);
    this.prepBar.add(back());
    kinds.forEach((kind, index) => {
      const button = new Button(scene, 44 + index * 78, cy, '', () => undefined, {
        width: 72,
        height: 108,
        color: hexToInt(palette.uiPanelLight),
      });
      button.add([
        scene.add.image(0, -8, ATLAS_KEY, Frame.TurretBase).setScale(0.9),
        scene.add.image(0, -8, ATLAS_KEY, turretFrame(kind)).setScale(0.9).setAngle(-90),
      ]);
      button.on('pointerdown', (pointer: Phaser.Input.Pointer) => handlers.onPick(kind, pointer));
      this.palette.set(kind, button);
      this.prepBar.add(button);
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
    this.prepBar.add([reset, this.fightButton]);

    this.battleBar = scene.add.container(0, layout.bottomBarY).setDepth(UI_DEPTH).setVisible(false);
    this.speedButton = new Button(scene, 62, cy, '', handlers.onSpeed, {
      width: 100,
      height: 108,
      fontSize: 36,
      color: hexToInt(palette.uiPanelLight),
    });
    this.battleBar.add([back(), this.speedButton]);
    ABILITY_KINDS.forEach((kind, index) => {
      const button = new Button(scene, 222 + index * 196, cy, '', () => handlers.onAbility(kind), {
        width: 186,
        height: 108,
        color: 0xc0562b,
      });
      const label = addLabel(scene, 0, -22, i18n.t(`ability.${kind}`), 21).setWordWrapWidth(170);
      const timer = addLabel(scene, 0, 24, '', 30, palette.gold);
      button.add([label, timer]);
      this.abilityButtons.set(kind, { button, label, timer });
      this.battleBar.add(button);
    });

    this.hintBack = scene.add
      .rectangle(width / 2, 134, width - 40, 64, dark, 0.86)
      .setDepth(UI_DEPTH)
      .setVisible(false);
    this.hintText = addLabel(scene, width / 2, 134, '', 25)
      .setDepth(UI_DEPTH)
      .setVisible(false)
      .setWordWrapWidth(width - 70);
  }

  setHint(text: string | null): void {
    const visible = text !== null && text !== '';
    this.hintBack.setVisible(visible);
    this.hintText.setVisible(visible);
    if (visible && this.hintText.text !== text) {
      this.hintText.setText(text);
      this.hintBack.setSize(this.hintBack.width, Math.max(64, this.hintText.height + 24));
    }
  }

  update(view: HudView, time: number): void {
    const { i18n } = this;
    const hp = Math.ceil(view.hp);
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      const share = Math.max(0, Math.min(1, view.hp / view.maxHp));
      this.hpFill.setSize((HP_BAR.width - 6) * share, HP_BAR.height - 6);
      this.hpFill.setFillStyle(
        hexToInt(share > 0.5 ? palette.ok : share > 0.25 ? palette.gold : palette.danger),
      );
      this.hpText.setText(`${hp}/${view.maxHp}`);
    }
    const turrets = `${view.turrets}/${view.turretLimit}`;
    if (this.turretText.text !== turrets) this.turretText.setText(turrets);
    if (this.statusText.text !== view.status) this.statusText.setText(view.status);

    this.prepBar.setVisible(!view.battle);
    this.battleBar.setVisible(view.battle);
    if (!view.battle) {
      for (const [kind, button] of this.palette) {
        button.setAlpha(view.armedKind === null || view.armedKind === kind ? 1 : 0.6);
        button.y = (gameConfig.height - layout.bottomBarY) / 2 - (view.armedKind === kind ? 8 : 0);
      }
      const canFight = view.turrets > 0;
      this.fightButton.setEnabled(canFight);
      if (canFight) this.fightButton.setScale(1 + Math.sin(time * 5) * 0.03);
      return;
    }
    this.speedButton.setText(i18n.t('hud.speed', { speed: view.speed }));
    for (const [kind, item] of this.abilityButtons) {
      const state = view.abilities[kind];
      item.button.setVisible(state.unlocked);
      if (!state.unlocked) continue;
      item.button.setEnabled(state.ready || state.adOffer);
      item.button.setScale(state.armed ? 1.06 : 1);
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
}
