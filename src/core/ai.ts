/**
 * Штучний інтелект суперників у дусі Civ 1.
 * Кожен юніт має роль за типом: поселенці шукають місце для міста, робітники покращують землю,
 * захисники тримають гарнізони, атакувальники б'ють, коли шанси на їхньому боці.
 * Міста обирають виробництво за пріоритетами; дослідження — за чергою.
 */
import type { World } from './world';
import { City, Unit, UnitTypeKey, BuildingTypeKey, TerrainType, Player, GovernmentKey } from './types';
import { AGENTS, UNIT_CONFIGS, BUILDING_CONFIGS, TERRAIN_DATA, FAT_CROSS_OFFSETS, MAP_WIDTH, MAP_HEIGHT, GOVERNMENTS } from './constants';
import { tileYield, TerraformKind, checkTerraform } from './terraform';
import { TurnManager } from './turn-manager';
import { FleetAi } from './ai-fleet';

/** Черга досліджень: спершу оборона, їжа й порядок, далі гроші, знання, будівництво. */
const RESEARCH_ORDER = [
  'bronze_working', 'alphabet', 'ceremonial_burial', 'pottery', 'masonry', 'horseback_riding',
  'writing', 'map_making', 'currency', 'code_of_laws', 'iron_working', 'the_wheel', 'mathematics', 'mysticism',
  'literacy', 'construction', 'monarchy', 'warrior_code', 'trade', 'philosophy', 'astronomy', 'seafaring',
  'feudalism', 'the_republic', 'monotheism', 'university', 'bridge_building', 'banking', 'chivalry',
  'navigation', 'invention', 'gunpowder',
  'physics', 'medicine', 'economics', 'theory_of_gravity', 'democracy', 'metallurgy', 'magnetism',
  'steam_engine', 'railroad', 'industrialization', 'communism', 'chemistry', 'electricity', 'conscription', 'leadership',
  'the_corporation', 'steel', 'electronics', 'sanitation', 'explosives', 'refining', 'theology',
  'combustion', 'automobile', 'mass_production', 'recycling', 'machine_tools', 'mobile_warfare', 'labor_union',
  'atomic_theory', 'flight', 'nuclear_fission', 'nuclear_power', 'radio', 'advanced_flight', 'rocketry',
  'computers', 'space_flight', 'robotics', 'plastics', 'superconductor',
  // Гірська піхота й шпигуни — після космічних технологій: кожна зайва технологія дорожчає наступні, і космос не встигав до 2100
  'tactics', 'espionage', 'refrigeration', 'miniaturization', 'combined_arms', 'amphibious_warfare', 'guerrilla_warfare', 'genetic_engineering', 'environmentalism', 'stealth', 'fundamentalism',
];

/** Корабель, який AI вважає готовим до старту: 3 двигуни, 3 модулі, 6 каркасів (політ 14 р., успіх 100%). */
const SHIP_GOAL = { structural: 6, component: 3, module: 3 };

/** Скільки міст AI хоче мати (далі поселенців не будує). */
const MAX_CITIES = 10;
/** Мінімальна відстань між містами (як у Civ 1: «товстий хрест» сусідів перекривається трохи). */
const CITY_SPACING = 4;

type Step = { x: number; y: number };

export class AiController {
  private fleet: FleetAi;

  constructor(private world: World) {
    this.fleet = new FleetAi(world, this);
  }

  /** Повний хід одного AI-гравця: дослідження, виробництво, юніти. */
  public takeTurn(player: Player): void {
    this.world.diplomacy.aiTurn(player);
    this.chooseResearch(player);
    this.maybeLaunch(player);
    this.chooseGovernment(player);
    this.manageLuxury(player);
    this.manageTaxes(player);
    // Спершу рухаємо юніти (захисники заходять у міста), потім міста бачать реальні гарнізони
    for (const unit of [...this.world.units.values()]) {
      if (unit.playerId !== player.id || !this.world.units.has(unit.id) || unit.task) continue;
      this.moveUnit(unit);
    }
    for (const city of this.citiesOf(player.id)) this.chooseProduction(city);
    this.spendSurplus(player);
  }

  /**
   * Надлишок золота — на викуп: інакше до 1950-х AI копить 400–900 зл. без діла.
   * Лише з початим запасом щитів (з нуля — ціна ×2). Без чудес і частин корабля: інакше AI вигравав космос
   * на ~30 років раніше (медіана ~2000 н.е.), і людина з однаковими правилами вже не встигала.
   */
  private spendSurplus(player: Player): void {
    const w = this.world;
    const cities = this.citiesOf(player.id);
    const reserve = 60 + 15 * cities.length;
    const turn = w.turnManager.turnNumber;
    for (;;) {
      let best: City | undefined;
      let bestCost = Infinity;
      for (const c of cities) {
        if (c.shieldsStored === 0 || c.boughtTurn === turn) continue;
        const cfg = c.currentProduction.isBuilding ? BUILDING_CONFIGS[c.currentProduction.key as BuildingTypeKey] : undefined;
        if (cfg?.isWonder || cfg?.spacePart) continue;
        const cost = w.buyCost(c);
        if (cost > 0 && cost < bestCost) { best = c; bestCost = cost; }
      }
      if (!best || player.gold - bestCost < reserve || !w.buyProduction(best)) return;
    }
  }

  /** Податки: не йти в мінус через утримання; з великим запасом — більше на науку. */
  private manageTaxes(player: Player): void {
    const net = this.world.netIncome(player.id);
    if (net < 0) this.world.adjustRate(player.id, 'tax', 1);
    else if (net > 6 && player.gold > 150) this.world.adjustRate(player.id, 'tax', -1);
  }

  /**
   * Розкіш проти безладу: якщо хоч одне місто бунтує — +10% розкоші;
   * якщо можна зменшити розкіш і жодне місто не збунтується — −10%.
   */
  private manageLuxury(player: Player): void {
    const w = this.world;
    const cities = this.citiesOf(player.id);
    if (cities.some((c) => w.cityYields(c).disorder)) {
      w.adjustRate(player.id, 'lux', 1) || w.adjustRate(player.id, 'tax', -1);
      return;
    }
    if (player.luxuryRate > 0 && w.adjustRate(player.id, 'lux', -1)) {
      if (cities.some((c) => w.cityYields(c).disorder)) w.adjustRate(player.id, 'lux', 1);
    }
  }

  // ---------- Дослідження ----------

  public chooseResearch(player: Player): void {
    if (player.currentTechId) return;
    const available = new Set(TurnManager.getAvailableTechs(player).map((t) => t.id));
    // Навмання з трьох найближчих у черзі: у різних AI різні знання — є чим мінятися
    const next = RESEARCH_ORDER.filter((id) => available.has(id)).slice(0, 3);
    player.currentTechId = next.length ? next[Math.floor(Math.random() * next.length)] : [...available][0];
  }

  // ---------- Устрій ----------

  /** Войовничі лідери тримаються воєнного стану (Монархія, далі Комунізм), мирні йдуть до Республіки. */
  private chooseGovernment(player: Player): void {
    if (player.government === 'anarchy') return;
    const warlike = (player.hostileFromTurn ?? Infinity) <= 60;
    const wanted: GovernmentKey[] = warlike ? ['fundamentalism', 'communism', 'monarchy'] : ['democracy', 'republic', 'monarchy'];
    const target = wanted.find((g) => g === player.government || this.world.canAdopt(player.id, g));
    if (target && target !== player.government) this.world.startRevolution(player.id, target);
  }

  // ---------- Виробництво міст ----------

  public chooseProduction(city: City): void {
    const w = this.world;
    const player = w.players[city.playerId];
    const has = (b: BuildingTypeKey) => city.buildings.includes(b);
    // Чи потягне казна утримання нової споруди (запас золота покриє ~30 ходів мінусу)
    const income = w.netIncome(player.id);
    const affordable = (m: number) => m === 0 || income - m >= 0 || (income - m >= -3 && player.gold >= m * 40);
    // Храм дешевий і рятує від бунту, ринок сам приносить золото — їх будуємо завжди;
    // дорогі Колізей і Собор — лише якщо по кишені (інакше від невдоволення рятує розкіш)
    const essential = new Set([BuildingTypeKey.Temple, BuildingTypeKey.Marketplace, BuildingTypeKey.CityWalls]);
    const canBuild = (b: BuildingTypeKey) => {
      if (b === BuildingTypeKey.Palace) return false; // палац — окремим правилом нижче
      const cfg = BUILDING_CONFIGS[b];
      if (!essential.has(b) && !affordable(cfg.maintenance)) return false;
      return !has(b) && (!cfg.prereqTech || player.knownTechs.includes(cfg.prereqTech))
        && (!cfg.isWonder || !w.isWonderBuilt(b))
        && (!cfg.requires || has(cfg.requires))
        && (!cfg.coastal || this.isCoastal(city)) && (!cfg.highland || this.world.isHighland(city));
    };
    const set = (isBuilding: boolean, key: string) => {
      city.currentProduction = { isBuilding, key };
    };

    const yields = w.cityYields(city);
    const cities = this.citiesOf(player.id).length;
    const myUnits = [...w.units.values()].filter((u) => u.playerId === player.id);
    // Інженери замінюють робітників, шпигун — дипломата: рахуємо разом
    const count = (t: UnitTypeKey) => myUnits.filter((u) => u.type === t || (t === UnitTypeKey.Workers && u.type === UnitTypeKey.Engineers)
      || (t === UnitTypeKey.Diplomat && u.type === UnitTypeKey.Spy) || (t === UnitTypeKey.Caravan && u.type === UnitTypeKey.Freight)
      || (t === UnitTypeKey.Fighter && u.type === UnitTypeKey.StealthFighter) || (t === UnitTypeKey.Bomber && u.type === UnitTypeKey.StealthBomber)).length;
    const worker = player.knownTechs.includes('explosives') ? UnitTypeKey.Engineers : UnitTypeKey.Workers;
    const trader = player.knownTechs.includes('the_corporation') ? UnitTypeKey.Freight : UnitTypeKey.Caravan;
    const agent = player.knownTechs.includes('espionage') ? UnitTypeKey.Spy : UnitTypeKey.Diplomat;
    const military = myUnits.filter((u) => UNIT_CONFIGS[u.type].attack > 0).length;
    const armyFull = military >= cities * 2 + 2;
    // «Аполлон» — першим: без нього космічна гонка не встигає до 2100
    const wonder = canBuild(BuildingTypeKey.Apollo) ? BUILDING_CONFIGS[BuildingTypeKey.Apollo]
      : Object.values(BUILDING_CONFIGS).find((b) => b.isWonder && canBuild(b.key));
    const garrison = this.garrisonAt(city);
    const threat = this.threatNear(city.x, city.y, player.id, 7);
    const defender = this.bestUnit(player, 'defense');
    const attacker = this.bestUnit(player, 'attack');
    const hostile = this.isHostilePhase(player);

    if (garrison < 1) {
      set(false, defender);
      // Порожнє місто під загрозою — викуповуємо захисника (так варвари брали більшість міст)
      if (threat) {
        w.buyProduction(city);
        const u = w.completeUnitNow(city);
        if (u) u.isFortified = true;
      }
      return;
    }
    // Палац втрачено — відбудовуємо в найбільшому місті (як у Civ 1)
    const allCities = this.citiesOf(player.id);
    const hasPalace = allCities.some((c) => c.buildings.includes(BuildingTypeKey.Palace));
    // Єдине бідне місто будувало б палац (200 щитів) століттями замість оборони
    if (!hasPalace && (allCities.length >= 2 || yields.shields >= 4) && city === allCities.reduce((a, b) => (b.size > a.size ? b : a))) return set(true, BuildingTypeKey.Palace);
    if ((yields.disorder || city.size >= 4) && canBuild(BuildingTypeKey.Temple)) return set(true, BuildingTypeKey.Temple);
    if (threat && garrison < 2) return set(false, defender);
    // Пасажири чекають на пором — будуємо, якщо поромів бракує
    if (this.isCoastal(city) && yields.shields >= 2 && this.fleet.needsFerry(player.id)) {
      const ferry = this.bestShip(player, 'ferry');
      if (ferry) return set(false, ferry);
    }
    if ((yields.unhappy > 0 || yields.entertainers > 1) && canBuild(BuildingTypeKey.Colosseum)) return set(true, BuildingTypeKey.Colosseum);
    if ((yields.unhappy > 0 || yields.entertainers > 1) && canBuild(BuildingTypeKey.Cathedral)) return set(true, BuildingTypeKey.Cathedral);
    if (city.size >= 3 && canBuild(BuildingTypeKey.Harbour)) return set(true, BuildingTypeKey.Harbour);
    // Розвідка морем: без неї цивілізації з різних континентів знайомились лише ~1800 н.е.
    if (this.isCoastal(city) && yields.shields >= 2 && cities >= 2 && this.fleet.needsScout(player.id)) {
      const scout = this.bestShip(player, 'ferry');
      if (scout) return set(false, scout);
    }
    // Поселенці їдять: місто без надлишку їжі одразу їх розпустить (60 щитів у нікуди)
    const fedSettlers = yields.foodSurplus >= GOVERNMENTS[player.government].settlerFood;
    const capitalOnWonders = has(BuildingTypeKey.Palace) && cities >= 3 && !!wonder;
    if (cities + count(UnitTypeKey.Settlers) < MAX_CITIES && count(UnitTypeKey.Settlers) < 2 && city.size >= 2 && !threat && !capitalOnWonders && fedSettlers) {
      return set(false, UnitTypeKey.Settlers);
    }
    // Дослідник: дешевий і швидкий — знаходить хатки й сусідів раніше за воїнів
    if (player.knownTechs.includes('seafaring') && count(UnitTypeKey.Explorer) < 1 && cities <= 6 && this.unexploredNear(city, player.id)) {
      return set(false, UnitTypeKey.Explorer);
    }
    // Робітники: від двох міст, а єдиному місту, що не росте, — одразу (зрошення)
    if ((cities >= 2 || yields.foodSurplus <= 0) && count(UnitTypeKey.Workers) < Math.ceil(cities / 2)) return set(false, worker);
    if (garrison < this.garrisonNeed(city)) return set(false, defender);
    // Лише Ополчення в гарнізоні — рання навала варварів забирала такі міста одне за одним
    if (defender !== UnitTypeKey.Militia && !this.hasRealDefender(city)) return set(false, defender);
    if (threat && canBuild(BuildingTypeKey.CityWalls)) return set(true, BuildingTypeKey.CityWalls);
    if (canBuild(BuildingTypeKey.CoastalDefense) && this.enemyFleetNear(city, player.id)) return set(true, BuildingTypeKey.CoastalDefense);
    if (yields.abroadUnhappy > 0 && canBuild(BuildingTypeKey.PoliceStation)) return set(true, BuildingTypeKey.PoliceStation);
    // Ворог має ядерні ракети — великі міста ставлять протиракетну оборону
    if (city.size >= 8 && canBuild(BuildingTypeKey.SdiDefense)
      && [...w.units.values()].some((u) => u.type === UnitTypeKey.Nuclear && w.diplomacy.atWar(player.id, u.playerId))) {
      return set(true, BuildingTypeKey.SdiDefense);
    }
    if (city.size >= 5 && garrison < 2) return set(false, defender);
    if (city.size >= 9 && canBuild(BuildingTypeKey.Aqueduct)) return set(true, BuildingTypeKey.Aqueduct);
    if (city.size >= 15 && canBuild(BuildingTypeKey.Sewer)) return set(true, BuildingTypeKey.Sewer);
    // Ворожа авіація — ЗРК у великих містах
    if (city.size >= 8 && canBuild(BuildingTypeKey.SamBattery) && [...w.units.values()].some((u) => UNIT_CONFIGS[u.type].domain === 'air'
      && u.type !== UnitTypeKey.Nuclear && w.diplomacy.atWar(player.id, u.playerId))) return set(true, BuildingTypeKey.SamBattery);
    if (city.size >= 10 && canBuild(BuildingTypeKey.Supermarket)) return set(true, BuildingTypeKey.Supermarket);
    if (city.size >= 12 && canBuild(BuildingTypeKey.Superhighways)) return set(true, BuildingTypeKey.Superhighways);
    if (yields.shields < 15 && canBuild(BuildingTypeKey.OffshorePlatform)
      && city.workedTiles.filter((p) => w.tiles[p.y][p.x].terrain === TerrainType.Ocean).length >= 4) return set(true, BuildingTypeKey.OffshorePlatform);
    // З автомобілями великі міста димлять — метро й трамваї
    if (city.size >= 12 && player.knownTechs.includes('automobile') && canBuild(BuildingTypeKey.MassTransit)) return set(true, BuildingTypeKey.MassTransit);
    // Фабрика з понад 20 щитами вже димить
    if (has(BuildingTypeKey.Factory) && yields.shieldsGross > 20 && canBuild(BuildingTypeKey.RecyclingCenter)) return set(true, BuildingTypeKey.RecyclingCenter);
    if (wonder && has(BuildingTypeKey.Palace) && !threat && garrison >= 2 && city.size >= 3 && cities >= 3) return set(true, wonder.key);
    // Космічна гонка: столиця й продуктивні міста (від 10 щитів) будують частини корабля
    if ((has(BuildingTypeKey.Palace) || yields.shields >= 10) && city.size >= 5 && !threat) {
      const part = this.nextSpacePart(player, city);
      if (part) return set(true, part);
    }
    for (const b of [BuildingTypeKey.Granary, BuildingTypeKey.Library, BuildingTypeKey.Marketplace, BuildingTypeKey.University, BuildingTypeKey.Bank, BuildingTypeKey.StockExchange, BuildingTypeKey.ResearchLab]) {
      if (city.size >= 3 && canBuild(b)) return set(true, b);
    }
    // Індустрія — лише великим містам (утримання й забруднення)
    // Електростанції — одна з трьох (бонус не додається); ГЕС і АЕС чистіші
    const power = has(BuildingTypeKey.PowerPlant) || has(BuildingTypeKey.NuclearPlant) || has(BuildingTypeKey.HydroPlant) || has(BuildingTypeKey.SolarPlant);
    for (const b of [BuildingTypeKey.Factory, BuildingTypeKey.SolarPlant, BuildingTypeKey.HydroPlant, BuildingTypeKey.NuclearPlant, BuildingTypeKey.PowerPlant]) {
      if (b !== BuildingTypeKey.Factory && power) continue;
      if (city.size >= 8 && canBuild(b)) return set(true, b);
    }
    // Завод дорогий в утриманні — лише містам, що вже дають багато щитів
    if (yields.shieldsGross > 25 && canBuild(BuildingTypeKey.MfgPlant)) return set(true, BuildingTypeKey.MfgPlant);
    if (yields.corruption >= 2 && canBuild(BuildingTypeKey.Courthouse)) return set(true, BuildingTypeKey.Courthouse);
    // Войовничі готують ветеранів у великих містах
    if (hostile && city.size >= 4 && canBuild(BuildingTypeKey.Barracks)) return set(true, BuildingTypeKey.Barracks);
    if (hostile && city.size >= 8 && canBuild(BuildingTypeKey.PortFacility)) return set(true, BuildingTypeKey.PortFacility);
    // Утримання: нові війська — лише там, де лишаються щити після утримання
    const canUpkeep = yields.shields >= 3;
    // Дипломат — знайомитись і відкривати посольства; з повною скарбницею на війні — підкуповувати міста
    const bribe = hostile && player.gold >= 600;
    if (canUpkeep && city.size >= 3 && player.knownTechs.includes('writing') && count(UnitTypeKey.Diplomat) < 1 && (this.needEmbassy(player).length || bribe)) {
      return set(false, agent);
    }
    if (hostile && !armyFull && canUpkeep && count(attacker as UnitTypeKey) < Math.ceil(cities / 2)) return set(false, attacker);
    // Флот і авіація для войовничих і тих, кому загрожують
    const ships = myUnits.filter((u) => this.isWarship(u.type)).length;
    const ports = allCities.filter((c) => this.isCoastal(c)).length;
    if (hostile && canUpkeep && city.size >= 6 && this.isCoastal(city) && ships < Math.min(3, Math.ceil(ports / 2))) {
      // Проти ворожої авіації — крейсер AEGIS, інакше найсильніший за атакою
      const enemyAir = player.knownTechs.includes('rocketry') && count(UnitTypeKey.AegisCruiser) < 1
        && [...w.units.values()].some((u) => UNIT_CONFIGS[u.type].domain === 'air' && w.diplomacy.atWar(player.id, u.playerId));
      const warship = enemyAir ? UnitTypeKey.AegisCruiser : this.bestShip(player, 'war');
      if (warship) return set(false, warship);
    }
    if (canUpkeep && city.size >= 8 && (threat || hostile) && player.knownTechs.includes('flight') && count(UnitTypeKey.Fighter) < Math.ceil(cities / 3)) {
      return set(false, player.knownTechs.includes('stealth') ? UnitTypeKey.StealthFighter : UnitTypeKey.Fighter);
    }
    if (hostile && canUpkeep && city.size >= 8 && player.knownTechs.includes('combined_arms')) {
      if (count(UnitTypeKey.Helicopter) < Math.ceil(cities / 4)) return set(false, UnitTypeKey.Helicopter);
      if (count(UnitTypeKey.Paratroopers) < 2) return set(false, UnitTypeKey.Paratroopers);
    }
    if (hostile && canUpkeep && this.isCoastal(city) && player.knownTechs.includes('amphibious_warfare') && count(UnitTypeKey.Marines) < 2) {
      return set(false, UnitTypeKey.Marines);
    }
    if (hostile && canUpkeep && city.size >= 8 && player.knownTechs.includes('rocketry') && count(UnitTypeKey.CruiseMissile) < Math.ceil(cities / 4)) {
      return set(false, UnitTypeKey.CruiseMissile);
    }
    if (hostile && canUpkeep && city.size >= 8 && player.knownTechs.includes('advanced_flight') && count(UnitTypeKey.Bomber) < Math.ceil(cities / 4)) {
      return set(false, player.knownTechs.includes('stealth') ? UnitTypeKey.StealthBomber : UnitTypeKey.Bomber);
    }
    if (cities < MAX_CITIES && city.size >= 2 && fedSettlers) return set(false, UnitTypeKey.Settlers);
    // Армії досить — будуємо місто: решта доступних споруд
    for (const b of [BuildingTypeKey.CityWalls, BuildingTypeKey.Colosseum, BuildingTypeKey.Aqueduct, BuildingTypeKey.Courthouse]) {
      if (canBuild(b) && (b !== BuildingTypeKey.Aqueduct || city.size >= 7)) return set(true, b);
    }
    // Чудеса: столиця сама, решта міст везуть каравани
    if (wonder && (has(BuildingTypeKey.Palace) || cities < 3)) return set(true, wonder.key);
    // Каравани — лише коли якесь місто справді будує чудо, і не більше трьох
    const wonderSite = allCities.some((c) => c.currentProduction.isBuilding && BUILDING_CONFIGS[c.currentProduction.key as BuildingTypeKey]?.isWonder);
    if (wonderSite && player.knownTechs.includes('trade') && count(UnitTypeKey.Caravan) < 3) return set(false, trader);
    if (wonder && city.size >= 5) return set(true, wonder.key);
    if (!armyFull && canUpkeep) return set(false, hostile ? attacker : defender);
    // Армії досить: щити — у чудеса (як любить AI Civ 1), інакше корисне без утримання
    if (wonder) return set(true, wonder.key);
    if (count(UnitTypeKey.Workers) < cities) return set(false, worker);
    if (cities < 14 && city.size >= 3 && fedSettlers) return set(false, UnitTypeKey.Settlers);
    // Юніти коштують утримання — тож наостанок краще будь-яка ще не збудована споруда
    const leftover = Object.values(BUILDING_CONFIGS)
      .filter((b) => !b.isWonder && !b.spacePart && !b.coinage && b.key !== BuildingTypeKey.Palace && !has(b.key)
        && (!b.prereqTech || player.knownTechs.includes(b.prereqTech)) && (!b.requires || has(b.requires)) && (!b.coastal || this.isCoastal(city)) && (!b.highland || this.world.isHighland(city)))
      .sort((a, b) => a.maintenance - b.maintenance || a.cost - b.cost)[0];
    if (leftover && affordable(leftover.maintenance)) return set(true, leftover.key);
    // Запас на чудеса, а між ними — торгові маршрути
    if (player.knownTechs.includes('trade') && count(UnitTypeKey.Caravan) < Math.max(3, Math.ceil(cities / 3))) return set(false, trader);
    // Без межі міста, яким нічого будувати, клепали робітників сотнями (107 на 18 міст)
    if (count(UnitTypeKey.Workers) < cities * 2) return set(false, worker);
    // Нічого корисного не лишилось — щити в золото, а не в юніти, що їдять утримання
    if (player.knownTechs.includes('the_corporation')) return set(true, BuildingTypeKey.Coinage);
    // Караван без чуда сам розпуститься за 20 ходів — тож не накопичується, як робітники
    return set(false, player.knownTechs.includes('trade') ? trader : defender);
  }

  /**
   * Яку частину корабля будувати: спершу каркас під уже заплановане, далі модулі, двигуни, решта каркасів.
   * Частини, що вже будуються в інших містах, рахуємо як готові — щоб не перебудувати.
   */
  private nextSpacePart(player: Player, city: City): BuildingTypeKey | undefined {
    const w = this.world;
    const ship = w.spaceship(player.id);
    const plan = { structural: ship.structural, component: ship.component, module: ship.module };
    const keyOf = { structural: BuildingTypeKey.SpaceStructural, component: BuildingTypeKey.SpaceComponent, module: BuildingTypeKey.SpaceModule };
    for (const c of this.citiesOf(player.id)) {
      if (c === city || !c.currentProduction.isBuilding) continue;
      const part = BUILDING_CONFIGS[c.currentProduction.key as BuildingTypeKey]?.spacePart;
      if (part) plan[part]++;
    }
    const can = (k: 'structural' | 'component' | 'module') => w.canBuildSpacePart(player.id, keyOf[k]);
    if (plan.structural < Math.min(SHIP_GOAL.structural, plan.component + plan.module + 1) && can('structural')) return keyOf.structural;
    if (plan.module < SHIP_GOAL.module && can('module')) return keyOf.module;
    if (plan.component < SHIP_GOAL.component && can('component')) return keyOf.component;
    if (plan.structural < SHIP_GOAL.structural && can('structural')) return keyOf.structural;
    return undefined;
  }

  /** Старт: коли корабель зібраний за планом, або суперник уже летить, або час спливає. */
  private maybeLaunch(player: Player): void {
    const w = this.world;
    if (w.launchProblem(player.id)) return;
    const s = w.spaceship(player.id);
    const ready = s.module >= SHIP_GOAL.module && s.component >= SHIP_GOAL.component;
    const rivalFlying = w.players.some((p) => p.id !== player.id && p.spaceship?.arrivalYear !== undefined);
    const late = w.turnManager.year >= 2050; // інакше не долетить до 2100
    if (ready || (rivalFlying && s.module >= 2) || late) w.launchSpaceship(player.id);
  }

  private isWarship(type: UnitTypeKey): boolean {
    const u = UNIT_CONFIGS[type];
    return u.domain === 'sea' && !u.capacity && !u.airCapacity && u.attack >= 4;
  }

  /** Найкращий доступний корабель: пором (більше місця) чи бойовий (сильніша атака). */
  private bestShip(player: Player, kind: 'ferry' | 'war'): UnitTypeKey | undefined {
    const ships = Object.values(UNIT_CONFIGS).filter((u) => u.domain === 'sea' && (!u.prereqTech || player.knownTechs.includes(u.prereqTech)));
    const list = kind === 'ferry'
      ? ships.filter((u) => (u.capacity ?? 0) > 0).sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0) || b.moves - a.moves)
      : ships.filter((u) => this.isWarship(u.key) && u.key !== UnitTypeKey.Submarine).sort((a, b) => b.attack - a.attack);
    return list[0]?.key;
  }

  /** Найкращий доступний сухопутний юніт за атакою або обороною. */
  private bestUnit(player: Player, by: 'attack' | 'defense'): UnitTypeKey {
    const units = Object.values(UNIT_CONFIGS).filter(
      (u) => u.domain === 'land' && u.attack > 0 && (!u.prereqTech || player.knownTechs.includes(u.prereqTech))
        && (!u.requiresGovernment || u.requiresGovernment === player.government)
    );
    const pool = units.filter((u) => (by === 'attack' ? u.attack > u.defense : u.defense >= u.attack));
    const list = pool.length ? pool : units;
    // Рівні за обороною — беремо Пікінерів (бонус проти вершників)
    const def = (u: { key: UnitTypeKey; defense: number }) => u.defense + (u.key === UnitTypeKey.Pikemen ? 0.5 : 0);
    // Рівні за атакою — беремо міцнішого (Танки, а не Артилерію)
    list.sort((a, b) => (by === 'attack' ? b.attack - a.attack || b.defense - a.defense : def(b) - def(a)) || a.cost - b.cost);
    return list[0]?.key ?? UnitTypeKey.Militia;
  }

  // ---------- Юніти ----------

  private moveUnit(unit: Unit): void {
    const cfg = UNIT_CONFIGS[unit.type];
    if (unit.carriedBy && cfg.domain === 'land') return; // пасажир: ним керує пором
    if (unit.aiMission && this.fleet.awaitFerry(unit)) return;
    if (unit.type === UnitTypeKey.Settlers) return this.settle(unit);
    if (unit.type === UnitTypeKey.Workers || unit.type === UnitTypeKey.Engineers) return this.work(unit);
    if (cfg.wonderShields) return this.caravan(unit);
    if (cfg.hover) return this.attack(unit); // гелікоптер воює, як наземний ударний загін
    if (AGENTS.has(unit.type)) return this.diplomat(unit);
    if (unit.type === UnitTypeKey.Explorer) return this.scoutLand(unit);
    if (cfg.domain === 'air') return this.fleet.moveAir(unit);
    if (cfg.domain === 'sea') return this.fleet.moveShip(unit);
    if (cfg.attack > cfg.defense) return this.attack(unit);
    return this.defend(unit);
  }

  /** Поселенці: обрати місце, дійти, заснувати. Перше місто — одразу на місці (як AI у Civ 1). */
  private settle(unit: Unit): void {
    const w = this.world;
    const noCities = this.citiesOf(unit.playerId).length === 0;
    if (noCities && this.canFoundAt(unit.x, unit.y)) {
      const city = w.foundCity(unit.id);
      if (city) this.chooseProduction(city);
      return;
    }
    if (!unit.aiTarget || !this.canFoundAt(unit.aiTarget.x, unit.aiTarget.y)) unit.aiTarget = this.findCitySite(unit);
    if (!unit.aiTarget) {
      // На своєму суходолі тісно — за море, якщо є порт і кораблі
      const far = this.citiesOf(unit.playerId).length < MAX_CITIES ? this.fleet.overseasSite(unit) : undefined;
      if (far) {
        unit.aiMission = { kind: 'board', purpose: 'settle', target: far };
        this.fleet.awaitFerry(unit);
        return;
      }
      return this.work(unit); // місця нема — хай працює на землі
    }

    if (unit.x === unit.aiTarget.x && unit.y === unit.aiTarget.y) {
      const city = w.foundCity(unit.id);
      if (city) this.chooseProduction(city);
      return;
    }
    this.walkTo(unit, unit.aiTarget);
  }

  public canFoundAt(x: number, y: number): boolean {
    const t = this.world.tiles[y][x];
    if (t.terrain === TerrainType.Ocean || t.terrain === TerrainType.Glacier || t.cityId) return false;
    return ![...this.world.cities.values()].some((c) => this.world.distance(c.x, c.y, x, y) < CITY_SPACING);
  }

  /** Найкраще місце в радіусі 10: їжа, щити, торгівля «товстого хреста», річка, вихід до моря. */
  private findCitySite(unit: Unit): Step | undefined {
    let best: Step | undefined;
    let bestScore = -Infinity;
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        const y = unit.y + dy;
        if (y < 2 || y >= MAP_HEIGHT - 2) continue;
        const x = (unit.x + dx + MAP_WIDTH) % MAP_WIDTH;
        if (!this.canFoundAt(x, y)) continue;
        const score = this.siteScore(x, y) - Math.max(Math.abs(dx), Math.abs(dy)) * 1.5;
        if (score > bestScore && this.pathStep(unit, { x, y }) !== null) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  public siteScore(x: number, y: number): number {
    const tiles = this.world.tiles;
    let score = 0;
    let coast = false;
    for (const o of FAT_CROSS_OFFSETS) {
      const ty = y + o.dy;
      if (ty < 0 || ty >= MAP_HEIGHT) continue;
      const t = tiles[ty][(x + o.dx + MAP_WIDTH) % MAP_WIDTH];
      const v = tileYield(t);
      score += v.food * 2 + v.shields * 1.5 + v.trade;
      if (t.terrain === TerrainType.Ocean && Math.abs(o.dx) <= 1 && Math.abs(o.dy) <= 1) coast = true;
    }
    const center = tiles[y][x];
    if (center.hasRiver) score += 4;
    if (center.terrain === TerrainType.Grassland || center.terrain === TerrainType.Plains) score += 3;
    if (center.terrain === TerrainType.Hills) score += 2; // захист
    if (coast) score += 3;
    return score;
  }

  /**
   * Робітники: іригація, шахти, дороги на клітинках, які обробляють свої міста.
   * Необроблювані клітинки міста — лише під іригацію: зрошена рівнина сама приверне жителя
   * (інакше місто серед лісів і сухих рівнин століттями стояло на розмірі 2).
   */
  private work(unit: Unit): void {
    const w = this.world;
    // Де вже хтось працює — шукаємо іншу клітинку: інакше всі йшли на найближчу (22 на одній)
    const busy = (x: number, y: number) => w.tiles[y][x].unitIds.some((id) => id !== unit.id && !!w.units.get(id)?.task);
    const here = busy(unit.x, unit.y) ? undefined : this.bestTaskAt(unit, unit.x, unit.y);
    // Забруднену клітинку місто кидає обробляти — тож чистимо будь-яку в радіусі, інакше смог лишався навіки
    const anyInRadius = here === 'irrigation' || here === 'clean' || here === 'transform';
    if (here && (this.isWorkedByOwn(unit.playerId, unit.x, unit.y) || (anyInRadius && this.inOwnRadius(unit.playerId, unit.x, unit.y)))) {
      unit.aiWait = 0;
      w.startTask(unit.id, here);
      return;
    }
    let best: Step | undefined;
    let bestD = Infinity;
    for (const city of this.citiesOf(unit.playerId)) {
      for (const o of FAT_CROSS_OFFSETS) {
        const y = city.y + o.dy;
        if ((!o.dx && !o.dy) || y < 0 || y >= MAP_HEIGHT) continue;
        const pos = { x: (city.x + o.dx + MAP_WIDTH) % MAP_WIDTH, y };
        const worked = city.workedTiles.some((p) => p.x === pos.x && p.y === pos.y);
        const d = w.distance(unit.x, unit.y, pos.x, pos.y) + (worked ? 0 : 3);
        if (d >= bestD) continue;
        const task = this.bestTaskAt(unit, pos.x, pos.y);
        if (task && (worked || task === 'irrigation' || task === 'clean' || task === 'transform') && !busy(pos.x, pos.y)
          && w.tiles[pos.y][pos.x].unitIds.every((id) => w.units.get(id)?.playerId === unit.playerId)) {
          bestD = d;
          best = pos;
        }
      }
    }
    if (best) {
      unit.aiWait = 0;
      this.walkTo(unit, best);
      return;
    }
    // Роботи давно нема — зайвий робітник лише їсть щити утримання
    unit.aiWait = (unit.aiWait ?? 0) + 1;
    const workers = [...w.units.values()].filter((u) => u.playerId === unit.playerId && (u.type === UnitTypeKey.Workers || u.type === UnitTypeKey.Engineers)).length;
    if (unit.aiWait > 20 && unit.homeCityId && workers > this.citiesOf(unit.playerId).length) w.removeUnit(unit.id);
    else this.defend(unit); // до найближчого міста
  }

  /** Що найкорисніше зробити на клітинці: їжа → щити → торгівля. */
  private bestTaskAt(unit: Unit, x: number, y: number): TerraformKind | undefined {
    const tile = this.world.tiles[y][x];
    const player = this.world.players[unit.playerId];
    const check = (k: TerraformKind) => checkTerraform(this.world.tiles, tile, k, player).ok;
    if (check('clean')) return 'clean'; // забруднення — першочергово
    // Болото й джунглі дають 1/0/0 — луки годують удвічі краще
    if (unit.type === UnitTypeKey.Engineers && (tile.terrain === TerrainType.Swamp || tile.terrain === TerrainType.Jungle)) return 'transform';
    if (tile.terrain === TerrainType.Hills && !tile.hasMine && check('mine')) return 'mine';
    if (check('irrigation')) return 'irrigation';
    if (check('mine') && tile.terrain !== TerrainType.Desert) return 'mine';
    if (check('road') && player.knownTechs.length > 0) return 'road';
    return undefined;
  }

  private inOwnRadius(playerId: number, x: number, y: number): boolean {
    return this.citiesOf(playerId).some((c) => FAT_CROSS_OFFSETS.some((o) => (c.x + o.dx + MAP_WIDTH) % MAP_WIDTH === x && c.y + o.dy === y));
  }

  private isWorkedByOwn(playerId: number, x: number, y: number): boolean {
    return this.citiesOf(playerId).some((c) => c.workedTiles.some((p) => p.x === x && p.y === y));
  }

  /** Караван несе щити до міста, що будує чудо. */
  /** Знайомі цивілізації, з якими ще нема посольства. */
  private needEmbassy(player: Player): number[] {
    const d = this.world.diplomacy;
    return this.world.players
      .filter((p) => p.id !== player.id && p.alive && !p.isBarbarian && d.hasContact(player.id, p.id) && !d.hasEmbassy(player.id, p.id))
      .map((p) => p.id);
  }

  /** Дипломат: до найближчого міста цивілізації без посольства; на війні — підкуп, крадіжка чи саботаж. */
  private diplomat(unit: Unit): void {
    const w = this.world;
    const player = w.players[unit.playerId];
    const want = new Set(this.needEmbassy(player));
    const targets = [...w.cities.values()].filter((c) => c.playerId !== unit.playerId
      && (want.has(c.playerId) || (w.diplomacy.atWar(unit.playerId, c.playerId) && !w.players[c.playerId].isBarbarian && !c.buildings.includes(BuildingTypeKey.Palace))))
      .sort((a, b) => w.distance(a.x, a.y, unit.x, unit.y) - w.distance(b.x, b.y, unit.x, unit.y));
    const target = targets.find((c) => w.distance(c.x, c.y, unit.x, unit.y) <= 20 && this.pathStep(unit, c, true) !== null);
    if (!target) {
      unit.aiWait = (unit.aiWait ?? 0) + 1;
      if (unit.aiWait > 20 && unit.homeCityId) w.removeUnit(unit.id);
      else this.defend(unit);
      return;
    }
    unit.aiWait = 0;
    this.walkTo(unit, target, true);
  }

  private caravan(unit: Unit): void {
    const w = this.world;
    const target = this.citiesOf(unit.playerId).find(
      (c) => c.currentProduction.isBuilding && BUILDING_CONFIGS[c.currentProduction.key as BuildingTypeKey]?.isWonder
    );
    if (!target) {
      // Чуда нема — торговий маршрут (Civ 1): разове золото й наука плюс торгівля назавжди
      const market = this.routeTarget(unit);
      if (market) {
        unit.aiWait = 0;
        if (unit.x === market.x && unit.y === market.y) w.establishTradeRoute(unit.id, market.id);
        else this.walkTo(unit, market, true);
        return;
      }
      // Чуда давно ніхто не будує — караван лише їсть щити утримання
      unit.aiWait = (unit.aiWait ?? 0) + 1;
      if (unit.aiWait > 20 && unit.homeCityId) {
        w.removeUnit(unit.id);
        return;
      }
      return this.defend(unit);
    }
    unit.aiWait = 0;
    if (unit.x === target.x && unit.y === target.y) {
      w.helpWonder(unit.id);
      return;
    }
    this.walkTo(unit, target);
  }

  /** Найвигідніше досяжне суходолом місто для маршруту: постійна торгівля важить більше за разовий прибуток. */
  private routeTarget(unit: Unit): City | undefined {
    const w = this.world;
    const home = unit.homeCityId ? w.cities.get(unit.homeCityId) : undefined;
    if (!home) return undefined;
    const routes = (home.tradeRoutes ?? []).filter((r) => w.cities.has(r.cityId));
    const weakest = routes.length >= 3 ? Math.min(...routes.map((r) => r.trade)) : 0;
    // Варвари не торгують; BFS дорогий — оцінюємо лише найближчі
    const near = [...w.cities.values()]
      .filter((c) => !w.players[c.playerId].isBarbarian && w.distance(c.x, c.y, unit.x, unit.y) <= 25 && !w.tradeRouteProblem(unit, c)
        && (c.playerId === unit.playerId || w.diplomacy.hasContact(unit.playerId, c.playerId)))
      .sort((a, b) => w.distance(a.x, a.y, unit.x, unit.y) - w.distance(b.x, b.y, unit.x, unit.y))
      .slice(0, 8);
    const scored = near
      .map((c) => ({ c, o: w.tradeRouteOffer(home, c) }))
      .filter(({ o }) => o.trade > weakest)
      .map(({ c, o }) => ({ c, score: (o.trade * 20 + o.bonus) / (w.distance(c.x, c.y, unit.x, unit.y) + 3) }))
      .sort((a, b) => b.score - a.score);
    for (const { c } of scored.slice(0, 3)) {
      if ((unit.x === c.x && unit.y === c.y) || this.pathStep(unit, c, true) !== null) return c;
    }
    return undefined;
  }

  /** Захисник: до міста, де бракує гарнізону, там — укріпитися. На старті — розвідка й хатки. */
  private defend(unit: Unit): void {
    const w = this.world;
    const cities = this.citiesOf(unit.playerId);
    const here = w.tiles[unit.y][unit.x].cityId;
    const hereCity = here ? w.cities.get(here) : undefined;
    if (hereCity && hereCity.playerId === unit.playerId && this.garrisonAt(hereCity) <= this.garrisonNeed(hereCity)) {
      unit.isFortified = true;
      return;
    }

    let best: City | undefined;
    let bestD = Infinity;
    for (const c of cities) {
      if (this.garrisonAt(c) >= this.garrisonNeed(c)) continue;
      const d = w.distance(unit.x, unit.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      unit.isFortified = false;
      this.walkTo(unit, best);
      return;
    }
    // Зайве застаріле Ополчення розпускаємо, коли є кращі захисники (не годуємо даремно)
    const player = w.players[unit.playerId];
    if (unit.type === UnitTypeKey.Militia && this.bestUnit(player, 'defense') !== UnitTypeKey.Militia) {
      w.removeUnit(unit.id);
      return;
    }
    if (hereCity && hereCity.playerId === unit.playerId) {
      unit.isFortified = true;
      return;
    }
    this.explore(unit);
  }

  /** Ворожий бойовий корабель за 6 клітинок від міста. */
  private enemyFleetNear(city: City, playerId: number): boolean {
    const w = this.world;
    return [...w.units.values()].some((u) => this.isWarship(u.type) && u.playerId !== playerId
      && w.diplomacy.atWar(playerId, u.playerId) && w.distance(u.x, u.y, city.x, city.y) <= 6);
  }

  /** Чи лишилось у радіусі 10 від міста понад 20 нерозвіданих клітинок суші. */
  private unexploredNear(city: City, playerId: number): boolean {
    const fog = this.world.playerFogs.get(playerId);
    if (!fog) return false;
    let n = 0;
    for (let dy = -10; dy <= 10; dy++) {
      const y = city.y + dy;
      if (y < 0 || y >= MAP_HEIGHT) continue;
      for (let dx = -10; dx <= 10; dx++) {
        const x = (city.x + dx + MAP_WIDTH) % MAP_WIDTH;
        if (!fog.explored[y][x] && this.world.tiles[y][x].terrain !== TerrainType.Ocean && ++n > 20) return true;
      }
    }
    return false;
  }

  private garrisonNeed(city: City): number {
    const important = city.size >= 3 || city.buildings.includes(BuildingTypeKey.Palace);
    return important || this.threatNear(city.x, city.y, city.playerId, 7) ? 2 : 1;
  }

  /** Атакувальник: ціль у радіусі 8 з добрими шансами; інакше стоїть у місті. */
  private attack(unit: Unit): void {
    const w = this.world;
    const player = w.players[unit.playerId];
    const cfg = UNIT_CONFIGS[unit.type];
    let best: { x: number; y: number; score: number } | undefined;

    for (const other of w.units.values()) {
      if (other.playerId === unit.playerId || !this.mayAttack(player, other.playerId)) continue;
      const d = w.distance(unit.x, unit.y, other.x, other.y);
      if (d > 8) continue;
      const odds = this.odds(unit, other.x, other.y);
      if (odds < 0.55) continue;
      const score = odds * 10 - d;
      if (!best || score > best.score) best = { x: other.x, y: other.y, score };
    }
    for (const city of w.cities.values()) {
      if (city.playerId === unit.playerId || !this.mayAttack(player, city.playerId)) continue;
      const d = w.distance(unit.x, unit.y, city.x, city.y);
      if (d > 8) continue;
      const empty = this.garrisonAt(city) === 0;
      const odds = empty ? 1 : this.odds(unit, city.x, city.y);
      if (odds < 0.55) continue;
      const score = odds * 10 - d + (empty ? 8 : 3); // місто цінніше за загін
      if (!best || score > best.score) best = { x: city.x, y: city.y, score };
    }

    if (best) {
      unit.isFortified = false;
      this.walkTo(unit, best, true);
      return;
    }
    // Суходолом цілей нема — десант на вороже місто за морем
    if (cfg.paradrop && this.paradrop(unit)) return;
    const far = this.isHostilePhase(player) && cfg.domain === 'land' ? this.fleet.overseasTarget(unit) : undefined;
    if (far) {
      unit.aiMission = { kind: 'board', purpose: 'invade', target: far };
      unit.isFortified = false;
      this.fleet.awaitFerry(unit);
      return;
    }
    if (cfg.attack > 0) this.defend(unit);
  }

  /** Десантники: стрибок до ворожого міста за 10 клітинок, де шанси добрі (або воно порожнє). */
  private paradrop(unit: Unit): boolean {
    const w = this.world;
    const player = w.players[unit.playerId];
    const reach = UNIT_CONFIGS[unit.type].paradrop ?? 0;
    for (const city of w.cities.values()) {
      if (city.playerId === unit.playerId || !this.mayAttack(player, city.playerId) || w.distance(unit.x, unit.y, city.x, city.y) > reach + 1) continue;
      if (this.garrisonAt(city) > 0 && this.odds(unit, city.x, city.y) < 0.55) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        if (w.paradrop(unit.id, city.x + dx, city.y + dy).ok) return true;
      }
    }
    return false;
  }

  /** Шанси атаки за формулою бою (без випадковості): атака / (атака + захист). */
  public odds(unit: Unit, x: number, y: number): number {
    const w = this.world;
    const tile = w.tiles[y][x];
    const defenders = tile.unitIds.map((id) => w.units.get(id)!).filter(Boolean);
    if (!defenders.length) return 1;
    const def = defenders.sort((a, b) => UNIT_CONFIGS[b.type].defense - UNIT_CONFIGS[a.type].defense)[0];
    // Як у бою: літаку в небі рельєф не допомагає, мури — лише проти наземних
    const inSky = UNIT_CONFIGS[def.type].domain === 'air' && !tile.cityId;
    let d = Math.max(1, UNIT_CONFIGS[def.type].defense) * (inSky ? 1 : TERRAIN_DATA[tile.terrain]?.defenseBonus ?? 1);
    if (def.isFortified && !inSky) d *= 1.5;
    const city = tile.cityId ? w.cities.get(tile.cityId) : undefined;
    const walls = city && (city.buildings.includes(BuildingTypeKey.CityWalls) || w.ownerWonders(city.playerId).has(BuildingTypeKey.GreatWall));
    if (walls && UNIT_CONFIGS[unit.type].domain === 'land') d *= 3;
    const a = Math.max(1, UNIT_CONFIGS[unit.type].attack);
    return a / (a + d);
  }

  /** Дослідник: розвідує, а коли на континенті нічого не лишилось — розпускається (не їсть щитів даремно). */
  private scoutLand(unit: Unit): void {
    for (let i = 0; i < 3 && unit.movesLeft > 0 && this.world.units.has(unit.id); i++) {
      if (!this.explore(unit, false)) {
        this.world.removeUnit(unit.id);
        return;
      }
    }
  }

  /** Розвідка: до найближчої хатки чи нерозвіданої суші. Повертає false, коли цілі нема. */
  private explore(unit: Unit, wander = true): boolean {
    const w = this.world;
    const fog = w.playerFogs.get(unit.playerId);
    let best: Step | undefined;
    let bestD = Infinity;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const y = unit.y + dy;
        if (y < 0 || y >= MAP_HEIGHT) continue;
        const x = (unit.x + dx + MAP_WIDTH) % MAP_WIDTH;
        const t = w.tiles[y][x];
        if (t.terrain === TerrainType.Ocean) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy)) - (t.hasHut ? 5 : 0);
        if ((t.hasHut || (fog && !fog.explored[y][x])) && d < bestD && d > -5) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) this.walkTo(unit, best);
    else if (wander) this.wander(unit);
    return !!best;
  }

  private wander(unit: Unit): void {
    const dx = Math.floor(Math.random() * 3) - 1;
    const dy = Math.floor(Math.random() * 3) - 1;
    if (dx || dy) this.world.moveUnit(unit.id, unit.x + dx, unit.y + dy);
  }

  /** Іде до цілі, поки є рух; з allowTarget — останній крок може бути атакою. */
  public walkTo(unit: Unit, target: Step, allowTarget = false): void {
    for (let guard = 0; guard < 6 && unit.movesLeft > 0 && this.world.units.has(unit.id); guard++) {
      const step = this.pathStep(unit, target, allowTarget);
      if (!step) return;
      const res = this.world.moveUnit(unit.id, step.x, step.y);
      if (!res.success || res.combatLog) return;
    }
  }

  /**
   * Перший крок найкоротшого шляху суходолом (пошук у ширину, 8 напрямків, мапа зациклена по X).
   * Чужі юніти й міста — перешкоди, окрім самої цілі (якщо allowTarget). null — шляху нема.
   */
  private pathStep(unit: Unit, target: Step, allowTarget = false): Step | null {
    const w = this.world;
    if (unit.x === target.x && unit.y === target.y) return null;
    const key = (x: number, y: number) => y * MAP_WIDTH + x;
    const prev = new Map<number, number>();
    const start = key(unit.x, unit.y);
    prev.set(start, -1);
    const queue = [start];
    const goal = key(target.x, target.y);
    const blocked = (x: number, y: number) => {
      const t = w.tiles[y][x];
      if (t.terrain === TerrainType.Ocean) return true;
      if (t.cityId && w.cities.get(t.cityId)!.playerId !== unit.playerId) return true;
      return t.unitIds.some((id) => w.units.get(id)?.playerId !== unit.playerId);
    };

    for (let head = 0; head < queue.length && head < 2500; head++) {
      const cur = queue[head];
      if (cur === goal) break;
      const cx = cur % MAP_WIDTH;
      const cy = Math.floor(cur / MAP_WIDTH);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ny = cy + dy;
          if (ny < 0 || ny >= MAP_HEIGHT) continue;
          const nx = (cx + dx + MAP_WIDTH) % MAP_WIDTH;
          const k = key(nx, ny);
          if (prev.has(k)) continue;
          if (k !== goal && blocked(nx, ny)) continue;
          if (k === goal && !allowTarget && blocked(nx, ny)) continue;
          if (k === goal && w.tiles[ny][nx].terrain === TerrainType.Ocean) continue;
          prev.set(k, cur);
          queue.push(k);
        }
      }
    }
    if (!prev.has(goal)) return null;
    let node = goal;
    while (prev.get(node) !== start) node = prev.get(node)!;
    return { x: node % MAP_WIDTH, y: Math.floor(node / MAP_WIDTH) };
  }

  // ---------- Допоміжне ----------

  public isCoastal(city: City): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const y = city.y + dy;
        if (y < 0 || y >= MAP_HEIGHT) continue;
        if (this.world.tiles[y][(city.x + dx + MAP_WIDTH) % MAP_WIDTH].terrain === TerrainType.Ocean) return true;
      }
    }
    return false;
  }

  public citiesOf(playerId: number): City[] {
    return [...this.world.cities.values()].filter((c) => c.playerId === playerId);
  }

  /** Скільки бойових юнітів власника стоїть у місті. */
  private garrisonAt(city: City): number {
    return this.world.tiles[city.y][city.x].unitIds
      .map((id) => this.world.units.get(id))
      .filter((u) => u && u.playerId === city.playerId && UNIT_CONFIGS[u.type].attack > 0 && UNIT_CONFIGS[u.type].domain === 'land')
      .length;
  }

  /** Чи стоїть у місті хтось, кращий за Ополчення. */
  private hasRealDefender(city: City): boolean {
    return this.world.tiles[city.y][city.x].unitIds
      .map((id) => this.world.units.get(id))
      .some((u) => u && u.playerId === city.playerId && u.type !== UnitTypeKey.Militia && UNIT_CONFIGS[u.type].defense >= 2 && UNIT_CONFIGS[u.type].domain === 'land');
  }

  /** Чи є ворожі бойові юніти поруч (варвари — завжди вороги; інші — коли воюють). */
  private threatNear(x: number, y: number, playerId: number, radius: number): boolean {
    for (const u of this.world.units.values()) {
      if (u.playerId === playerId || UNIT_CONFIGS[u.type].attack === 0) continue;
      if (this.world.distance(u.x, u.y, x, y) > radius) continue;
      const other = this.world.players[u.playerId];
      if (this.world.diplomacy.atWar(other.id, playerId)) return true;
    }
    return false;
  }

  private isHostilePhase(player: Player): boolean {
    return this.world.turnManager.turnNumber >= (player.hostileFromTurn ?? Infinity);
  }

  /** Варварів б'ємо завжди; інших — коли настав час війни за характером лідера. */
  public mayAttack(player: Player, targetId: number): boolean {
    if (this.world.players[targetId].isBarbarian) return true;
    // Рада безпеки ООН: власника не чіпають, поки він сам не напав
    if (this.world.ownerWonders(targetId).has(BuildingTypeKey.UnitedNations) && !this.world.attackedRecently(targetId, player.id)) return false;
    // Нападаємо лише на тих, з ким оголошено війну (дипломатія)
    return this.world.diplomacy.atWar(player.id, targetId);
  }
}
