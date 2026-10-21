/**
 * Роботи поселенців за правилами Civ 1: дороги (і залізниці поверх них), іригація, шахти, очищення.
 * Тривалість і бонуси залежать від рельєфу; іригація лише біля води;
 * шахта й іригація взаємовиключні.
 */
import { TileData, TerrainType, Player, UnitTypeKey } from './types';
import { TERRAIN_DATA, MAP_WIDTH, MAP_HEIGHT } from './constants';

export type TerraformKind = 'road' | 'irrigation' | 'mine' | 'clean';

/** Хто вміє працювати на землі: робітники (основне заняття) і поселенці (як у Civ 1). */
export function canTerraform(type: UnitTypeKey): boolean {
  return type === UnitTypeKey.Workers || type === UnitTypeKey.Settlers;
}

export const TERRAFORM_INFO: Record<TerraformKind, { nameUa: string; letter: string; hotkey: string }> = {
  road: { nameUa: 'Дорога', letter: 'R', hotkey: 'R' },
  irrigation: { nameUa: 'Іригація', letter: 'I', hotkey: 'I' },
  mine: { nameUa: 'Шахта', letter: 'M', hotkey: 'M' },
  clean: { nameUa: 'Очищення', letter: 'P', hotkey: 'P' },
};

/** Підпис роботи «дорога»: на клітинці з дорогою це вже залізниця. */
export function terraformName(tile: TileData, kind: TerraformKind): string {
  return kind === 'road' && tile.hasRoad ? 'Залізниця' : TERRAFORM_INFO[kind].nameUa;
}

// Ходи роботи одного поселенця (undefined — на цьому рельєфі неможливо)
const ROAD_TURNS: Partial<Record<TerrainType, number>> = {
  [TerrainType.Grassland]: 2, [TerrainType.Plains]: 2, [TerrainType.Desert]: 2, [TerrainType.Tundra]: 2,
  [TerrainType.Forest]: 4, [TerrainType.Jungle]: 4, [TerrainType.Swamp]: 4, [TerrainType.Hills]: 4,
  [TerrainType.Glacier]: 4, [TerrainType.Mountains]: 6,
};
const IRRIGATION_TURNS: Partial<Record<TerrainType, number>> = {
  [TerrainType.Grassland]: 5, [TerrainType.Plains]: 5, [TerrainType.Desert]: 5, [TerrainType.Hills]: 10,
};
const MINE_TURNS: Partial<Record<TerrainType, number>> = {
  [TerrainType.Desert]: 5, [TerrainType.Hills]: 10, [TerrainType.Mountains]: 10,
};

// Бонуси до видобутку клітинки
const ROAD_TRADE = new Set([TerrainType.Grassland, TerrainType.Plains, TerrainType.Desert]);
const MINE_SHIELDS: Partial<Record<TerrainType, number>> = {
  [TerrainType.Desert]: 1, [TerrainType.Hills]: 3, [TerrainType.Mountains]: 1,
};

export interface TerraformCheck {
  ok: boolean;
  turns: number;
  reason?: string;
}

function neighbors4(tiles: TileData[][], x: number, y: number): TileData[] {
  const out: TileData[] = [];
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const ny = y + dy;
    if (ny < 0 || ny >= MAP_HEIGHT) continue;
    out.push(tiles[ny][(x + dx + MAP_WIDTH) % MAP_WIDTH]);
  }
  return out;
}

/** Рельєф, на якому клітинка міста зрошена автоматично (Civ 1). */
export const CITY_IRRIGABLE: TerrainType[] = [TerrainType.Grassland, TerrainType.Plains, TerrainType.Desert, TerrainType.Hills];

/** Іригація можлива, якщо клітинка на річці або поруч є океан, річка чи зрошене поле (місто теж зрошене). */
function hasWaterAccess(tiles: TileData[][], tile: TileData): boolean {
  if (tile.hasRiver) return true;
  // Без міста-джерела місто серед сухих рівнин навіки застрягало на розмірі 2
  return neighbors4(tiles, tile.x, tile.y).some(
    (n) => n.terrain === TerrainType.Ocean || n.hasRiver || n.hasIrrigation || (!!n.cityId && CITY_IRRIGABLE.includes(n.terrain))
  );
}

export function checkTerraform(
  tiles: TileData[][], tile: TileData, kind: TerraformKind, player: Player
): TerraformCheck {
  if (tile.cityId) return { ok: false, turns: 0, reason: 'У місті вже все є' };

  if (kind === 'clean') {
    return tile.hasPollution ? { ok: true, turns: 3 } : { ok: false, turns: 0, reason: 'Тут чисто' };
  }

  if (kind === 'road') {
    // Залізниця кладеться поверх дороги, удвічі довше
    if (tile.hasRoad) {
      if (tile.hasRailroad) return { ok: false, turns: 0, reason: 'Залізниця вже прокладена' };
      if (!player.knownTechs.includes('railroad')) return { ok: false, turns: 0, reason: 'Дорога вже прокладена (залізниці — після технології Залізниця)' };
      const rail = ROAD_TURNS[tile.terrain];
      return rail ? { ok: true, turns: rail * 2 } : { ok: false, turns: 0, reason: 'Тут колію не прокласти' };
    }
    if (tile.hasRiver && !player.knownTechs.includes('bridge_building')) {
      return { ok: false, turns: 0, reason: 'Через річку потрібне Будівництво мостів' };
    }
    const turns = ROAD_TURNS[tile.terrain];
    return turns ? { ok: true, turns } : { ok: false, turns: 0, reason: 'Тут дорогу не прокласти' };
  }

  if (kind === 'irrigation') {
    if (tile.hasIrrigation) return { ok: false, turns: 0, reason: 'Поле вже зрошене' };
    const turns = IRRIGATION_TURNS[tile.terrain];
    if (!turns) return { ok: false, turns: 0, reason: 'Цей рельєф не зрошується' };
    if (!hasWaterAccess(tiles, tile)) return { ok: false, turns: 0, reason: 'Поруч немає води' };
    return { ok: true, turns };
  }

  if (tile.hasMine) return { ok: false, turns: 0, reason: 'Шахта вже є' };
  const turns = MINE_TURNS[tile.terrain];
  return turns ? { ok: true, turns } : { ok: false, turns: 0, reason: 'Шахту копають у пагорбах, горах чи пустелі' };
}

export function applyTerraform(tile: TileData, kind: TerraformKind): void {
  if (kind === 'road') {
    if (tile.hasRoad) tile.hasRailroad = true;
    else tile.hasRoad = true;
  }
  if (kind === 'clean') tile.hasPollution = false;
  if (kind === 'irrigation') {
    tile.hasIrrigation = true;
    tile.hasMine = false;
  }
  if (kind === 'mine') {
    tile.hasMine = true;
    tile.hasIrrigation = false;
  }
}

/** Луки зі «щитом» (Civ 1): фіксований візерунок, ~половина лук дає +1 щит. */
export function hasGrasslandShield(tile: TileData): boolean {
  if (tile.terrain !== TerrainType.Grassland) return false;
  let h = (tile.x * 374761393 + tile.y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 100 < 45;
}

/** Видобуток клітинки з урахуванням покращень. */
export function tileYield(tile: TileData): { food: number; shields: number; trade: number } {
  const base = TERRAIN_DATA[tile.terrain];
  const y = {
    food: base.food + (tile.hasIrrigation ? 1 : 0),
    shields: base.shields + (hasGrasslandShield(tile) ? 1 : 0) + (tile.hasMine ? MINE_SHIELDS[tile.terrain] ?? 0 : 0),
    trade: base.trade + (tile.hasRoad && ROAD_TRADE.has(tile.terrain) ? 1 : 0) + (tile.hasRiver ? 1 : 0),
  };
  // Залізниця: +1 щит там, де щити вже є
  if (tile.hasRailroad && y.shields > 0) y.shields += 1;
  // Забруднення: усе вдвічі менше
  if (tile.hasPollution) {
    y.food = Math.floor(y.food / 2);
    y.shields = Math.floor(y.shields / 2);
    y.trade = Math.floor(y.trade / 2);
  }
  return y;
}
