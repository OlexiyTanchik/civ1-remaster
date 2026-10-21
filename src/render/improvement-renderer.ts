/**
 * Покращення клітинок: іригація, дороги й залізниці (8 напрямків, як у Civ 1), шахти, забруднення.
 * Шар перемальовується за подією (refreshAll), а не щокадру.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { World } from '../core/world';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../core/constants';
import { SpriteAtlas } from './sprite-atlas';

const T = TILE_SIZE;
const DIRS_8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

export class ImprovementRenderer {
  public readonly container = new Container();
  private irrigation = new Graphics();
  private roads = new Graphics();
  private rails = new Graphics();
  private smog = new Graphics();
  private mines = new Container();

  constructor(private world: World) {
    this.container.addChild(this.irrigation, this.roads, this.rails, this.mines, this.smog);
  }

  public refresh(): void {
    this.irrigation.clear();
    this.roads.clear();
    this.rails.clear();
    this.smog.clear();
    this.mines.removeChildren().forEach((c) => c.destroy());

    const fog = this.world.playerFogs.get(0);
    const segments: [number, number, number, number][] = [];
    const railSegments: [number, number, number, number][] = [];
    const lone: [number, number][] = [];

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (fog && !fog.explored[y][x]) continue;
        const tile = this.world.tiles[y][x];
        if (tile.hasIrrigation) this.drawIrrigation(x, y);
        if (tile.hasPollution) this.drawSmog(x, y);
        if (tile.hasHut) {
          const s = new Sprite(SpriteAtlas.texture('i_hut'));
          s.anchor.set(0.5, 1);
          s.position.set(x * T + T / 2, y * T + T - 8);
          this.mines.addChild(s);
        }
        if (tile.hasMine) {
          const s = new Sprite(SpriteAtlas.texture('i_mine'));
          s.anchor.set(0.5, 1);
          s.position.set(x * T + T / 2, y * T + T - 4);
          this.mines.addChild(s);
        }
        if (!tile.hasRoad) continue;

        // Кожен відрізок малюємо один раз: лише до сусідів «попереду» (половина напрямків)
        let connected = false;
        for (const [dx, dy] of DIRS_8) {
          const ny = y + dy;
          if (ny < 0 || ny >= MAP_HEIGHT) continue;
          const n = this.world.tiles[ny][(x + dx + MAP_WIDTH) % MAP_WIDTH];
          if (!n.hasRoad && !n.cityId) continue;
          connected = true;
          if (n.cityId || dy > 0 || (dy === 0 && dx > 0)) {
            segments.push([x * T + T / 2, y * T + T / 2, (x + dx) * T + T / 2, ny * T + T / 2]);
            if (tile.hasRailroad && (n.hasRailroad || n.cityId)) {
              railSegments.push([x * T + T / 2, y * T + T / 2, (x + dx) * T + T / 2, ny * T + T / 2]);
            }
          }
        }
        if (!connected) lone.push([x * T + T / 2, y * T + T / 2]);
      }
    }

    // Спершу темна облямівка всіх доріг, потім ґрунтове полотно — перетини виглядають суцільно
    for (const [w, color] of [[9, 0x3b2614], [5, 0xa77a45]] as const) {
      for (const [x1, y1, x2, y2] of segments) {
        this.roads.moveTo(x1, y1).lineTo(x2, y2);
      }
      this.roads.stroke({ color, width: w, cap: 'square' });
      for (const [cx, cy] of lone) {
        this.roads.rect(cx - w, cy - w, w * 2, w * 2).fill({ color });
      }
    }
    this.drawRails(railSegments);
  }

  /** Колія: дерев'яні шпали поперек і дві сталеві рейки. */
  private drawRails(segs: [number, number, number, number][]): void {
    const g = this.rails;
    for (const [x1, y1, x2, y2] of segs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      const nx = -uy;
      const ny = ux;
      for (let t = 3; t < len; t += 6) {
        const px = x1 + ux * t;
        const py = y1 + uy * t;
        g.moveTo(px - nx * 5, py - ny * 5).lineTo(px + nx * 5, py + ny * 5);
      }
    }
    g.stroke({ color: 0x5a3a1c, width: 2 });
    for (const off of [-2.5, 2.5]) {
      for (const [x1, y1, x2, y2] of segs) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const nx = -(y2 - y1) / len;
        const ny = (x2 - x1) / len;
        g.moveTo(x1 + nx * off, y1 + ny * off).lineTo(x2 + nx * off, y2 + ny * off);
      }
    }
    g.stroke({ color: 0x2b2b30, width: 1.5 });
  }

  /** Забруднення: темні плями кіптяви (піксельні квадрати за фіксованим візерунком). */
  private drawSmog(x: number, y: number): void {
    const g = this.smog;
    for (let i = 0; i < 14; i++) {
      const h = ((x * 73856093) ^ (y * 19349663) ^ (i * 83492791)) >>> 0;
      const px = x * T + 6 + (h % (T - 16));
      const py = y * T + 6 + ((h >>> 8) % (T - 16));
      const s = 3 + ((h >>> 16) % 5);
      g.rect(px, py, s, s).fill({ color: i % 3 ? 0x2a2622 : 0x4a4038, alpha: 0.75 });
    }
  }

  /** Іригація: зеленіше поле з трьома блакитними каналами. */
  private drawIrrigation(x: number, y: number): void {
    const px = x * T;
    const py = y * T;
    const g = this.irrigation;
    g.rect(px + 4, py + 4, T - 8, T - 8).fill({ color: 0x5fa83a, alpha: 0.18 });
    for (const f of [0.25, 0.5, 0.75]) {
      const cy = Math.round(py + T * f);
      g.rect(px + 6, cy - 1, T - 12, 1).fill({ color: 0x1b2f5c });
      g.rect(px + 6, cy, T - 12, 2).fill({ color: 0x3a78c8 });
      g.rect(px + 6, cy + 2, T - 12, 1).fill({ color: 0x8cc4f0 });
    }
  }
}
