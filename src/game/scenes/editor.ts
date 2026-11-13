import Phaser from 'phaser';
import { generateLevelMap, hexToInt, palette } from '../art';
import { gameConfig } from '../config';
import { SceneKey } from '../keys';
import { levels } from '../levels';
import {
  OBSTACLE_TYPES,
  type LevelData,
  type ObstacleType,
  type Point,
  type Rect,
} from '../levels/level-types';
import { validateLevel } from '../levels/validate-level';
import { fitUiCamera } from '../ui/screen';
import { FlowField } from '../sim/flow-field';
import { GridMap, obstacleContains, rectContains } from '../sim/grid-map';

const TOOLS = ['rect', 'circle', 'poly', 'entry', 'zone', 'erase'] as const;
type Tool = (typeof TOOLS)[number];

const SNAP = 20;

function blankLevel(): LevelData {
  return {
    id: 'level-new',
    name: 'level.01',
    chapter: 1,
    grid: { cols: 36, rows: 64, cell: 20 },
    tiles: 'meadow',
    obstacles: [],
    entries: [{ id: 'n', x: 360, y: 0, radius: 100 }],
    zones: [{ x: 0, y: 1040, w: 720, h: 90 }],
    baseHp: 30,
    turretLimit: 4,
    win: { type: 'waves' },
    difficulty: { hp: 1, speed: 1 },
    waves: [{ groups: [{ goblin: 'grunt', count: 30, duration: 10, entry: 'n', delay: 0 }] }],
  };
}

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function toRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export class EditorScene extends Phaser.Scene {
  private draft: LevelData = blankLevel();
  private tool: Tool = 'rect';
  private obstacleType: ObstacleType = 'rock';
  private showFlow = true;
  private background!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private panel: HTMLDivElement | null = null;
  private status: HTMLDivElement | null = null;
  private dragStart: Point | null = null;
  private polygon: Point[] = [];

  constructor() {
    super(SceneKey.Editor);
  }

  create(): void {
    fitUiCamera(this);
    this.background = this.add
      .image(0, 0, generateLevelMap(this.textures, this.draft))
      .setOrigin(0);
    this.overlay = this.add.graphics();
    this.buildPanel();
    this.refresh();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const point = { x: snap(pointer.worldX), y: snap(pointer.worldY) };
      if (this.tool === 'rect' || this.tool === 'zone' || this.tool === 'circle') {
        this.dragStart = point;
      } else if (this.tool === 'poly') {
        this.polygon.push(point);
        this.drawOverlay();
      } else if (this.tool === 'entry') {
        this.addEntry(pointer.worldX, pointer.worldY);
      } else {
        this.erase(pointer.worldX, pointer.worldY);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.dragStart || !pointer.isDown) return;
      if (this.tool === 'circle') {
        this.drawOverlay(undefined, {
          ...this.dragStart,
          r: Math.hypot(pointer.worldX - this.dragStart.x, pointer.worldY - this.dragStart.y),
        });
        return;
      }
      this.drawOverlay(
        toRect(this.dragStart, { x: snap(pointer.worldX), y: snap(pointer.worldY) }),
      );
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.dragStart) return;
      if (this.tool === 'circle') {
        const center = this.dragStart;
        this.dragStart = null;
        const r = Math.round(Math.hypot(pointer.worldX - center.x, pointer.worldY - center.y));
        if (r >= 8) {
          this.draft.obstacles.push({
            type: this.obstacleType,
            shape: { kind: 'circle', ...center, r },
          });
        }
        this.refresh();
        return;
      }
      const rect = toRect(this.dragStart, { x: snap(pointer.worldX), y: snap(pointer.worldY) });
      this.dragStart = null;
      if (rect.w >= SNAP && rect.h >= SNAP) {
        if (this.tool === 'zone') this.draft.zones.push(rect);
        else {
          this.draft.obstacles.push({ type: this.obstacleType, shape: { kind: 'rect', ...rect } });
        }
      }
      this.refresh();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.panel?.remove();
      this.panel = null;
    });
  }

  private addEntry(x: number, y: number): void {
    const { width, height } = gameConfig;
    const edges = [
      { d: y, point: { x: snap(x), y: 0 } },
      { d: height - y, point: { x: snap(x), y: height } },
      { d: x, point: { x: 0, y: snap(y) } },
      { d: width - x, point: { x: width, y: snap(y) } },
    ].toSorted((a, b) => a.d - b.d);
    const nearest = edges[0];
    if (!nearest) return;
    const used = new Set(this.draft.entries.map((entry) => entry.id));
    let index = 1;
    while (used.has(`e${index}`)) index += 1;
    this.draft.entries.push({ id: `e${index}`, ...nearest.point, radius: 80 });
    this.refresh();
  }

  private erase(x: number, y: number): void {
    const draft = this.draft;
    const entry = draft.entries.findIndex((item) => Math.hypot(item.x - x, item.y - y) < 60);
    if (entry >= 0) draft.entries.splice(entry, 1);
    else {
      const obstacle = draft.obstacles.findLastIndex((item) => obstacleContains(item, x, y));
      if (obstacle >= 0) draft.obstacles.splice(obstacle, 1);
      else {
        const zone = draft.zones.findLastIndex((item) => rectContains(item, x, y));
        if (zone >= 0) draft.zones.splice(zone, 1);
      }
    }
    this.refresh();
  }

  private closePolygon(): void {
    if (this.polygon.length >= 3) {
      this.draft.obstacles.push({
        type: this.obstacleType,
        shape: { kind: 'poly', points: this.polygon },
      });
    }
    this.polygon = [];
    this.refresh();
  }

  private refresh(): void {
    this.background.setTexture(generateLevelMap(this.textures, this.draft));
    this.drawOverlay();
    const issues = validateLevel(this.draft);
    if (this.status) {
      this.status.textContent =
        issues.length === 0 ? 'Level is valid' : `Issues:\n${issues.slice(0, 6).join('\n')}`;
      this.status.style.color = issues.length === 0 ? '#9be7a0' : '#ffb0a0';
    }
  }

  private drawOverlay(preview?: Rect, circle?: { x: number; y: number; r: number }): void {
    const g = this.overlay.clear();
    const draft = this.draft;
    if (this.showFlow && draft.zones.length > 0) {
      const map = new GridMap(draft);
      const flow = new FlowField(map);
      for (let cy = 0; cy < map.rows; cy += 1) {
        for (let cx = 0; cx < map.cols; cx += 1) {
          const c = cy * map.cols + cx;
          const x = (cx + 0.5) * map.cell;
          const y = (cy + 0.5) * map.cell;
          if (map.blockMove[c]) {
            g.fillStyle(0x000000, 0.25).fillRect(cx * map.cell, cy * map.cell, map.cell, map.cell);
            continue;
          }
          if (!Number.isFinite(flow.dist[c] ?? 0)) {
            g.fillStyle(0xff0000, 0.3).fillRect(cx * map.cell, cy * map.cell, map.cell, map.cell);
            continue;
          }
          const dx = (flow.dirX[c] ?? 0) * 7;
          const dy = (flow.dirY[c] ?? 0) * 7;
          g.lineStyle(1.5, 0x10202a, 0.55).lineBetween(x - dx, y - dy, x + dx, y + dy);
          g.fillStyle(0x10202a, 0.7).fillCircle(x + dx, y + dy, 2);
        }
      }
    }
    for (const entry of draft.entries) {
      g.lineStyle(3, hexToInt(palette.danger), 1).strokeCircle(entry.x, entry.y, entry.radius);
      g.fillStyle(hexToInt(palette.danger), 1).fillCircle(entry.x, entry.y, 8);
    }
    if (this.polygon.length > 0) {
      g.lineStyle(3, 0xffffff, 1);
      g.beginPath();
      this.polygon.forEach((point, index) => {
        if (index === 0) g.moveTo(point.x, point.y);
        else g.lineTo(point.x, point.y);
      });
      g.strokePath();
      for (const point of this.polygon) g.fillStyle(0xffffff, 1).fillCircle(point.x, point.y, 5);
    }
    if (circle) g.lineStyle(3, 0xffffff, 1).strokeCircle(circle.x, circle.y, circle.r);
    if (preview) {
      g.lineStyle(3, 0xffffff, 1).strokeRect(preview.x, preview.y, preview.w, preview.h);
    }
  }

  private buildPanel(): void {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      right: '8px',
      top: '8px',
      zIndex: '950',
      width: '230px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      font: '13px/1.3 system-ui, sans-serif',
      color: '#fff',
      background: 'rgba(15, 20, 18, 0.92)',
      borderRadius: '8px',
    });
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const element = document.createElement('button');
      element.textContent = label;
      element.style.padding = '6px';
      element.addEventListener('click', action);
      panel.append(element);
      return element;
    };
    const select = (
      label: string,
      options: readonly string[],
      onChange: (value: string) => void,
    ): void => {
      const row = document.createElement('label');
      row.textContent = `${label} `;
      const element = document.createElement('select');
      for (const option of options) {
        const item = document.createElement('option');
        item.value = option;
        item.textContent = option;
        element.append(item);
      }
      element.addEventListener('change', () => onChange(element.value));
      row.append(element);
      panel.append(row);
    };

    select('Tool', TOOLS, (value) => {
      const tool = TOOLS.find((item) => item === value);
      if (tool) this.tool = tool;
      this.polygon = [];
      this.drawOverlay();
    });
    select('Obstacle', OBSTACLE_TYPES, (value) => {
      const type = OBSTACLE_TYPES.find((item) => item === value);
      if (type) this.obstacleType = type;
    });
    select('Load', ['new', ...levels.map((level) => level.id)], (value) => {
      const source = levels.find((level) => level.id === value);
      this.draft = source ? structuredClone(source) : blankLevel();
      this.polygon = [];
      this.refresh();
    });
    button('Close polygon', () => this.closePolygon());
    button('Toggle flow field', () => {
      this.showFlow = !this.showFlow;
      this.drawOverlay();
    });
    button('Undo last obstacle', () => {
      this.draft.obstacles.pop();
      this.refresh();
    });
    button('Copy JSON', () => {
      const json = `${JSON.stringify(this.draft, null, 2)}\n`;
      console.info(json);
      navigator.clipboard.writeText(json).then(
        () => {
          if (this.status) this.status.textContent = 'JSON copied to the clipboard';
        },
        () => {
          if (this.status) this.status.textContent = 'Clipboard is blocked, JSON is in the console';
        },
      );
    });
    const status = document.createElement('div');
    status.style.whiteSpace = 'pre-wrap';
    panel.append(status);
    const note = document.createElement('div');
    note.style.opacity = '0.7';
    note.textContent =
      'rect/zone: drag. circle: drag from the centre. poly: click points, then Close polygon. entry: click near an edge. Waves, HP and limits are edited in the JSON.';
    panel.append(note);
    document.body.append(panel);
    this.panel = panel;
    this.status = status;
  }
}
