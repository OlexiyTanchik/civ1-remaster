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

export const TERRAIN_NAMES_UA: Record<TerrainType, string> = {
  [TerrainType.Ocean]: 'океан', [TerrainType.Grassland]: 'луки', [TerrainType.Plains]: 'рівнина',
  [TerrainType.Desert]: 'пустеля', [TerrainType.Tundra]: 'тундра', [TerrainType.Glacier]: 'льодовик',
  [TerrainType.Hills]: 'пагорби', [TerrainType.Mountains]: 'гори', [TerrainType.Forest]: 'ліс',
  [TerrainType.Jungle]: 'джунглі', [TerrainType.Swamp]: 'болото',
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
    key: UnitTypeKey.Caravan, name: 'Caravan', nameUa: 'Караван', attack: 0, defense: 1, moves: 1, cost: 50, domain: 'land', wonderShields: 50,
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
  [UnitTypeKey.Elephants]: {
    key: UnitTypeKey.Elephants, name: 'Elephants', nameUa: 'Бойові слони', attack: 5, defense: 1, moves: 1, cost: 40, domain: 'land',
    prereqTech: 'polytheism', descriptionUa: 'Б’ють сильніше за колісниці, але повільні. Пікінери тримають їх, як кінноту.',
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
  [UnitTypeKey.Howitzer]: {
    key: UnitTypeKey.Howitzer, name: 'Howitzer', nameUa: 'Гаубиця', attack: 12, defense: 2, moves: 2, cost: 70, domain: 'land',
    prereqTech: 'robotics', descriptionUa: 'Самохідна гаубиця: міські мури проти неї не допомагають.',
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
    key: UnitTypeKey.Fighter, name: 'Fighter', nameUa: 'Винищувач', attack: 4, defense: 2, moves: 10, cost: 60, domain: 'air', fuel: 1, interceptor: true,
    prereqTech: 'flight', descriptionUa: 'Пальне на один хід: до кінця ходу сядьте в місті чи на авіаносці. Єдиний, хто збиває літаки.',
  },
  [UnitTypeKey.Awacs]: {
    key: UnitTypeKey.Awacs, name: 'AWACS', nameUa: 'Літак ДРЛО (AWACS)', attack: 0, defense: 1, moves: 16, cost: 60, domain: 'air', fuel: 2, vision: 8,
    prereqTech: 'advanced_flight', descriptionUa: 'Літаючий радар: бачить на 8 клітинок довкола. Не воює; пальне на два ходи.',
  },
  [UnitTypeKey.Bomber]: {
    key: UnitTypeKey.Bomber, name: 'Bomber', nameUa: 'Бомбардувальник', attack: 12, defense: 1, moves: 8, cost: 120, domain: 'air', fuel: 2,
    prereqTech: 'advanced_flight', descriptionUa: 'Нищівний удар з неба; мури не рятують. Пальне на два ходи.',
  },
  [UnitTypeKey.Carrier]: {
    key: UnitTypeKey.Carrier, name: 'Carrier', nameUa: 'Авіаносець', attack: 1, defense: 12, moves: 5, cost: 160, domain: 'sea', airCapacity: 8,
    prereqTech: 'advanced_flight', descriptionUa: 'Плавучий аеродром: несе 8 літаків і заправляє їх.',
  },
  [UnitTypeKey.Diplomat]: {
    key: UnitTypeKey.Diplomat, name: 'Diplomat', nameUa: 'Дипломат', attack: 0, defense: 1, moves: 2, cost: 30, domain: 'land',
    prereqTech: 'writing', descriptionUa: 'Зайдіть у чуже місто: відкрити посольство або викрасти технологію.',
  },
  [UnitTypeKey.Nuclear]: {
    key: UnitTypeKey.Nuclear, name: 'Nuclear', nameUa: 'Ядерна ракета', attack: 99, defense: 0, moves: 16, cost: 160, domain: 'air', fuel: 1,
    prereqTech: 'rocketry', requiresWonder: BuildingTypeKey.Manhattan,
    descriptionUa: 'Знищує все живе на 3×3 клітинки, міста втрачають половину жителів. Потрібен Мангеттенський проєкт (будь-чий).',
  },
  // Етап 8: Античність
  [UnitTypeKey.Explorer]: {
    key: UnitTypeKey.Explorer, name: 'Explorer', nameUa: 'Дослідник', attack: 0, defense: 1, moves: 1, cost: 30, domain: 'land',
    allTerrainAsRoad: true, vision: 3,
    prereqTech: 'seafaring', descriptionUa: 'Будь-який рельєф проходить, як дорогою (3 клітинки за хід), і бачить на 3 клітинки. Не воює.',
  },
  [UnitTypeKey.Galleon]: {
    key: UnitTypeKey.Galleon, name: 'Galleon', nameUa: 'Галеон', attack: 0, defense: 2, moves: 4, cost: 40, domain: 'sea', capacity: 4,
    prereqTech: 'magnetism', descriptionUa: 'Вантажне вітрильне судно: везе 4 юніти, але не воює.',
  },
  // Етап 8: Середньовіччя / Новий час
  [UnitTypeKey.Engineers]: {
    key: UnitTypeKey.Engineers, name: 'Engineers', nameUa: 'Інженери', attack: 0, defense: 2, moves: 2, cost: 40, domain: 'land',
    prereqTech: 'explosives', descriptionUa: 'Працюють на землі вдвічі швидше й перетворюють рельєф [O]: ліс ↔ рівнина, болото й джунглі → луки.',
  },
  [UnitTypeKey.Dragoons]: {
    key: UnitTypeKey.Dragoons, name: 'Dragoons', nameUa: 'Драгуни', attack: 5, defense: 2, moves: 2, cost: 50, domain: 'land',
    prereqTech: 'leadership', descriptionUa: 'Кіннота з мушкетами: швидкий удар і непогана оборона.',
  },
  [UnitTypeKey.AlpineTroops]: {
    key: UnitTypeKey.AlpineTroops, name: 'Alpine Troops', nameUa: 'Альпійські стрільці', attack: 5, defense: 5, moves: 1, cost: 50, domain: 'land',
    allTerrainAsRoad: true,
    prereqTech: 'tactics', descriptionUa: 'Гірська піхота: будь-який рельєф проходить, як дорогою, і міцно тримає оборону.',
  },
  [UnitTypeKey.Spy]: {
    key: UnitTypeKey.Spy, name: 'Spy', nameUa: 'Шпигун', attack: 0, defense: 0, moves: 3, cost: 30, domain: 'land',
    prereqTech: 'espionage', descriptionUa: 'Як дипломат, але професіонал: після посольства лишається живим, після крадіжки чи саботажу — у половині випадків.',
  },
  // Етап 8: XX століття
  [UnitTypeKey.Paratroopers]: {
    key: UnitTypeKey.Paratroopers, name: 'Paratroopers', nameUa: 'Десантники', attack: 6, defense: 4, moves: 1, cost: 60, domain: 'land', paradrop: 10,
    prereqTech: 'combined_arms', descriptionUa: 'З міста, поки не ходили, стрибають на будь-яку розвідану клітинку суші за 10 клітинок (клік по ній).',
  },
  [UnitTypeKey.Marines]: {
    key: UnitTypeKey.Marines, name: 'Marines', nameUa: 'Морська піхота', attack: 8, defense: 5, moves: 1, cost: 60, domain: 'land', marine: true,
    prereqTech: 'amphibious_warfare', descriptionUa: 'Атакує просто з корабля на повну силу (інші війська з корабля б\'ють удвічі слабше).',
  },
  [UnitTypeKey.Partisans]: {
    key: UnitTypeKey.Partisans, name: 'Partisans', nameUa: 'Партизани', attack: 4, defense: 4, moves: 1, cost: 50, domain: 'land',
    allTerrainAsRoad: true,
    prereqTech: 'guerrilla_warfare', descriptionUa: 'Будь-який рельєф — як дорога. Коли ворог бере ваше місто, довкола нього самі з\'являються партизани.',
  },
  [UnitTypeKey.Fanatics]: {
    key: UnitTypeKey.Fanatics, name: 'Fanatics', nameUa: 'Фанатики', attack: 4, defense: 4, moves: 1, cost: 20, domain: 'land',
    requiresGovernment: 'fundamentalism',
    prereqTech: 'fundamentalism', descriptionUa: 'Лише за Фундаменталізму: дешеві й без утримання.',
  },
  [UnitTypeKey.Destroyer]: {
    key: UnitTypeKey.Destroyer, name: 'Destroyer', nameUa: 'Есмінець', attack: 4, defense: 4, moves: 8, cost: 60, domain: 'sea', vision: 3,
    prereqTech: 'combustion', descriptionUa: 'Найшвидший корабель: 8 клітинок за хід, бачить на 3 клітинки.',
  },
  [UnitTypeKey.Freight]: {
    key: UnitTypeKey.Freight, name: 'Freight', nameUa: 'Вантажівка', attack: 0, defense: 1, moves: 2, cost: 80, domain: 'land', wonderShields: 80,
    prereqTech: 'the_corporation', descriptionUa: 'Сучасний караван: удвічі швидший і віддає на чудо світу 80 щитів [H].',
  },
  [UnitTypeKey.Helicopter]: {
    key: UnitTypeKey.Helicopter, name: 'Helicopter', nameUa: 'Гелікоптер', attack: 10, defense: 3, moves: 6, cost: 100, domain: 'air', hover: true,
    prereqTech: 'combined_arms', descriptionUa: 'Летить над будь-чим без пального, але висить низько: його б\'ють і наземні війська. Міст не захоплює.',
  },
  // Етап 8: Сучасність
  [UnitTypeKey.CruiseMissile]: {
    key: UnitTypeKey.CruiseMissile, name: 'Cruise Missile', nameUa: 'Крилата ракета', attack: 18, defense: 0, moves: 12, cost: 60, domain: 'air', fuel: 1, missile: true,
    prereqTech: 'rocketry', descriptionUa: 'Один нищівний удар за 12 клітинок — і ракети нема, хоч би як скінчився бій.',
  },
  [UnitTypeKey.StealthFighter]: {
    key: UnitTypeKey.StealthFighter, name: 'Stealth Fighter', nameUa: 'Стелс-винищувач', attack: 8, defense: 4, moves: 14, cost: 80, domain: 'air', fuel: 1,
    interceptor: true, stealth: true,
    prereqTech: 'stealth', descriptionUa: 'Збиває літаки; ЗРК і крейсери AEGIS проти нього не посилюються. Пальне на один хід.',
  },
  [UnitTypeKey.StealthBomber]: {
    key: UnitTypeKey.StealthBomber, name: 'Stealth Bomber', nameUa: 'Стелс-бомбардувальник', attack: 14, defense: 5, moves: 12, cost: 160, domain: 'air', fuel: 2,
    stealth: true,
    prereqTech: 'stealth', descriptionUa: 'Нищівний удар з неба; мури, ЗРК і AEGIS його не стримують. Пальне на два ходи.',
  },
  [UnitTypeKey.AegisCruiser]: {
    key: UnitTypeKey.AegisCruiser, name: 'AEGIS Cruiser', nameUa: 'Крейсер AEGIS', attack: 8, defense: 8, moves: 5, cost: 100, domain: 'sea', antiAir: true,
    prereqTech: 'rocketry', descriptionUa: 'Ракетний крейсер: проти літаків і ракет захист ×5.',
  },
  // Унікальні юніти: кожна цивілізація має свій замість звичайного юніта тієї ж епохи
  [UnitTypeKey.Cossacks]: {
    key: UnitTypeKey.Cossacks, name: 'Cossacks', nameUa: 'Козаки', attack: 6, defense: 2, moves: 3, cost: 50, domain: 'land',
    civ: 'rus', replaces: UnitTypeKey.Dragoons, prereqTech: 'leadership', descriptionUa: 'Унікальний юніт Русі замість Драгунів: запорожці на баских конях — швидші й сильніші в атаці.',
  },
  [UnitTypeKey.Praetorians]: {
    key: UnitTypeKey.Praetorians, name: 'Praetorians', nameUa: 'Преторіанці', attack: 4, defense: 2, moves: 1, cost: 25, domain: 'land',
    civ: 'romans', replaces: UnitTypeKey.Legion, prereqTech: 'iron_working', descriptionUa: 'Унікальний юніт Риму замість Легіону: гвардія імператора, міцніша в обороні.',
  },
  [UnitTypeKey.WarChariot]: {
    key: UnitTypeKey.WarChariot, name: 'War Chariot', nameUa: 'Колісниця фараона', attack: 4, defense: 2, moves: 2, cost: 40, domain: 'land',
    civ: 'egyptians', replaces: UnitTypeKey.Chariot, prereqTech: 'the_wheel', descriptionUa: 'Унікальний юніт Єгипту замість Колісниці: легка колісниця з лучником, не така вразлива в обороні.',
  },
  [UnitTypeKey.Hoplites]: {
    key: UnitTypeKey.Hoplites, name: 'Hoplites', nameUa: 'Гопліти', attack: 1, defense: 3, moves: 1, cost: 20, domain: 'land',
    civ: 'greeks', replaces: UnitTypeKey.Phalanx, prereqTech: 'bronze_working', descriptionUa: 'Унікальний юніт Греції замість Фаланги: щит до щита — найкраща рання оборона.',
  },
  [UnitTypeKey.BabylonBowmen]: {
    key: UnitTypeKey.BabylonBowmen, name: 'Babylonian Bowmen', nameUa: 'Лучники Вавилону', attack: 3, defense: 3, moves: 1, cost: 30, domain: 'land',
    civ: 'babylonians', replaces: UnitTypeKey.Archers, prereqTech: 'warrior_code', descriptionUa: 'Унікальний юніт Вавилону замість Лучників: тримають мури не гірше за мушкетерів.',
  },
  [UnitTypeKey.Panzer]: {
    key: UnitTypeKey.Panzer, name: 'Panzer', nameUa: 'Панцер', attack: 10, defense: 6, moves: 4, cost: 80, domain: 'land',
    civ: 'germans', replaces: UnitTypeKey.Armor, prereqTech: 'mobile_warfare', descriptionUa: 'Унікальний юніт Германії замість Танків: швидший і краще броньований.',
  },
  [UnitTypeKey.ChuKoNu]: {
    key: UnitTypeKey.ChuKoNu, name: 'Chu-Ko-Nu', nameUa: 'Чу-ко-ну', attack: 3, defense: 2, moves: 1, cost: 25, domain: 'land',
    civ: 'chinese', replaces: UnitTypeKey.Pikemen, prereqTech: 'feudalism', descriptionUa: 'Унікальний юніт Китаю замість Пікінерів: багатозарядні арбалети — б\'ють сильніше й так само тримають кінноту (×2).',
  },
  [UnitTypeKey.Keshik]: {
    key: UnitTypeKey.Keshik, name: 'Keshik', nameUa: 'Кешик', attack: 4, defense: 2, moves: 3, cost: 40, domain: 'land',
    civ: 'mongols', replaces: UnitTypeKey.Knights, prereqTech: 'chivalry', descriptionUa: 'Унікальний юніт Монголії замість Лицарів: кінні лучники хана — 3 ходи.',
  },
  [UnitTypeKey.JaguarWarriors]: {
    key: UnitTypeKey.JaguarWarriors, name: 'Jaguar Warriors', nameUa: 'Воїни-ягуари', attack: 4, defense: 1, moves: 1, cost: 15, domain: 'land',
    civ: 'aztecs', replaces: UnitTypeKey.Legion, prereqTech: 'iron_working', descriptionUa: 'Унікальний юніт ацтеків замість Легіону: дешеві й люті воїни в шкурах ягуара.',
  },
  [UnitTypeKey.Longbowmen]: {
    key: UnitTypeKey.Longbowmen, name: 'Longbowmen', nameUa: 'Лучники-йомени', attack: 4, defense: 2, moves: 1, cost: 30, domain: 'land',
    civ: 'english', replaces: UnitTypeKey.Archers, prereqTech: 'warrior_code', descriptionUa: 'Унікальний юніт Англії замість Лучників: довгий лук б\'є далі й сильніше.',
  },
  // Етап 10, Античність
  [UnitTypeKey.HorseArchers]: {
    key: UnitTypeKey.HorseArchers, name: 'Horse Archers', nameUa: 'Кінні лучники', attack: 3, defense: 1, moves: 2, cost: 30, domain: 'land',
    prereqTech: 'horseback_riding', descriptionUa: 'Стріляють з сідла й відходять: швидкий удар степовиків.',
  },
  [UnitTypeKey.BatteringRam]: {
    key: UnitTypeKey.BatteringRam, name: 'Battering Ram', nameUa: 'Таран', attack: 3, defense: 1, moves: 1, cost: 30, domain: 'land', ignoresWalls: true,
    prereqTech: 'construction', descriptionUa: 'Окутий колод під навісом: міські мури проти нього не діють.',
  },
  [UnitTypeKey.Bireme]: {
    key: UnitTypeKey.Bireme, name: 'Bireme', nameUa: 'Бірема', attack: 3, defense: 2, moves: 3, cost: 40, domain: 'sea', capacity: 2,
    prereqTech: 'seafaring', descriptionUa: 'Бойова галера з двома рядами весел: везе 2 загони й таранить ворожі кораблі.',
  },
  [UnitTypeKey.Crossbowmen]: {
    key: UnitTypeKey.Crossbowmen, name: 'Crossbowmen', nameUa: 'Арбалетники', attack: 5, defense: 2, moves: 1, cost: 35, domain: 'land',
    prereqTech: 'invention', descriptionUa: 'Арбалет пробиває лицарські обладунки. Наступники Лучників.',
  },
  [UnitTypeKey.Trebuchet]: {
    key: UnitTypeKey.Trebuchet, name: 'Trebuchet', nameUa: 'Требушет', attack: 7, defense: 1, moves: 1, cost: 50, domain: 'land',
    prereqTech: 'architecture', descriptionUa: 'Важка облогова машина з противагою — між катапультою й гарматою.',
  },
  // Етап 10, Середньовіччя і Новий час
  [UnitTypeKey.Landsknechts]: {
    key: UnitTypeKey.Landsknechts, name: 'Landsknechts', nameUa: 'Ландскнехти', attack: 4, defense: 3, moves: 1, cost: 40, domain: 'land',
    prereqTech: 'guilds', descriptionUa: 'Найманці з дворучними мечами й піками: міцні й в атаці, й в обороні.',
  },
  [UnitTypeKey.Grenadiers]: {
    key: UnitTypeKey.Grenadiers, name: 'Grenadiers', nameUa: 'Гренадери', attack: 6, defense: 3, moves: 1, cost: 50, domain: 'land',
    prereqTech: 'chemistry', descriptionUa: 'Відбірна піхота з ручними гранатами — штурмують укріплення.',
  },
  [UnitTypeKey.Cuirassiers]: {
    key: UnitTypeKey.Cuirassiers, name: 'Cuirassiers', nameUa: 'Кірасири', attack: 6, defense: 3, moves: 2, cost: 60, domain: 'land',
    prereqTech: 'metallurgy', descriptionUa: 'Важка кіннота в сталевих кірасах. Як і всю кінноту, пікінери тримають її вдвічі краще.',
  },
  [UnitTypeKey.ShipOfTheLine]: {
    key: UnitTypeKey.ShipOfTheLine, name: 'Ship of the Line', nameUa: 'Лінійний корабель', attack: 6, defense: 4, moves: 4, cost: 70, domain: 'sea',
    prereqTech: 'magnetism', descriptionUa: 'Три гарматні палуби: король морів до пари й броні.',
  },
  [UnitTypeKey.Privateer]: {
    key: UnitTypeKey.Privateer, name: 'Privateer', nameUa: 'Капер', attack: 4, defense: 2, moves: 5, cost: 50, domain: 'sea',
    prereqTech: 'navigation', descriptionUa: 'Швидкий корабель із каперським свідоцтвом — полює на ворожі судна.',
  },
  // Етап 10, Індустрія і XX століття
  [UnitTypeKey.MachineGunners]: {
    key: UnitTypeKey.MachineGunners, name: 'Machine Gunners', nameUa: 'Кулеметники', attack: 3, defense: 6, moves: 1, cost: 60, domain: 'land',
    prereqTech: 'machine_tools', descriptionUa: 'Кулемет «Максим» в окопі: найміцніша оборона до моторизованої піхоти.',
  },
  [UnitTypeKey.ArmoredCar]: {
    key: UnitTypeKey.ArmoredCar, name: 'Armored Car', nameUa: 'Бронеавтомобіль', attack: 6, defense: 3, moves: 3, cost: 60, domain: 'land',
    prereqTech: 'automobile', descriptionUa: 'Броньована машина з кулеметом: швидка розвідка й рейди.',
  },
  [UnitTypeKey.Dreadnought]: {
    key: UnitTypeKey.Dreadnought, name: 'Dreadnought', nameUa: 'Дредноут', attack: 12, defense: 8, moves: 4, cost: 120, domain: 'sea',
    prereqTech: 'steel', descriptionUa: 'Перший великий броненосний лінкор із баштовими гарматами.',
  },
  [UnitTypeKey.AntiTankGun]: {
    key: UnitTypeKey.AntiTankGun, name: 'Anti-Tank Gun', nameUa: 'Протитанкова гармата', attack: 5, defense: 7, moves: 1, cost: 60, domain: 'land',
    prereqTech: 'mobile_warfare', descriptionUa: 'Тримає оборону проти танків і бронетехніки: проти них захист ×2.',
  },
  [UnitTypeKey.RocketArtillery]: {
    key: UnitTypeKey.RocketArtillery, name: 'Rocket Artillery', nameUa: 'Реактивна артилерія', attack: 12, defense: 1, moves: 2, cost: 80, domain: 'land',
    prereqTech: 'rocketry', descriptionUa: 'Залп реактивних снарядів з вантажівки, як «Катюша».',
  },
  // Етап 10, Сучасність і Майбутнє
  [UnitTypeKey.ModernArmor]: {
    key: UnitTypeKey.ModernArmor, name: 'Modern Armor', nameUa: 'Сучасний танк', attack: 16, defense: 10, moves: 4, cost: 120, domain: 'land',
    prereqTech: 'robotics', descriptionUa: 'Танк із комп\'ютерним керуванням вогнем і композитною бронею.',
  },
  [UnitTypeKey.Drone]: {
    key: UnitTypeKey.Drone, name: 'Strike Drone', nameUa: 'Ударний дрон', attack: 8, defense: 2, moves: 10, cost: 50, domain: 'air', fuel: 1,
    prereqTech: 'miniaturization', descriptionUa: 'Безпілотник: дешевий удар без ризику для пілота, повертається на базу за хід.',
  },
  [UnitTypeKey.MissileSubmarine]: {
    key: UnitTypeKey.MissileSubmarine, name: 'Missile Submarine', nameUa: 'Ракетний підводний човен', attack: 16, defense: 4, moves: 4, cost: 120, domain: 'sea',
    prereqTech: 'nuclear_power', descriptionUa: 'Атомний підводний човен з крилатими ракетами.',
  },
  [UnitTypeKey.LaserInfantry]: {
    key: UnitTypeKey.LaserInfantry, name: 'Laser Infantry', nameUa: 'Лазерна піхота', attack: 10, defense: 12, moves: 2, cost: 100, domain: 'land',
    prereqTech: 'lasers', descriptionUa: 'Піхота в екзоскелетах з лазерними гвинтівками.',
  },
  [UnitTypeKey.HoverTank]: {
    key: UnitTypeKey.HoverTank, name: 'Hover Tank', nameUa: 'Гравітанк', attack: 20, defense: 12, moves: 5, cost: 160, domain: 'land', allTerrainAsRoad: true,
    prereqTech: 'fusion', descriptionUa: 'Танк на антигравітаційній подушці: будь-який рельєф — як дорога.',
  },
  [UnitTypeKey.BattleMech]: {
    key: UnitTypeKey.BattleMech, name: 'Battle Mech', nameUa: 'Бойовий мех', attack: 24, defense: 16, moves: 3, cost: 200, domain: 'land',
    prereqTech: 'nanotechnology', descriptionUa: 'Крокуючий бойовий робот із наноброні.',
  },
  [UnitTypeKey.PlasmaCruiser]: {
    key: UnitTypeKey.PlasmaCruiser, name: 'Plasma Cruiser', nameUa: 'Плазмовий крейсер', attack: 24, defense: 20, moves: 6, cost: 220, domain: 'sea',
    prereqTech: 'fusion', descriptionUa: 'Термоядерний корабель із плазмовими гарматами.',
  },
  // Етап 10, друга хвиля
  [UnitTypeKey.Conquistadors]: {
    key: UnitTypeKey.Conquistadors, name: 'Conquistadors', nameUa: 'Конкістадори', attack: 3, defense: 2, moves: 2, cost: 40, domain: 'land', allTerrainAsRoad: true, vision: 3,
    prereqTech: 'navigation', descriptionUa: 'Шукачі золота за морем: будь-який рельєф — як дорога, бачать на 3 клітинки.',
  },
  [UnitTypeKey.Balloon]: {
    key: UnitTypeKey.Balloon, name: 'Balloon', nameUa: 'Повітряна куля', attack: 0, defense: 1, moves: 6, cost: 30, domain: 'air', fuel: 2, vision: 5,
    prereqTech: 'physics', descriptionUa: 'Монгольф\'єр: бачить на 5 клітинок, тримається в небі 2 ходи.',
  },
  [UnitTypeKey.Zeppelin]: {
    key: UnitTypeKey.Zeppelin, name: 'Zeppelin', nameUa: 'Цепелін', attack: 6, defense: 2, moves: 6, cost: 80, domain: 'air', fuel: 3,
    prereqTech: 'combustion', descriptionUa: 'Повільний дирижабль-бомбардувальник: 3 ходи в небі, огляд згори.',
  },
  [UnitTypeKey.Snipers]: {
    key: UnitTypeKey.Snipers, name: 'Snipers', nameUa: 'Снайпери', attack: 6, defense: 4, moves: 1, cost: 50, domain: 'land', allTerrainAsRoad: true,
    prereqTech: 'tactics', descriptionUa: 'Влучні стрільці, що ховаються в будь-якому рельєфі й рухаються ним, як дорогою.',
  },
  [UnitTypeKey.FlakGun]: {
    key: UnitTypeKey.FlakGun, name: 'Flak Gun', nameUa: 'Зенітна гармата', attack: 1, defense: 4, moves: 1, cost: 50, domain: 'land', antiAir: true,
    prereqTech: 'flight', descriptionUa: 'Зенітка: проти літаків і гелікоптерів захист ×5.',
  },
};

/** Юніт для цивілізації: унікальні — лише своїй, а звичайний, якого її унікальний замінює, — їй ні. */
export function unitForCiv(cfg: UnitConfig, civ?: CivKey): boolean {
  if (cfg.civ) return cfg.civ === civ;
  return !civ || !Object.values(UNIT_CONFIGS).some((u) => u.civ === civ && u.replaces === cfg.key);
}

/** Чим цивілізація будує цей юніт: своїм унікальним, якщо він його замінює. */
export function civUnit(type: UnitTypeKey, civ?: CivKey): UnitTypeKey {
  return Object.values(UNIT_CONFIGS).find((u) => u.civ && u.civ === civ && u.replaces === type)?.key ?? type;
}

/** Хто діє в чужих містах (посольство, крадіжка, підкуп, саботаж). */
export const AGENTS: ReadonlySet<UnitTypeKey> = new Set([UnitTypeKey.Diplomat, UnitTypeKey.Spy]);

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
  [BuildingTypeKey.RecyclingCenter]: {
    key: BuildingTypeKey.RecyclingCenter, nameUa: 'Центр переробки', cost: 200, maintenance: 2, prereqTech: 'recycling',
    descriptionUa: 'Виробництво міста забруднює довкілля втричі рідше.',
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
  [BuildingTypeKey.HydroPlant]: {
    key: BuildingTypeKey.HydroPlant, nameUa: 'ГЕС', cost: 240, maintenance: 4, prereqTech: 'electronics', requires: BuildingTypeKey.Factory, highland: true,
    descriptionUa: 'Як електростанція (+25% щитів з фабрикою, не додається до неї), але забруднення вдвічі рідше. Лише біля річки, гір чи пагорбів.',
  },
  [BuildingTypeKey.MfgPlant]: {
    key: BuildingTypeKey.MfgPlant, nameUa: 'Завод', cost: 320, maintenance: 6, prereqTech: 'robotics', requires: BuildingTypeKey.Factory,
    descriptionUa: 'Конвеєри з роботами: ще +25% щитів, з електростанцією +50%. Більше щитів — більше й смогу. Потрібна фабрика.',
  },
  [BuildingTypeKey.Manhattan]: {
    key: BuildingTypeKey.Manhattan, nameUa: 'Мангеттенський проєкт', cost: 600, maintenance: 0, prereqTech: 'nuclear_fission', isWonder: true,
    descriptionUa: 'Чудо світу. Відкриває ядерну зброю ВСІМ, хто знає Ракетобудування.',
  },
  [BuildingTypeKey.SdiDefense]: {
    key: BuildingTypeKey.SdiDefense, nameUa: 'Протиракетна оборона (SDI)', cost: 200, maintenance: 4, prereqTech: 'superconductor',
    descriptionUa: 'Збиває ядерні ракети, що летять на місто чи на клітинки за 3 від нього.',
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
  [BuildingTypeKey.MarcoPolo]: {
    key: BuildingTypeKey.MarcoPolo, nameUa: 'Посольство Марко Поло', cost: 200, maintenance: 0, prereqTech: 'trade', isWonder: true,
    descriptionUa: 'Чудо світу. Посольства в усіх цивілізаціях: ви знайомі з усіма й бачите їхні технології.',
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
  // Етап 8: Античність
  [BuildingTypeKey.TempleOfArtemis]: {
    key: BuildingTypeKey.TempleOfArtemis, nameUa: 'Храм Артеміди', cost: 300, maintenance: 0, prereqTech: 'philosophy', isWonder: true,
    descriptionUa: 'Чудо світу. Кожен ваш храм заспокоює ще двох невдоволених.',
  },
  [BuildingTypeKey.StatueOfZeus]: {
    key: BuildingTypeKey.StatueOfZeus, nameUa: 'Статуя Зевса', cost: 200, maintenance: 0, prereqTech: 'bronze_working', isWonder: true,
    descriptionUa: 'Чудо світу. Кожне ваше місто утримує ще один юніт безкоштовно, а один загін за кордоном не засмучує жителів.',
  },
  [BuildingTypeKey.SunTzu]: {
    key: BuildingTypeKey.SunTzu, nameUa: 'Військова академія Сунь-цзи', cost: 300, maintenance: 0, prereqTech: 'feudalism', isWonder: true,
    descriptionUa: 'Чудо світу. Нові наземні війська в усіх ваших містах — ветерани, як із казарм.',
  },
  // Етап 8: Середньовіччя / Новий час
  [BuildingTypeKey.CoastalDefense]: {
    key: BuildingTypeKey.CoastalDefense, nameUa: 'Берегова оборона', cost: 60, maintenance: 1, prereqTech: 'metallurgy', coastal: true,
    descriptionUa: 'Подвоює захист міста від кораблів. Лише в приморському місті.',
  },
  [BuildingTypeKey.PortFacility]: {
    key: BuildingTypeKey.PortFacility, nameUa: 'Портові споруди', cost: 80, maintenance: 2, prereqTech: 'steam_engine', coastal: true,
    descriptionUa: 'Усі нові кораблі міста — ветерани. Лише в приморському місті.',
  },
  [BuildingTypeKey.PoliceStation]: {
    key: BuildingTypeKey.PoliceStation, nameUa: 'Поліція', cost: 60, maintenance: 2, prereqTech: 'communism',
    descriptionUa: 'Кожен загін за кордоном засмучує на одного жителя менше; гарнізон заспокоює до двох невдоволених.',
  },
  [BuildingTypeKey.StatueOfLiberty]: {
    key: BuildingTypeKey.StatueOfLiberty, nameUa: 'Статуя Свободи', cost: 400, maintenance: 0, prereqTech: 'democracy', isWonder: true,
    descriptionUa: 'Чудо світу. Зміна устрою — одразу, без анархії.',
  },
  [BuildingTypeKey.EiffelTower]: {
    key: BuildingTypeKey.EiffelTower, nameUa: 'Ейфелева вежа', cost: 300, maintenance: 0, prereqTech: 'industrialization', isWonder: true,
    descriptionUa: 'Чудо світу. Усі ваші міста забруднюють довкілля на чверть рідше.',
  },
  // Етап 8: XX століття
  [BuildingTypeKey.SamBattery]: {
    key: BuildingTypeKey.SamBattery, nameUa: 'Зенітні ракети (ЗРК)', cost: 100, maintenance: 2, prereqTech: 'rocketry',
    descriptionUa: 'Подвоює захист міста від літаків і гелікоптерів.',
  },
  [BuildingTypeKey.Supermarket]: {
    key: BuildingTypeKey.Supermarket, nameUa: 'Супермаркет', cost: 80, maintenance: 3, prereqTech: 'refrigeration',
    descriptionUa: 'Холодильники й ферми: зрошені клітинки міста дають на 50% більше їжі.',
  },
  [BuildingTypeKey.Superhighways]: {
    key: BuildingTypeKey.Superhighways, nameUa: 'Автостради', cost: 120, maintenance: 3, prereqTech: 'automobile',
    descriptionUa: 'Клітинки міста з дорогою дають на 50% більше торгівлі.',
  },
  [BuildingTypeKey.OffshorePlatform]: {
    key: BuildingTypeKey.OffshorePlatform, nameUa: 'Морська платформа', cost: 120, maintenance: 3, prereqTech: 'miniaturization', coastal: true,
    descriptionUa: 'Кожна морська клітинка міста дає +1 щит. Лише в приморському місті.',
  },
  // Етап 8: Сучасність
  [BuildingTypeKey.ResearchLab]: {
    key: BuildingTypeKey.ResearchLab, nameUa: 'Дослідницька лабораторія', cost: 120, maintenance: 3, prereqTech: 'computers', requires: BuildingTypeKey.University,
    descriptionUa: 'Ще +50% науки (разом з бібліотекою й університетом). Потрібен університет.',
  },
  [BuildingTypeKey.SolarPlant]: {
    key: BuildingTypeKey.SolarPlant, nameUa: 'Сонячна електростанція', cost: 320, maintenance: 4, prereqTech: 'environmentalism', requires: BuildingTypeKey.Factory,
    descriptionUa: 'Електростанція без диму: з фабрикою ще +25% щитів, а виробництво міста зовсім не забруднює. Потрібна фабрика.',
  },
  // Сумські чудеса XX століття: типова радянська школа й СумДУ
  [BuildingTypeKey.SumyAltanka]: {
    key: BuildingTypeKey.SumyAltanka, nameUa: 'Сумська альтанка', cost: 300, maintenance: 0, prereqTech: 'electricity', isWonder: true,
    descriptionUa: 'Чудо світу. Різьблена дерев\'яна альтанка 1912 року над Пслом — символ міста Суми, улюблене місце побачень і фото. +1 задоволений у кожному вашому місті; у місті з альтанкою розкіш ×2.',
  },
  [BuildingTypeKey.SumySchool]: {
    key: BuildingTypeKey.SumySchool, nameUa: 'Сумська спеціалізована школа №1 ім. В. Стрельченка', cost: 450, maintenance: 0, prereqTech: 'sanitation', isWonder: true,
    descriptionUa: 'Чудо світу. Комунальна установа Сумська спеціалізована школа І-ІІІ ступенів № 1 ім. В. Стрельченка, м. Суми, Сумської області. Довгий світлий фасад, ялини біля ґанку й учителі, що пам\'ятають кожного учня. Усі технології на 15% дешевші; у місті +2 задоволених — випускники.',
  },
  [BuildingTypeKey.SumDU]: {
    key: BuildingTypeKey.SumDU, nameUa: 'Сумський державний університет (СумДУ)', cost: 500, maintenance: 0, prereqTech: 'electronics', isWonder: true,
    descriptionUa: 'Чудо світу. Колишній Сумський політехнічний інститут: вежа над містом, червоні корпуси з синіми гербами й студенти, що креслять майбутнє. +100% науки в місті, +25% у кожному місті з університетом.',
  },
  [BuildingTypeKey.Internet]: {
    key: BuildingTypeKey.Internet, nameUa: 'Інтернет', cost: 600, maintenance: 0, prereqTech: 'computers', isWonder: true,
    descriptionUa: 'Чудо світу. Кожне ваше місто з університетом працює, як з дослідницькою лабораторією.',
  },
  [BuildingTypeKey.Coinage]: {
    key: BuildingTypeKey.Coinage, nameUa: '💰 Капіталізація', cost: 0, maintenance: 0, prereqTech: 'the_corporation', coinage: true,
    descriptionUa: 'Місто нічого не будує: усі щити щоходу йдуть у скарбницю золотом (Civ II).',
  },
  // Етап 10, Античність
  [BuildingTypeKey.Well]: {
    key: BuildingTypeKey.Well, nameUa: 'Колодязь', cost: 30, maintenance: 0, prereqTech: 'pottery', effects: { food: 10 },
    descriptionUa: 'Чиста вода: +10% їжі.',
  },
  [BuildingTypeKey.Workshop]: {
    key: BuildingTypeKey.Workshop, nameUa: 'Майстерня', cost: 40, maintenance: 1, prereqTech: 'bronze_working', effects: { shields: 15 },
    descriptionUa: 'Ковалі й теслі: +15% щитів.',
  },
  [BuildingTypeKey.Herbalist]: {
    key: BuildingTypeKey.Herbalist, nameUa: 'Травник', cost: 40, maintenance: 1, prereqTech: 'herbalism', effects: { content: 1 },
    descriptionUa: 'Знахар лікує тіло й душу: +1 задоволений.',
  },
  [BuildingTypeKey.Thermae]: {
    key: BuildingTypeKey.Thermae, nameUa: 'Терми', cost: 60, maintenance: 1, prereqTech: 'construction', effects: { content: 1, luxury: 25 },
    descriptionUa: 'Громадські лазні: +1 задоволений, +25% розкоші.',
  },
  [BuildingTypeKey.Forum]: {
    key: BuildingTypeKey.Forum, nameUa: 'Форум', cost: 70, maintenance: 1, prereqTech: 'architecture', effects: { content: 1, gold: 10 },
    descriptionUa: 'Площа для торгу й промов: +1 задоволений, +10% золота.',
  },
  [BuildingTypeKey.Scriptorium]: {
    key: BuildingTypeKey.Scriptorium, nameUa: 'Скрипторій', cost: 60, maintenance: 1, prereqTech: 'literacy', requires: BuildingTypeKey.Library, effects: { science: 15 },
    descriptionUa: 'Переписувачі множать книги: +15% науки (потрібна бібліотека).',
  },
  [BuildingTypeKey.GuildHall]: {
    key: BuildingTypeKey.GuildHall, nameUa: 'Цеховий двір', cost: 90, maintenance: 2, prereqTech: 'guilds', requires: BuildingTypeKey.Workshop, effects: { shields: 20 },
    descriptionUa: 'Цехи ремісників: ще +20% щитів (потрібна майстерня).',
  },
  [BuildingTypeKey.Monastery]: {
    key: BuildingTypeKey.Monastery, nameUa: 'Монастир', cost: 80, maintenance: 1, prereqTech: 'monotheism', effects: { content: 1, science: 10 },
    descriptionUa: 'Ченці моляться й переписують літописи: +1 задоволений, +10% науки.',
  },
  [BuildingTypeKey.Mausoleum]: {
    key: BuildingTypeKey.Mausoleum, nameUa: 'Мавзолей Галікарнаса', cost: 300, maintenance: 0, prereqTech: 'architecture', isWonder: true, globalEffects: { content: 1, luxury: 25 },
    descriptionUa: 'Чудо світу. Гробниця, що дала ім\'я всім мавзолеям: у кожному вашому місті +1 задоволений і +25% розкоші.',
  },
  [BuildingTypeKey.SilkRoad]: {
    key: BuildingTypeKey.SilkRoad, nameUa: 'Великий шовковий шлях', cost: 350, maintenance: 0, prereqTech: 'guilds', isWonder: true, effects: { gold: 50 }, globalEffects: { trade: 1 },
    descriptionUa: 'Чудо світу. Каравани зі сходу на захід: +1 торгівлі в кожному вашому місті, тут — +50% золота.',
  },
  [BuildingTypeKey.SaintSophia]: {
    key: BuildingTypeKey.SaintSophia, nameUa: 'Софійський собор', cost: 400, maintenance: 0, prereqTech: 'monotheism', isWonder: true, effects: { content: 2, science: 50 }, globalEffects: { content: 1 },
    descriptionUa: 'Чудо світу. Собор Ярослава Мудрого в Києві з мозаїками й бібліотекою: +1 задоволений у кожному вашому місті, тут — ще +2 і +50% науки.',
  },
  // Етап 10, Середньовіччя і Новий час
  [BuildingTypeKey.PrintingHouse]: {
    key: BuildingTypeKey.PrintingHouse, nameUa: 'Друкарня', cost: 80, maintenance: 1, prereqTech: 'printing_press', requires: BuildingTypeKey.Library, effects: { science: 20 },
    descriptionUa: 'Книги з друкарського верстата: +20% науки (потрібна бібліотека).',
  },
  [BuildingTypeKey.Theatre]: {
    key: BuildingTypeKey.Theatre, nameUa: 'Театр', cost: 80, maintenance: 2, prereqTech: 'humanism', effects: { content: 2 },
    descriptionUa: 'Вистави для всього міста: +2 задоволених.',
  },
  [BuildingTypeKey.Observatory]: {
    key: BuildingTypeKey.Observatory, nameUa: 'Обсерваторія', cost: 100, maintenance: 2, prereqTech: 'optics', effects: { science: 25 },
    descriptionUa: 'Телескоп під куполом: +25% науки.',
  },
  [BuildingTypeKey.CustomsHouse]: {
    key: BuildingTypeKey.CustomsHouse, nameUa: 'Митниця', cost: 80, maintenance: 1, prereqTech: 'navigation', coastal: true, effects: { gold: 20 },
    descriptionUa: 'Мита з кожного корабля: +20% золота (лише на узбережжі).',
  },
  [BuildingTypeKey.Foundry]: {
    key: BuildingTypeKey.Foundry, nameUa: 'Ливарня', cost: 100, maintenance: 2, prereqTech: 'metallurgy', requires: BuildingTypeKey.Workshop, effects: { shields: 20 },
    descriptionUa: 'Гармати й дзвони з бронзи та чавуну: ще +20% щитів (потрібна майстерня).',
  },
  [BuildingTypeKey.TownHall]: {
    key: BuildingTypeKey.TownHall, nameUa: 'Ратуша', cost: 80, maintenance: 1, prereqTech: 'banking', effects: { content: 1, gold: 10 },
    descriptionUa: 'Магістрат і міська рада: +1 задоволений, +10% золота.',
  },
  [BuildingTypeKey.TajMahal]: {
    key: BuildingTypeKey.TajMahal, nameUa: 'Тадж-Махал', cost: 450, maintenance: 0, prereqTech: 'humanism', isWonder: true, effects: { content: 3 }, globalEffects: { luxury: 50 },
    descriptionUa: 'Чудо світу. Біломармуровий мавзолей кохання: +50% розкоші в кожному вашому місті, тут — +3 задоволених.',
  },
  [BuildingTypeKey.Versailles]: {
    key: BuildingTypeKey.Versailles, nameUa: 'Версаль', cost: 450, maintenance: 0, prereqTech: 'economics', isWonder: true, globalEffects: { gold: 15 },
    descriptionUa: 'Чудо світу. Палац-місто короля-сонця: +15% золота в кожному вашому місті.',
  },
  [BuildingTypeKey.Uffizi]: {
    key: BuildingTypeKey.Uffizi, nameUa: 'Галерея Уффіці', cost: 400, maintenance: 0, prereqTech: 'printing_press', isWonder: true, effects: { luxury: 100 }, globalEffects: { science: 10 },
    descriptionUa: 'Чудо світу. Скарбниця Ренесансу: +10% науки в кожному вашому місті, тут — розкіш ×2.',
  },
  // Етап 10, Індустрія і XX століття
  [BuildingTypeKey.Cinema]: {
    key: BuildingTypeKey.Cinema, nameUa: 'Кінотеатр', cost: 100, maintenance: 2, prereqTech: 'photography', effects: { content: 2, luxury: 25 },
    descriptionUa: 'Кіно на великому екрані: +2 задоволених, +25% розкоші.',
  },
  [BuildingTypeKey.Hospital]: {
    key: BuildingTypeKey.Hospital, nameUa: 'Лікарня', cost: 120, maintenance: 2, prereqTech: 'antibiotics', effects: { content: 1, food: 15 },
    descriptionUa: 'Лікарі й антибіотики: +1 задоволений, +15% їжі (менше хвороб).',
  },
  [BuildingTypeKey.TvStation]: {
    key: BuildingTypeKey.TvStation, nameUa: 'Телевежа', cost: 120, maintenance: 2, prereqTech: 'television', effects: { content: 2 },
    descriptionUa: 'Новини й серіали в кожен дім: +2 задоволених.',
  },
  [BuildingTypeKey.RailwayStation]: {
    key: BuildingTypeKey.RailwayStation, nameUa: 'Вокзал', cost: 100, maintenance: 2, prereqTech: 'railroad', effects: { shields: 10, gold: 10, trade: 2 },
    descriptionUa: 'Потяги везуть товари й людей: +10% щитів і золота, +2 торгівлі.',
  },
  [BuildingTypeKey.DepartmentStore]: {
    key: BuildingTypeKey.DepartmentStore, nameUa: 'Універмаг', cost: 120, maintenance: 2, prereqTech: 'the_corporation', requires: BuildingTypeKey.Marketplace, effects: { gold: 20, content: 1 },
    descriptionUa: 'Усе під одним дахом: +20% золота, +1 задоволений (потрібен ринок).',
  },
  [BuildingTypeKey.Skyscraper]: {
    key: BuildingTypeKey.Skyscraper, nameUa: 'Хмарочос', cost: 160, maintenance: 3, prereqTech: 'mass_production', effects: { gold: 15, shields: 10 },
    descriptionUa: 'Офіси до хмар: +15% золота, +10% щитів.',
  },
  [BuildingTypeKey.GrainElevator]: {
    key: BuildingTypeKey.GrainElevator, nameUa: 'Зерновий елеватор', cost: 100, maintenance: 1, prereqTech: 'refrigeration', effects: { food: 15 },
    descriptionUa: 'Зерно не псується: +15% їжі.',
  },
  [BuildingTypeKey.BigBen]: {
    key: BuildingTypeKey.BigBen, nameUa: 'Біг-Бен', cost: 500, maintenance: 0, prereqTech: 'the_corporation', isWonder: true, effects: { content: 2 }, globalEffects: { gold: 10 },
    descriptionUa: 'Чудо світу. Годинник над парламентом, за яким звіряє час імперія: +10% золота в кожному вашому місті, тут — +2 задоволених.',
  },
  [BuildingTypeKey.Hollywood]: {
    key: BuildingTypeKey.Hollywood, nameUa: 'Голлівуд', cost: 600, maintenance: 0, prereqTech: 'television', isWonder: true, globalEffects: { content: 1, luxury: 25 },
    descriptionUa: 'Чудо світу. Фабрика мрій: у кожному вашому місті +1 задоволений і +25% розкоші.',
  },
  [BuildingTypeKey.PanamaCanal]: {
    key: BuildingTypeKey.PanamaCanal, nameUa: 'Панамський канал', cost: 550, maintenance: 0, prereqTech: 'steel', isWonder: true, effects: { gold: 50 }, globalEffects: { trade: 1 },
    descriptionUa: 'Чудо світу. Шлюзи між океанами: +1 торгівлі в кожному вашому місті, тут — +50% золота.',
  },
  // Етап 10, Сучасність і Майбутнє
  [BuildingTypeKey.GeneClinic]: {
    key: BuildingTypeKey.GeneClinic, nameUa: 'Генна клініка', cost: 160, maintenance: 2, prereqTech: 'genetic_engineering', effects: { content: 1, food: 10 },
    descriptionUa: 'Ліки під кожен геном: +1 задоволений, +10% їжі.',
  },
  [BuildingTypeKey.FusionPlant]: {
    key: BuildingTypeKey.FusionPlant, nameUa: 'Термоядерна станція', cost: 240, maintenance: 4, prereqTech: 'fusion', requires: BuildingTypeKey.Factory, effects: { shields: 35 },
    descriptionUa: 'Чиста енергія синтезу: ще +35% щитів (потрібна фабрика).',
  },
  [BuildingTypeKey.AiCenter]: {
    key: BuildingTypeKey.AiCenter, nameUa: 'Центр штучного інтелекту', cost: 200, maintenance: 3, prereqTech: 'artificial_intelligence', effects: { science: 40 },
    descriptionUa: 'Нейромережі ведуть дослідження: +40% науки.',
  },
  [BuildingTypeKey.Nanofactory]: {
    key: BuildingTypeKey.Nanofactory, nameUa: 'Нанофабрика', cost: 260, maintenance: 4, prereqTech: 'nanotechnology', requires: BuildingTypeKey.Factory, effects: { shields: 40 },
    descriptionUa: 'Наноботи збирають усе: ще +40% щитів (потрібна фабрика).',
  },
  [BuildingTypeKey.OceanHabitat]: {
    key: BuildingTypeKey.OceanHabitat, nameUa: 'Підводне місто', cost: 200, maintenance: 3, prereqTech: 'ocean_colonization', coastal: true, effects: { food: 25, content: 1 },
    descriptionUa: 'Квартали під куполами на дні: +25% їжі, +1 задоволений (лише на узбережжі).',
  },
  [BuildingTypeKey.Collider]: {
    key: BuildingTypeKey.Collider, nameUa: 'Великий адронний колайдер', cost: 700, maintenance: 0, prereqTech: 'superconductor', isWonder: true, globalEffects: { science: 20 },
    descriptionUa: 'Чудо світу. 27 кілометрів магнітів під землею: +20% науки в кожному вашому місті.',
  },
  [BuildingTypeKey.SeedVault]: {
    key: BuildingTypeKey.SeedVault, nameUa: 'Світове сховище насіння', cost: 500, maintenance: 0, prereqTech: 'genetic_engineering', isWonder: true, globalEffects: { food: 10 },
    descriptionUa: 'Чудо світу. Ковчег усіх рослин Землі у вічній мерзлоті: +10% їжі в кожному вашому місті.',
  },
  [BuildingTypeKey.SpaceElevator]: {
    key: BuildingTypeKey.SpaceElevator, nameUa: 'Космічний ліфт', cost: 900, maintenance: 0, prereqTech: 'nanotechnology', isWonder: true, globalEffects: { shields: 20 },
    descriptionUa: 'Чудо світу. Трос із нанотрубок до орбіти: +20% щитів у кожному вашому місті.',
  },
  // Етап 10, унікальні споруди цивілізацій: кожна будує лише свою
  [BuildingTypeKey.Sich]: {
    key: BuildingTypeKey.Sich, nameUa: 'Запорізька Січ', cost: 80, maintenance: 1, prereqTech: 'feudalism', civ: 'rus', effects: { content: 1, shields: 15 },
    descriptionUa: 'Унікальна споруда Русі. Козацька фортеця на острові за порогами: +1 задоволений, +15% щитів.',
  },
  [BuildingTypeKey.RomanRoads]: {
    key: BuildingTypeKey.RomanRoads, nameUa: 'Римські дороги', cost: 70, maintenance: 1, prereqTech: 'construction', civ: 'romans', effects: { trade: 2, gold: 10 },
    descriptionUa: 'Унікальна споруда Риму. Усі дороги ведуть до Риму: +2 торгівлі, +10% золота.',
  },
  [BuildingTypeKey.Obelisk]: {
    key: BuildingTypeKey.Obelisk, nameUa: 'Обеліск', cost: 50, maintenance: 1, prereqTech: 'ceremonial_burial', civ: 'egyptians', effects: { content: 2 },
    descriptionUa: 'Унікальна споруда Єгипту. Гранітна голка з ієрогліфами на славу фараона: +2 задоволених.',
  },
  [BuildingTypeKey.Academy]: {
    key: BuildingTypeKey.Academy, nameUa: 'Академія', cost: 80, maintenance: 1, prereqTech: 'philosophy', civ: 'greeks', effects: { science: 25, content: 1 },
    descriptionUa: 'Унікальна споруда Греції. Оливковий гай Платона, де сперечаються філософи: +25% науки, +1 задоволений.',
  },
  [BuildingTypeKey.Ziggurat]: {
    key: BuildingTypeKey.Ziggurat, nameUa: 'Зикурат', cost: 70, maintenance: 1, prereqTech: 'mysticism', civ: 'babylonians', effects: { science: 15, content: 1 },
    descriptionUa: 'Унікальна споруда Вавилону. Ступінчастий храм, з якого жерці стежать за зорями: +15% науки, +1 задоволений.',
  },
  [BuildingTypeKey.Kontor]: {
    key: BuildingTypeKey.Kontor, nameUa: 'Ганзейська контора', cost: 80, maintenance: 1, prereqTech: 'banking', civ: 'germans', effects: { gold: 25 },
    descriptionUa: 'Унікальна споруда Германії. Купецький двір Ганзи: +25% золота.',
  },
  [BuildingTypeKey.ExamHall]: {
    key: BuildingTypeKey.ExamHall, nameUa: 'Палата імператорських іспитів', cost: 70, maintenance: 1, prereqTech: 'literacy', civ: 'chinese', effects: { science: 15, gold: 10 },
    descriptionUa: 'Унікальна споруда Китаю. Тут обирають чиновників за знаннями: +15% науки, +10% золота.',
  },
  [BuildingTypeKey.HordePastures]: {
    key: BuildingTypeKey.HordePastures, nameUa: 'Пасовища орди', cost: 50, maintenance: 1, prereqTech: 'horseback_riding', civ: 'mongols', effects: { food: 15, shields: 10 },
    descriptionUa: 'Унікальна споруда Монголії. Безкраї степові пасовища: +15% їжі, +10% щитів.',
  },
  [BuildingTypeKey.Chinampas]: {
    key: BuildingTypeKey.Chinampas, nameUa: 'Чинампи', cost: 50, maintenance: 1, prereqTech: 'pottery', civ: 'aztecs', effects: { food: 20 },
    descriptionUa: 'Унікальна споруда ацтеків. Плавучі сади на озері: +20% їжі.',
  },
  [BuildingTypeKey.RoyalDockyard]: {
    key: BuildingTypeKey.RoyalDockyard, nameUa: 'Королівська верф', cost: 80, maintenance: 1, prereqTech: 'navigation', civ: 'english', coastal: true, effects: { shields: 20, gold: 10 },
    descriptionUa: 'Унікальна споруда Англії. Тут будують флот, що править морями: +20% щитів, +10% золота (лише на узбережжі).',
  },
  // Етап 10, друга хвиля
  [BuildingTypeKey.FishingWharf]: {
    key: BuildingTypeKey.FishingWharf, nameUa: 'Рибальська пристань', cost: 50, maintenance: 1, prereqTech: 'map_making', coastal: true, effects: { food: 10, trade: 1 },
    descriptionUa: 'Човни й сіті: +10% їжі, +1 торгівлі (лише на узбережжі).',
  },
  [BuildingTypeKey.CityPark]: {
    key: BuildingTypeKey.CityPark, nameUa: 'Міський парк', cost: 80, maintenance: 1, prereqTech: 'sanitation', effects: { content: 1, luxury: 25 },
    descriptionUa: 'Алеї, фонтани й лавки: +1 задоволений, +25% розкоші.',
  },
  [BuildingTypeKey.Stadium]: {
    key: BuildingTypeKey.Stadium, nameUa: 'Стадіон', cost: 140, maintenance: 3, prereqTech: 'the_corporation', effects: { content: 3 },
    descriptionUa: 'Футбол щонеділі: +3 задоволених.',
  },
  [BuildingTypeKey.Zoo]: {
    key: BuildingTypeKey.Zoo, nameUa: 'Зоопарк', cost: 90, maintenance: 2, prereqTech: 'theology', effects: { content: 1, science: 10 },
    descriptionUa: 'Звірі з усіх континентів: +1 задоволений, +10% науки.',
  },
  [BuildingTypeKey.ContainerPort]: {
    key: BuildingTypeKey.ContainerPort, nameUa: 'Контейнерний термінал', cost: 160, maintenance: 3, prereqTech: 'mass_production', coastal: true, effects: { gold: 25, shields: 10 },
    descriptionUa: 'Крани й тисячі контейнерів: +25% золота, +10% щитів (лише на узбережжі).',
  },
  [BuildingTypeKey.VerticalFarm]: {
    key: BuildingTypeKey.VerticalFarm, nameUa: 'Вертикальна ферма', cost: 180, maintenance: 3, prereqTech: 'robotics', effects: { food: 20 },
    descriptionUa: 'Грядки поверхами під світлодіодами: +20% їжі.',
  },
  [BuildingTypeKey.ChichenItza]: {
    key: BuildingTypeKey.ChichenItza, nameUa: 'Чичен-Іца', cost: 300, maintenance: 0, prereqTech: 'astronomy', isWonder: true, effects: { science: 25 }, globalEffects: { luxury: 25 },
    descriptionUa: 'Чудо світу. Піраміда-календар майя: +25% розкоші в кожному вашому місті, тут — +25% науки.',
  },
  [BuildingTypeKey.TerracottaArmy]: {
    key: BuildingTypeKey.TerracottaArmy, nameUa: 'Теракотова армія', cost: 300, maintenance: 0, prereqTech: 'iron_working', isWonder: true, globalEffects: { shields: 10 },
    descriptionUa: 'Чудо світу. Вісім тисяч глиняних воїнів імператора: +10% щитів у кожному вашому місті.',
  },
  [BuildingTypeKey.KyivLavra]: {
    key: BuildingTypeKey.KyivLavra, nameUa: 'Києво-Печерська лавра', cost: 450, maintenance: 0, prereqTech: 'theology', isWonder: true, effects: { science: 25 }, globalEffects: { content: 1 },
    descriptionUa: 'Чудо світу. Печери, золоті бані й друкарня над Дніпром: +1 задоволений у кожному вашому місті, тут — +25% науки.',
  },
  [BuildingTypeKey.SpaceStation]: {
    key: BuildingTypeKey.SpaceStation, nameUa: 'Міжнародна космічна станція', cost: 700, maintenance: 0, prereqTech: 'space_flight', isWonder: true, globalEffects: { science: 15 },
    descriptionUa: 'Чудо світу. Лабораторія на орбіті, спільна для всіх народів: +15% науки в кожному вашому місті.',
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
  seafaring: { id: 'seafaring', nameUa: 'Мореплавство', era: 1, prereqs: ['pottery', 'map_making'], descriptionUa: 'Далекі береги кличуть: дослідники й нові мапи.' },
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
  polytheism: { id: 'polytheism', nameUa: 'Політеїзм', era: 1, prereqs: ['horseback_riding', 'mysticism'], descriptionUa: 'Боги війни й бойові слони.' },
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
  leadership: { id: 'leadership', nameUa: 'Лідерство', era: 3, prereqs: ['chivalry', 'gunpowder'], descriptionUa: 'Офіцери ведуть у бій кінноту з мушкетами.' },
  fundamentalism: { id: 'fundamentalism', nameUa: 'Фундаменталізм', era: 4, prereqs: ['monotheism', 'conscription'], descriptionUa: 'Віра як закон: покора замість свобод.' },
  conscription: { id: 'conscription', nameUa: 'Загальний призов', era: 3, prereqs: ['democracy', 'metallurgy'], descriptionUa: 'Армія з громадян.' },
  // Сучасність I: війни XX століття
  tactics: { id: 'tactics', nameUa: 'Тактика', era: 4, prereqs: ['conscription', 'leadership'], descriptionUa: 'Маневр і рельєф як зброя: гірська піхота.' },
  espionage: { id: 'espionage', nameUa: 'Шпигунство', era: 4, prereqs: ['democracy', 'tactics'], descriptionUa: 'Розвідка стає професією.' },
  amphibious_warfare: { id: 'amphibious_warfare', nameUa: 'Десантні операції', era: 4, prereqs: ['navigation', 'tactics'], descriptionUa: 'Штурм узбережжя просто з кораблів.' },
  guerrilla_warfare: { id: 'guerrilla_warfare', nameUa: 'Партизанська війна', era: 4, prereqs: ['communism', 'tactics'], descriptionUa: 'Окуповані землі не скоряються.' },
  refrigeration: { id: 'refrigeration', nameUa: 'Холодильники', era: 4, prereqs: ['electricity', 'sanitation'], descriptionUa: 'Їжа не псується: супермаркети й ферми.' },
  communism: { id: 'communism', nameUa: 'Комунізм', era: 4, prereqs: ['philosophy', 'industrialization'], descriptionUa: 'Держава робітників: відкриває устрій Комунізм.' },
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
  recycling: { id: 'recycling', nameUa: 'Переробка', era: 4, prereqs: ['mass_production', 'democracy'], descriptionUa: 'Вторсировина замість звалищ: менше смогу від заводів.' },
  machine_tools: { id: 'machine_tools', nameUa: 'Верстати', era: 4, prereqs: ['steel', 'conscription'], descriptionUa: 'Точні верстати: далекобійні гармати.' },
  mobile_warfare: { id: 'mobile_warfare', nameUa: 'Мобільна війна', era: 4, prereqs: ['automobile', 'machine_tools'], descriptionUa: 'Бліцкриг: броня і мотори.' },
  labor_union: { id: 'labor_union', nameUa: 'Профспілки', era: 4, prereqs: ['mass_production', 'communism'], descriptionUa: 'Робітники об\'єднуються: армія на колесах.' },
  // Сучасність II: небо й атом
  atomic_theory: { id: 'atomic_theory', nameUa: 'Атомна теорія', era: 5, prereqs: ['theory_of_gravity', 'electronics'], descriptionUa: 'Атом ділиться: ядро, електрони, нейтрони.' },
  flight: { id: 'flight', nameUa: 'Польоти', era: 5, prereqs: ['combustion', 'theory_of_gravity'], descriptionUa: 'Людина в небі.' },
  radio: { id: 'radio', nameUa: 'Радіо', era: 5, prereqs: ['flight', 'electronics'], descriptionUa: 'Голос в ефірі, диспетчери аеродромів.' },
  advanced_flight: { id: 'advanced_flight', nameUa: 'Реактивна авіація', era: 5, prereqs: ['radio', 'machine_tools'], descriptionUa: 'Важкі бомбардувальники й палубна авіація.' },
  nuclear_fission: { id: 'nuclear_fission', nameUa: 'Ядерний розпад', era: 5, prereqs: ['atomic_theory', 'mass_production'], descriptionUa: 'Ланцюгова реакція: енергія — і загроза — небачені досі.' },
  nuclear_power: { id: 'nuclear_power', nameUa: 'Ядерна енергетика', era: 5, prereqs: ['nuclear_fission', 'electronics'], descriptionUa: 'Атом на службі міст і флоту: кораблі +1 рух.' },
  rocketry: { id: 'rocketry', nameUa: 'Ракетобудування', era: 5, prereqs: ['advanced_flight', 'nuclear_fission'], descriptionUa: 'Ракети далекого радіуса — з будь-якою боєголовкою.' },
  // Космічна гонка
  combined_arms: { id: 'combined_arms', nameUa: 'Взаємодія родів військ', era: 5, prereqs: ['mobile_warfare', 'advanced_flight'], descriptionUa: 'Десант із неба й гелікоптери над полем бою.' },
  miniaturization: { id: 'miniaturization', nameUa: 'Мініатюризація', era: 5, prereqs: ['machine_tools', 'electronics'], descriptionUa: 'Малі й точні механізми: видобуток у морі.' },
  computers: { id: 'computers', nameUa: 'Комп\'ютери', era: 6, prereqs: ['radio', 'machine_tools'], descriptionUa: 'Машини, що рахують швидше за всіх математиків світу.' },
  space_flight: { id: 'space_flight', nameUa: 'Космічні польоти', era: 6, prereqs: ['computers', 'rocketry'], descriptionUa: 'Людина на орбіті — і далі, до зірок.' },
  plastics: { id: 'plastics', nameUa: 'Пластмаси', era: 6, prereqs: ['refining', 'space_flight'], descriptionUa: 'Легкі й міцні матеріали для ракетних двигунів.' },
  superconductor: { id: 'superconductor', nameUa: 'Надпровідники', era: 6, prereqs: ['plastics', 'nuclear_power'], descriptionUa: 'Струм без втрат: системи життєзабезпечення для зорельота.' },
  robotics: { id: 'robotics', nameUa: 'Робототехніка', era: 6, prereqs: ['mobile_warfare', 'computers'], descriptionUa: 'Роботи на конвеєрах: заводи нового покоління.' },
  stealth: { id: 'stealth', nameUa: 'Технологія стелс', era: 6, prereqs: ['superconductor', 'robotics'], descriptionUa: 'Літаки, яких не бачать радари.' },
  environmentalism: { id: 'environmentalism', nameUa: 'Екологія', era: 6, prereqs: ['recycling', 'space_flight'], descriptionUa: 'Енергія сонця замість диму.' },
  genetic_engineering: { id: 'genetic_engineering', nameUa: 'Генна інженерія', era: 6, prereqs: ['medicine', 'computers'], descriptionUa: 'Ключ до коду життя.' },
  // Етап 10, Античність
  herbalism: { id: 'herbalism', nameUa: 'Травництво', era: 1, prereqs: ['ceremonial_burial', 'pottery'], descriptionUa: 'Цілющі трави, настої й перші лікарі.' },
  architecture: { id: 'architecture', nameUa: 'Архітектура', era: 2, prereqs: ['construction', 'mathematics'], descriptionUa: 'Арки, склепіння й колонади.' },
  guilds: { id: 'guilds', nameUa: 'Цехи', era: 2, prereqs: ['trade', 'feudalism'], descriptionUa: 'Майстри об\'єднуються й бережуть секрети ремесла.' },
  // Етап 10, Середньовіччя і Новий час
  printing_press: { id: 'printing_press', nameUa: 'Друкарство', era: 3, prereqs: ['invention', 'monotheism'], descriptionUa: 'Рухомі літери: книги для всіх.' },
  humanism: { id: 'humanism', nameUa: 'Гуманізм', era: 3, prereqs: ['philosophy', 'printing_press'], descriptionUa: 'Людина — міра всіх речей: мистецтво й театр.' },
  optics: { id: 'optics', nameUa: 'Оптика', era: 3, prereqs: ['physics', 'astronomy'], descriptionUa: 'Лінзи, підзорні труби й телескопи.' },
  // Етап 10, Індустрія і XX століття
  photography: { id: 'photography', nameUa: 'Фотографія', era: 4, prereqs: ['electricity', 'chemistry'], descriptionUa: 'Світлопис: мить, збережена назавжди, а згодом і кіно.' },
  antibiotics: { id: 'antibiotics', nameUa: 'Антибіотики', era: 5, prereqs: ['medicine', 'refrigeration'], descriptionUa: 'Пеніцилін перемагає інфекції.' },
  television: { id: 'television', nameUa: 'Телебачення', era: 5, prereqs: ['radio', 'mass_production'], descriptionUa: 'Блакитний екран у кожному домі.' },
  // Етап 10, Сучасність і Майбутнє
  lasers: { id: 'lasers', nameUa: 'Лазери', era: 6, prereqs: ['nuclear_power', 'superconductor'], descriptionUa: 'Світло, що ріже сталь.' },
  artificial_intelligence: { id: 'artificial_intelligence', nameUa: 'Штучний інтелект', era: 7, prereqs: ['computers', 'robotics'], descriptionUa: 'Машини, що вчаться самі.' },
  fusion: { id: 'fusion', nameUa: 'Термоядерний синтез', era: 7, prereqs: ['superconductor', 'lasers'], descriptionUa: 'Сонце в пляшці: майже безмежна чиста енергія.' },
  nanotechnology: { id: 'nanotechnology', nameUa: 'Нанотехнології', era: 7, prereqs: ['plastics', 'artificial_intelligence'], descriptionUa: 'Наноботи збирають речі атом за атомом.' },
  ocean_colonization: { id: 'ocean_colonization', nameUa: 'Колонізація океану', era: 7, prereqs: ['fusion', 'environmentalism'], descriptionUa: 'Міста під куполами на морському дні.' },
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
  communism: {
    key: 'communism', nameUa: 'Комунізм', prereqTech: 'communism', maxRate: 8, corruptionPerTile: 0, flatCorruption: 0.1, tilePenalty: false, tradeBonus: false, martialLaw: 3, freeUnits: 3, settlerFood: 1,
    descriptionUa: 'Корупція однакова в усіх містах (10%), хоч як далеко від столиці. Військові в місті заспокоюють до 3 невдоволених. Ставки до 80%.',
  },
  fundamentalism: {
    key: 'fundamentalism', nameUa: 'Фундаменталізм', prereqTech: 'fundamentalism', maxRate: 8, corruptionPerTile: 0.02, tilePenalty: false, tradeBonus: false, martialLaw: 0, freeUnits: 3, settlerFood: 1,
    noUnhappy: true, scienceFactor: 0.5, tithes: true,
    descriptionUa: 'Невдоволених нема зовсім. Храм, колізей і собор замість спокою дають золото (десятина). Наука вдвічі менша. Лише за цього устрою — Фанатики без утримання. Ставки до 80%.',
  },
  democracy: {
    key: 'democracy', nameUa: 'Демократія', prereqTech: 'democracy', maxRate: 9, corruptionPerTile: 0, tilePenalty: false, tradeBonus: true, martialLaw: 0, freeUnits: 0, settlerFood: 2, abroadUnhappy: 2,
    descriptionUa: '+1 торгівлі на клітинках, що вже її дають. Корупції немає. Ставки до 90%. Кожен військовий за кордоном — 2 невдоволених. Сенат приймає мир і не дає нападати першим.',
  },
  republic: {
    key: 'republic', nameUa: 'Республіка', prereqTech: 'the_republic', maxRate: 8, corruptionPerTile: 0.01, tilePenalty: false, tradeBonus: true, martialLaw: 0, freeUnits: 0, settlerFood: 2, abroadUnhappy: 1,
    descriptionUa: '+1 торгівлі на клітинках, що вже її дають. Найменша корупція. Ставки до 80%. Військовий стан не діє. Кожен військовий за кордоном — 1 невдоволений. Сенат сам приймає мир від суперників.',
  },
};

/** Глобальне потепління: межа лічильника — ~25 ходів по 20 забруднених клітинок понад норму. */
export const WARMING_LIMIT = 500;
