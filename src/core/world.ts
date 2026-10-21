/**
 * Стан ігрового світу, управління мапою, юнітами, містами та гравцями.
 */
import { MAP_WIDTH, MAP_HEIGHT, UNIT_CONFIGS, BUILDING_CONFIGS, TECH_TREE, GOVERNMENTS } from './constants';
import { TileData, Unit, City, Player, PlayerFog, UnitTypeKey, TerrainType, BuildingTypeKey, GovernmentKey } from './types';
import { MapGenerator } from './map-generator';
import { CityLogic } from './city';
import { UnitLogic } from './unit';
import { TurnManager } from './turn-manager';
import { TerraformKind, TerraformCheck, checkTerraform, applyTerraform, canTerraform, TERRAFORM_INFO } from './terraform';
import { CityEnv, CityYields } from './city';
import { AiController } from './ai';

export class World {
  public tiles: TileData[][];
  public units: Map<string, Unit> = new Map();
  public cities: Map<string, City> = new Map();
  public players: Player[] = [];
  public activePlayerId: number = 0;
  public turnManager: TurnManager = new TurnManager();
  public playerFogs: Map<number, PlayerFog> = new Map();
  private nextId: number = 1;
  private cityNameIndex: Map<number, number> = new Map();
  private ai = new AiController(this);
  /** Події чужих ходів (захоплення міст), які треба показати людині в кінці ходу */
  private news: string[] = [];

  constructor() {
    this.tiles = MapGenerator.generateWorld();
    this.initPlayers();
    this.initFogOfWar();
    this.spawnInitialSettlers();
    this.placeHuts();
  }

  private initPlayers(): void {
    const makePlayer = (id: number, nameUa: string, leaderUa: string, color: string, colorHex: number, isAi: boolean): Player => ({
      id, nameUa, leaderUa, color, colorHex, isAi,
      gold: 50, taxRate: 5, scienceRate: 5, luxuryRate: 0,
      researchProgress: 0, knownTechs: [], alive: true, government: 'despotism',
    });
    this.players = [
      makePlayer(0, 'Київська Русь', 'Ярослав Мудрий', '#2a75d3', 0x2a75d3, false),
      // Характер лідерів: Цезар рано береться за меч, Рамзес довго будує
      { ...makePlayer(1, 'Римляни', 'Юлій Цезар', '#d63031', 0xd63031, true), hostileFromTurn: 45 },
      { ...makePlayer(2, 'Єгиптяни', 'Рамзес II', '#f1c40f', 0xf1c40f, true), hostileFromTurn: 110 },
      { ...makePlayer(BARBARIANS, 'Варвари', 'Вождь', '#5a1010', 0x5a1010, true), isBarbarian: true },
    ];
  }

  private initFogOfWar(): void {
    for (const player of this.players) {
      const explored = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
      const visible = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
      this.playerFogs.set(player.id, { explored, visible });
    }
  }

  private spawnInitialSettlers(): void {
    for (const player of this.players) {
      if (player.isBarbarian) continue;
      let spawned = false;
      let tries = 0;
      while (!spawned && tries < 1000) {
        tries++;
        const rx = Math.floor(Math.random() * MAP_WIDTH);
        const ry = Math.floor(MAP_HEIGHT * 0.25 + Math.random() * (MAP_HEIGHT * 0.5));
        const tile = this.tiles[ry][rx];

        if (tile.terrain === TerrainType.Grassland || tile.terrain === TerrainType.Plains) {
          // Перевіряємо, що навколо є щонайменше 7 сухопутних клітинок (глибина континенту)
          let landCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = (rx + dx + MAP_WIDTH) % MAP_WIDTH;
              const ny = ry + dy;
              if (ny >= 0 && ny < MAP_HEIGHT && this.tiles[ny][nx].terrain !== TerrainType.Ocean) {
                landCount++;
              }
            }
          }
          if (landCount < 7) continue;

          this.createUnit(player.id, UnitTypeKey.Settlers, rx, ry);
          this.revealFog(player.id, rx, ry, 3);
          spawned = true;

          const mX = (rx + 1) % MAP_WIDTH;
          this.createUnit(player.id, UnitTypeKey.Militia, mX, ry);
          this.revealFog(player.id, mX, ry, 3);
        }
      }
    }
  }

  public createUnit(playerId: number, type: UnitTypeKey, x: number, y: number): Unit {
    const id = `u_${this.nextId++}`;
    const cfg = UNIT_CONFIGS[type];
    const unit: Unit = {
      id,
      playerId,
      type,
      x,
      y,
      movesLeft: cfg.moves,
      isFortified: false,
      isSentry: false,
    };
    unit.movesLeft = this.unitMoves(unit);
    this.units.set(id, unit);
    this.tiles[y][x].unitIds.push(id);
    return unit;
  }

  public foundCity(unitId: string, customName?: string): City | null {
    const unit = this.units.get(unitId);
    if (!unit || unit.type !== UnitTypeKey.Settlers) return null;

    const tile = this.tiles[unit.y][unit.x];
    if (tile.terrain === TerrainType.Ocean || tile.cityId) return null;

    const player = this.players[unit.playerId];
    const cityName = customName || this.generateCityName(player.id);
    const isCapital = ![...this.cities.values()].some((c) => c.playerId === player.id);
    const cityId = `c_${this.nextId++}`;

    const city: City = {
      id: cityId,
      playerId: unit.playerId,
      name: cityName,
      x: unit.x,
      y: unit.y,
      size: 1,
      foodStored: 0,
      foodNeeded: 10,
      shieldsStored: 0,
      currentProduction: { isBuilding: false, key: UnitTypeKey.Militia },
      buildings: isCapital ? [BuildingTypeKey.Palace] : [],
      workedTiles: [{ x: unit.x, y: unit.y }],
    };

    CityLogic.autoAssignWorkers(city, this.tiles);
    this.cities.set(cityId, city);
    tile.cityId = cityId;

    // Знищуємо поселенця, який заснував місто
    this.removeUnit(unitId);
    this.revealFog(player.id, city.x, city.y, 3);
    return city;
  }

  public moveUnit(unitId: string, targetX: number, targetY: number): { success: boolean; combatLog?: string; event?: string } {
    const unit = this.units.get(unitId);
    if (!unit || unit.movesLeft <= 0) return { success: false };

    // Зациклення по X
    const destX = (targetX + MAP_WIDTH) % MAP_WIDTH;
    const destY = targetY;
    if (destY < 0 || destY >= MAP_HEIGHT) return { success: false };

    if (!UnitLogic.isAdjacent(unit.x, unit.y, destX, destY)) return { success: false };

    const fromTile = this.tiles[unit.y][unit.x];
    const toTile = this.tiles[destY][destX];

    // Перевірка ворожих юнітів на клітинці (Бій)
    if (toTile.unitIds.length > 0) {
      // Захищається найсильніший у обороні; у морі — лише кораблі (пасажири не б'ються)
      const atSea = toTile.terrain === TerrainType.Ocean;
      const candidates = toTile.unitIds.map((id) => this.units.get(id)!).filter((u) => !atSea || !u.carriedBy);
      const otherUnit = candidates
        .sort((a, b) => UNIT_CONFIGS[b.type].defense * (b.veteran ? 1.5 : 1) - UNIT_CONFIGS[a.type].defense * (a.veteran ? 1.5 : 1))[0];
      if (otherUnit && otherUnit.playerId !== unit.playerId) {
        if (UNIT_CONFIGS[unit.type].attack === 0) return { success: false }; // мирні юніти не нападають
        if (atSea && UNIT_CONFIGS[unit.type].domain === 'land') return { success: false }; // з суші кораблі не атакують
        if (!atSea && unit.type === UnitTypeKey.Submarine) return { success: false }; // торпеди — лише по кораблях
        const defCity = toTile.cityId ? this.cities.get(toTile.cityId) : undefined;
        const walls = !!defCity && (defCity.buildings.includes(BuildingTypeKey.CityWalls)
          || this.ownerWonders(defCity.playerId).has(BuildingTypeKey.GreatWall));
        const combat = UnitLogic.resolveCombat(unit, otherUnit, toTile, walls);

        if (combat.attackerWon) {
          // Поза містом гине весь стос (Civ 1); у місті — лише захисник
          const losers = defCity ? [otherUnit.id] : [...toTile.unitIds];
          losers.forEach((id) => this.removeUnit(id));
          unit.movesLeft = 0;
          if (Math.random() < 0.5) unit.veteran = true; // переможець набирається досвіду
        } else {
          this.removeUnit(unit.id);
          if (Math.random() < 0.5) otherUnit.veteran = true;
        }
        return { success: true, combatLog: combat.logUa };
      }
    }

    // Сухопутний юніт іде в море лише на свій корабель із вільним місцем
    const cfg = UNIT_CONFIGS[unit.type];
    let boardShip: Unit | undefined;
    if (cfg.domain === 'land' && toTile.terrain === TerrainType.Ocean) {
      if (unit.movesLeft <= 0) return { success: false };
      boardShip = toTile.unitIds
        .map((id) => this.units.get(id)!)
        .find((s) => s.playerId === unit.playerId && (UNIT_CONFIGS[s.type].capacity ?? 0) > this.cargoOf(s.id).length);
      if (!boardShip) return { success: false };
    } else if (!UnitLogic.canMoveTo(unit, toTile)) {
      return { success: false };
    }

    // Порожнє вороже місто: бойовий юніт захоплює, мирний — не заходить
    const enemyCity = toTile.cityId ? this.cities.get(toTile.cityId) : undefined;
    let captureLog: string | undefined;
    if (enemyCity && enemyCity.playerId !== unit.playerId) {
      if (UNIT_CONFIGS[unit.type].attack === 0) return { success: false };
      captureLog = this.captureCity(enemyCity, unit.playerId);
    }

    const cost = UnitLogic.getMovementCost(fromTile, toTile);
    unit.movesLeft = Math.max(0, unit.movesLeft - cost);
    unit.isFortified = false;
    unit.task = undefined;
    // Посадка на корабель / висадка на сушу
    unit.carriedBy = boardShip?.id;

    // Корабель везе пасажирів із собою; у порту вони сходять на берег
    const cargo = cfg.domain === 'sea' ? this.cargoOf(unit.id) : [];
    this.relocateUnit(unit, destX, destY);
    this.revealFog(unit.playerId, destX, destY, 2);
    for (const c of cargo) {
      this.relocateUnit(c, destX, destY);
      if (toTile.terrain !== TerrainType.Ocean) c.carriedBy = undefined;
    }
    if (captureLog) return { success: true, combatLog: captureLog };
    if (toTile.hasHut && UNIT_CONFIGS[unit.type].domain === 'land') {
      toTile.hasHut = false;
      return { success: true, event: this.enterHut(unit) };
    }
    return { success: true };
  }

  private relocateUnit(unit: Unit, newX: number, newY: number): void {
    const oldTile = this.tiles[unit.y][unit.x];
    oldTile.unitIds = oldTile.unitIds.filter((id) => id !== unit.id);

    unit.x = newX;
    unit.y = newY;
    this.tiles[newY][newX].unitIds.push(unit.id);
  }

  /** Пасажири корабля. */
  public cargoOf(shipId: string): Unit[] {
    return [...this.units.values()].filter((u) => u.carriedBy === shipId);
  }

  public removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    // Корабель іде на дно разом із пасажирами
    for (const c of this.cargoOf(unitId)) this.removeUnit(c.id);
    const tile = this.tiles[unit.y][unit.x];
    tile.unitIds = tile.unitIds.filter((id) => id !== unitId);
    this.units.delete(unitId);
  }

  public revealFog(playerId: number, cx: number, cy: number, radius: number): void {
    const fog = this.playerFogs.get(playerId);
    if (!fog) return;

    for (let dy = -radius; dy <= radius; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= MAP_HEIGHT) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = (cx + dx + MAP_WIDTH) % MAP_WIDTH;
        fog.explored[y][x] = true;
        fog.visible[y][x] = true;
      }
    }
  }

  /** Утримання всіх будівель гравця за хід (палац і чудеса безкоштовні). */
  public upkeepOf(playerId: number): number {
    const adamSmith = this.ownerWonders(playerId).has(BuildingTypeKey.AdamSmith);
    let total = 0;
    for (const c of this.cities.values()) {
      if (c.playerId !== playerId) continue;
      for (const b of c.buildings) {
        const m = BUILDING_CONFIGS[b]?.maintenance ?? 0;
        if (!(adamSmith && m === 1)) total += m;
      }
    }
    return total;
  }

  /** Чистий дохід за хід: податки з міст мінус утримання. */
  public netIncome(playerId: number): number {
    let gold = 0;
    for (const c of this.cities.values()) if (c.playerId === playerId) gold += this.cityYields(c).gold;
    return gold - this.upkeepOf(playerId);
  }

  /** Продаж будівлі з найбільшим утриманням (за її ціну). */
  private sellBuilding(playerId: number): { name: string; city: string; price: number } | undefined {
    let best: { city: City; b: BuildingTypeKey } | undefined;
    for (const c of this.cities.values()) {
      if (c.playerId !== playerId) continue;
      for (const b of c.buildings) {
        const m = BUILDING_CONFIGS[b]?.maintenance ?? 0;
        if (m > 0 && (!best || m > (BUILDING_CONFIGS[best.b].maintenance))) best = { city: c, b };
      }
    }
    if (!best) return undefined;
    const cfg = BUILDING_CONFIGS[best.b];
    best.city.buildings = best.city.buildings.filter((x) => x !== best!.b);
    this.players[playerId].gold += cfg.cost;
    return { name: cfg.nameUa, city: best.city.name, price: cfg.cost };
  }

  /** Дати гравцеві n технологій (поточне дослідження першим). Повертає назви. */
  private grantTechs(player: Player, n: number): string[] {
    const got: string[] = [];
    for (let i = 0; i < n; i++) {
      const options = TurnManager.getAvailableTechs(player);
      const tech = options.find((t) => t.id === player.currentTechId) ?? options[0];
      if (!tech) break;
      player.knownTechs.push(tech.id);
      if (player.currentTechId === tech.id) player.currentTechId = undefined;
      got.push(tech.nameUa);
    }
    return got;
  }

  /** Леонардо: перший юніт, для якого є сучасніша заміна, оновлюється (ветеранство лишається). */
  private leonardoUpgrade(player: Player): string | undefined {
    for (const unit of this.units.values()) {
      if (unit.playerId !== player.id) continue;
      let next = UPGRADES[unit.type];
      let target: UnitTypeKey | undefined;
      while (next) {
        const cfg = UNIT_CONFIGS[next];
        if (cfg.prereqTech && !player.knownTechs.includes(cfg.prereqTech)) break;
        target = next;
        next = UPGRADES[next];
      }
      if (!target) continue;
      const from = UNIT_CONFIGS[unit.type].nameUa;
      unit.type = target;
      return `${from} → ${UNIT_CONFIGS[target].nameUa}`;
    }
    return undefined;
  }

  /**
   * Забруднення (Civ 1): шанс = (щити − 20) × 3%, з фабрикою вдвічі вищий.
   * З Автомобілем димлять і самі жителі: (розмір − 10) × 3%, якщо нема Масового транспорту.
   * Забруднюється випадкова оброблювана клітинка суші.
   */
  private pollute(city: City): string | undefined {
    const shields = this.cityYields(city).shields;
    const factor = city.buildings.includes(BuildingTypeKey.Factory) ? 2 : 1;
    const cars = this.players[city.playerId].knownTechs.includes('automobile') && !city.buildings.includes(BuildingTypeKey.MassTransit);
    const people = cars ? Math.max(0, city.size - 10) : 0;
    const chance = Math.min(0.6, (Math.max(0, shields - 20) * factor + people) * 0.03);
    if (Math.random() >= chance) return undefined;
    const options = city.workedTiles
      .map((p) => this.tiles[p.y][p.x])
      .filter((t) => t.terrain !== TerrainType.Ocean && !t.hasPollution && !t.cityId);
    if (!options.length) return undefined;
    options[Math.floor(Math.random() * options.length)].hasPollution = true;
    return `☁️ Забруднення біля міста ${city.name}! Пошліть робітників очистити [P].`;
  }

  /** Чудеса, якими володіє гравець (у будь-якому з його міст). */
  public ownerWonders(playerId: number): Set<BuildingTypeKey> {
    const out = new Set<BuildingTypeKey>();
    for (const c of this.cities.values()) {
      if (c.playerId !== playerId) continue;
      for (const b of c.buildings) if (BUILDING_CONFIGS[b]?.isWonder) out.add(b);
    }
    return out;
  }

  /** Чи збудоване чудо будь-де у світі. */
  public isWonderBuilt(key: BuildingTypeKey): boolean {
    return [...this.cities.values()].some((c) => c.buildings.includes(key));
  }

  /** Обставини міста для розрахунку: столиця власника, його чудеса, податки. */
  public cityEnv(city: City): CityEnv {
    const player = this.players[city.playerId];
    const capital = [...this.cities.values()].find(
      (c) => c.playerId === city.playerId && c.buildings.includes(BuildingTypeKey.Palace)
    );
    return {
      capital: capital ? { x: capital.x, y: capital.y } : undefined,
      ownerWonders: this.ownerWonders(city.playerId),
      taxRate: player.taxRate,
      scienceRate: player.scienceRate,
      luxuryRate: player.luxuryRate,
      government: player.government,
      garrison: this.tiles[city.y][city.x].unitIds
        .map((id) => this.units.get(id))
        .filter((u) => u && u.playerId === city.playerId && UNIT_CONFIGS[u.type].attack > 0).length,
    };
  }

  /**
   * Змінює ставку податків або розкоші на ±10%; наука забирає/віддає різницю.
   * Повертає false, якщо так не можна (межа 60% чи нижче нуля).
   */
  public adjustRate(playerId: number, which: 'tax' | 'lux', delta: 1 | -1): boolean {
    const p = this.players[playerId];
    const tax = p.taxRate + (which === 'tax' ? delta : 0);
    const lux = p.luxuryRate + (which === 'lux' ? delta : 0);
    const sci = 10 - tax - lux;
    const max = GOVERNMENTS[p.government].maxRate;
    if (tax < 0 || lux < 0 || sci < 0 || tax > max || lux > max || sci > max) return false;
    p.taxRate = tax;
    p.luxuryRate = lux;
    p.scienceRate = sci;
    return true;
  }

  /** Чи доступний гравцеві устрій (за технологією). */
  public canAdopt(playerId: number, gov: GovernmentKey): boolean {
    const cfg = GOVERNMENTS[gov];
    const p = this.players[playerId];
    return gov !== 'anarchy' && gov !== p.government && (!cfg.prereqTech || p.knownTechs.includes(cfg.prereqTech));
  }

  /** Революція: 2 ходи анархії, потім новий устрій (як у Civ 1). */
  public startRevolution(playerId: number, gov: GovernmentKey): boolean {
    if (!this.canAdopt(playerId, gov)) return false;
    const p = this.players[playerId];
    p.government = 'anarchy';
    p.revolutionTurns = 2;
    p.targetGovernment = gov;
    return true;
  }

  /** Під новий устрій підганяємо ставки під його межу. */
  private clampRates(p: Player): void {
    const max = GOVERNMENTS[p.government].maxRate;
    if (!max) return;
    p.taxRate = Math.min(p.taxRate, max);
    p.luxuryRate = Math.min(p.luxuryRate, max);
    p.scienceRate = 10 - p.taxRate - p.luxuryRate;
    while (p.scienceRate > max) { p.scienceRate--; p.taxRate++; }
  }

  public cityYields(city: City): CityYields {
    return CityLogic.calculateYields(city, this.tiles, this.cityEnv(city));
  }

  /** Повний рух юніта з урахуванням чудес (Маяк: +1 кораблям). */
  public unitMoves(unit: Unit): number {
    const cfg = UNIT_CONFIGS[unit.type];
    if (cfg.domain !== 'sea') return cfg.moves;
    const w = this.ownerWonders(unit.playerId);
    return cfg.moves + (w.has(BuildingTypeKey.Lighthouse) ? 1 : 0) + (w.has(BuildingTypeKey.Magellan) ? 2 : 0);
  }

  /** Караван у своєму місті віддає 50 щитів на чудо, яке там будується. */
  public helpWonder(unitId: string): { ok: boolean; reason?: string; city?: City } {
    const unit = this.units.get(unitId);
    if (!unit || unit.type !== UnitTypeKey.Caravan) return { ok: false, reason: 'Лише караван' };
    const cityId = this.tiles[unit.y][unit.x].cityId;
    const city = cityId ? this.cities.get(cityId) : undefined;
    if (!city || city.playerId !== unit.playerId) return { ok: false, reason: 'Караван має бути у вашому місті' };
    const prod = city.currentProduction;
    if (!prod.isBuilding || !BUILDING_CONFIGS[prod.key as BuildingTypeKey]?.isWonder) {
      return { ok: false, reason: 'Місто зараз не будує чудо світу' };
    }
    city.shieldsStored += 50;
    this.removeUnit(unitId);
    return { ok: true, city };
  }

  public processTurnEnd(): { techDiscovered?: string; completedItems: string[] } {
    const completedItems: string[] = [];
    const human = this.players[0];

    // 1. Міста: якщо чудо вже збудував хтось інший — будівництво зривається (як у Civ 1)
    for (const city of this.cities.values()) {
      const prod = city.currentProduction;
      if (prod.isBuilding && BUILDING_CONFIGS[prod.key as BuildingTypeKey]?.isWonder && this.isWonderBuilt(prod.key as BuildingTypeKey)) {
        if (city.playerId === human.id) {
          completedItems.push(`${city.name}: чудо «${BUILDING_CONFIGS[prod.key as BuildingTypeKey].nameUa}» вже збудоване іншими, виробництво змінено`);
        }
        city.currentProduction = { isBuilding: false, key: UnitTypeKey.Militia };
      }

      // Варварське місто — трофей, а не фабрика військ: щити не накопичуються
      if (this.players[city.playerId].isBarbarian) city.shieldsStored = 0;
      const res = CityLogic.processTurn(city, this.tiles, this.cityEnv(city));
      const mine = city.playerId === human.id;
      if (mine && res.needsAqueduct) completedItems.push(`${city.name} не може рости далі без акведука`);
      if (mine && res.needsSewer) completedItems.push(`${city.name} не може рости далі без каналізації`);
      if (!res.completedProduction) continue;
      if (!res.completedProduction.isBuilding) {
        const newUnit = this.createUnit(city.playerId, res.completedProduction.key as UnitTypeKey, city.x, city.y);
        // Казарми: нові бойові юніти — ветерани
        if (city.buildings.includes(BuildingTypeKey.Barracks) && UNIT_CONFIGS[newUnit.type].attack > 0) newUnit.veteran = true;
        if (mine) completedItems.push(`${city.name} створило юніт: ${UNIT_CONFIGS[newUnit.type].nameUa}${newUnit.veteran ? ' (ветеран)' : ''}`);
      } else {
        const cfg = BUILDING_CONFIGS[res.completedProduction.key as BuildingTypeKey];
        if (cfg.isWonder) {
          // Чудо — новина для всього світу
          completedItems.push(`🌟 ${this.players[city.playerId].nameUa} завершили чудо світу «${cfg.nameUa}» у місті ${city.name}!`);
          if (cfg.key === BuildingTypeKey.Darwin) {
            const got = this.grantTechs(this.players[city.playerId], 2);
            if (mine && got.length) completedItems.push(`🧬 Подорож Дарвіна відкрила: ${got.join(', ')}`);
          }
        } else if (mine) {
          completedItems.push(`${city.name} збудувало споруду: ${cfg.nameUa}`);
        }
      }
    }

    // 2. Революції: анархія спливає — новий устрій
    for (const p of this.players) {
      if (p.government !== 'anarchy' || !p.targetGovernment) continue;
      p.revolutionTurns = (p.revolutionTurns ?? 1) - 1;
      if (p.revolutionTurns > 0) continue;
      p.government = p.targetGovernment;
      p.targetGovernment = undefined;
      this.clampRates(p);
      if (!p.isBarbarian) completedItems.push(`🏛️ ${p.nameUa}: встановлено новий устрій — ${GOVERNMENTS[p.government].nameUa}`);
    }

    // Економіка й наука всіх гравців (по містах, з корупцією та бонусами будівель)
    let humanTech: string | undefined;
    for (const player of this.players) {
      if (!player.alive || player.isBarbarian) continue;
      let gold = 0;
      let science = 0;
      for (const city of this.cities.values()) {
        if (city.playerId !== player.id) continue;
        const y = this.cityYields(city);
        gold += y.gold;
        science += y.science;
      }
      const econ = this.turnManager.processPlayerEconomy(player, gold, science);
      // Утримання будівель; порожня казна — продаємо найдорожчу в утриманні (як у Civ 1)
      player.gold -= this.upkeepOf(player.id);
      while (player.gold < 0) {
        const sold = this.sellBuilding(player.id);
        if (!sold) { player.gold = 0; break; }
        if (player.id === human.id) completedItems.push(`💸 Казна порожня: продано «${sold.name}» у місті ${sold.city} (+${sold.price} зл.)`);
      }
      if (player.id === human.id && econ.techDiscovered) humanTech = econ.techDiscovered.nameUa;
    }
    const libraryTech = this.applyGreatLibrary();
    if (libraryTech) completedItems.push(`📚 Велика бібліотека передала вам знання: ${libraryTech}`);

    // 3. Роботи поселенців і відновлення очок руху
    for (const unit of this.units.values()) {
      if (unit.task) {
        unit.task.turnsLeft--;
        if (unit.task.turnsLeft <= 0) {
          const tile = this.tiles[unit.y][unit.x];
          applyTerraform(tile, unit.task.kind);
          if (unit.playerId === 0) {
            completedItems.push(`${UNIT_CONFIGS[unit.type].nameUa} завершили: ${TERRAFORM_INFO[unit.task.kind].nameUa.toLowerCase()}`);
          }
          unit.task = undefined;
        }
      }
      unit.movesLeft = unit.task ? 0 : this.unitMoves(unit);
    }

    // Майстерня Леонардо: щоходу оновлює один застарілий юніт власника
    for (const p of this.players) {
      if (p.isBarbarian || !this.ownerWonders(p.id).has(BuildingTypeKey.Leonardo)) continue;
      const up = this.leonardoUpgrade(p);
      if (up && p.id === human.id) completedItems.push(`🔧 Майстерня Леонардо: ${up}`);
    }
    // Забруднення: продуктивні міста (понад 20 щитів), особливо з фабриками
    for (const city of this.cities.values()) {
      const msg = this.pollute(city);
      if (msg && city.playerId === human.id) completedItems.push(msg);
    }

    // 4. Хід AI і навала варварів
    for (const p of this.players) {
      if (p.isAi && !p.isBarbarian && p.hostileFromTurn === this.turnManager.turnNumber) {
        completedItems.push(`⚔️ ${p.leaderUa} (${p.nameUa}) більше не шукає миру: його війська рушають на сусідів!`);
      }
    }
    this.processAiTurns();
    const raid = this.spawnBarbarians();
    if (raid) completedItems.push(raid);

    // 5. Календар
    this.turnManager.advanceCalendar();
    completedItems.push(...this.news.splice(0));

    return {
      techDiscovered: humanTech,
      completedItems,
    };
  }

  /** Велика бібліотека: власник отримує технологію, яку знають щонайменше дві інші живі цивілізації. */
  private applyGreatLibrary(): string | undefined {
    let humanGot: string | undefined;
    for (const owner of this.players) {
      if (!owner.alive || !this.ownerWonders(owner.id).has(BuildingTypeKey.GreatLibrary)) continue;
      const others = this.players.filter((p) => p.alive && p.id !== owner.id);
      const tech = Object.values(TECH_TREE).find(
        (t) => !owner.knownTechs.includes(t.id) && others.filter((p) => p.knownTechs.includes(t.id)).length >= 2
      );
      if (!tech) continue;
      owner.knownTechs.push(tech.id);
      if (owner.currentTechId === tech.id) owner.currentTechId = undefined;
      if (owner.id === 0) humanGot = tech.nameUa;
    }
    return humanGot;
  }

  /** Відстань у клітинках з урахуванням зациклення мапи по X. */
  public distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x1 - x2);
    return Math.max(Math.min(dx, MAP_WIDTH - dx), Math.abs(y1 - y2));
  }

  /** Селища племен: ~1 на 35 клітинок суші, не ближче 4 від стартових юнітів і 3 одне від одного. */
  private placeHuts(): void {
    const land: { x: number; y: number }[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = this.tiles[y][x].terrain;
        if (t !== TerrainType.Ocean && t !== TerrainType.Glacier) land.push({ x, y });
      }
    }
    const target = Math.floor(land.length / 35);
    const huts: { x: number; y: number }[] = [];
    for (let tries = 0; huts.length < target && tries < target * 30; tries++) {
      const p = land[Math.floor(Math.random() * land.length)];
      const nearUnit = [...this.units.values()].some((u) => this.distance(u.x, u.y, p.x, p.y) < 4);
      const nearHut = huts.some((h) => this.distance(h.x, h.y, p.x, p.y) < 3);
      if (nearUnit || nearHut) continue;
      huts.push(p);
      this.tiles[p.y][p.x].hasHut = true;
    }
  }

  /** Що чекає в селищі племені (у дусі Civ 1). Повідомлення — лише для людини. */
  private enterHut(unit: Unit): string | undefined {
    const player = this.players[unit.playerId];
    const human = unit.playerId === 0;
    const nearOwnCity = [...this.cities.values()].some(
      (c) => c.playerId === unit.playerId && this.distance(c.x, c.y, unit.x, unit.y) <= 3
    );
    const roll = Math.random();
    const gold = () => {
      player.gold += 50;
      return '💰 Плем\'я подарувало вам 50 золотих.';
    };

    if (roll < 0.35) return human ? gold() : (gold(), undefined);

    if (roll < 0.6) {
      const options = TurnManager.getAvailableTechs(player);
      if (!options.length) return human ? gold() : (gold(), undefined);
      const tech = options[Math.floor(Math.random() * options.length)];
      player.knownTechs.push(tech.id);
      if (player.currentTechId === tech.id) player.currentTechId = undefined;
      return human ? `📜 Мудреці племені навчили вас: ${tech.nameUa}!` : undefined;
    }

    if (roll < 0.8) {
      this.createUnit(unit.playerId, UnitTypeKey.Cavalry, unit.x, unit.y);
      return human ? '🐎 Загін найманців-вершників приєднався до вас.' : undefined;
    }

    if (roll < 0.9 && !nearOwnCity && this.turnManager.turnNumber > 5) {
      // Ворожі воїни вискакують на сусідні клітинки
      let spawned = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        if (spawned >= 2) break;
        const x = (unit.x + dx + MAP_WIDTH) % MAP_WIDTH;
        const y = unit.y + dy;
        if (y < 0 || y >= MAP_HEIGHT) continue;
        const t = this.tiles[y][x];
        if (t.terrain === TerrainType.Ocean || t.cityId || t.unitIds.length) continue;
        this.createUnit(BARBARIANS, UnitTypeKey.Legion, x, y);
        spawned++;
      }
      if (spawned) return human ? '⚔️ Це була пастка! З селища вискочили варвари!' : undefined;
      return human ? gold() : (gold(), undefined);
    }

    // Мирне плем'я осідає й стає вашим містом
    const t = this.tiles[unit.y][unit.x];
    if (!t.cityId && t.terrain !== TerrainType.Ocean && !nearOwnCity) {
      const settlers = this.createUnit(unit.playerId, UnitTypeKey.Settlers, unit.x, unit.y);
      const city = this.foundCity(settlers.id);
      if (city) return human ? `🏘️ Плем'я приєдналося до вашої цивілізації і заснувало місто ${city.name}!` : undefined;
      this.removeUnit(settlers.id);
    }
    return human ? '🏚️ Селище порожнє — плем\'я давно пішло.' : undefined;
  }

  /** Захоплення міста: новий власник, населення −1, палац руйнується. */
  private captureCity(city: City, newOwner: number): string {
    const oldOwner = this.players[city.playerId];
    city.playerId = newOwner;
    city.size = Math.max(1, city.size - 1);
    city.foodNeeded = city.size * 10;
    city.foodStored = 0;
    city.shieldsStored = 0;
    city.buildings = city.buildings.filter((b) => b !== BuildingTypeKey.Palace);
    city.currentProduction = { isBuilding: false, key: UnitTypeKey.Militia };
    CityLogic.autoAssignWorkers(city, this.tiles);
    const msg = `🔥 ${this.players[newOwner].nameUa} захопили місто ${city.name} (${oldOwner.nameUa})!`;
    if (newOwner !== 0) this.news.push(msg); // свої захоплення людина бачить одразу
    return msg;
  }

  /**
   * Навала варварів (з ~2000 до н.е.): час від часу загін з'являється за 5–8 клітинок
   * від випадкового міста, на суші, де нікого немає.
   */
  private spawnBarbarians(): string | undefined {
    // З ~1000 до н.е.; спершу поодинці, з ~1 н.е. — загонами
    if (this.turnManager.turnNumber < 60 || Math.random() > 0.1) return undefined;
    // Навали не накопичуються безкінечно
    if ([...this.units.values()].filter((u) => u.playerId === BARBARIANS).length >= 12) return undefined;
    const targets = [...this.cities.values()].filter((c) => !this.players[c.playerId].isBarbarian);
    if (!targets.length) return undefined;
    const target = targets[Math.floor(Math.random() * targets.length)];

    for (let tries = 0; tries < 60; tries++) {
      const r = 5 + Math.floor(Math.random() * 4);
      const ang = Math.random() * Math.PI * 2;
      const x = ((target.x + Math.round(Math.cos(ang) * r)) % MAP_WIDTH + MAP_WIDTH) % MAP_WIDTH;
      const y = target.y + Math.round(Math.sin(ang) * r);
      if (y < 1 || y >= MAP_HEIGHT - 1) continue;
      const t = this.tiles[y][x];
      if (t.terrain === TerrainType.Ocean || t.cityId || t.unitIds.length) continue;
      const tooClose = [...this.cities.values()].some((c) => this.distance(c.x, c.y, x, y) < 4);
      if (tooClose) continue;

      this.createUnit(BARBARIANS, UnitTypeKey.Legion, x, y);
      // Пізніше — загони з вершниками
      if (this.turnManager.turnNumber > 100) {
        this.createUnit(BARBARIANS, this.turnManager.turnNumber > 130 ? UnitTypeKey.Cavalry : UnitTypeKey.Legion, x, y);
      }
      return target.playerId === 0 ? `⚔️ Варвари з'явилися неподалік міста ${target.name}!` : undefined;
    }
    return undefined;
  }

  /** Варвари йдуть до найближчого міста й нападають на все на шляху. */
  private moveBarbarian(unit: Unit): void {
    let best: City | undefined;
    let bestD = Infinity;
    for (const c of this.cities.values()) {
      if (c.playerId === BARBARIANS) continue;
      const d = this.distance(c.x, c.y, unit.x, unit.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best || bestD > 15) return;
    while (unit.movesLeft > 0 && this.units.has(unit.id)) {
      let step: { x: number; y: number } | undefined;
      let stepD = this.distance(best.x, best.y, unit.x, unit.y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = (unit.x + dx + MAP_WIDTH) % MAP_WIDTH;
          const y = unit.y + dy;
          if (y < 0 || y >= MAP_HEIGHT || this.tiles[y][x].terrain === TerrainType.Ocean) continue;
          const d = this.distance(best.x, best.y, x, y);
          if (d < stepD) { stepD = d; step = { x, y }; }
        }
      }
      if (!step || !this.moveUnit(unit.id, step.x, step.y).success) break;
    }
  }

  private processAiTurns(): void {
    for (const player of this.players) {
      if (player.isAi && !player.isBarbarian && player.alive) this.ai.takeTurn(player);
    }
    for (const unit of [...this.units.values()]) {
      if (unit.playerId === BARBARIANS && this.units.has(unit.id)) this.moveBarbarian(unit);
    }
  }

  /** Назви міст по черзі, як у Civ 1: перша — столиця. */
  private generateCityName(playerId: number): string {
    const names = CITY_NAMES[playerId] ?? CITY_NAMES[1];
    const i = this.cityNameIndex.get(playerId) ?? 0;
    this.cityNameIndex.set(playerId, i + 1);
    return i < names.length ? names[i] : `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`;
  }

  /** Перевірка, чи може поселенець почати роботу на своїй клітинці. */
  public checkTask(unitId: string, kind: TerraformKind): TerraformCheck {
    const unit = this.units.get(unitId);
    if (!unit || !canTerraform(unit.type)) return { ok: false, turns: 0, reason: 'Лише робітники чи поселенці' };
    const tile = this.tiles[unit.y][unit.x];
    const player = this.players[unit.playerId];
    const check = checkTerraform(this.tiles, tile, kind, player);
    // Вибухівка: робітники (не поселенці) працюють удвічі швидше, як інженери Civ 1
    if (check.ok && unit.type === UnitTypeKey.Workers && player.knownTechs.includes('explosives')) {
      check.turns = Math.max(1, Math.ceil(check.turns / 2));
    }
    return check;
  }

  public startTask(unitId: string, kind: TerraformKind): TerraformCheck {
    const check = this.checkTask(unitId, kind);
    const unit = this.units.get(unitId);
    if (!check.ok || !unit) return check;
    unit.task = { kind, turnsLeft: check.turns };
    unit.movesLeft = 0;
    unit.isFortified = false;
    return check;
  }
}

/** Індекс гравця-варварів. */
const BARBARIANS = 3;

/** Що чим застаріває (для Майстерні Леонардо). */
const UPGRADES: Partial<Record<UnitTypeKey, UnitTypeKey>> = {
  [UnitTypeKey.Militia]: UnitTypeKey.Phalanx,
  [UnitTypeKey.Phalanx]: UnitTypeKey.Pikemen,
  [UnitTypeKey.Pikemen]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Musketeers]: UnitTypeKey.Riflemen,
  [UnitTypeKey.Riflemen]: UnitTypeKey.MechInf,
  [UnitTypeKey.Archers]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Legion]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Catapult]: UnitTypeKey.Cannon,
  [UnitTypeKey.Cannon]: UnitTypeKey.Artillery,
  [UnitTypeKey.Cavalry]: UnitTypeKey.Knights,
  [UnitTypeKey.Chariot]: UnitTypeKey.Knights,
  [UnitTypeKey.Knights]: UnitTypeKey.Crusaders,
  [UnitTypeKey.Crusaders]: UnitTypeKey.Armor,
  [UnitTypeKey.Sail]: UnitTypeKey.Caravel,
  [UnitTypeKey.Caravel]: UnitTypeKey.Frigate,
  [UnitTypeKey.Frigate]: UnitTypeKey.Ironclad,
  [UnitTypeKey.Ironclad]: UnitTypeKey.Cruiser,
};

const CITY_NAMES: Record<number, string[]> = {
  0: ['Київ', 'Чернігів', 'Переяслав', 'Галич', 'Володимир', 'Новгород-Сіверський', 'Полоцьк', 'Смоленськ',
      'Турів', 'Луцьк', 'Белз', 'Звенигород', 'Вишгород', 'Любеч', 'Корсунь', 'Канів'],
  1: ['Рим', 'Капуя', 'Неаполь', 'Равенна', 'Тарент', 'Помпеї', 'Мілан', 'Генуя', 'Верона', 'Аквілея'],
  2: ['Фіви', 'Мемфіс', 'Олександрія', 'Гіза', 'Луксор', 'Асуан', 'Абідос', 'Саїс', 'Танис', 'Буто'],
};
