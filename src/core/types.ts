/**
 * Базові типи та інтерфейси для ремастеру Civilization 1 (1991).
 */

export enum TerrainType {
  Ocean = 'ocean',
  Grassland = 'grassland',
  Plains = 'plains',
  Desert = 'desert',
  Tundra = 'tundra',
  Glacier = 'glacier',
  Hills = 'hills',
  Mountains = 'mountains',
  Forest = 'forest',
  Jungle = 'jungle',
  Swamp = 'swamp',
}

export enum ResourceType {
  None = 'none',
  Oasis = 'oasis',
  Oil = 'oil',
  Coal = 'coal',
  Gold = 'gold',
  Iron = 'iron',
  Fish = 'fish',
  Game = 'game',
}

export interface TileData {
  x: number;
  y: number;
  terrain: TerrainType;
  resource: ResourceType;
  hasRoad: boolean;
  hasRailroad: boolean;
  hasIrrigation: boolean;
  hasMine: boolean;
  hasRiver: boolean;
  /** Забруднення: видобуток клітинки вдвічі менший, доки робітники не очистять */
  hasPollution?: boolean;
  /** Селище племені: заходиш — отримуєш несподіванку */
  hasHut?: boolean;
  cityId?: string;
  unitIds: string[];
}

export interface PlayerFog {
  explored: boolean[][];
  visible: boolean[][];
}

export enum UnitTypeKey {
  Settlers = 'settlers',
  Workers = 'workers',
  Caravan = 'caravan',
  Militia = 'militia',
  Phalanx = 'phalanx',
  Legion = 'legion',
  Cavalry = 'cavalry',
  Chariot = 'chariot',
  Catapult = 'catapult',
  Knights = 'knights',
  Sail = 'sail',
  Archers = 'archers',
  Pikemen = 'pikemen',
  Crusaders = 'crusaders',
  Musketeers = 'musketeers',
  Caravel = 'caravel',
  Cannon = 'cannon',
  Frigate = 'frigate',
  Ironclad = 'ironclad',
  Riflemen = 'riflemen',
  Transport = 'transport',
  // Сучасність I
  Artillery = 'artillery',
  Armor = 'armor',
  MechInf = 'mech_inf',
  Cruiser = 'cruiser',
  Battleship = 'battleship',
  Submarine = 'submarine',
  // Сучасність II: небо й атом
  Fighter = 'fighter',
  Bomber = 'bomber',
  Carrier = 'carrier',
  Nuclear = 'nuclear',
  Diplomat = 'diplomat',
}

export interface UnitConfig {
  key: UnitTypeKey;
  name: string;
  nameUa: string;
  attack: number;
  defense: number;
  moves: number;
  cost: number;
  domain: 'land' | 'sea' | 'air';
  /** Скільки сухопутних юнітів везе корабель */
  capacity?: number;
  /** Скільки літаків несе авіаносець */
  airCapacity?: number;
  /** Літак: скільки ходів може бути в повітрі (поза своїм містом чи авіаносцем) */
  fuel?: number;
  /** Виробляється лише тоді, коли це чудо збудоване будь-де у світі */
  requiresWonder?: BuildingTypeKey;
  prereqTech?: string;
  descriptionUa: string;
}

export interface Unit {
  id: string;
  playerId: number;
  type: UnitTypeKey;
  x: number;
  y: number;
  movesLeft: number;
  isFortified: boolean;
  isSentry: boolean;
  /** Поточна робота поселенця (дорога / іригація / шахта) */
  task?: { kind: 'road' | 'irrigation' | 'mine' | 'clean'; turnsLeft: number };
  /** Ветеран: +50% атаки й захисту (казарми або перемога в бою) */
  veteran?: boolean;
  /** Корабель, на якому пливе сухопутний юніт (чи авіаносець, на якому стоїть літак) */
  carriedBy?: string;
  /** Літак: ходів пального, що лишились */
  fuel?: number;
  /** Ціль AI (місце для міста тощо), щоб не обирати її щоходу заново */
  aiTarget?: { x: number; y: number };
  /** Рідне місто, що утримує юніт щитами (і їжею — поселенці). Без нього — безкоштовний */
  homeCityId?: string;
  /** AI: чекає в порту на пором, щоб переправитися до цілі за морем */
  aiMission?: { kind: 'board'; purpose: 'settle' | 'invade'; target: { x: number; y: number } };
  /** AI-пором: скільки ходів уже чекає пасажирів у порту */
  aiWait?: number;
}

export enum BuildingTypeKey {
  Palace = 'palace',
  Barracks = 'barracks',
  Granary = 'granary',
  Temple = 'temple',
  Marketplace = 'marketplace',
  Library = 'library',
  CityWalls = 'city_walls',
  Courthouse = 'courthouse',
  Colosseum = 'colosseum',
  Aqueduct = 'aqueduct',
  // Чудеса світу (кожне — одне на весь світ)
  Pyramids = 'pyramids',
  Colossus = 'colossus',
  GreatLibrary = 'great_library',
  GreatWall = 'great_wall',
  HangingGardens = 'hanging_gardens',
  Lighthouse = 'lighthouse',
  Oracle = 'oracle',
  // Середньовіччя
  Cathedral = 'cathedral',
  University = 'university',
  Bank = 'bank',
  Harbour = 'harbour',
  Copernicus = 'copernicus',
  Michelangelo = 'michelangelo',
  KingRichards = 'king_richards',
  // Новий час та індустрія
  Factory = 'factory',
  PowerPlant = 'power_plant',
  Shakespeare = 'shakespeare',
  Newton = 'newton',
  Magellan = 'magellan',
  Leonardo = 'leonardo',
  Darwin = 'darwin',
  AdamSmith = 'adam_smith',
  // Сучасність I
  StockExchange = 'stock_exchange',
  Sewer = 'sewer',
  MassTransit = 'mass_transit',
  HooverDam = 'hoover_dam',
  WomensSuffrage = 'womens_suffrage',
  Bach = 'bach',
  // Сучасність II
  Airport = 'airport',
  NuclearPlant = 'nuclear_plant',
  Manhattan = 'manhattan',
  UnitedNations = 'united_nations',
  // Космічна гонка
  Apollo = 'apollo',
  Seti = 'seti',
  CureForCancer = 'cure_for_cancer',
  MarcoPolo = 'marco_polo',
  SpaceStructural = 'space_structural',
  SpaceComponent = 'space_component',
  SpaceModule = 'space_module',
}

/** Частина космічного корабля: каркас тримає двигуни й модулі. */
export type SpacePart = 'structural' | 'component' | 'module';

/** Космічний корабель до Альфи Центавра (спрощено з Civ 1). */
export interface Spaceship {
  structural: number;
  component: number;
  module: number;
  /** Рік прибуття (після запуску) */
  arrivalYear?: number;
  /** Шанс долетіти (0..1), фіксується при запуску */
  success?: number;
}

/** Чим закінчилась гра. */
export interface GameOver {
  reason: 'space' | 'conquest' | 'time' | 'destroyed';
  /** Переможець (для «destroyed» — хто лишився сильнішим не важливо) */
  winner?: number;
  year: string;
}

/** Державний устрій (Civ 1). Анархія — перехідний стан під час революції. */
export type GovernmentKey = 'despotism' | 'monarchy' | 'republic' | 'democracy' | 'anarchy';

export interface GovernmentConfig {
  key: GovernmentKey;
  nameUa: string;
  prereqTech?: string;
  /** Найвища ставка податків / розкоші / науки (у десятках відсотків) */
  maxRate: number;
  /** Корупція: частка торгівлі за кожну клітинку від столиці */
  corruptionPerTile: number;
  /** −1 до будь-якого видобутку клітинки понад 2 */
  tilePenalty: boolean;
  /** +1 торгівлі на клітинках, що вже дають торгівлю */
  tradeBonus: boolean;
  /** Скільки невдоволених заспокоюють військові в місті (по 1 на юніт) */
  martialLaw: number;
  /** Скільки юнітів місто утримує безкоштовно; кожен наступний — 1 щит */
  freeUnits: number;
  /** Скільки їжі з'їдають поселенці міста */
  settlerFood: number;
  /** Скільки невдоволених дає кожен військовий юніт за кордоном (Республіка 1, Демократія 2) */
  abroadUnhappy?: number;
  descriptionUa: string;
}

export interface BuildingConfig {
  key: BuildingTypeKey;
  nameUa: string;
  cost: number;
  maintenance: number;
  prereqTech?: string;
  /** Чудо світу: будується один раз на весь світ */
  isWonder?: boolean;
  /** Потрібна споруда в місті (університет — бібліотека, банк — ринок) */
  requires?: BuildingTypeKey;
  /** Лише в прибережному місті */
  coastal?: boolean;
  /** Будується лише тоді, коли це чудо збудоване будь-де у світі */
  requiresWonder?: BuildingTypeKey;
  /** Частина космічного корабля: іде не в місто, а на корабель */
  spacePart?: SpacePart;
  descriptionUa: string;
}

export interface CityWorkerSlot {
  relX: number; // відносно центру (-2..+2)
  relY: number;
  isWorked: boolean;
}

export interface City {
  id: string;
  playerId: number;
  name: string;
  x: number;
  y: number;
  size: number;
  foodStored: number;
  foodNeeded: number;
  shieldsStored: number;
  currentProduction: {
    isBuilding: boolean;
    key: string;
  };
  buildings: BuildingTypeKey[];
  workedTiles: { x: number; y: number }[];
  /** Хто вже крав тут технологію дипломатом (кожен — лише раз) */
  stolenBy?: number[];
}

export interface Tech {
  id: string;
  nameUa: string;
  era: number;
  prereqs: string[];
  descriptionUa: string;
}

/** Цивілізації, з яких обирають гравця й суперників. */
export type CivKey = 'rus' | 'romans' | 'egyptians' | 'greeks' | 'babylonians' | 'germans' | 'chinese' | 'mongols' | 'aztecs' | 'english';
export type MapSizeKey = 'small' | 'normal' | 'large';
export type DifficultyKey = 'chieftain' | 'warlord' | 'prince' | 'king' | 'emperor';

/** Налаштування нової гри (головне меню). */
export interface GameOptions {
  civ: CivKey;
  /** Суперники; якщо не задано — випадкові з решти */
  rivalCivs?: CivKey[];
  rivals: number;
  mapSize: MapSizeKey;
  difficulty: DifficultyKey;
}

export interface Player {
  id: number;
  /** Яка це цивілізація (назви міст, характер); у варварів немає */
  civ?: CivKey;
  /** Складність: у скільки разів дорожча наука (лише людині) */
  researchFactor?: number;
  /** З ким є посольство (бачимо їхні технології, золото, міста) */
  embassies?: number[];
  /** Скільки разів порушував мирні угоди (AI таких не люблять) */
  brokenTreaties?: number;
  nameUa: string;
  leaderUa: string;
  color: string;
  colorHex: number;
  isAi: boolean;
  isBarbarian?: boolean;
  /** Характер AI-лідера: з якого ходу починає нападати на сусідів */
  hostileFromTurn?: number;
  gold: number;
  taxRate: number;      // 0..10 (множиться на 10%)
  scienceRate: number;  // 0..10
  luxuryRate: number;   // 0..10
  government: GovernmentKey;
  /** Ходів анархії до нового устрою */
  revolutionTurns?: number;
  targetGovernment?: GovernmentKey;
  currentTechId?: string;
  researchProgress: number;
  knownTechs: string[];
  /** Технології майбутнього (після всього дерева): кожна +5 до рахунку */
  futureTechs?: number;
  spaceship?: Spaceship;
  alive: boolean;
}

export interface TerrainYield {
  food: number;
  shields: number;
  trade: number;
  moveCost: number;
  defenseBonus: number; // 1.0 = без бонусу, 1.5 = +50%, 2.0 = +100%
  color: number;
}
