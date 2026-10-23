/**
 * Сценарії: готові старти з історією, згенерованою кодом (без файлів мап).
 * Світ створюється як звичайно, а `applyScenario` «дописує» минуле: рік, технології, устрій,
 * міста з жителями й спорудами, війська, флот, дороги, знайомства, мету й рік завершення.
 */
import type { World } from './world';
import { BuildingTypeKey, CivKey, GovernmentKey, MapSizeKey, MapTypeKey, TerrainType, TileData, UnitTypeKey } from './types';
import { BUILDING_CONFIGS, MAP_WIDTH, TECH_TREE, UNIT_CONFIGS, civUnit } from './constants';
import { tileYield } from './terraform';
import { CityLogic } from './city';

export type ScenarioKey = 'mediterranean' | 'discovery' | 'world1900';

export interface ScenarioDef {
  nameUa: string;
  descriptionUa: string;
  goalUa: string;
  /** Рік старту й завершення (переможець — за рахунком, якщо раніше не скінчилось інакше) */
  year: number;
  endYear: number;
  civs: CivKey[];
  mapType: MapTypeKey;
  mapSize: MapSizeKey;
  /** Усі технології до цієї епохи включно, плюс додаткові */
  techEra: number;
  extraTechs: string[];
  government: GovernmentKey;
  cities: [number, number];
  size: [number, number];
  /** Найдорожча споруда, яку місто вже має */
  buildingCost: number;
  gold: number;
  /** Де стартує народ: захід чи схід мапи (Старий і Новий Світ) */
  regions?: Partial<Record<CivKey, 'west' | 'east'>>;
  /** Чудеса в столицях */
  wonders?: Partial<Record<CivKey, BuildingTypeKey[]>>;
  /** Додаткові юніти в кожному місті й кораблі в прибережній столиці */
  cityUnits: UnitTypeKey[];
  capitalShips: UnitTypeKey[];
  roads: 'none' | 'road' | 'rail';
  contactsAll: boolean;
}

export const SCENARIOS: Record<ScenarioKey, ScenarioDef> = {
  mediterranean: {
    nameUa: 'Античне Середземномор\'я',
    descriptionUa: '3000 до н.е. Римляни, греки, єгиптяни, вавилоняни й перси вже мають перші міста на одному суходолі — і тісно сусідять.',
    goalUa: 'До 1 н.е. збудуйте найбільшу державу античності: перемагає найбільший рахунок (або завоювання).',
    year: -3000, endYear: 1,
    civs: ['romans', 'greeks', 'egyptians', 'babylonians', 'persians'],
    mapType: 'pangaea', mapSize: 'normal',
    techEra: 0, extraTechs: ['bronze_working', 'alphabet', 'masonry', 'pottery', 'ceremonial_burial', 'horseback_riding', 'warrior_code'],
    government: 'despotism', cities: [2, 3], size: [2, 4], buildingCost: 40, gold: 80,
    wonders: {}, cityUnits: [UnitTypeKey.Archers], capitalShips: [], roads: 'none', contactsAll: true,
  },
  discovery: {
    nameUa: 'Епоха відкриттів',
    descriptionUa: '1500 н.е. Англійці, французи, германці й русичі ділять Старий Світ на заході; за океаном, на сході, — ацтеки й незаймані землі.',
    goalUa: 'До 1850 н.е. колонізуйте Новий Світ і станьте першою морською державою: перемагає найбільший рахунок.',
    year: 1500, endYear: 1850,
    civs: ['english', 'french', 'germans', 'rus', 'aztecs'],
    mapType: 'continents', mapSize: 'normal',
    techEra: 2, extraTechs: ['physics', 'medicine', 'theory_of_gravity', 'printing_press'],
    government: 'monarchy', cities: [4, 6], size: [4, 8], buildingCost: 90, gold: 300,
    regions: { english: 'west', french: 'west', germans: 'west', rus: 'west', aztecs: 'east' },
    wonders: { english: [BuildingTypeKey.Colossus], french: [BuildingTypeKey.NotreDame], aztecs: [BuildingTypeKey.ChichenItza], rus: [BuildingTypeKey.SaintSophia], germans: [BuildingTypeKey.GreatLibrary] },
    cityUnits: [UnitTypeKey.Musketeers], capitalShips: [UnitTypeKey.Galleon, UnitTypeKey.Caravel], roads: 'road', contactsAll: false,
  },
  world1900: {
    nameUa: 'Світ 1900',
    descriptionUa: '1900 н.е. Індустріальні імперії — Англія, Франція, Германія, Русь, Японія й Китай — з залізницями, фабриками й флотами.',
    goalUa: 'До 2000 н.е. стань наддержавою: космос, завоювання чи найбільший рахунок.',
    year: 1900, endYear: 2000,
    civs: ['english', 'french', 'germans', 'rus', 'japanese', 'chinese'],
    mapType: 'continents', mapSize: 'large',
    techEra: 3, extraTechs: ['the_corporation', 'steel', 'electronics', 'sanitation', 'refining', 'explosives', 'conscription', 'photography'],
    government: 'democracy', cities: [6, 8], size: [7, 12], buildingCost: 160, gold: 600,
    wonders: { english: [BuildingTypeKey.BigBen], french: [BuildingTypeKey.EiffelTower], germans: [BuildingTypeKey.BrandenburgGate], rus: [BuildingTypeKey.SaintSophia], japanese: [BuildingTypeKey.SunTzu], chinese: [BuildingTypeKey.GreatWall] },
    cityUnits: [UnitTypeKey.Riflemen, UnitTypeKey.Artillery], capitalShips: [UnitTypeKey.Ironclad, UnitTypeKey.Transport], roads: 'rail', contactsAll: true,
  },
};

/** Регіон старту для народу в сценарії (для `spawnInitialSettlers`). */
export function scenarioRegion(key: ScenarioKey | undefined, civ: CivKey | undefined): 'west' | 'east' | undefined {
  return key && civ ? SCENARIOS[key].regions?.[civ] : undefined;
}

/** Дописати минуле світу за сценарієм. Викликається одразу після створення світу. */
export function applyScenario(w: World, key: ScenarioKey): void {
  const def = SCENARIOS[key];
  const tm = w.turnManager;
  while (tm.year < def.year) tm.advanceCalendar();
  const mass = w.landmasses();
  const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

  for (const p of w.players) {
    if (p.isBarbarian) continue;
    // Технології: усі до епохи й додаткові, з передумовами
    let added = true;
    while (added) {
      added = false;
      for (const t of Object.values(TECH_TREE)) {
        if (p.knownTechs.includes(t.id) || !(t.era <= def.techEra || def.extraTechs.includes(t.id))) continue;
        if (!t.prereqs.every((r) => p.knownTechs.includes(r))) continue;
        p.knownTechs.push(t.id);
        added = true;
      }
    }
    p.currentTechId = undefined;
    p.government = def.government === 'democracy' && (p.hostileFromTurn ?? 80) <= 50 ? 'monarchy' : def.government;
    p.gold = def.gold;

    // Столиця — там, де стоять перші поселенці; далі — найкращі місця на тому ж суходолі
    const settler = [...w.units.values()].find((u) => u.playerId === p.id && u.type === UnitTypeKey.Settlers);
    if (!settler) continue;
    const capital = w.foundCity(settler.id);
    if (!capital) continue;
    const home = mass[capital.y][capital.x];
    const want = rnd(def.cities[0], def.cities[1]);
    for (let n = 1; n < want; n++) {
      const site = bestSite(w, capital.x, capital.y, home, mass);
      if (!site) break;
      const s = w.createUnit(p.id, UnitTypeKey.Settlers, site.x, site.y);
      w.foundCity(s.id);
    }

    const mine = [...w.cities.values()].filter((c) => c.playerId === p.id);
    for (const c of mine) {
      c.size = rnd(def.size[0], def.size[1]) + (c === capital ? 1 : 0);
      c.foodNeeded = c.size * 10;
      // Споруди, які вже мали б стояти: доступні за технологіями, не дорожчі за межу сценарію
      for (let pass = 0; pass < 3; pass++) {
        for (const b of Object.values(BUILDING_CONFIGS)) {
          if (b.isWonder || b.spacePart || b.coinage || b.key === BuildingTypeKey.Palace || c.buildings.includes(b.key)) continue;
          if (b.cost > def.buildingCost || (b.civ && b.civ !== p.civ) || b.highland) continue;
          if (b.prereqTech && !p.knownTechs.includes(b.prereqTech)) continue;
          if (b.requires && !c.buildings.includes(b.requires)) continue;
          if (b.coastal && !coastal(w, c.x, c.y)) continue;
          c.buildings.push(b.key);
        }
      }
      // Гарнізон і війська
      const defender = civUnit(bestDefender(p.knownTechs), p.civ);
      w.createUnit(p.id, defender, c.x, c.y, c.id).isFortified = true;
      for (const t of def.cityUnits) w.createUnit(p.id, civUnit(t, p.civ), c.x, c.y, c.id);
      // Дороги й колії на клітинках, що їх обробляє місто
      if (def.roads !== 'none') {
        for (const pos of c.workedTiles) {
          const t = w.tiles[pos.y][pos.x];
          if (t.terrain === TerrainType.Ocean) continue;
          t.hasRoad = true;
          if (def.roads === 'rail') t.hasRailroad = true;
        }
      }
      w.revealFog(p.id, c.x, c.y, 6);
    }
    for (const b of def.wonders?.[p.civ!] ?? []) if (!w.isWonderBuilt(b)) capital.buildings.push(b);
    if (coastal(w, capital.x, capital.y)) {
      const water = neighborsOf(w, capital.x, capital.y).find((t) => t.terrain === TerrainType.Ocean);
      for (const t of def.capitalShips) if (water) w.createUnit(p.id, t, water.x, water.y, capital.id);
    }
    for (let i = 0; i < Math.ceil(mine.length / 2); i++) w.createUnit(p.id, p.knownTechs.includes('explosives') ? UnitTypeKey.Engineers : UnitTypeKey.Workers, capital.x, capital.y, capital.id);
    for (const c of mine) CityLogic.autoAssignWorkers(c, w.tiles, w.cityEnv(c));
    // Скарбниця не має танути: податки 70%, а найдорожчі в утриманні споруди — геть, поки мінус не покриється запасом на ~50 ходів
    p.taxRate = 7;
    p.luxuryRate = 0;
    p.scienceRate = 3;
    for (let guard = 0; guard < 400 && w.netIncome(p.id) < -p.gold / 50; guard++) {
      const pick = mine.flatMap((c) => c.buildings.map((b) => ({ c, b })))
        .filter(({ b }) => !BUILDING_CONFIGS[b].isWonder && b !== BuildingTypeKey.Palace && BUILDING_CONFIGS[b].maintenance > 0)
        .sort((x, y) => BUILDING_CONFIGS[y.b].maintenance - BUILDING_CONFIGS[x.b].maintenance || y.c.buildings.length - x.c.buildings.length)[0];
      if (!pick) break;
      pick.c.buildings = pick.c.buildings.filter((b) => b !== pick.b);
    }
  }

  if (def.contactsAll) {
    const civs = w.players.filter((p) => !p.isBarbarian);
    for (const a of civs) for (const b of civs) if (a.id < b.id) w.diplomacy.meet(a.id, b.id);
  }
  w.scenario = { key, endYear: def.endYear };
}

/** Найкращий оборонець за технологіями (лінійка Фаланга → … → Мотопіхота). */
function bestDefender(known: string[]): UnitTypeKey {
  return [UnitTypeKey.MechInf, UnitTypeKey.Riflemen, UnitTypeKey.Musketeers, UnitTypeKey.Pikemen, UnitTypeKey.Phalanx]
    .find((t) => !UNIT_CONFIGS[t].prereqTech || known.includes(UNIT_CONFIGS[t].prereqTech!)) ?? UnitTypeKey.Militia;
}

function neighborsOf(w: World, x: number, y: number): TileData[] {
  const out: TileData[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = w.tiles[y + dy]?.[(x + dx + MAP_WIDTH) % MAP_WIDTH];
    if (t && (dx || dy)) out.push(t);
  }
  return out;
}

function coastal(w: World, x: number, y: number): boolean {
  return neighborsOf(w, x, y).some((t) => t.terrain === TerrainType.Ocean);
}

/** Місце для нового міста: той самий суходіл, за 4+ клітинки від будь-якого міста, за 10 від столиці; найбагатший хрест 3×3. */
function bestSite(w: World, cx: number, cy: number, home: number, mass: number[][]): { x: number; y: number } | undefined {
  let best: { x: number; y: number } | undefined;
  let bestScore = -1;
  const cities = [...w.cities.values()];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
    const y = cy + dy;
    const x = (cx + dx + MAP_WIDTH) % MAP_WIDTH;
    const t = w.tiles[y]?.[x];
    if (!t || t.terrain === TerrainType.Ocean || t.terrain === TerrainType.Glacier || t.cityId || mass[y][x] !== home) continue;
    if (cities.some((c) => w.distance(c.x, c.y, x, y) < 4)) continue;
    let score = 0;
    for (const n of [t, ...neighborsOf(w, x, y)]) {
      const v = tileYield(n);
      score += v.food * 2 + v.shields * 1.5 + v.trade;
    }
    if (t.hasRiver) score += 3;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

/** Назва сценарію для меню й збережень. */
export function scenarioName(key: ScenarioKey): string {
  return SCENARIOS[key].nameUa;
}

