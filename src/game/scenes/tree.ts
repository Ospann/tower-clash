import Phaser from 'phaser';
import type { GameI18n } from '../../i18n';
import { Frame, hexToInt, palette, turretColors, turretFrame, uiImage } from '../art';
import { upgradeTree, type TreeNode } from '../balance';
import { SceneKey } from '../keys';
import { services } from '../services';
import {
  nodeAvailable,
  nodeCost,
  nodeLevel,
  nodeVisible,
  purchaseNode,
  sanitizeTree,
} from '../sim/tree';
import { Button } from '../ui/button';
import { currentScreen, fitUiCamera, renderScale, restartOnResize } from '../ui/screen';
import { addLabel } from '../ui/text';

const RING = 165;
const SIBLING_PAD = 1.2;
const NODE_RADIUS = 40;
const PANEL_HEIGHT = 230;
const UI = 100;

interface Placed {
  node: TreeNode;
  x: number;
  y: number;
}

function layoutTree(): Placed[] {
  const children = new Map<string, TreeNode[]>();
  for (const node of upgradeTree) {
    if (node.parent === null) continue;
    const list = children.get(node.parent) ?? [];
    list.push(node);
    children.set(node.parent, list);
  }
  const leaves = new Map<string, number>();
  const count = (id: string): number => {
    const kids = children.get(id) ?? [];
    const total =
      kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + count(kid.id), 0) + SIBLING_PAD;
    leaves.set(id, total);
    return total;
  };
  const root = upgradeTree.find((node) => node.parent === null);
  if (!root) return [];
  count(root.id);
  const placed: Placed[] = [];
  const walk = (node: TreeNode, depth: number, from: number, to: number): void => {
    const angle = (from + to) / 2;
    placed.push({
      node,
      x: Math.cos(angle) * depth * RING,
      y: Math.sin(angle) * depth * RING,
    });
    const kids = children.get(node.id) ?? [];
    const total = leaves.get(node.id) ?? 1;
    const span = to - from;
    const minimum = (NODE_RADIUS * 2 + 22) / ((depth + 1) * RING);
    const shares = kids.map((kid) => Math.max(minimum, ((leaves.get(kid.id) ?? 1) / total) * span));
    const sum = shares.reduce((acc, value) => acc + value, 0);
    const scale = sum > span ? span / sum : 1;
    let cursor = from + (span - sum * scale) / 2;
    kids.forEach((kid, index) => {
      const share = (shares[index] ?? minimum) * scale;
      walk(kid, depth + 1, cursor, cursor + share);
      cursor += share;
    });
  };
  walk(root, 0, -Math.PI / 2, Math.PI * 1.5);
  return placed;
}

function nodeColor(node: TreeNode): number {
  const effect = node.effect;
  if (effect.type === 'unlockTurret' || effect.type === 'turret' || effect.type === 'count') {
    return hexToInt(turretColors[effect.turret].main);
  }
  if (effect.type === 'unlockAbility' || effect.type === 'ability') return 0xc0562b;
  if (effect.type === 'core') return hexToInt(palette.gold);
  return 0x3f8f6a;
}

function nodeGlyph(node: TreeNode): string {
  const effect = node.effect;
  if (effect.type === 'turret') {
    return { damage: '⚔', rate: '»', range: '◎', arc: '∢', special: '★' }[effect.stat];
  }
  if (effect.type === 'ability') return effect.stat === 'cooldown' ? '⏱' : '✦';
  if (effect.type === 'unlockAbility') return '✹';
  if (effect.type === 'count') return '+1';
  if (effect.type === 'baseHp') return '♥';
  if (effect.type === 'reward') return '◆';
  if (effect.type === 'rocket') return { damage: '↗', rate: '»', radius: '◎' }[effect.stat];
  return '';
}

export function describeNode(i18n: GameI18n, node: TreeNode, level: number): string {
  const effect = node.effect;
  const shown = Math.max(1, level);
  const percent = Math.round(node.perLevel * shown * 100);
  if (effect.type === 'core') return i18n.t('tree.core');
  if (effect.type === 'unlockTurret') {
    return i18n.t('tree.unlock', { name: i18n.t(`turret.${effect.turret}`) });
  }
  if (effect.type === 'turret') {
    const name = i18n.t(`turret.${effect.turret}`);
    const line = i18n.t(`tree.stat.${effect.stat}`, { name, percent });
    return effect.stat === 'special'
      ? `${line}\n(${i18n.t(`tree.special.${effect.turret}`)})`
      : line;
  }
  if (effect.type === 'unlockAbility') {
    return i18n.t('tree.unlock', { name: i18n.t(`ability.${effect.ability}`) });
  }
  if (effect.type === 'ability') {
    return i18n.t(`tree.ability.${effect.stat}`, {
      name: i18n.t(`ability.${effect.ability}`),
      percent,
    });
  }
  if (effect.type === 'count') {
    return i18n.t('tree.count', {
      name: i18n.t(`turret.${effect.turret}`),
      count: Math.round(node.perLevel * shown),
    });
  }
  if (effect.type === 'baseHp') return i18n.t('tree.baseHp', { percent });
  if (effect.type === 'rocket') return i18n.t(`tree.rocket.${effect.stat}`, { percent });
  return i18n.t('tree.reward', { percent });
}

interface NodeView {
  placed: Placed;
  circle: Phaser.GameObjects.Arc;
  level: Phaser.GameObjects.Text;
  parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[];
}

export class TreeScene extends Phaser.Scene {
  private views: NodeView[] = [];
  private edges!: Phaser.GameObjects.Graphics;
  private selection!: Phaser.GameObjects.Arc;
  private selected = 'core';
  private currency!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private buy!: Button;
  private dragging = false;
  private moved = 0;

  constructor() {
    super(SceneKey.Tree);
  }

  create(): void {
    const { i18n, save, gameplay } = services();
    const camera = fitUiCamera(this);
    const { width, height } = currentScreen();
    const scale = renderScale();
    gameplay.stop();
    this.cameras.main.fadeIn(200);
    restartOnResize(this);
    this.selected = 'core';
    this.views = [];

    const placed = layoutTree();
    const reach =
      Math.max(...placed.map((item) => Math.max(Math.abs(item.x), Math.abs(item.y)))) + 140;
    const clampScroll = (x: number, y: number): void => {
      const minX = -reach;
      const maxX = reach - width;
      const minY = -reach - 120;
      const maxY = reach + PANEL_HEIGHT - height;
      camera.scrollX = minX > maxX ? -width / 2 : Math.min(maxX, Math.max(minX, x));
      camera.scrollY = minY > maxY ? 60 - height / 2 : Math.min(maxY, Math.max(minY, y));
    };
    clampScroll(-width / 2, 60 - height / 2);

    this.edges = this.add.graphics();
    this.selection = this.add.circle(0, 0, NODE_RADIUS + 9).setStrokeStyle(6, 0xffffff, 1);
    this.selection.isFilled = false;

    for (const item of placed) {
      const circle = this.add
        .circle(item.x, item.y, NODE_RADIUS, nodeColor(item.node))
        .setStrokeStyle(4, hexToInt(palette.outline));
      const parts: NodeView['parts'] = [];
      const effect = item.node.effect;
      if (effect.type === 'unlockTurret') {
        parts.push(uiImage(this, item.x, item.y - 4, turretFrame(effect.turret)));
      } else if (effect.type === 'core') {
        parts.push(uiImage(this, item.x, item.y - 2, Frame.TurretBase));
        parts.push(uiImage(this, item.x, item.y - 2, turretFrame('ballista')).setAngle(-90));
      } else {
        const glyph = addLabel(this, item.x, item.y - 8, nodeGlyph(item.node), 34);
        glyph.setStroke(palette.outline, 5);
        parts.push(glyph);
      }
      const level = addLabel(this, item.x, item.y + 24, '', 18);
      level.setStroke(palette.outline, 4);
      this.views.push({ placed: item, circle, level, parts });
    }

    const dark = hexToInt(palette.uiDark);
    this.add
      .rectangle(0, 0, width, 96, dark, 0.95)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(UI)
      .setInteractive();
    addLabel(this, width / 2, 48, i18n.t('tree.title'), 36)
      .setScrollFactor(0)
      .setDepth(UI);
    new Button(
      this,
      78,
      48,
      i18n.t('common.back'),
      () => {
        this.scene.start(SceneKey.LevelSelect);
      },
      { width: 132, height: 72, fontSize: 26, color: 0x3a3f58 },
    )
      .setScrollFactor(0)
      .setDepth(UI);
    uiImage(this, width - 150, 48, Frame.Crystal)
      .setScrollFactor(0)
      .setDepth(UI);
    this.currency = addLabel(this, width - 126, 48, '', 32, palette.crystal)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(UI);

    this.add
      .rectangle(0, height - PANEL_HEIGHT, width, PANEL_HEIGHT, dark, 0.96)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(UI)
      .setInteractive();
    this.title = addLabel(this, width / 2, height - PANEL_HEIGHT + 52, '', 28)
      .setScrollFactor(0)
      .setDepth(UI)
      .setWordWrapWidth(width - 60);
    this.info = addLabel(this, width / 2, height - PANEL_HEIGHT + 106, '', 24, palette.uiMuted)
      .setScrollFactor(0)
      .setDepth(UI)
      .setWordWrapWidth(width - 60);
    this.buy = new Button(this, width / 2, height - 62, '', () => this.purchase(), {
      width: 420,
      height: 92,
      fontSize: 34,
      color: 0x7d4bc4,
    })
      .setScrollFactor(0)
      .setDepth(UI);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, over: unknown[]) => {
      this.dragging = over.length === 0;
      this.moved = 0;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const dx = pointer.x - pointer.prevPosition.x;
      const dy = pointer.y - pointer.prevPosition.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      clampScroll(camera.scrollX - dx / scale, camera.scrollY - dy / scale);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const wasDragging = this.dragging;
      this.dragging = false;
      if (!wasDragging || this.moved > 14) return;
      const point = camera.getWorldPoint(pointer.x, pointer.y);
      for (const view of this.views) {
        if (!view.circle.visible) continue;
        if (Math.hypot(view.placed.x - point.x, view.placed.y - point.y) <= NODE_RADIUS + 8) {
          this.selected = view.placed.node.id;
          this.render();
          return;
        }
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
    });

    void save;
    this.render();
  }

  private purchase(): void {
    const { save } = services();
    const levels = sanitizeTree(save.data.tree);
    const result = purchaseNode(levels, this.selected, save.data.currency);
    if (!result) return;
    save.update((data) => {
      data.currency = result.currency;
      data.tree = { ...levels, [this.selected]: result.level };
    });
    this.render();
  }

  private render(): void {
    const { i18n, save } = services();
    const levels = sanitizeTree(save.data.tree);
    this.currency.setText(String(save.data.currency));

    const positions = new Map(this.views.map((view) => [view.placed.node.id, view.placed]));
    const g = this.edges.clear();
    for (const view of this.views) {
      const { node, x, y } = view.placed;
      const level = nodeLevel(levels, node.id);
      const available = nodeAvailable(levels, node.id);
      const visible = nodeVisible(levels, node.id);
      view.circle.setVisible(visible);
      view.level.setVisible(visible);
      for (const part of view.parts) part.setVisible(visible);
      if (!visible) continue;
      const parent = node.parent === null ? undefined : positions.get(node.parent);
      if (parent) {
        g.lineStyle(6, level > 0 ? hexToInt(palette.gold) : 0x55606a, available ? 0.9 : 0.4);
        g.lineBetween(parent.x, parent.y, x, y);
      }
      const alpha = level > 0 ? 1 : available ? 0.85 : 0.35;
      view.circle.setAlpha(alpha);
      view.circle.setStrokeStyle(
        4,
        hexToInt(level >= node.maxLevel ? palette.gold : palette.outline),
      );
      for (const part of view.parts) part.setAlpha(alpha);
      view.level
        .setAlpha(alpha)
        .setText(node.effect.type === 'core' ? '' : `${level}/${node.maxLevel}`);
      if (node.id === this.selected) this.selection.setPosition(x, y);
    }

    const selected = this.views.find((view) => view.placed.node.id === this.selected)?.placed.node;
    if (!selected) return;
    const level = nodeLevel(levels, selected.id);
    const cost = nodeCost(selected.id, level);
    const available = nodeAvailable(levels, selected.id);
    const next = Math.min(selected.maxLevel, level + 1);
    this.title.setText(describeNode(i18n, selected, cost === null ? level : next));
    if (selected.effect.type === 'core') {
      this.info.setText('');
      this.buy.setVisible(false);
      return;
    }
    this.buy.setVisible(true);
    this.info.setText(
      available ? i18n.t('tree.level', { level, max: selected.maxLevel }) : i18n.t('tree.locked'),
    );
    this.buy.setText(cost === null ? i18n.t('tree.max') : i18n.t('tree.buy', { cost }));
    this.buy.setEnabled(cost !== null && available && save.data.currency >= cost);
  }
}
