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
  Howitzer = 'howitzer',
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
  // Етап 8: Античність
  Explorer = 'explorer',
  Galleon = 'galleon',
  // Етап 8: Середньовіччя / Новий час
  Engineers = 'engineers',
  Dragoons = 'dragoons',
  AlpineTroops = 'alpine_troops',
  Spy = 'spy',
  // Етап 8: XX століття
  Paratroopers = 'paratroopers',
  Marines = 'marines',
  Partisans = 'partisans',
  Fanatics = 'fanatics',
  // Унікальні юніти цивілізацій
  Cossacks = 'cossacks',
  Praetorians = 'praetorians',
  WarChariot = 'war_chariot',
  Hoplites = 'hoplites',
  BabylonBowmen = 'babylon_bowmen',
  Panzer = 'panzer',
  ChuKoNu = 'chu_ko_nu',
  Keshik = 'keshik',
  JaguarWarriors = 'jaguar_warriors',
  Longbowmen = 'longbowmen',
  Elephants = 'elephants',
  Awacs = 'awacs',
  Destroyer = 'destroyer',
  Freight = 'freight',
  Helicopter = 'helicopter',
  // Етап 8: Сучасність
  CruiseMissile = 'cruise_missile',
  StealthFighter = 'stealth_fighter',
  StealthBomber = 'stealth_bomber',
  AegisCruiser = 'aegis_cruiser',
  // Етап 10, Античність
  HorseArchers = 'horse_archers',
  BatteringRam = 'battering_ram',
  Bireme = 'bireme',
  Crossbowmen = 'crossbowmen',
  Trebuchet = 'trebuchet',
  // Етап 10, Середньовіччя і Новий час
  Grenadiers = 'grenadiers',
  Cuirassiers = 'cuirassiers',
  ShipOfTheLine = 'ship_of_the_line',
  Privateer = 'privateer',
  Landsknechts = 'landsknechts',
  // Етап 10, Індустрія і XX століття
  MachineGunners = 'machine_gunners',
  ArmoredCar = 'armored_car',
  Dreadnought = 'dreadnought',
  AntiTankGun = 'anti_tank_gun',
  RocketArtillery = 'rocket_artillery',
  // Етап 10, Сучасність і Майбутнє
  ModernArmor = 'modern_armor',
  Drone = 'drone',
  MissileSubmarine = 'missile_submarine',
  LaserInfantry = 'laser_infantry',
  HoverTank = 'hover_tank',
  BattleMech = 'battle_mech',
  PlasmaCruiser = 'plasma_cruiser',
  // Етап 10, друга хвиля
  Conquistadors = 'conquistadors',
  Balloon = 'balloon',
  Zeppelin = 'zeppelin',
  Snipers = 'snipers',
  FlakGun = 'flak_gun',
  // Етап 11: унікальні юніти нових народів
  Samurai = 'samurai',
  RoyalMusketeers = 'royal_musketeers',
  RajaElephants = 'raja_elephants',
  Impi = 'impi',
  Immortals = 'immortals',
  Berserkers = 'berserkers',
  // Етап 11: великі люди (не будуються — з’являються з подій і чудес)
  GreatScientist = 'great_scientist',
  GreatEngineer = 'great_engineer',
  GreatArtist = 'great_artist',
  GreatGeneral = 'great_general',
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
  /** Будь-який рельєф — як дорога (1/3 руху) */
  allTerrainAsRoad?: boolean;
  /** Будується лише за цього устрою і тоді ж не потребує утримання (Фанатики) */
  requiresGovernment?: GovernmentKey;
  /** Не помічає мурів (таран, гаубиця) */
  ignoresWalls?: boolean;
  /** Велика людина: не будується, одноразова дія (`World.useGreatPerson`) */
  greatPerson?: GreatPersonKind;
  /** Унікальний юніт: будує лише ця цивілізація, замість `replaces` */
  civ?: CivKey;
  replaces?: UnitTypeKey;
  /** Радіус огляду (типово 2) */
  vision?: number;
  /** Десант: зі свого міста з повним рухом — стрибок на клітинку за стільки клітинок */
  paradrop?: number;
  /** Морська піхота: атакує з корабля без втрат (решта — удвічі слабше) */
  marine?: boolean;
  /** Гелікоптер: літає без пального, але його б'ють і наземні */
  hover?: boolean;
  /** Збиває літаки в небі (винищувачі) */
  interceptor?: boolean;
  /** Ракета: після удару зникає, хоч би як скінчився бій */
  missile?: boolean;
  /** Стелс: ЗРК і AEGIS проти нього не посилюються */
  stealth?: boolean;
  /** Захист ×5 проти авіації (крейсер AEGIS) */
  antiAir?: boolean;
  /** Скільки щитів віддає на чудо (караван, вантажівка) */
  wonderShields?: number;
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
  task?: { kind: 'road' | 'irrigation' | 'mine' | 'clean' | 'transform'; turnsLeft: number };
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
  RecyclingCenter = 'recycling_center',
  HooverDam = 'hoover_dam',
  WomensSuffrage = 'womens_suffrage',
  Bach = 'bach',
  // Сучасність II
  Airport = 'airport',
  NuclearPlant = 'nuclear_plant',
  HydroPlant = 'hydro_plant',
  MfgPlant = 'mfg_plant',
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
  SdiDefense = 'sdi_defense',
  // Етап 8: Античність
  TempleOfArtemis = 'temple_artemis',
  StatueOfZeus = 'statue_zeus',
  SunTzu = 'sun_tzu',
  // Етап 8: Середньовіччя / Новий час
  CoastalDefense = 'coastal_defense',
  PortFacility = 'port_facility',
  PoliceStation = 'police_station',
  StatueOfLiberty = 'statue_liberty',
  EiffelTower = 'eiffel_tower',
  // Етап 8: XX століття
  SamBattery = 'sam_battery',
  Supermarket = 'supermarket',
  Superhighways = 'superhighways',
  OffshorePlatform = 'offshore_platform',
  // Етап 8: Сучасність
  ResearchLab = 'research_lab',
  SolarPlant = 'solar_plant',
  Internet = 'internet',
  SumySchool = 'sumy_school_1',
  SumDU = 'sumdu',
  SumyAltanka = 'sumy_altanka',
  Coinage = 'coinage',
  // Етап 10, Античність
  Well = 'well',
  Workshop = 'workshop',
  Herbalist = 'herbalist',
  Thermae = 'thermae',
  Forum = 'forum',
  Scriptorium = 'scriptorium',
  GuildHall = 'guild_hall',
  Monastery = 'monastery',
  Mausoleum = 'mausoleum',
  SilkRoad = 'silk_road',
  SaintSophia = 'saint_sophia',
  // Етап 10, Середньовіччя і Новий час
  PrintingHouse = 'printing_house',
  Theatre = 'theatre',
  Observatory = 'observatory',
  CustomsHouse = 'customs_house',
  Foundry = 'foundry',
  TownHall = 'town_hall',
  TajMahal = 'taj_mahal',
  Versailles = 'versailles',
  Uffizi = 'uffizi',
  // Етап 10, Індустрія і XX століття
  Cinema = 'cinema',
  Hospital = 'hospital',
  TvStation = 'tv_station',
  RailwayStation = 'railway_station',
  DepartmentStore = 'department_store',
  Skyscraper = 'skyscraper',
  GrainElevator = 'grain_elevator',
  BigBen = 'big_ben',
  Hollywood = 'hollywood',
  PanamaCanal = 'panama_canal',
  // Етап 10, Сучасність і Майбутнє
  GeneClinic = 'gene_clinic',
  FusionPlant = 'fusion_plant',
  AiCenter = 'ai_center',
  Nanofactory = 'nanofactory',
  OceanHabitat = 'ocean_habitat',
  Collider = 'collider',
  SeedVault = 'seed_vault',
  SpaceElevator = 'space_elevator',
  // Етап 10, унікальні споруди цивілізацій
  Sich = 'sich',
  RomanRoads = 'roman_roads',
  Obelisk = 'obelisk',
  Academy = 'academy',
  Ziggurat = 'ziggurat',
  Kontor = 'kontor',
  ExamHall = 'exam_hall',
  HordePastures = 'horde_pastures',
  Chinampas = 'chinampas',
  RoyalDockyard = 'royal_dockyard',
  // Етап 10, друга хвиля
  FishingWharf = 'fishing_wharf',
  CityPark = 'city_park',
  Stadium = 'stadium',
  Zoo = 'zoo',
  ContainerPort = 'container_port',
  VerticalFarm = 'vertical_farm',
  ChichenItza = 'chichen_itza',
  TerracottaArmy = 'terracotta_army',
  KyivLavra = 'kyiv_lavra',
  SpaceStation = 'space_station',
  // Етап 11: унікальні споруди нових народів
  Dojo = 'dojo',
  Salon = 'salon',
  Stupa = 'stupa',
  Ikhanda = 'ikhanda',
  Pairidaeza = 'pairidaeza',
  Longhouse = 'longhouse',
  // Етап 11: чудеса з пізніших Civ
  Stonehenge = 'stonehenge',
  Petra = 'petra',
  ForbiddenCity = 'forbidden_city',
  AngkorWat = 'angkor_wat',
  NotreDame = 'notre_dame',
  MachuPicchu = 'machu_picchu',
  BrandenburgGate = 'brandenburg_gate',
  ChristRedeemer = 'christ_redeemer',
  Pentagon = 'pentagon',
  SydneyOpera = 'sydney_opera',
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
export type GovernmentKey = 'despotism' | 'monarchy' | 'republic' | 'democracy' | 'communism' | 'fundamentalism' | 'anarchy';

export interface GovernmentConfig {
  key: GovernmentKey;
  nameUa: string;
  prereqTech?: string;
  /** Найвища ставка податків / розкоші / науки (у десятках відсотків) */
  maxRate: number;
  /** Корупція: частка торгівлі за кожну клітинку від столиці */
  corruptionPerTile: number;
  /** Корупція однакова в кожному місті, хоч би як далеко від столиці (Комунізм) */
  flatCorruption?: number;
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
  /** Фундаменталізм (Civ II): невдоволених нема зовсім */
  noUnhappy?: boolean;
  /** Множник науки міст (Фундаменталізм — половина) */
  scienceFactor?: number;
  /** Десятина: храм, колізей і собор дають золото, скільки заспокоювали б */
  tithes?: boolean;
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
  /** Лише біля річки, гір чи пагорбів (ГЕС) */
  highland?: boolean;
  /** Будується лише тоді, коли це чудо збудоване будь-де у світі */
  requiresWonder?: BuildingTypeKey;
  /** Частина космічного корабля: іде не в місто, а на корабель */
  spacePart?: SpacePart;
  /** Капіталізація: не будується ніколи, щити щоходу йдуть у золото */
  coinage?: boolean;
  /** Унікальна споруда: будує лише ця цивілізація */
  civ?: CivKey;
  /** Загальні ефекти в цьому місті */
  effects?: BuildingEffects;
  /** Чудо: ефекти в кожному місті власника */
  globalEffects?: BuildingEffects;
  descriptionUa: string;
}

/** Ефекти споруди: їжа, щити, золото, наука, розкіш — у відсотках; задоволені й торгівля — штуками. */
export interface BuildingEffects {
  food?: number;
  shields?: number;
  gold?: number;
  science?: number;
  luxury?: number;
  content?: number;
  trade?: number;
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
  /** Хід, коли виробництво викуплено: до кінця ходу його не змінити (інакше дешеве перепродавалось би в дороге) */
  boughtTurn?: number;
  /** Хід, коли людина продала тут споруду (одна на хід, як у Civ 1) */
  soldTurn?: number;
  /** Торгові маршрути (Civ 1): до 3, кожен дає постійну торгівлю, порахувану при заснуванні */
  tradeRoutes?: { cityId: string; trade: number }[];
  /** Золотий вік (великий митець): скільки ходів лишилось */
  goldenAge?: number;
}

export interface Tech {
  id: string;
  nameUa: string;
  era: number;
  prereqs: string[];
  descriptionUa: string;
}

/** Цивілізації, з яких обирають гравця й суперників. */
export type CivKey = 'rus' | 'romans' | 'egyptians' | 'greeks' | 'babylonians' | 'germans' | 'chinese' | 'mongols' | 'aztecs' | 'english'
  | 'japanese' | 'french' | 'indians' | 'zulus' | 'persians' | 'vikings';
export type MapSizeKey = 'small' | 'normal' | 'large';
export type GreatPersonKind = 'scientist' | 'engineer' | 'artist' | 'general';
/** Тип світу: континенти, один суходіл, багато островів, острів на кожну цивілізацію */
export type MapTypeKey = 'continents' | 'pangaea' | 'archipelago' | 'islands';
export type DifficultyKey = 'chieftain' | 'warlord' | 'prince' | 'king' | 'emperor';

/** Налаштування нової гри (головне меню). */
export interface GameOptions {
  civ: CivKey;
  /** Суперники; якщо не задано — випадкові з решти */
  rivalCivs?: CivKey[];
  rivals: number;
  mapSize: MapSizeKey;
  difficulty: DifficultyKey;
  /** Тип світу (типово — континенти) */
  mapType?: MapTypeKey;
  /** Сценарій (`src/core/scenarios.ts`) — готовий старт з історією */
  scenario?: 'mediterranean' | 'discovery' | 'world1900';
  /** «Гаряче місце»: цивілізації інших людей за цим пристроєм (гравець 0 — `civ`) */
  humanCivs?: CivKey[];
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
