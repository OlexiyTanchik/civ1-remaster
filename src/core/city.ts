/**
 * Логіка міст, розрахунок ресурсів, населення та виробництва.
 * Правила в дусі Civ 1: щастя (4 задоволені, далі — невдоволені, безлад),
 * корупція від відстані до столиці, множники будівель, межа росту без акведука.
 */
import { BUILDING_CONFIGS, UNIT_CONFIGS, FAT_CROSS_OFFSETS, MAP_WIDTH, MAP_HEIGHT, GOVERNMENTS } from './constants';
import { tileYield } from './terraform';
import { City, TileData, BuildingTypeKey, UnitTypeKey, TerrainType, GovernmentKey } from './types';

/** Скільки громадян задоволені «від природи» (Деспотизм, Civ 1). */
const BASE_CONTENT = 4;
/** Без акведука місто не росте більше за це. */
const AQUEDUCT_CAP = 10;
/** Без каналізації — більше за це. */
const SEWER_CAP = 16;

/** Обставини власника міста, що впливають на розрахунок (столиця, чудеса, податки). */
export interface CityEnv {
  capital?: { x: number; y: number };
  ownerWonders: Set<BuildingTypeKey>;
  taxRate: number;     // 0..10
  scienceRate: number; // 0..10
  luxuryRate: number;  // 0..10
  government: GovernmentKey;
  /** Скільки військових стоїть у місті (воєнний стан Монархії) */
  garrison: number;
}

export interface CityYields {
  food: number;
  shields: number;
  trade: number;
  foodSurplus: number;
  corruption: number;
  gold: number;
  science: number;
  luxury: number;
  entertainers: number;
  happy: number;
  content: number;
  unhappy: number;
  disorder: boolean;
}

const DEFAULT_ENV: CityEnv = { ownerWonders: new Set(), taxRate: 5, scienceRate: 5, luxuryRate: 0, government: 'despotism', garrison: 0 };

export class CityLogic {
  /**
   * Обчислює баланс їжі, щитів, торгівлі, корупції, золота, науки та щастя міста.
   */
  public static calculateYields(city: City, tiles: TileData[][], env: CityEnv = DEFAULT_ENV): CityYields {
    // Артисти (Civ 1): якщо місто бунтує, найменш цінні жителі кидають поле й розважають (+2 розкоші)
    const worked = city.workedTiles
      .filter((p) => !(p.x === city.x && p.y === city.y))
      .map((p) => this.workedYield(city, tiles[p.y][p.x], env))
      .sort((a, b) => a.food * 2 + a.shields * 2 + a.trade - (b.food * 2 + b.shields * 2 + b.trade));
    // Жителі без клітинки (усе навколо зайняте) — теж артисти
    const idle = Math.max(0, city.size - worked.length);
    let result = this.yieldsWith(city, tiles, env, worked, idle);
    for (let e = 1; result.disorder && e <= worked.length; e++) {
      result = this.yieldsWith(city, tiles, env, worked.slice(e), idle + e);
    }
    return result;
  }

  private static yieldsWith(
    city: City, tiles: TileData[][], env: CityEnv,
    worked: { food: number; shields: number; trade: number }[], entertainers: number
  ): CityYields {
    const has = (b: BuildingTypeKey) => city.buildings.includes(b);
    let food = 0;
    let shields = 0;
    let trade = 0;

    // Клітинка міста: як у Civ 1 — з дорогою та іригацією, мінімум 2/1/1
    const center = this.centerYield(tiles[city.y][city.x], env);
    food += Math.max(2, center.food);
    shields += Math.max(1, center.shields);
    trade += Math.max(1, center.trade);

    for (const y of worked) {
      food += y.food;
      shields += y.shields;
      trade += y.trade;
    }

    // Піраміди +25%, фабрика +50%, електростанція чи АЕС (лише з фабрикою; Гребля Гувера — у кожному місті) ще +25%
    let shieldBonus = 1;
    if (has(BuildingTypeKey.Pyramids)) shieldBonus += 0.25;
    const power = has(BuildingTypeKey.PowerPlant) || has(BuildingTypeKey.NuclearPlant) || env.ownerWonders.has(BuildingTypeKey.HooverDam);
    if (has(BuildingTypeKey.Factory)) shieldBonus += power ? 0.75 : 0.5;
    shields = Math.floor(shields * shieldBonus);

    // Корупція: зростає з відстанню до столиці; суд зменшує вдвічі; столиця не корумпована
    let corruptionShare = 0.3; // без палацу — як у Civ 1, держава без центру
    if (env.capital) {
      const dxRaw = Math.abs(city.x - env.capital.x);
      const dist = Math.max(Math.min(dxRaw, MAP_WIDTH - dxRaw), Math.abs(city.y - env.capital.y));
      corruptionShare = Math.min(0.5, dist * GOVERNMENTS[env.government].corruptionPerTile);
    }
    if (has(BuildingTypeKey.Courthouse)) corruptionShare /= 2;
    if (has(BuildingTypeKey.Palace)) corruptionShare = 0;
    const corruption = Math.floor(trade * corruptionShare);
    const netTrade = trade - corruption;

    // Розподіл торгівлі: податки / розкіш / решта — наука; артисти дають по 2 розкоші
    const anarchy = env.government === 'anarchy';
    let gold = anarchy ? 0 : Math.floor((netTrade * env.taxRate) / 10);
    let luxury = anarchy ? netTrade : Math.floor((netTrade * env.luxuryRate) / 10);
    let science = netTrade - gold - luxury;
    luxury += entertainers * 2;
    // Ринок, банк (лише з ринком), біржа (лише з банком): по +50% золота й розкоші
    let goldBonus = 1;
    if (has(BuildingTypeKey.Marketplace)) {
      goldBonus += 0.5;
      if (has(BuildingTypeKey.Bank)) goldBonus += has(BuildingTypeKey.StockExchange) ? 1 : 0.5;
    }
    gold = Math.floor(gold * goldBonus);
    luxury = Math.floor(luxury * goldBonus);
    // Бібліотека, університет (лише з бібліотекою): по +50%; Коперник: +100%
    let sciBonus = 1;
    if (has(BuildingTypeKey.Library)) sciBonus += has(BuildingTypeKey.University) ? 1 : 0.5;
    if (has(BuildingTypeKey.Copernicus)) sciBonus += 1;
    if (has(BuildingTypeKey.Newton)) sciBonus += 1;
    if (env.ownerWonders.has(BuildingTypeKey.Seti)) sciBonus += 0.5;
    science = Math.floor(science * sciBonus);

    // Щастя: серед працюючих перші 4 задоволені, решта невдоволені (артисти не бунтують)
    const citizens = city.size - entertainers;
    let content = Math.min(citizens, BASE_CONTENT);
    let unhappy = citizens - content;
    // Храм/колізей/чудеса заспокоюють невдоволених
    let calm = 0;
    if (has(BuildingTypeKey.Temple)) calm += env.ownerWonders.has(BuildingTypeKey.Oracle) ? 4 : 2;
    if (has(BuildingTypeKey.Colosseum)) calm += 3;
    if (has(BuildingTypeKey.Cathedral) || env.ownerWonders.has(BuildingTypeKey.Michelangelo)) calm += 3;
    if (env.ownerWonders.has(BuildingTypeKey.HangingGardens)) calm += 1;
    if (env.ownerWonders.has(BuildingTypeKey.Bach)) calm += 2;
    if (env.ownerWonders.has(BuildingTypeKey.CureForCancer)) calm += 1;
    // Воєнний стан (Монархія): кожен військовий у місті заспокоює одного;
    // Жіноче виборче право — поліція: до 2 за будь-якого устрою
    const police = env.ownerWonders.has(BuildingTypeKey.WomensSuffrage) ? 2 : 0;
    calm += Math.min(env.garrison, Math.max(GOVERNMENTS[env.government].martialLaw, police));
    // Театр Шекспіра: у місті немає невдоволених
    if (has(BuildingTypeKey.Shakespeare)) calm += unhappy;
    const calmed = Math.min(unhappy, calm);
    unhappy -= calmed;
    content += calmed;
    // Розкіш: кожні 2 — задоволений стає щасливим, а як задоволених нема — невдоволений задоволеним
    let happy = 0;
    for (let lux = luxury; lux >= 2; lux -= 2) {
      if (content > 0) { content--; happy++; } else if (unhappy > 0) { unhappy--; content++; } else break;
    }
    // Безлад, коли невдоволених більше, ніж щасливих (Civ 1)
    const disorder = unhappy > happy;

    return {
      food,
      shields: disorder ? 0 : shields,
      trade,
      foodSurplus: food - city.size * 2,
      corruption,
      gold: disorder ? 0 : gold,
      science: disorder ? 0 : science,
      luxury,
      happy,
      content,
      unhappy,
      entertainers,
      disorder,
    };
  }

  /** Клітинка міста отримує дорогу й (де можна) іригацію автоматично, як у Civ 1. */
  private static centerYield(tile: TileData, env: CityEnv = DEFAULT_ENV): { food: number; shields: number; trade: number } {
    const irrigable = [TerrainType.Grassland, TerrainType.Plains, TerrainType.Desert, TerrainType.Hills].includes(tile.terrain);
    return this.applyGovernment(tileYield({ ...tile, hasRoad: true, hasIrrigation: tile.hasIrrigation || irrigable }), env);
  }

  /** Видобуток клітинки, яку обробляє місто (з урахуванням споруд і чудес міста та устрою). */
  private static workedYield(city: City, tile: TileData, env: CityEnv = DEFAULT_ENV): { food: number; shields: number; trade: number } {
    const has = (b: BuildingTypeKey) => city.buildings.includes(b);
    const y = tileYield(tile);
    if (tile.terrain === TerrainType.Ocean) {
      if (has(BuildingTypeKey.Colossus)) y.trade += 1;
      if (has(BuildingTypeKey.Harbour)) y.food += 1;
    }
    const out = this.applyGovernment(y, env);
    if (has(BuildingTypeKey.KingRichards)) out.shields += 1;
    return out;
  }

  /** Деспотизм/анархія: −1 до кожного видобутку понад 2; Республіка: +1 торгівлі, де вона є. */
  private static applyGovernment(y: { food: number; shields: number; trade: number }, env: CityEnv) {
    const gov = GOVERNMENTS[env.government];
    const out = { ...y };
    if (gov.tradeBonus && out.trade > 0) out.trade += 1;
    if (gov.tilePenalty) {
      if (out.food > 2) out.food -= 1;
      if (out.shields > 2) out.shields -= 1;
      if (out.trade > 2) out.trade -= 1;
    }
    return out;
  }

  /**
   * Завершення ходу для міста: ріст, голод, завершення будівництва.
   */
  public static processTurn(
    city: City,
    tiles: TileData[][],
    env: CityEnv = DEFAULT_ENV
  ): {
    completedProduction?: { isBuilding: boolean; key: string };
    grew: boolean;
    starved: boolean;
    needsAqueduct: boolean;
    needsSewer: boolean;
  } {
    const yields = this.calculateYields(city, tiles, env);
    let grew = false;
    let starved = false;
    let needsAqueduct = false;
    let needsSewer = false;
    let completedProduction: { isBuilding: boolean; key: string } | undefined;

    // 1. Динаміка їжі та населення
    city.foodStored += yields.foodSurplus;
    if (city.foodStored >= city.foodNeeded) {
      if (city.size >= AQUEDUCT_CAP && !city.buildings.includes(BuildingTypeKey.Aqueduct)) {
        city.foodStored = city.foodNeeded; // комора повна, але рости нікуди
        needsAqueduct = true;
      } else if (city.size >= SEWER_CAP && !city.buildings.includes(BuildingTypeKey.Sewer)) {
        city.foodStored = city.foodNeeded;
        needsSewer = true;
      } else {
        city.size += 1;
        grew = true;
        const hasGranary = city.buildings.includes(BuildingTypeKey.Granary);
        city.foodStored = hasGranary ? Math.floor(city.foodNeeded / 2) : 0;
        city.foodNeeded = city.size * 10;
        this.autoAssignWorkers(city, tiles, env);
      }
    } else if (city.foodStored < 0) {
      if (city.size > 1) {
        city.size -= 1;
        starved = true;
        city.foodStored = 0;
        city.foodNeeded = city.size * 10;
        this.autoAssignWorkers(city, tiles);
      } else {
        city.foodStored = 0;
      }
    }

    // 2. Виробництво щитів (у безладі місто не виробляє)
    city.shieldsStored += yields.shields;
    const targetCost = this.getProductionCost(city.currentProduction);

    if (city.shieldsStored >= targetCost) {
      completedProduction = { ...city.currentProduction };
      city.shieldsStored -= targetCost;

      if (city.currentProduction.isBuilding) {
        city.buildings.push(city.currentProduction.key as BuildingTypeKey);
        // За замовчуванням наступне виробництво - ополчення
        city.currentProduction = { isBuilding: false, key: UnitTypeKey.Militia };
      }
    }

    return { completedProduction, grew, starved, needsAqueduct, needsSewer };
  }

  /**
   * Вартість поточного виробництва в щитах.
   */
  public static getProductionCost(prod: { isBuilding: boolean; key: string }): number {
    if (prod.isBuilding) {
      const b = BUILDING_CONFIGS[prod.key as BuildingTypeKey];
      return b ? b.cost : 40;
    } else {
      const u = UNIT_CONFIGS[prod.key as UnitTypeKey];
      return u ? u.cost : 20;
    }
  }

  /**
   * Автоматичне призначення жителів на найкращі доступні клітинки навколо міста (суша й море).
   */
  public static autoAssignWorkers(city: City, tiles: TileData[][], env: CityEnv = DEFAULT_ENV): void {
    city.workedTiles = [{ x: city.x, y: city.y }];
    const candidates: { x: number; y: number; food: number; shields: number; trade: number }[] = [];

    for (const offset of FAT_CROSS_OFFSETS) {
      if (offset.dx === 0 && offset.dy === 0) continue;
      const tx = (city.x + offset.dx + MAP_WIDTH) % MAP_WIDTH;
      const ty = city.y + offset.dy;
      if (ty < 0 || ty >= MAP_HEIGHT) continue;

      if (tiles[ty][tx].cityId) continue;
      const y = this.workedYield(city, tiles[ty][tx], env);
      candidates.push({ x: tx, y: ty, ...y });
    }

    // Спершу стільки їжі, щоб місто росло (+2), далі — щити й торгівля
    const center = this.centerYield(tiles[city.y][city.x], env);
    let surplus = Math.max(2, center.food) - city.size * 2;
    for (let i = 0; i < city.size && candidates.length; i++) {
      const hungry = surplus < 2;
      candidates.sort((a, b) =>
        hungry
          ? b.food - a.food || b.shields * 2 + b.trade - (a.shields * 2 + a.trade)
          : b.shields * 2 + b.food + b.trade - (a.shields * 2 + a.food + a.trade)
      );
      const pick = candidates.shift()!;
      surplus += pick.food;
      city.workedTiles.push({ x: pick.x, y: pick.y });
    }
  }
}
