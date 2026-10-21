/**
 * Піксельна панорама міста для екрана міста (як «вид міста» у Civ 1).
 * Кожна збудована споруда стоїть на своєму місці; житла заповнюють простір
 * від центру назовні в міру росту населення; мури — стрічка на передньому плані.
 */
import { City, BuildingTypeKey } from '../core/types';
import { SpriteAtlas } from '../render/sprite-atlas';
import { BUILDING_CONFIGS } from '../core/constants';

export const PANORAMA_W = 384;
export const PANORAMA_H = 216;

// Місце споруди: низ-центр і масштаб (у пікселях панорами).
// Чудеса — на дальньому плані біля горизонту, як монументи; звичайні споруди — у місті.
const BUILDING_SLOTS: Partial<Record<BuildingTypeKey, { x: number; y: number; scale: number }>> = {
  [BuildingTypeKey.Pyramids]: { x: 30, y: 94, scale: 0.65 },
  [BuildingTypeKey.GreatWall]: { x: 98, y: 92, scale: 0.6 },
  [BuildingTypeKey.Oracle]: { x: 286, y: 94, scale: 0.55 },
  [BuildingTypeKey.Colossus]: { x: 334, y: 96, scale: 0.6 },
  [BuildingTypeKey.Lighthouse]: { x: 370, y: 98, scale: 0.55 },
  [BuildingTypeKey.Temple]: { x: 84, y: 128, scale: 0.8 },
  [BuildingTypeKey.Palace]: { x: 192, y: 122, scale: 1 },
  [BuildingTypeKey.Courthouse]: { x: 252, y: 128, scale: 0.7 },
  [BuildingTypeKey.Library]: { x: 316, y: 132, scale: 0.75 },
  [BuildingTypeKey.HangingGardens]: { x: 30, y: 162, scale: 0.7 },
  [BuildingTypeKey.GreatLibrary]: { x: 124, y: 162, scale: 0.65 },
  [BuildingTypeKey.Granary]: { x: 262, y: 166, scale: 0.6 },
  [BuildingTypeKey.Aqueduct]: { x: 340, y: 166, scale: 0.65 },
  [BuildingTypeKey.Colosseum]: { x: 56, y: 198, scale: 0.7 },
  [BuildingTypeKey.Marketplace]: { x: 160, y: 196, scale: 0.8 },
  [BuildingTypeKey.Barracks]: { x: 300, y: 198, scale: 0.65 },
  // Середньовіччя
  [BuildingTypeKey.Michelangelo]: { x: 150, y: 96, scale: 0.55 },
  [BuildingTypeKey.Copernicus]: { x: 236, y: 92, scale: 0.5 },
  [BuildingTypeKey.KingRichards]: { x: 20, y: 128, scale: 0.55 },
  [BuildingTypeKey.Cathedral]: { x: 138, y: 130, scale: 0.65 },
  [BuildingTypeKey.University]: { x: 362, y: 130, scale: 0.6 },
  [BuildingTypeKey.Bank]: { x: 198, y: 166, scale: 0.55 },
  [BuildingTypeKey.Harbour]: { x: 368, y: 208, scale: 0.55 },
  // Новий час: заводи димлять на горизонті, чудеса — серед міста
  [BuildingTypeKey.Factory]: { x: 112, y: 84, scale: 0.5 },
  [BuildingTypeKey.PowerPlant]: { x: 262, y: 84, scale: 0.5 },
  [BuildingTypeKey.Shakespeare]: { x: 232, y: 196, scale: 0.55 },
  [BuildingTypeKey.Newton]: { x: 88, y: 168, scale: 0.55 },
  [BuildingTypeKey.Magellan]: { x: 372, y: 178, scale: 0.5 },
  [BuildingTypeKey.Leonardo]: { x: 292, y: 150, scale: 0.5 },
  [BuildingTypeKey.Darwin]: { x: 16, y: 198, scale: 0.5 },
  [BuildingTypeKey.AdamSmith]: { x: 196, y: 194, scale: 0.5 },
  // Сучасність I: гребля й собор — на горизонті, міські служби — серед кварталів
  [BuildingTypeKey.HooverDam]: { x: 62, y: 94, scale: 0.5 },
  [BuildingTypeKey.Bach]: { x: 94, y: 206, scale: 0.5 },
  [BuildingTypeKey.WomensSuffrage]: { x: 334, y: 190, scale: 0.5 },
  [BuildingTypeKey.StockExchange]: { x: 226, y: 160, scale: 0.5 },
  [BuildingTypeKey.Sewer]: { x: 124, y: 210, scale: 0.45 },
  [BuildingTypeKey.MassTransit]: { x: 264, y: 210, scale: 0.5 },
  // Сучасність II: аеродром і АЕС на околицях, чудеса — на горизонті
  [BuildingTypeKey.Airport]: { x: 330, y: 206, scale: 0.5 },
  [BuildingTypeKey.NuclearPlant]: { x: 316, y: 86, scale: 0.5 },
  [BuildingTypeKey.Manhattan]: { x: 206, y: 210, scale: 0.5 },
  [BuildingTypeKey.UnitedNations]: { x: 156, y: 160, scale: 0.55 },
  // Космічна гонка: стартовий майданчик і антени — на горизонті
  [BuildingTypeKey.Apollo]: { x: 352, y: 92, scale: 0.55 },
  [BuildingTypeKey.Seti]: { x: 132, y: 92, scale: 0.5 },
  [BuildingTypeKey.CureForCancer]: { x: 290, y: 176, scale: 0.5 },
  [BuildingTypeKey.MarcoPolo]: { x: 266, y: 130, scale: 0.5 },
};

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/**
 * Місця для жител, впорядковані від центру назовні. Пропускаємо лише місця під споруди,
 * що справді стоять у місті: поки чуда чи храму нема, там теж живуть люди.
 */
function houseSlots(built: BuildingTypeKey[]): { x: number; y: number; scale: number }[] {
  const slots: { x: number; y: number; scale: number }[] = [];
  // Ближні ряди — повнорозмірні; два дальні біля горизонту — дрібніші (лише для великих міст)
  const rows: [number, number][] = [[100, 1], [116, 1], [132, 1], [148, 1], [164, 1], [180, 1], [196, 1], [210, 1], [86, 0.7], [76, 0.55]];
  rows.forEach(([y, scale], r) => {
    const step = Math.round(30 * scale);
    for (let x = 18 + (r % 2) * Math.round(step / 2); x < PANORAMA_W - 12; x += step) {
      // Спрайт споруди 72 px: житло не стає ні на неї, ні просто перед нею (закрило б фасад)
      const blocked = built.some((b) => {
        const s = BUILDING_SLOTS[b];
        return !!s && Math.abs(s.x - x) < 36 * s.scale + 14 && y > s.y - 50 * s.scale && y < s.y + 26;
      });
      if (!blocked) slots.push({ x: x + Math.round((hash(x, y) - 0.5) * 8 * scale), y, scale });
    }
  });
  const near = (s: { x: number; y: number; scale: number }) => Math.hypot(s.x - 192, (s.y - 150) * 2) + (s.scale < 1 ? 1000 : 0);
  return slots.sort((a, b) => near(a) - near(b));
}

interface Item { frame: string; x: number; y: number; scale: number }

export function drawCityPanorama(canvas: HTMLCanvasElement, city: City): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  SpriteAtlas.draw(ctx, 'bd_land', 0, 0, PANORAMA_W, PANORAMA_H);

  const seed = city.x * 131 + city.y;
  const items: Item[] = [];

  for (const b of city.buildings) {
    const slot = BUILDING_SLOTS[b];
    if (slot) items.push({ frame: `${BUILDING_CONFIGS[b]?.isWonder ? 'w' : 'b'}_${b}`, ...slot });
  }

  // 3 житла на кожен рівень населення; з ростом хатинки змінюються будинками
  const slots = houseSlots(city.buildings);
  const houses = Math.min(slots.length, city.size * 3);
  const stoneShare = Math.min(1, Math.max(0, (city.size - 2) / 6));
  for (let i = 0; i < houses; i++) {
    const r = hash(seed, i);
    const stone = r < stoneShare;
    const variant = hash(i, seed) < 0.5 ? 'a' : 'b';
    items.push({ frame: stone ? `h_house_${variant}` : `h_hut_${variant}`, ...slots[i] });
  }

  // Ближче до глядача — малюється пізніше
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const { w, h } = SpriteAtlas.rect(it.frame);
    const dw = Math.round(w * it.scale);
    const dh = Math.round(h * it.scale);
    SpriteAtlas.draw(ctx, it.frame, Math.round(it.x - dw / 2), it.y - dh, dw, dh);
  }

  if (city.buildings.includes(BuildingTypeKey.CityWalls)) drawWalls(ctx);
}

/** Мури: кам'яна стрічка з зубцями й брамою по центру, вежі по краях. */
function drawWalls(ctx: CanvasRenderingContext2D): void {
  const top = PANORAMA_H - 14;
  const gateL = PANORAMA_W / 2 - 14;
  const gateR = PANORAMA_W / 2 + 14;
  const segments: [number, number][] = [[0, gateL], [gateR, PANORAMA_W]];
  for (const [x0, x1] of segments) {
    ctx.fillStyle = '#2a2630';
    ctx.fillRect(x0, top - 1, x1 - x0, 15);
    ctx.fillStyle = '#7d7a82';
    ctx.fillRect(x0, top, x1 - x0, 14);
    ctx.fillStyle = '#9c99a0';
    ctx.fillRect(x0, top, x1 - x0, 2);
    // Зубці та шви кладки
    for (let x = x0; x < x1; x += 8) {
      ctx.fillStyle = '#7d7a82';
      ctx.fillRect(x, top - 5, 4, 5);
      ctx.fillStyle = '#2a2630';
      ctx.fillRect(x, top - 6, 4, 1);
      ctx.fillStyle = '#5c5962';
      ctx.fillRect(x + 6, top + 4, 1, 4);
      ctx.fillRect(x + 2, top + 9, 1, 4);
    }
    ctx.fillStyle = '#5c5962';
    ctx.fillRect(x0, top + 8, x1 - x0, 1);
  }
  for (const x of [22, PANORAMA_W - 22, gateL - 4, gateR + 4]) {
    const { w, h } = SpriteAtlas.rect('b_city_walls');
    const dw = Math.round(w * 0.45);
    const dh = Math.round(h * 0.45);
    SpriteAtlas.draw(ctx, 'b_city_walls', Math.round(x - dw / 2), PANORAMA_H - dh, dw, dh);
  }
}
