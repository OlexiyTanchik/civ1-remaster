import {
  TerrainType, TerrainYield, UnitTypeKey, UnitConfig, BuildingTypeKey, BuildingConfig, Tech, GovernmentKey, GovernmentConfig, SpacePart,
  MapSizeKey, DifficultyKey, CivKey, GameOptions,
} from './types';

// Розмір мапи змінюється перед створенням світу (setMapSize); імпорти бачать нове значення (live binding)
export let MAP_WIDTH = 80;
export let MAP_HEIGHT = 50;
export const TILE_SIZE = 64;

export function setMapSize(w: number, h: number): void {
  MAP_WIDTH = w;
  MAP_HEIGHT = h;
}

export const MAP_SIZES: Record<MapSizeKey, { nameUa: string; w: number; h: number }> = {
  small: { nameUa: 'Мала', w: 64, h: 40 },
  normal: { nameUa: 'Звичайна', w: 80, h: 50 },
  large: { nameUa: 'Велика', w: 112, h: 70 },
};

/**
 * Рівні складності Civ 1. Людині: скільки громадян задоволені від природи, у скільки разів дорожча наука.
 * AI: у скільки разів дешевше/дорожче йому все будувати. Варвари: з якого ходу приходять.
 */
export const DIFFICULTIES: Record<DifficultyKey, { nameUa: string; content: number; research: number; aiCost: number; barbariansFrom: number; descriptionUa: string }> = {
  chieftain: { nameUa: 'Вождь', content: 6, research: 0.8, aiCost: 1.4, barbariansFrom: 90, descriptionUa: 'Для знайомства: люди спокійні, наука дешева, суперники повільні.' },
  warlord: { nameUa: 'Воєвода', content: 5, research: 0.9, aiCost: 1.2, barbariansFrom: 75, descriptionUa: 'Трохи легше за звичайне.' },
  prince: { nameUa: 'Князь', content: 4, research: 1, aiCost: 1, barbariansFrom: 60, descriptionUa: 'Рівні умови для всіх.' },
  king: { nameUa: 'Король', content: 4, research: 1.1, aiCost: 0.85, barbariansFrom: 50, descriptionUa: 'Суперники будують швидше, наука дорожча.' },
  emperor: { nameUa: 'Імператор', content: 3, research: 1.25, aiCost: 0.7, barbariansFrom: 45, descriptionUa: 'Для майстрів: міста бунтують, суперники мчать уперед.' },
};

/** Характер лідера: з якого ходу починає нападати на сусідів. */
const WARLIKE = 45;
const NORMAL = 80;
const PEACEFUL = 110;

export const CIVS: Record<CivKey, { nameUa: string; leaderUa: string; color: string; colorHex: number; hostileFromTurn: number; cityNames: string[] }> = {
  rus: {
    nameUa: 'Київська Русь', leaderUa: 'Ярослав Мудрий', color: '#2a75d3', colorHex: 0x2a75d3, hostileFromTurn: NORMAL,
    cityNames: ['Київ', 'Чернігів', 'Переяслав', 'Галич', 'Володимир', 'Новгород-Сіверський', 'Полоцьк', 'Смоленськ',
      'Турів', 'Луцьк', 'Белз', 'Звенигород', 'Вишгород', 'Любеч', 'Корсунь', 'Канів'],
  },
  romans: {
    nameUa: 'Римляни', leaderUa: 'Юлій Цезар', color: '#d63031', colorHex: 0xd63031, hostileFromTurn: WARLIKE,
    cityNames: ['Рим', 'Капуя', 'Неаполь', 'Равенна', 'Тарент', 'Помпеї', 'Мілан', 'Генуя', 'Верона', 'Аквілея'],
  },
  egyptians: {
    nameUa: 'Єгиптяни', leaderUa: 'Рамзес II', color: '#f1c40f', colorHex: 0xf1c40f, hostileFromTurn: PEACEFUL,
    cityNames: ['Фіви', 'Мемфіс', 'Олександрія', 'Гіза', 'Луксор', 'Асуан', 'Абідос', 'Саїс', 'Танис', 'Буто'],
  },
  greeks: {
    nameUa: 'Греки', leaderUa: 'Олександр Македонський', color: '#7fd1ff', colorHex: 0x7fd1ff, hostileFromTurn: NORMAL,
    cityNames: ['Афіни', 'Спарта', 'Коринф', 'Дельфи', 'Фіви Беотійські', 'Аргос', 'Мілет', 'Ефес', 'Пелла', 'Олімпія'],
  },
  babylonians: {
    nameUa: 'Вавилоняни', leaderUa: 'Хаммурапі', color: '#e0e0e0', colorHex: 0xe0e0e0, hostileFromTurn: PEACEFUL,
    cityNames: ['Вавилон', 'Ур', 'Урук', 'Ніппур', 'Лагаш', 'Кіш', 'Еріду', 'Ларса', 'Сіппар', 'Борсіппа'],
  },
  germans: {
    nameUa: 'Германці', leaderUa: 'Фрідріх Барбаросса', color: '#4a4a4a', colorHex: 0x4a4a4a, hostileFromTurn: WARLIKE,
    cityNames: ['Ахен', 'Кельн', 'Майнц', 'Трір', 'Аугсбург', 'Регенсбург', 'Вормс', 'Фульда', 'Бремен', 'Любек'],
  },
  chinese: {
    nameUa: 'Китайці', leaderUa: 'Цінь Шихуанді', color: '#2ecc71', colorHex: 0x2ecc71, hostileFromTurn: NORMAL,
    cityNames: ['Сяньян', 'Чан\'ань', 'Лоян', 'Ханчжоу', 'Кайфен', 'Нанкін', 'Ченду', 'Гуанчжоу', 'Пекін', 'Сучжоу'],
  },
  mongols: {
    nameUa: 'Монголи', leaderUa: 'Чингісхан', color: '#a0522d', colorHex: 0xa0522d, hostileFromTurn: WARLIKE,
    cityNames: ['Каракорум', 'Хара-Хото', 'Бейбулак', 'Кондуй', 'Аврага', 'Олон-Сум', 'Хадан', 'Ергуне', 'Шанду', 'Ханбалик'],
  },
  aztecs: {
    nameUa: 'Ацтеки', leaderUa: 'Монтесума', color: '#e67e22', colorHex: 0xe67e22, hostileFromTurn: WARLIKE,
    cityNames: ['Теночтітлан', 'Тескоко', 'Тлакопан', 'Чолула', 'Шочимілько', 'Тула', 'Койоакан', 'Кульуакан', 'Тлателолько', 'Чалько'],
  },
  english: {
    nameUa: 'Англійці', leaderUa: 'Єлизавета I', color: '#9b59b6', colorHex: 0x9b59b6, hostileFromTurn: NORMAL,
    cityNames: ['Лондон', 'Йорк', 'Ноттінгем', 'Гастінгс', 'Кентербері', 'Ковентрі', 'Вінчестер', 'Оксфорд', 'Бристоль', 'Плімут'],
  },
};

/** Налаштування за замовчуванням: класична партія Русь проти Риму та Єгипту. */
export const DEFAULT_OPTIONS: GameOptions = {
  civ: 'rus', rivalCivs: ['romans', 'egyptians'], rivals: 2, mapSize: 'normal', difficulty: 'prince',
};

// Характеристики рельєфу за правилами Civilization 1 (1991)
export const TERRAIN_DATA: Record<TerrainType, TerrainYield> = {
  [TerrainType.Ocean]:     { food: 1, shields: 0, trade: 2, moveCost: 1, defenseBonus: 1.0, color: 0x1b3b82 },
  [TerrainType.Grassland]: { food: 2, shields: 0, trade: 0, moveCost: 1, defenseBonus: 1.0, color: 0x3d8c28 },
  [TerrainType.Plains]:    { food: 1, shields: 1, trade: 0, moveCost: 1, defenseBonus: 1.0, color: 0x828424 },
  [TerrainType.Desert]:    { food: 0, shields: 1, trade: 0, moveCost: 1, defenseBonus: 1.0, color: 0xc8aa4b },
  [TerrainType.Tundra]:    { food: 1, shields: 0, trade: 0, moveCost: 1, defenseBonus: 1.0, color: 0x76877b },
  [TerrainType.Glacier]:   { food: 0, shields: 0, trade: 0, moveCost: 2, defenseBonus: 1.0, color: 0xd8e6ec },
  [TerrainType.Hills]:     { food: 1, shields: 0, trade: 0, moveCost: 2, defenseBonus: 2.0, color: 0x6e603b },
  [TerrainType.Mountains]: { food: 0, shields: 1, trade: 0, moveCost: 3, defenseBonus: 3.0, color: 0x544736 },
  [TerrainType.Forest]:    { food: 1, shields: 2, trade: 0, moveCost: 2, defenseBonus: 1.5, color: 0x1c4a16 },
  [TerrainType.Jungle]:    { food: 1, shields: 0, trade: 0, moveCost: 2, defenseBonus: 1.5, color: 0x18562d },
  [TerrainType.Swamp]:     { food: 1, shields: 0, trade: 0, moveCost: 2, defenseBonus: 1.5, color: 0x384a30 },
};

// Конфігурація бойових та цивільних юнітів Civ 1
export const UNIT_CONFIGS: Record<UnitTypeKey, UnitConfig> = {
  [UnitTypeKey.Settlers]: {
    key: UnitTypeKey.Settlers, name: 'Settlers', nameUa: 'Поселенці', attack: 0, defense: 1, moves: 1, cost: 60, domain: 'land',
    descriptionUa: 'Засновують нові міста. Можуть і працювати на землі, але це дорого.',
  },
  [UnitTypeKey.Workers]: {
    key: UnitTypeKey.Workers, name: 'Workers', nameUa: 'Робітники', attack: 0, defense: 1, moves: 1, cost: 20, domain: 'land',
    descriptionUa: 'Дешеві й швидкі у виробництві: прокладають дороги, зрошують поля, копають шахти. Міст не засновують.',
  },
  [UnitTypeKey.Caravan]: {
    key: UnitTypeKey.Caravan, name: 'Caravan', nameUa: 'Караван', attack: 0, defense: 1, moves: 1, cost: 50, domain: 'land',
    prereqTech: 'trade', descriptionUa: 'Везе товари. У своєму місті може віддати 50 щитів на будівництво чуда світу [H].',
  },
  [UnitTypeKey.Militia]: {
    key: UnitTypeKey.Militia, name: 'Militia', nameUa: 'Ополчення', attack: 1, defense: 1, moves: 1, cost: 10, domain: 'land',
    descriptionUa: 'Базовий піхотний загін для захисту та розвідки.',
  },
  [UnitTypeKey.Phalanx]: {
    key: UnitTypeKey.Phalanx, name: 'Phalanx', nameUa: 'Фаланга', attack: 1, defense: 2, moves: 1, cost: 20, domain: 'land',
    prereqTech: 'bronze_working', descriptionUa: 'Добре укріплений оборонний загін із щитами та списами.',
  },
  [UnitTypeKey.Legion]: {
    key: UnitTypeKey.Legion, name: 'Legion', nameUa: 'Легіон', attack: 3, defense: 1, moves: 1, cost: 20, domain: 'land',
    prereqTech: 'iron_working', descriptionUa: 'Сильний атакуючий підрозділ античної епохи.',
  },
  [UnitTypeKey.Cavalry]: {
    key: UnitTypeKey.Cavalry, name: 'Cavalry', nameUa: 'Кіннота', attack: 2, defense: 1, moves: 2, cost: 20, domain: 'land',
    prereqTech: 'horseback_riding', descriptionUa: 'Швидкі вершники для глибоких рейдів.',
  },
  [UnitTypeKey.Chariot]: {
    key: UnitTypeKey.Chariot, name: 'Chariot', nameUa: 'Колісниця', attack: 4, defense: 1, moves: 2, cost: 40, domain: 'land',
    prereqTech: 'the_wheel', descriptionUa: 'Потужний штурмовий підрозділ ранніх війн.',
  },
  [UnitTypeKey.Catapult]: {
    key: UnitTypeKey.Catapult, name: 'Catapult', nameUa: 'Катапульта', attack: 6, defense: 1, moves: 1, cost: 40, domain: 'land',
    prereqTech: 'mathematics', descriptionUa: 'Облогове знаряддя для штурму міст.',
  },
  [UnitTypeKey.Knights]: {
    key: UnitTypeKey.Knights, name: 'Knights', nameUa: 'Лицарі', attack: 4, defense: 2, moves: 2, cost: 40, domain: 'land',
    prereqTech: 'chivalry', descriptionUa: 'Елітні броньовані вершники Середньовіччя.',
  },
  [UnitTypeKey.Sail]: {
    key: UnitTypeKey.Sail, name: 'Trireme', nameUa: 'Трирема', attack: 1, defense: 0, moves: 3, cost: 40, domain: 'sea', capacity: 2,
    prereqTech: 'map_making', descriptionUa: 'Раннє судно: везе 2 юніти вздовж узбережжя.',
  },
  [UnitTypeKey.Archers]: {
    key: UnitTypeKey.Archers, name: 'Archers', nameUa: 'Лучники', attack: 3, defense: 2, moves: 1, cost: 30, domain: 'land',
    prereqTech: 'warrior_code', descriptionUa: 'Стріляють здалеку: непогано і в атаці, і в обороні.',
  },
  [UnitTypeKey.Pikemen]: {
    key: UnitTypeKey.Pikemen, name: 'Pikemen', nameUa: 'Пікінери', attack: 1, defense: 2, moves: 1, cost: 20, domain: 'land',
    prereqTech: 'feudalism', descriptionUa: 'Ліс пік: захист подвоюється проти вершників.',
  },
  [UnitTypeKey.Crusaders]: {
    key: UnitTypeKey.Crusaders, name: 'Crusaders', nameUa: 'Хрестоносці', attack: 5, defense: 1, moves: 2, cost: 40, domain: 'land',
    prereqTech: 'monotheism', descriptionUa: 'Важка кіннота віри: найсильніший удар Середньовіччя.',
  },
  [UnitTypeKey.Musketeers]: {
    key: UnitTypeKey.Musketeers, name: 'Musketeers', nameUa: 'Мушкетери', attack: 3, defense: 3, moves: 1, cost: 30, domain: 'land',
    prereqTech: 'gunpowder', descriptionUa: 'Порох змінює війну: міцна оборона міст.',
  },
  [UnitTypeKey.Caravel]: {
    key: UnitTypeKey.Caravel, name: 'Caravel', nameUa: 'Каравела', attack: 2, defense: 1, moves: 3, cost: 40, domain: 'sea', capacity: 3,
    prereqTech: 'navigation', descriptionUa: 'Корабель для далеких плавань: везе 3 юніти.',
  },
  [UnitTypeKey.Cannon]: {
    key: UnitTypeKey.Cannon, name: 'Cannon', nameUa: 'Гармата', attack: 8, defense: 1, moves: 1, cost: 40, domain: 'land',
    prereqTech: 'metallurgy', descriptionUa: 'Ламає будь-які мури.',
  },
  [UnitTypeKey.Frigate]: {
    key: UnitTypeKey.Frigate, name: 'Frigate', nameUa: 'Фрегат', attack: 4, defense: 2, moves: 4, cost: 40, domain: 'sea', capacity: 2,
    prereqTech: 'magnetism', descriptionUa: 'Бойовий вітрильник: везе 2 юніти.',
  },
  [UnitTypeKey.Ironclad]: {
    key: UnitTypeKey.Ironclad, name: 'Ironclad', nameUa: 'Броненосець', attack: 4, defense: 4, moves: 4, cost: 60, domain: 'sea',
    prereqTech: 'steam_engine', descriptionUa: 'Парове залізне судно: панує біля берегів.',
  },
  [UnitTypeKey.Riflemen]: {
    key: UnitTypeKey.Riflemen, name: 'Riflemen', nameUa: 'Стрільці', attack: 5, defense: 4, moves: 1, cost: 40, domain: 'land',
    prereqTech: 'conscription', descriptionUa: 'Нарізні гвинтівки: найкраща оборона епохи.',
  },
  [UnitTypeKey.Transport]: {
    key: UnitTypeKey.Transport, name: 'Transport', nameUa: 'Транспорт', attack: 0, defense: 3, moves: 5, cost: 50, domain: 'sea', capacity: 8,
    prereqTech: 'industrialization', descriptionUa: 'Паровий транспорт: везе 8 юнітів.',
  },
  // Сучасність I: війни XX століття
  [UnitTypeKey.Artillery]: {
    key: UnitTypeKey.Artillery, name: 'Artillery', nameUa: 'Артилерія', attack: 10, defense: 1, moves: 1, cost: 50, domain: 'land',
    prereqTech: 'machine_tools', descriptionUa: 'Далекобійні гармати: руйнують будь-яку оборону, але самі беззахисні.',
  },
  [UnitTypeKey.Armor]: {
    key: UnitTypeKey.Armor, name: 'Armor', nameUa: 'Танки', attack: 10, defense: 5, moves: 3, cost: 80, domain: 'land',
    prereqTech: 'mobile_warfare', descriptionUa: 'Броня і гусениці: швидкий і могутній удар.',
  },
  [UnitTypeKey.MechInf]: {
    key: UnitTypeKey.MechInf, name: 'Mech. Inf.', nameUa: 'Мотопіхота', attack: 6, defense: 6, moves: 3, cost: 50, domain: 'land',
    prereqTech: 'labor_union', descriptionUa: 'Піхота на бронетранспортерах: найміцніша оборона й швидкий рух.',
  },
  [UnitTypeKey.Cruiser]: {
    key: UnitTypeKey.Cruiser, name: 'Cruiser', nameUa: 'Крейсер', attack: 6, defense: 6, moves: 6, cost: 80, domain: 'sea',
    prereqTech: 'steel', descriptionUa: 'Швидкий сталевий корабель: охороняє узбережжя.',
  },
  [UnitTypeKey.Battleship]: {
    key: UnitTypeKey.Battleship, name: 'Battleship', nameUa: 'Лінкор', attack: 18, defense: 12, moves: 4, cost: 160, domain: 'sea',
    prereqTech: 'automobile', descriptionUa: 'Володар морів: гармати головного калібру б\'ють і по прибережних містах.',
  },
  [UnitTypeKey.Submarine]: {
    key: UnitTypeKey.Submarine, name: 'Submarine', nameUa: 'Підводний човен', attack: 8, defense: 2, moves: 3, cost: 50, domain: 'sea',
    prereqTech: 'combustion', descriptionUa: 'Торпеди проти кораблів. Сушу не атакує.',
  },
  // Сучасність II: небо й атом
  [UnitTypeKey.Fighter]: {
    key: UnitTypeKey.Fighter, name: 'Fighter', nameUa: 'Винищувач', attack: 4, defense: 2, moves: 10, cost: 60, domain: 'air', fuel: 1,
    prereqTech: 'flight', descriptionUa: 'Пальне на один хід: до кінця ходу сядьте в місті чи на авіаносці. Єдиний, хто збиває літаки.',
  },
  [UnitTypeKey.Bomber]: {
    key: UnitTypeKey.Bomber, name: 'Bomber', nameUa: 'Бомбардувальник', attack: 12, defense: 1, moves: 8, cost: 120, domain: 'air', fuel: 2,
    prereqTech: 'advanced_flight', descriptionUa: 'Нищівний удар з неба; мури не рятують. Пальне на два ходи.',
  },
  [UnitTypeKey.Carrier]: {
    key: UnitTypeKey.Carrier, name: 'Carrier', nameUa: 'Авіаносець', attack: 1, defense: 12, moves: 5, cost: 160, domain: 'sea', airCapacity: 8,
    prereqTech: 'advanced_flight', descriptionUa: 'Плавучий аеродром: несе 8 літаків і заправляє їх.',
  },
  [UnitTypeKey.Nuclear]: {
    key: UnitTypeKey.Nuclear, name: 'Nuclear', nameUa: 'Ядерна ракета', attack: 99, defense: 0, moves: 16, cost: 160, domain: 'air', fuel: 1,
    prereqTech: 'rocketry', requiresWonder: BuildingTypeKey.Manhattan,
    descriptionUa: 'Знищує все живе на 3×3 клітинки, міста втрачають половину жителів. Потрібен Мангеттенський проєкт (будь-чий).',
  },
};

// Будівлі міст Civ 1
export const BUILDING_CONFIGS: Record<BuildingTypeKey, BuildingConfig> = {
  [BuildingTypeKey.Palace]: {
    key: BuildingTypeKey.Palace, nameUa: 'Палац', cost: 200, maintenance: 0,
    descriptionUa: 'Столиця імперії. Корупція в містах росте з відстанню до неї.',
  },
  [BuildingTypeKey.Barracks]: {
    key: BuildingTypeKey.Barracks, nameUa: 'Казарми', cost: 40, maintenance: 1,
    descriptionUa: 'Усі нові юніти міста — ветерани: +50% атаки й захисту.',
  },
  [BuildingTypeKey.Granary]: {
    key: BuildingTypeKey.Granary, nameUa: 'Комора', cost: 60, maintenance: 1, prereqTech: 'pottery',
    descriptionUa: 'Зберігає 50% запасів їжі при зростанні міста.',
  },
  [BuildingTypeKey.Temple]: {
    key: BuildingTypeKey.Temple, nameUa: 'Храм', cost: 40, maintenance: 1, prereqTech: 'ceremonial_burial',
    descriptionUa: 'Заспокоює двох незадоволених громадян.',
  },
  [BuildingTypeKey.Marketplace]: {
    key: BuildingTypeKey.Marketplace, nameUa: 'Ринок', cost: 80, maintenance: 1, prereqTech: 'currency',
    descriptionUa: '+50% золота з торгівлі міста.',
  },
  [BuildingTypeKey.Library]: {
    key: BuildingTypeKey.Library, nameUa: 'Бібліотека', cost: 80, maintenance: 1, prereqTech: 'writing',
    descriptionUa: '+50% науки з торгівлі міста.',
  },
  [BuildingTypeKey.CityWalls]: {
    key: BuildingTypeKey.CityWalls, nameUa: 'Міські мури', cost: 120, maintenance: 2, prereqTech: 'masonry',
    descriptionUa: 'Потроює захист сухопутних юнітів у місті.',
  },
  [BuildingTypeKey.Courthouse]: {
    key: BuildingTypeKey.Courthouse, nameUa: 'Суд', cost: 60, maintenance: 1, prereqTech: 'code_of_laws',
    descriptionUa: 'Удвічі зменшує корупцію торгівлі в місті.',
  },
  [BuildingTypeKey.Colosseum]: {
    key: BuildingTypeKey.Colosseum, nameUa: 'Колізей', cost: 100, maintenance: 2, prereqTech: 'construction',
    descriptionUa: 'Видовища заспокоюють трьох невдоволених громадян.',
  },
  [BuildingTypeKey.Aqueduct]: {
    key: BuildingTypeKey.Aqueduct, nameUa: 'Акведук', cost: 120, maintenance: 2, prereqTech: 'construction',
    descriptionUa: 'Без акведука місто не виростає більше за 10.',
  },
  [BuildingTypeKey.Pyramids]: {
    key: BuildingTypeKey.Pyramids, nameUa: 'Піраміди', cost: 300, maintenance: 0, prereqTech: 'bronze_working', isWonder: true,
    descriptionUa: 'Чудо світу. +25% щитів у цьому місті.',
  },
  [BuildingTypeKey.Colossus]: {
    key: BuildingTypeKey.Colossus, nameUa: 'Колос Родоський', cost: 200, maintenance: 0, prereqTech: 'bronze_working', isWonder: true,
    descriptionUa: 'Чудо світу. +1 торгівлі на кожній морській клітинці міста.',
  },
  [BuildingTypeKey.GreatLibrary]: {
    key: BuildingTypeKey.GreatLibrary, nameUa: 'Велика бібліотека', cost: 300, maintenance: 0, prereqTech: 'literacy', isWonder: true,
    descriptionUa: 'Чудо світу. Дає технологію, щойно її знають дві інші цивілізації.',
  },
  [BuildingTypeKey.GreatWall]: {
    key: BuildingTypeKey.GreatWall, nameUa: 'Великий мур', cost: 300, maintenance: 0, prereqTech: 'construction', isWonder: true,
    descriptionUa: 'Чудо світу. Діє як міські мури в усіх ваших містах.',
  },
  [BuildingTypeKey.HangingGardens]: {
    key: BuildingTypeKey.HangingGardens, nameUa: 'Висячі сади', cost: 300, maintenance: 0, prereqTech: 'pottery', isWonder: true,
    descriptionUa: 'Чудо світу. +1 задоволений громадянин у кожному вашому місті.',
  },
  [BuildingTypeKey.Lighthouse]: {
    key: BuildingTypeKey.Lighthouse, nameUa: 'Маяк', cost: 200, maintenance: 0, prereqTech: 'map_making', isWonder: true,
    descriptionUa: 'Чудо світу. +1 рух усім вашим кораблям.',
  },
  [BuildingTypeKey.Oracle]: {
    key: BuildingTypeKey.Oracle, nameUa: 'Оракул', cost: 300, maintenance: 0, prereqTech: 'mysticism', isWonder: true,
    descriptionUa: 'Чудо світу. Храми в усіх ваших містах заспокоюють удвічі більше.',
  },
  [BuildingTypeKey.Cathedral]: {
    key: BuildingTypeKey.Cathedral, nameUa: 'Собор', cost: 120, maintenance: 3, prereqTech: 'monotheism',
    descriptionUa: 'Заспокоює трьох невдоволених громадян.',
  },
  [BuildingTypeKey.University]: {
    key: BuildingTypeKey.University, nameUa: 'Університет', cost: 160, maintenance: 3, prereqTech: 'university', requires: BuildingTypeKey.Library,
    descriptionUa: 'Ще +50% науки (разом з бібліотекою). Потрібна бібліотека.',
  },
  [BuildingTypeKey.Bank]: {
    key: BuildingTypeKey.Bank, nameUa: 'Банк', cost: 120, maintenance: 2, prereqTech: 'banking', requires: BuildingTypeKey.Marketplace,
    descriptionUa: 'Ще +50% золота й розкоші (разом з ринком). Потрібен ринок.',
  },
  [BuildingTypeKey.Harbour]: {
    key: BuildingTypeKey.Harbour, nameUa: 'Гавань', cost: 60, maintenance: 1, prereqTech: 'navigation', coastal: true,
    descriptionUa: '+1 їжі на кожній морській клітинці міста.',
  },
  [BuildingTypeKey.Copernicus]: {
    key: BuildingTypeKey.Copernicus, nameUa: 'Обсерваторія Коперника', cost: 300, maintenance: 0, prereqTech: 'astronomy', isWonder: true,
    descriptionUa: 'Чудо світу. +100% науки в цьому місті.',
  },
  [BuildingTypeKey.Michelangelo]: {
    key: BuildingTypeKey.Michelangelo, nameUa: 'Капела Мікеланджело', cost: 400, maintenance: 0, prereqTech: 'monotheism', isWonder: true,
    descriptionUa: 'Чудо світу. Діє як собор у кожному вашому місті.',
  },
  [BuildingTypeKey.KingRichards]: {
    key: BuildingTypeKey.KingRichards, nameUa: 'Хрестовий похід Річарда', cost: 300, maintenance: 0, prereqTech: 'chivalry', isWonder: true,
    descriptionUa: 'Чудо світу. +1 щит на кожній клітинці, яку обробляє місто.',
  },
  [BuildingTypeKey.Factory]: {
    key: BuildingTypeKey.Factory, nameUa: 'Фабрика', cost: 200, maintenance: 4, prereqTech: 'industrialization',
    descriptionUa: '+50% щитів. Але й забруднення вдвічі частіше.',
  },
  [BuildingTypeKey.PowerPlant]: {
    key: BuildingTypeKey.PowerPlant, nameUa: 'Електростанція', cost: 160, maintenance: 4, prereqTech: 'electricity', requires: BuildingTypeKey.Factory,
    descriptionUa: 'Ще +25% щитів (разом із фабрикою). Потрібна фабрика.',
  },
  [BuildingTypeKey.Shakespeare]: {
    key: BuildingTypeKey.Shakespeare, nameUa: 'Театр Шекспіра', cost: 300, maintenance: 0, prereqTech: 'medicine', isWonder: true,
    descriptionUa: 'Чудо світу. У цьому місті немає невдоволених.',
  },
  [BuildingTypeKey.Newton]: {
    key: BuildingTypeKey.Newton, nameUa: 'Коледж Ньютона', cost: 400, maintenance: 0, prereqTech: 'theory_of_gravity', isWonder: true,
    descriptionUa: 'Чудо світу. +100% науки в цьому місті.',
  },
  [BuildingTypeKey.Magellan]: {
    key: BuildingTypeKey.Magellan, nameUa: 'Експедиція Магеллана', cost: 400, maintenance: 0, prereqTech: 'navigation', isWonder: true,
    descriptionUa: 'Чудо світу. +2 руху всім вашим кораблям.',
  },
  [BuildingTypeKey.Leonardo]: {
    key: BuildingTypeKey.Leonardo, nameUa: 'Майстерня Леонардо', cost: 400, maintenance: 0, prereqTech: 'invention', isWonder: true,
    descriptionUa: 'Чудо світу. Щоходу оновлює один ваш застарілий юніт до сучасного.',
  },
  [BuildingTypeKey.Darwin]: {
    key: BuildingTypeKey.Darwin, nameUa: 'Подорож Дарвіна', cost: 400, maintenance: 0, prereqTech: 'railroad', isWonder: true,
    descriptionUa: 'Чудо світу. Одразу дає дві технології.',
  },
  [BuildingTypeKey.AdamSmith]: {
    key: BuildingTypeKey.AdamSmith, nameUa: 'Торгова компанія Адама Сміта', cost: 400, maintenance: 0, prereqTech: 'economics', isWonder: true,
    descriptionUa: 'Чудо світу. Сплачує утримання всіх ваших будівель вартістю 1 зл.',
  },
  // Сучасність I
  [BuildingTypeKey.StockExchange]: {
    key: BuildingTypeKey.StockExchange, nameUa: 'Біржа', cost: 120, maintenance: 3, prereqTech: 'the_corporation', requires: BuildingTypeKey.Bank,
    descriptionUa: 'Ще +50% золота й розкоші (разом з ринком і банком). Потрібен банк.',
  },
  [BuildingTypeKey.Sewer]: {
    key: BuildingTypeKey.Sewer, nameUa: 'Каналізація', cost: 120, maintenance: 2, prereqTech: 'sanitation', requires: BuildingTypeKey.Aqueduct,
    descriptionUa: 'Без каналізації місто не виростає більше за 16. Потрібен акведук.',
  },
  [BuildingTypeKey.MassTransit]: {
    key: BuildingTypeKey.MassTransit, nameUa: 'Масовий транспорт', cost: 120, maintenance: 4, prereqTech: 'mass_production',
    descriptionUa: 'Трамваї й метро: населення міста більше не забруднює довкілля автомобілями.',
  },
  [BuildingTypeKey.HooverDam]: {
    key: BuildingTypeKey.HooverDam, nameUa: 'Гребля Гувера', cost: 500, maintenance: 0, prereqTech: 'electronics', isWonder: true,
    descriptionUa: 'Чудо світу. Діє як електростанція в кожному вашому місті з фабрикою.',
  },
  [BuildingTypeKey.WomensSuffrage]: {
    key: BuildingTypeKey.WomensSuffrage, nameUa: 'Жіноче виборче право', cost: 500, maintenance: 0, prereqTech: 'industrialization', isWonder: true,
    descriptionUa: 'Чудо світу. Поліція в кожному місті: гарнізон заспокоює до 2 невдоволених за будь-якого устрою.',
  },
  [BuildingTypeKey.Bach]: {
    key: BuildingTypeKey.Bach, nameUa: 'Собор Баха', cost: 400, maintenance: 0, prereqTech: 'theology', isWonder: true,
    descriptionUa: 'Чудо світу. Музика заспокоює двох невдоволених у кожному вашому місті.',
  },
  // Сучасність II
  [BuildingTypeKey.Airport]: {
    key: BuildingTypeKey.Airport, nameUa: 'Аеропорт', cost: 120, maintenance: 3, prereqTech: 'radio',
    descriptionUa: 'Усі нові літаки міста — ветерани: +50% атаки й захисту.',
  },
  [BuildingTypeKey.NuclearPlant]: {
    key: BuildingTypeKey.NuclearPlant, nameUa: 'АЕС', cost: 160, maintenance: 2, prereqTech: 'nuclear_power', requires: BuildingTypeKey.Factory,
    descriptionUa: 'Як електростанція (+25% щитів з фабрикою, не додається до неї), але забруднення від виробництва вдвічі рідше.',
  },
  [BuildingTypeKey.Manhattan]: {
    key: BuildingTypeKey.Manhattan, nameUa: 'Мангеттенський проєкт', cost: 600, maintenance: 0, prereqTech: 'nuclear_fission', isWonder: true,
    descriptionUa: 'Чудо світу. Відкриває ядерну зброю ВСІМ, хто знає Ракетобудування.',
  },
  [BuildingTypeKey.UnitedNations]: {
    key: BuildingTypeKey.UnitedNations, nameUa: 'Організація Об\'єднаних Націй', cost: 600, maintenance: 0, prereqTech: 'nuclear_fission', isWonder: true,
    descriptionUa: 'Чудо світу. Рада безпеки: суперники не нападають на вас, якщо ви самі не нападали на них останні 10 ходів.',
  },
  // Космічна гонка
  [BuildingTypeKey.Seti]: {
    key: BuildingTypeKey.Seti, nameUa: 'Програма SETI', cost: 600, maintenance: 0, prereqTech: 'computers', isWonder: true,
    descriptionUa: 'Чудо світу. +50% науки в усіх ваших містах.',
  },
  [BuildingTypeKey.Apollo]: {
    key: BuildingTypeKey.Apollo, nameUa: 'Програма «Аполлон»', cost: 600, maintenance: 0, prereqTech: 'space_flight', isWonder: true,
    descriptionUa: 'Чудо світу. Відкриває космічну гонку ВСІМ: частини кораблів до Альфи Центавра. Власник бачить усі міста світу.',
  },
  [BuildingTypeKey.CureForCancer]: {
    key: BuildingTypeKey.CureForCancer, nameUa: 'Ліки від раку', cost: 600, maintenance: 0, prereqTech: 'genetic_engineering', isWonder: true,
    descriptionUa: 'Чудо світу. +1 задоволений громадянин у кожному вашому місті.',
  },
  [BuildingTypeKey.SpaceStructural]: {
    key: BuildingTypeKey.SpaceStructural, nameUa: '🚀 Каркас корабля', cost: 80, maintenance: 0, prereqTech: 'space_flight',
    requiresWonder: BuildingTypeKey.Apollo, spacePart: 'structural',
    descriptionUa: 'Частина космічного корабля. Кожен двигун і модуль потребує свого каркаса.',
  },
  [BuildingTypeKey.SpaceComponent]: {
    key: BuildingTypeKey.SpaceComponent, nameUa: '🚀 Двигун корабля', cost: 160, maintenance: 0, prereqTech: 'plastics',
    requiresWonder: BuildingTypeKey.Apollo, spacePart: 'component',
    descriptionUa: 'Частина космічного корабля. Кожен двигун скорочує політ на 2 роки.',
  },
  [BuildingTypeKey.SpaceModule]: {
    key: BuildingTypeKey.SpaceModule, nameUa: '🚀 Модуль корабля', cost: 320, maintenance: 0, prereqTech: 'superconductor',
    requiresWonder: BuildingTypeKey.Apollo, spacePart: 'module',
    descriptionUa: 'Частина космічного корабля: житло й життєзабезпечення колоністів. Кожен — +20% шансу долетіти.',
  },
};

/** Найбільше частин одного виду на кораблі. */
export const SPACE_LIMITS: Record<SpacePart, number> = { structural: 12, component: 8, module: 6 };

/** Після всього дерева — нескінченні технології майбутнього (Civ 1). */
export const FUTURE_TECH: Tech = {
  id: 'future_tech', nameUa: 'Технологія майбутнього', era: 7, prereqs: [],
  descriptionUa: 'Знання, яких ще не має людство. Кожна — +5 до рахунку цивілізації.',
};

// Дерево технологій стародавньої епохи (у дусі Civ 1). Ціна дослідження — TurnManager.researchCost.
export const TECH_TREE: Record<string, Tech> = {
  alphabet: { id: 'alphabet', nameUa: 'Алфавіт', era: 1, prereqs: [], descriptionUa: 'Перші знаки для запису слів.' },
  bronze_working: { id: 'bronze_working', nameUa: 'Обробка бронзи', era: 1, prereqs: [], descriptionUa: 'Перший сплав: зброя і обладунки.' },
  ceremonial_burial: { id: 'ceremonial_burial', nameUa: 'Поховальний обряд', era: 1, prereqs: [], descriptionUa: 'Віра в потойбічне згуртовує людей.' },
  horseback_riding: { id: 'horseback_riding', nameUa: 'Верхова їзда', era: 1, prereqs: [], descriptionUa: 'Приручення коня.' },
  masonry: { id: 'masonry', nameUa: 'Мурування', era: 1, prereqs: [], descriptionUa: 'Кам\'яні стіни, що стоять віками.' },
  pottery: { id: 'pottery', nameUa: 'Гончарство', era: 1, prereqs: [], descriptionUa: 'Глиняний посуд для зберігання припасів.' },
  the_wheel: { id: 'the_wheel', nameUa: 'Колесо', era: 1, prereqs: ['horseback_riding'], descriptionUa: 'Вози та бойові колісниці.' },
  code_of_laws: { id: 'code_of_laws', nameUa: 'Кодекс законів', era: 1, prereqs: ['alphabet'], descriptionUa: 'Писані закони замість волі вождя.' },
  writing: { id: 'writing', nameUa: 'Писемність', era: 1, prereqs: ['alphabet'], descriptionUa: 'Знання переживають своїх авторів.' },
  map_making: { id: 'map_making', nameUa: 'Картографія', era: 1, prereqs: ['alphabet'], descriptionUa: 'Мапи узбережжя відкривають море.' },
  currency: { id: 'currency', nameUa: 'Валюта', era: 1, prereqs: ['bronze_working'], descriptionUa: 'Монета замість обміну.' },
  iron_working: { id: 'iron_working', nameUa: 'Обробка заліза', era: 1, prereqs: ['bronze_working'], descriptionUa: 'Залізо міцніше за бронзу.' },
  mysticism: { id: 'mysticism', nameUa: 'Містицизм', era: 1, prereqs: ['ceremonial_burial', 'alphabet'], descriptionUa: 'Пророцтва й таємні знання жерців.' },
  mathematics: { id: 'mathematics', nameUa: 'Математика', era: 1, prereqs: ['alphabet', 'masonry'], descriptionUa: 'Обчислення для будівництва й облоги.' },
  monarchy: { id: 'monarchy', nameUa: 'Монархія', era: 1, prereqs: ['ceremonial_burial', 'code_of_laws'], descriptionUa: 'Влада короля: відкриває устрій Монархія.' },
  literacy: { id: 'literacy', nameUa: 'Грамотність', era: 1, prereqs: ['writing', 'code_of_laws'], descriptionUa: 'Читати вміють не лише жерці.' },
  construction: { id: 'construction', nameUa: 'Будівництво', era: 1, prereqs: ['pottery', 'currency'], descriptionUa: 'Розчин і арки для великих споруд.' },
  philosophy: { id: 'philosophy', nameUa: 'Філософія', era: 1, prereqs: ['mysticism', 'literacy'], descriptionUa: 'Пошук істини через розум.' },
  astronomy: { id: 'astronomy', nameUa: 'Астрономія', era: 1, prereqs: ['mysticism', 'mathematics'], descriptionUa: 'Рух зірок і календар.' },
  trade: { id: 'trade', nameUa: 'Торгівля', era: 1, prereqs: ['literacy', 'pottery'], descriptionUa: 'Каравани везуть товари між містами.' },
  the_republic: { id: 'the_republic', nameUa: 'Республіка', era: 1, prereqs: ['code_of_laws', 'literacy'], descriptionUa: 'Влада громадян: відкриває устрій Республіка.' },
  bridge_building: { id: 'bridge_building', nameUa: 'Будівництво мостів', era: 1, prereqs: ['iron_working', 'construction'], descriptionUa: 'Дороги нарешті перетинають річки.' },
  warrior_code: { id: 'warrior_code', nameUa: 'Кодекс воїна', era: 1, prereqs: [], descriptionUa: 'Лук і дисципліна.' },
  // Середньовіччя
  feudalism: { id: 'feudalism', nameUa: 'Феодалізм', era: 2, prereqs: ['monarchy', 'warrior_code'], descriptionUa: 'Сеньйори й васали, замки й піки.' },
  chivalry: { id: 'chivalry', nameUa: 'Лицарство', era: 2, prereqs: ['feudalism', 'horseback_riding'], descriptionUa: 'Кодекс честі закутих у залізо вершників.' },
  monotheism: { id: 'monotheism', nameUa: 'Монотеїзм', era: 2, prereqs: ['philosophy', 'astronomy'], descriptionUa: 'Одна віра для всієї держави.' },
  navigation: { id: 'navigation', nameUa: 'Навігація', era: 2, prereqs: ['map_making', 'astronomy'], descriptionUa: 'Компас і зорі ведуть кораблі у відкрите море.' },
  university: { id: 'university', nameUa: 'Університет', era: 2, prereqs: ['astronomy', 'philosophy'], descriptionUa: 'Знання стає наукою.' },
  banking: { id: 'banking', nameUa: 'Банківська справа', era: 2, prereqs: ['trade', 'the_republic'], descriptionUa: 'Кредит і векселі замість скринь із золотом.' },
  invention: { id: 'invention', nameUa: 'Винахідництво', era: 2, prereqs: ['literacy', 'bridge_building'], descriptionUa: 'Механізми, що працюють замість людей.' },
  gunpowder: { id: 'gunpowder', nameUa: 'Порох', era: 2, prereqs: ['invention', 'iron_working'], descriptionUa: 'Вогонь, що пробиває обладунки.' },
  // Новий час та індустрія
  physics: { id: 'physics', nameUa: 'Фізика', era: 3, prereqs: ['navigation', 'literacy'], descriptionUa: 'Закони руху й сили.' },
  magnetism: { id: 'magnetism', nameUa: 'Магнетизм', era: 3, prereqs: ['navigation', 'physics'], descriptionUa: 'Стрілка компаса веде флоти через океани.' },
  theory_of_gravity: { id: 'theory_of_gravity', nameUa: 'Теорія гравітації', era: 3, prereqs: ['astronomy', 'university'], descriptionUa: 'Яблуко падає, планети кружляють — за одним законом.' },
  medicine: { id: 'medicine', nameUa: 'Медицина', era: 3, prereqs: ['philosophy', 'trade'], descriptionUa: 'Лікарі замість знахарів.' },
  metallurgy: { id: 'metallurgy', nameUa: 'Металургія', era: 3, prereqs: ['gunpowder', 'university'], descriptionUa: 'Литі гармати й міцна сталь.' },
  chemistry: { id: 'chemistry', nameUa: 'Хімія', era: 3, prereqs: ['university', 'medicine'], descriptionUa: 'Речовини, що перетворюються одна на одну.' },
  economics: { id: 'economics', nameUa: 'Економіка', era: 3, prereqs: ['banking', 'university'], descriptionUa: 'Невидима рука ринку.' },
  democracy: { id: 'democracy', nameUa: 'Демократія', era: 3, prereqs: ['banking', 'invention'], descriptionUa: 'Влада більшості: відкриває устрій Демократія.' },
  steam_engine: { id: 'steam_engine', nameUa: 'Парова машина', era: 3, prereqs: ['physics', 'invention'], descriptionUa: 'Пара рухає кораблі й верстати.' },
  railroad: { id: 'railroad', nameUa: 'Залізниця', era: 3, prereqs: ['steam_engine', 'bridge_building'], descriptionUa: 'Сталеві колії зшивають країну.' },
  industrialization: { id: 'industrialization', nameUa: 'Індустріалізація', era: 3, prereqs: ['railroad', 'banking'], descriptionUa: 'Фабрики, димарі — і смог над містами.' },
  electricity: { id: 'electricity', nameUa: 'Електрика', era: 3, prereqs: ['metallurgy', 'magnetism'], descriptionUa: 'Струм у дротах.' },
  conscription: { id: 'conscription', nameUa: 'Загальний призов', era: 3, prereqs: ['democracy', 'metallurgy'], descriptionUa: 'Армія з громадян.' },
  // Сучасність I: війни XX століття
  the_corporation: { id: 'the_corporation', nameUa: 'Корпорація', era: 4, prereqs: ['economics', 'industrialization'], descriptionUa: 'Акціонерні компанії, більші за королівства.' },
  steel: { id: 'steel', nameUa: 'Сталь', era: 4, prereqs: ['electricity', 'industrialization'], descriptionUa: 'Мартенівські печі: сталеві корпуси й рейки.' },
  explosives: { id: 'explosives', nameUa: 'Вибухівка', era: 4, prereqs: ['gunpowder', 'chemistry'], descriptionUa: 'Динаміт прокладає шлях: робітники працюють удвічі швидше.' },
  refining: { id: 'refining', nameUa: 'Нафтопереробка', era: 4, prereqs: ['chemistry', 'the_corporation'], descriptionUa: 'З нафти — пальне для нових двигунів.' },
  electronics: { id: 'electronics', nameUa: 'Електроніка', era: 4, prereqs: ['electricity', 'the_corporation'], descriptionUa: 'Лампи, радіо й великі електромережі.' },
  sanitation: { id: 'sanitation', nameUa: 'Санітарія', era: 4, prereqs: ['medicine', 'the_corporation'], descriptionUa: 'Водогін і каналізація для мільйонних міст.' },
  theology: { id: 'theology', nameUa: 'Теологія', era: 4, prereqs: ['monotheism', 'democracy'], descriptionUa: 'Віра, що звучить у музиці й соборах.' },
  combustion: { id: 'combustion', nameUa: 'Двигун внутрішнього згоряння', era: 4, prereqs: ['refining', 'explosives'], descriptionUa: 'Бензиновий мотор: машини без пари.' },
  automobile: { id: 'automobile', nameUa: 'Автомобіль', era: 4, prereqs: ['combustion', 'steel'], descriptionUa: 'Машини на вулицях — і смог від великих міст.' },
  mass_production: { id: 'mass_production', nameUa: 'Масове виробництво', era: 4, prereqs: ['automobile', 'the_corporation'], descriptionUa: 'Конвеєр: усе для всіх.' },
  machine_tools: { id: 'machine_tools', nameUa: 'Верстати', era: 4, prereqs: ['steel', 'conscription'], descriptionUa: 'Точні верстати: далекобійні гармати.' },
  mobile_warfare: { id: 'mobile_warfare', nameUa: 'Мобільна війна', era: 4, prereqs: ['automobile', 'machine_tools'], descriptionUa: 'Бліцкриг: броня і мотори.' },
  labor_union: { id: 'labor_union', nameUa: 'Профспілки', era: 4, prereqs: ['mass_production', 'conscription'], descriptionUa: 'Робітники об\'єднуються: армія на колесах.' },
  // Сучасність II: небо й атом
  atomic_theory: { id: 'atomic_theory', nameUa: 'Атомна теорія', era: 5, prereqs: ['theory_of_gravity', 'electronics'], descriptionUa: 'Атом ділиться: ядро, електрони, нейтрони.' },
  flight: { id: 'flight', nameUa: 'Польоти', era: 5, prereqs: ['combustion', 'theory_of_gravity'], descriptionUa: 'Людина в небі.' },
  radio: { id: 'radio', nameUa: 'Радіо', era: 5, prereqs: ['flight', 'electronics'], descriptionUa: 'Голос в ефірі, диспетчери аеродромів.' },
  advanced_flight: { id: 'advanced_flight', nameUa: 'Реактивна авіація', era: 5, prereqs: ['radio', 'machine_tools'], descriptionUa: 'Важкі бомбардувальники й палубна авіація.' },
  nuclear_fission: { id: 'nuclear_fission', nameUa: 'Ядерний розпад', era: 5, prereqs: ['atomic_theory', 'mass_production'], descriptionUa: 'Ланцюгова реакція: енергія — і загроза — небачені досі.' },
  nuclear_power: { id: 'nuclear_power', nameUa: 'Ядерна енергетика', era: 5, prereqs: ['nuclear_fission', 'electronics'], descriptionUa: 'Атом на службі міст і флоту: кораблі +1 рух.' },
  rocketry: { id: 'rocketry', nameUa: 'Ракетобудування', era: 5, prereqs: ['advanced_flight', 'nuclear_fission'], descriptionUa: 'Ракети далекого радіуса — з будь-якою боєголовкою.' },
  // Космічна гонка
  computers: { id: 'computers', nameUa: 'Комп\'ютери', era: 6, prereqs: ['radio', 'machine_tools'], descriptionUa: 'Машини, що рахують швидше за всіх математиків світу.' },
  space_flight: { id: 'space_flight', nameUa: 'Космічні польоти', era: 6, prereqs: ['computers', 'rocketry'], descriptionUa: 'Людина на орбіті — і далі, до зірок.' },
  plastics: { id: 'plastics', nameUa: 'Пластмаси', era: 6, prereqs: ['refining', 'space_flight'], descriptionUa: 'Легкі й міцні матеріали для ракетних двигунів.' },
  superconductor: { id: 'superconductor', nameUa: 'Надпровідники', era: 6, prereqs: ['plastics', 'nuclear_power'], descriptionUa: 'Струм без втрат: системи життєзабезпечення для зорельота.' },
  genetic_engineering: { id: 'genetic_engineering', nameUa: 'Генна інженерія', era: 6, prereqs: ['medicine', 'computers'], descriptionUa: 'Ключ до коду життя.' },
};

// 21 клітинка міста (Fat Cross Civ 1)
export const FAT_CROSS_OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
  { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
  { dx: 0, dy: -2 }, { dx: -1, dy: -2 }, { dx: 1, dy: -2 },
  { dx: 2, dy: -1 }, { dx: 2, dy: 0 }, { dx: 2, dy: 1 },
  { dx: 1, dy: 2 }, { dx: 0, dy: 2 }, { dx: -1, dy: 2 },
  { dx: -2, dy: 1 }, { dx: -2, dy: 0 }, { dx: -2, dy: -1 },
];

// Державні устрої (Civ 1)
export const GOVERNMENTS: Record<GovernmentKey, GovernmentConfig> = {
  anarchy: {
    key: 'anarchy', nameUa: 'Анархія', maxRate: 0, corruptionPerTile: 0.05, tilePenalty: true, tradeBonus: false, martialLaw: 0, freeUnits: 3, settlerFood: 1,
    descriptionUa: 'Перехід між устроями: ні податків, ні науки, вся торгівля йде на розкіш.',
  },
  despotism: {
    key: 'despotism', nameUa: 'Деспотизм', maxRate: 6, corruptionPerTile: 0.03, tilePenalty: true, tradeBonus: false, martialLaw: 0, freeUnits: 3, settlerFood: 1,
    descriptionUa: 'Влада одного. Клітинки дають не більше 2 кожного ресурсу (понад 2 — мінус 1). Ставки до 60%.',
  },
  monarchy: {
    key: 'monarchy', nameUa: 'Монархія', prereqTech: 'monarchy', maxRate: 7, corruptionPerTile: 0.02, tilePenalty: false, tradeBonus: false, martialLaw: 3, freeUnits: 3, settlerFood: 1,
    descriptionUa: 'Без штрафу до клітинок. Військові в місті заспокоюють до 3 невдоволених. Ставки до 70%.',
  },
  democracy: {
    key: 'democracy', nameUa: 'Демократія', prereqTech: 'democracy', maxRate: 9, corruptionPerTile: 0, tilePenalty: false, tradeBonus: true, martialLaw: 0, freeUnits: 0, settlerFood: 2,
    descriptionUa: '+1 торгівлі на клітинках, що вже її дають. Корупції немає. Ставки до 90%.',
  },
  republic: {
    key: 'republic', nameUa: 'Республіка', prereqTech: 'the_republic', maxRate: 8, corruptionPerTile: 0.01, tilePenalty: false, tradeBonus: true, martialLaw: 0, freeUnits: 0, settlerFood: 2,
    descriptionUa: '+1 торгівлі на клітинках, що вже її дають. Найменша корупція. Ставки до 80%. Військовий стан не діє.',
  },
};
