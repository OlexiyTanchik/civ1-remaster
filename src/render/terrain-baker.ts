/**
 * Запікання рельєфу в піксель-арт шматки (CHUNK×CHUNK тайлів) з атласу спрайтів.
 * Порядок: база (безшовні текстури, прив'язані до світових координат) →
 * дизерингові переходи між біомами → берег (пляж, мілина, піна) → річки → накладки → ресурси.
 */
import { World } from '../core/world';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../core/constants';
import { TerrainType, ResourceType } from '../core/types';
import { SpriteAtlas, TERRAIN_FRAME, OVERLAY_FRAME, RESOURCE_FRAME } from './sprite-atlas';
import { hasGrasslandShield } from '../core/terraform';

/** Тайлів у шматку по кожній осі (1024 px — безпечний розмір текстури для будь-якого GPU). */
export const CHUNK = 16;

export interface TerrainChunk {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

/** Базовий ґрунт під кожним типом рельєфу (гори, ліси тощо — накладки поверх бази). */
const BASE_OF: Record<TerrainType, TerrainType> = {
  [TerrainType.Ocean]: TerrainType.Ocean,
  [TerrainType.Grassland]: TerrainType.Grassland,
  [TerrainType.Plains]: TerrainType.Plains,
  [TerrainType.Desert]: TerrainType.Desert,
  [TerrainType.Tundra]: TerrainType.Tundra,
  [TerrainType.Glacier]: TerrainType.Glacier,
  [TerrainType.Swamp]: TerrainType.Swamp,
  [TerrainType.Hills]: TerrainType.Plains,
  [TerrainType.Mountains]: TerrainType.Tundra,
  [TerrainType.Forest]: TerrainType.Grassland,
  [TerrainType.Jungle]: TerrainType.Grassland,
};

/** Вищий пріоритет «наповзає» на сусіда з нижчим. Океан обробляється окремо (берег). */
const PRIORITY: Record<string, number> = {
  [TerrainType.Ocean]: 0,
  [TerrainType.Swamp]: 1,
  [TerrainType.Grassland]: 2,
  [TerrainType.Plains]: 3,
  [TerrainType.Tundra]: 4,
  [TerrainType.Desert]: 5,
  [TerrainType.Glacier]: 6,
};

const BAND = 14; // ширина дизерингового переходу, px
const BEACH = 4; // ширина пляжу на суші, px
const SHALLOW = 12; // ширина мілини у воді, px

// Матриця Байєра 4×4, нормована в (0..1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// 8 сусідів: зсув і функція відстані від пікселя до відповідної сторони/кута тайла
const T = TILE_SIZE;
const NEIGHBORS: { dx: number; dy: number; dist: (lx: number, ly: number) => number }[] = [
  { dx: 0, dy: -1, dist: (_, ly) => ly },
  { dx: 0, dy: 1, dist: (_, ly) => T - 1 - ly },
  { dx: -1, dy: 0, dist: (lx) => lx },
  { dx: 1, dy: 0, dist: (lx) => T - 1 - lx },
  { dx: -1, dy: -1, dist: (lx, ly) => Math.hypot(lx, ly) },
  { dx: 1, dy: -1, dist: (lx, ly) => Math.hypot(T - 1 - lx, ly) },
  { dx: -1, dy: 1, dist: (lx, ly) => Math.hypot(lx, T - 1 - ly) },
  { dx: 1, dy: 1, dist: (lx, ly) => Math.hypot(T - 1 - lx, T - 1 - ly) },
];

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Плавний шум уздовж краю: звивистість меж замість прямих ліній, ±4 px. */
const wobble = (wx: number, wy: number) => {
  const u = (wx + wy) / 9;
  const i = Math.floor(u);
  const f = u - i;
  const s = f * f * (3 - 2 * f);
  return (hash(i, 7) * (1 - s) + hash(i + 1, 7) * s - 0.5) * 8;
};

interface TexData {
  data: Uint8ClampedArray;
  size: number;
}

export class TerrainBaker {
  private static textures = new Map<TerrainType, TexData>();

  public static bake(world: World): TerrainChunk[] {
    this.loadTextures();
    const chunks: TerrainChunk[] = [];
    for (let cy = 0; cy < MAP_HEIGHT; cy += CHUNK) {
      for (let cx = 0; cx < MAP_WIDTH; cx += CHUNK) {
        chunks.push({ canvas: this.bakeChunk(world, cx, cy), x: cx * T, y: cy * T });
      }
    }
    return chunks;
  }

  private static loadTextures(): void {
    if (this.textures.size) return;
    for (const [type, frame] of Object.entries(TERRAIN_FRAME)) {
      const c = SpriteAtlas.toCanvas(frame!);
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      this.textures.set(type as TerrainType, { data, size: c.width });
    }
  }

  private static baseAt(world: World, x: number, y: number): TerrainType {
    const cy = Math.max(0, Math.min(MAP_HEIGHT - 1, y));
    const cx = ((x % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH;
    return BASE_OF[world.tiles[cy][cx].terrain];
  }

  private static bakeChunk(world: World, cx0: number, cy0: number): HTMLCanvasElement {
    const tilesW = Math.min(CHUNK, MAP_WIDTH - cx0);
    const tilesH = Math.min(CHUNK, MAP_HEIGHT - cy0);
    const canvas = document.createElement('canvas');
    canvas.width = tilesW * T;
    canvas.height = tilesH * T;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(canvas.width, canvas.height);
    const out = img.data;

    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        this.bakeTilePixels(world, cx0 + tx, cy0 + ty, out, canvas.width, tx * T, ty * T);
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;

    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        const tile = world.tiles[cy0 + ty][cx0 + tx];
        if (tile.hasRiver) this.drawRiver(ctx, world, cx0 + tx, cy0 + ty, tx * T, ty * T);
      }
    }
    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        const tile = world.tiles[cy0 + ty][cx0 + tx];
        const overlay = OVERLAY_FRAME[tile.terrain];
        if (overlay) {
          // Дзеркалимо половину накладок, щоб гори/ліси не виглядали штампом
          ctx.save();
          if (hash(cx0 + tx, cy0 + ty) > 0.5) {
            ctx.translate(tx * T + T, ty * T);
            ctx.scale(-1, 1);
          } else {
            ctx.translate(tx * T, ty * T);
          }
          SpriteAtlas.draw(ctx, overlay, 0, 0, T, T);
          ctx.restore();
        }
        if (hasGrasslandShield(tile)) this.drawShieldMark(ctx, tx * T + T / 2 - 8, ty * T + T / 2 - 9);
        const res = tile.resource !== ResourceType.None ? RESOURCE_FRAME[tile.resource] : undefined;
        if (res) {
          const r = SpriteAtlas.rect(res);
          // З накладкою ресурс у верхньому правому куті, інакше — по центру
          const rx = overlay ? T - r.w - 2 : (T - r.w) / 2;
          const ry = overlay ? 2 : (T - r.h) / 2;
          SpriteAtlas.draw(ctx, res, tx * T + rx, ty * T + ry);
        }
      }
    }
    return canvas;
  }

  private static bakeTilePixels(
    world: World, x: number, y: number, out: Uint8ClampedArray, stride: number, ox: number, oy: number
  ): void {
    const base = this.baseAt(world, x, y);
    const isOcean = base === TerrainType.Ocean;
    const neigh = NEIGHBORS.map((n) => ({ ...n, base: this.baseAt(world, x + n.dx, y + n.dy) }));
    // Для океану — сусідня суша (мілина/піна), для суші — сусідній океан (пляж) і біоми з вищим пріоритетом
    const coast = neigh.filter((n) => (n.base === TerrainType.Ocean) !== isOcean);
    const higher = isOcean ? [] : neigh.filter((n) => n.base !== TerrainType.Ocean && PRIORITY[n.base] > PRIORITY[base]);

    for (let ly = 0; ly < T; ly++) {
      for (let lx = 0; lx < T; lx++) {
        const wx = x * T + lx;
        const wy = y * T + ly;
        const bay = BAYER[(ly & 3) * 4 + (lx & 3)];
        const wob = wobble(wx, wy);

        let show = base;
        let coastDist = Infinity;
        for (const n of coast) coastDist = Math.min(coastDist, n.dist(lx, ly) + wob * 0.5);

        let bestPrio = -1;
        for (const n of higher) {
          const d = n.dist(lx, ly) + wob;
          if (bay < 1 - d / BAND && PRIORITY[n.base] > bestPrio) {
            show = n.base;
            bestPrio = PRIORITY[n.base];
          }
        }

        const p = ((oy + ly) * stride + ox + lx) * 4;
        if (!isOcean && coastDist < BEACH) show = TerrainType.Desert;
        this.sample(show, wx, wy, out, p);

        if (isOcean && coastDist < SHALLOW) {
          if (coastDist < 2) this.mix(out, p, 236, 246, 240, 0.9); // піна
          else if (bay < 1 - coastDist / SHALLOW) this.mix(out, p, 92, 176, 196, 0.45); // мілина
        } else if (!isOcean && coastDist < 1.5) {
          this.mix(out, p, 60, 46, 30, 0.35); // темний край суші
        }
      }
    }
  }

  private static sample(type: TerrainType, wx: number, wy: number, out: Uint8ClampedArray, p: number): void {
    const tex = this.textures.get(type)!;
    const s = tex.size;
    const q = ((wy % s) * s + (wx % s)) * 4;
    out[p] = tex.data[q];
    out[p + 1] = tex.data[q + 1];
    out[p + 2] = tex.data[q + 2];
    out[p + 3] = 255;
  }

  private static mix(d: Uint8ClampedArray, p: number, r: number, g: number, b: number, k: number): void {
    d[p] = d[p] * (1 - k) + r * k;
    d[p + 1] = d[p + 1] * (1 - k) + g * k;
    d[p + 2] = d[p + 2] * (1 - k) + b * k;
  }

  /** Піксельний щит 16×18 у центрі клітинки (луки з бонусом щита, як у Civ 1). */
  private static drawShieldMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const rows = ['.######.', '#oooooo#', '#oyyyyo#', '#oyyyyo#', '#oyyyyo#', '.#oyyo#.', '.#oooo#.', '..#oo#..', '...##...'];
    const colors: Record<string, string> = { '#': '#2a1d10', o: '#b0782c', y: '#f0c850' };
    rows.forEach((row, ry) => [...row].forEach((c, rx) => {
      if (c === '.') return;
      ctx.fillStyle = colors[c];
      ctx.fillRect(x + rx * 2, y + ry * 2, 2, 2);
    }));
  }

  /** Річка: чіткі прямокутні відрізки від центру тайла до сусідніх річок / океану. */
  private static drawRiver(ctx: CanvasRenderingContext2D, world: World, x: number, y: number, px: number, py: number): void {
    const c = T / 2;
    const parts: [number, number][] = [];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const ny = y + dy;
      if (ny < 0 || ny >= MAP_HEIGHT) continue;
      const nt = world.tiles[ny][(x + dx + MAP_WIDTH) % MAP_WIDTH];
      if (nt.hasRiver || nt.terrain === TerrainType.Ocean) parts.push([dx, dy]);
    }
    for (const [w, color] of [[10, '#1b2f5c'], [6, '#3a78c8'], [2, '#8cc4f0']] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(px + c - w / 2, py + c - w / 2, w, w);
      for (const [dx, dy] of parts) {
        if (dx === 0) ctx.fillRect(px + c - w / 2, py + (dy < 0 ? 0 : c), w, c);
        else ctx.fillRect(px + (dx < 0 ? 0 : c), py + c - w / 2, c, w);
      }
    }
  }
}
