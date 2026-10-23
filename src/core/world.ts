/**
 * Стан ігрового світу, управління мапою, юнітами, містами та гравцями.
 */
import {
  MAP_WIDTH, MAP_HEIGHT, UNIT_CONFIGS, BUILDING_CONFIGS, TECH_TREE, GOVERNMENTS, SPACE_LIMITS,
  CIVS, MAP_SIZES, DIFFICULTIES, DEFAULT_OPTIONS, AGENTS, WARMING_LIMIT, civUnit, setMapSize,
} from './constants';
import {
  TileData, Unit, City, Player, PlayerFog, UnitTypeKey, TerrainType, BuildingTypeKey, GovernmentKey, Spaceship, GameOver,
  GameOptions, CivKey, ResourceType,
} from './types';
import { MapGenerator } from './map-generator';
import { CityLogic } from './city';
import { UnitLogic } from './unit';
import { TurnManager } from './turn-manager';
import { TerraformKind, TerraformCheck, checkTerraform, applyTerraform, canTerraform, TERRAFORM_INFO } from './terraform';
import { CityEnv, CityYields } from './city';
import { AiController } from './ai';
import { Diplomacy, DiplomacyData } from './diplomacy';

export class World {
  public tiles: TileData[][];
  public units: Map<string, Unit> = new Map();
  public cities: Map<string, City> = new Map();
  public players: Player[] = [];
  public activePlayerId: number = 0;
  public turnManager: TurnManager = new TurnManager();
  public playerFogs: Map<number, PlayerFog> = new Map();
  /** Дані інтерфейсу (історія для статистики, хроніка): ядро їх не читає, лише зберігає з партією */
  public uiData: Record<string, unknown> = {};
  private nextId: number = 1;
  private cityNameIndex: Map<number, number> = new Map();
  private ai = new AiController(this);
  /** Події чужих ходів (захоплення міст), які треба показати людині в кінці ходу */
  private news: string[] = [];
  /** Мир, війна, ставлення лідерів, зустрічі з людиною */
  public diplomacy = new Diplomacy(this);
  /** Налаштування партії (цивілізація, суперники, мапа, складність) */
  public options: GameOptions;
  /** Індекс гравця-варварів — завжди останній */
  public barbarianId = 0;

  /** Нова гра з налаштувань або відновлення збереженої. */
  constructor(options: GameOptions = DEFAULT_OPTIONS, save?: SaveData) {
    this.options = save ? save.options : options;
    TurnManager.techDiscount = (p) => (this.ownerWonders(p.id).has(BuildingTypeKey.SumySchool) ? 0.85 : 1);
    const size = MAP_SIZES[this.options.mapSize];
    setMapSize(size.w, size.h);
    if (save) {
      this.tiles = [];
      this.restore(save);
      return;
    }
    this.tiles = MapGenerator.generateWorld();
    this.initPlayers();
    this.initFogOfWar();
    this.spawnInitialSettlers();
    this.placeHuts();
  }

  /** Людина — гравець 0; далі суперники (задані або випадкові з решти); варвари — останні. */
  private initPlayers(): void {
    const o = this.options;
    const diff = DIFFICULTIES[o.difficulty];
    const others = (Object.keys(CIVS) as CivKey[]).filter((c) => c !== o.civ).sort(() => Math.random() - 0.5);
    const rivals = (o.rivalCivs ?? others).filter((c) => c !== o.civ).slice(0, o.rivals);
    const makePlayer = (id: number, civ: CivKey, isAi: boolean): Player => ({
      id, civ, nameUa: CIVS[civ].nameUa, leaderUa: CIVS[civ].leaderUa, color: CIVS[civ].color, colorHex: CIVS[civ].colorHex, isAi,
      gold: 50, taxRate: 5, scienceRate: 5, luxuryRate: 0,
      researchProgress: 0, knownTechs: [], alive: true, government: 'despotism',
    });
    // Характер лідерів: войовничі рано беруться за меч, мирні довго будують
    this.players = [
      { ...makePlayer(0, o.civ, false), researchFactor: diff.research },
      ...rivals.map((civ, i) => ({ ...makePlayer(i + 1, civ, true), hostileFromTurn: CIVS[civ].hostileFromTurn })),
    ];
    this.barbarianId = this.players.length;
    this.players.push({
      id: this.barbarianId, nameUa: 'Варвари', leaderUa: 'Вождь', color: '#5a1010', colorHex: 0x5a1010, isAi: true, isBarbarian: true,
      gold: 0, taxRate: 5, scienceRate: 5, luxuryRate: 0, researchProgress: 0, knownTechs: [], alive: true, government: 'despotism',
    });
  }

  private initFogOfWar(): void {
    for (const player of this.players) {
      const explored = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
      const visible = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
      this.playerFogs.set(player.id, { explored, visible });
    }
  }

  private spawnInitialSettlers(): void {
    const starts: { x: number; y: number }[] = [];
    for (const player of this.players) {
      if (player.isBarbarian) continue;
      let spawned = false;
      let tries = 0;
      while (!spawned && tries < 1000) {
        tries++;
        // Сусіди не стартують на виду одне в одного (інакше знайомство в 3950 до н.е.); вимогу послаблюємо, якщо мапа тісна
        const minDist = tries < 400 ? Math.floor(MAP_WIDTH / 5) : tries < 800 ? 8 : 0;
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
          if (starts.some((p) => this.distance(p.x, p.y, rx, ry) < minDist)) continue;
          starts.push({ x: rx, y: ry });

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

  public createUnit(playerId: number, type: UnitTypeKey, x: number, y: number, homeCityId?: string): Unit {
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
      homeCityId,
    };
    unit.movesLeft = this.unitMoves(unit);
    if (cfg.fuel) unit.fuel = cfg.fuel;
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

  /** Новина для людини наприкінці ходу (події чужих ходів). */
  public pushNews(text: string): void {
    this.news.push(text);
  }

  /** Клітинки зі зміненим рельєфом (інженери, потепління) — рендерер перепікає їхні шматки. */
  public terrainChanges: { x: number; y: number }[] = [];
  /** Глобальне потепління (Civ 1): накопичується від смогу понад норму; на `WARMING_LIMIT` — зміна клімату. */
  public warming = 0;

  /** Чий мир порушить цей хід: бойовий юніт іде на загін чи місто цивілізації, з якою не воюємо. */
  public peaceVictim(unit: Unit, targetX: number, targetY: number): number | undefined {
    if (UNIT_CONFIGS[unit.type].attack === 0 || AGENTS.has(unit.type)) return undefined;
    const tile = this.tiles[targetY]?.[(targetX + MAP_WIDTH) % MAP_WIDTH];
    if (!tile) return undefined;
    const owners = tile.unitIds.map((id) => this.units.get(id)?.playerId);
    if (tile.cityId) owners.push(this.cities.get(tile.cityId)?.playerId);
    return owners.find((o) => o !== undefined && o !== unit.playerId && this.diplomacy.hasContact(unit.playerId, o) && !this.diplomacy.atWar(unit.playerId, o));
  }

  public moveUnit(unitId: string, targetX: number, targetY: number): { success: boolean; combatLog?: string; event?: string; diplomatCity?: string } {
    const unit = this.units.get(unitId);
    if (!unit || unit.movesLeft <= 0) return { success: false };

    // Зациклення по X
    const destX = (targetX + MAP_WIDTH) % MAP_WIDTH;
    const destY = targetY;
    if (destY < 0 || destY >= MAP_HEIGHT) return { success: false };

    if (!UnitLogic.isAdjacent(unit.x, unit.y, destX, destY)) return { success: false };

    const fromTile = this.tiles[unit.y][unit.x];
    const toTile = this.tiles[destY][destX];
    const air = UNIT_CONFIGS[unit.type].domain === 'air';

    // Дипломат у чужому місті: людина обирає дію у вікні, AI — одразу (`aiDiplomatChoice`)
    if (AGENTS.has(unit.type) && toTile.cityId) {
      const target = this.cities.get(toTile.cityId)!;
      if (target.playerId !== unit.playerId) {
        if (!this.players[unit.playerId].isAi) return { success: false, diplomatCity: target.id };
        return { success: true, event: this.diplomacy.diplomatAct(unit.id, target.id, this.diplomacy.aiDiplomatChoice(unit.playerId, target)) };
      }
    }

    // Караван у чужому місті — торгівля (Civ 1); з ворогом — ні, і напасти він не може
    if (UNIT_CONFIGS[unit.type].wonderShields && toTile.cityId) {
      const target = this.cities.get(toTile.cityId)!;
      if (target.playerId !== unit.playerId) {
        const res = this.establishTradeRoute(unit.id, target.id);
        if (!res.ok) return { success: false, event: `⚠️ ${res.reason}` };
        if (unit.playerId !== 0 && target.playerId === 0) this.news.push(`🐪 ${this.players[unit.playerId].nameUa} відкрили торговий шлях до міста ${target.name}`);
        return { success: true, event: res.text };
      }
    }

    // Ядерна ракета вибухає над ворожим загоном чи містом
    if (unit.type === UnitTypeKey.Nuclear) {
      const enemyCity = toTile.cityId && this.cities.get(toTile.cityId)!.playerId !== unit.playerId;
      const enemyUnits = toTile.unitIds.some((id) => this.units.get(id)?.playerId !== unit.playerId);
      if (enemyCity || enemyUnits) {
        const sdi = this.sdiCover(destX, destY, unit.playerId);
        if (!sdi) return { success: true, combatLog: this.detonate(unit, destX, destY) };
        // Протиракетна оборона збиває ракету — та все одно напад
        this.noteAggression(unit.playerId, sdi.playerId);
        this.removeUnit(unit.id);
        const msg = `🛡️ Протиракетна оборона міста ${sdi.name} (${this.players[sdi.playerId].nameUa}) збила ядерну ракету!`;
        if (unit.playerId !== 0) this.news.push(msg);
        return { success: true, combatLog: msg };
      }
    }

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
        // Літак у небі (не в місті) збиває лише винищувач
        if (!defCity && UNIT_CONFIGS[otherUnit.type].domain === 'air' && !UNIT_CONFIGS[otherUnit.type].hover && !otherUnit.carriedBy && !UNIT_CONFIGS[unit.type].interceptor) {
          return { success: false };
        }
        this.noteAggression(unit.playerId, otherUnit.playerId);
        // Гаубиця, як у Civ 1, мурів не помічає
        const walls = !!defCity && unit.type !== UnitTypeKey.Howitzer && !UNIT_CONFIGS[unit.type].ignoresWalls && (defCity.buildings.includes(BuildingTypeKey.CityWalls)
          || this.ownerWonders(defCity.playerId).has(BuildingTypeKey.GreatWall));
        const combat = UnitLogic.resolveCombat(unit, otherUnit, toTile, walls, {
          coastal: !!defCity && defCity.buildings.includes(BuildingTypeKey.CoastalDefense),
          sam: !!defCity && defCity.buildings.includes(BuildingTypeKey.SamBattery),
          fromShip: !!unit.carriedBy && UNIT_CONFIGS[unit.type].domain === 'land',
        });

        // Ракета після удару зникає
        if (UNIT_CONFIGS[unit.type].missile) {
          if (combat.attackerWon) (defCity ? [otherUnit.id] : [...toTile.unitIds]).forEach((id) => this.removeUnit(id));
          this.removeUnit(unit.id);
          return { success: true, combatLog: combat.logUa };
        }
        if (combat.attackerWon) {
          // Поза містом гине весь стос (Civ 1); у місті — лише захисник
          const losers = defCity ? [otherUnit.id] : [...toTile.unitIds];
          losers.forEach((id) => this.removeUnit(id));
          // Літак після удару летить далі (додому), решта зупиняється
          unit.movesLeft = air ? Math.max(0, unit.movesLeft - 1) : 0;
          if (Math.random() < 0.5) unit.veteran = true; // переможець набирається досвіду
        } else {
          this.removeUnit(unit.id);
          if (Math.random() < 0.5) otherUnit.veteran = true;
        }
        return { success: true, combatLog: combat.logUa };
      }
    }

    // Зона контролю (Civ 1): з клітинки поруч із ворогом не перейти на іншу таку ж (хіба до своїх)
    if (this.zocBlocks(unit, destX, destY)) {
      return { success: false, event: '⚠️ Зона контролю: від ворожого загону можна лише відступити або атакувати' };
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

    // Порожнє вороже місто: бойовий наземний юніт захоплює; мирний і літак — не заходять
    const enemyCity = toTile.cityId ? this.cities.get(toTile.cityId) : undefined;
    let captureLog: string | undefined;
    if (enemyCity && enemyCity.playerId !== unit.playerId) {
      // Міста беруть лише наземні війська: кораблі й літаки — ні
      if (UNIT_CONFIGS[unit.type].attack === 0 || air || UNIT_CONFIGS[unit.type].domain === 'sea') return { success: false };
      this.noteAggression(unit.playerId, enemyCity.playerId);
      captureLog = this.captureCity(enemyCity, unit.playerId);
    }

    // Літак летить над будь-чим по 1 руху за клітинку
    const cost = air ? 1 : UnitLogic.getMovementCost(fromTile, toTile, cfg.allTerrainAsRoad);
    unit.movesLeft = Math.max(0, unit.movesLeft - cost);
    unit.isFortified = false;
    unit.task = undefined;
    // Посадка на корабель / висадка на сушу; літак у морі сідає на свій авіаносець, якщо є місце
    const carrier = air && toTile.terrain === TerrainType.Ocean
      ? toTile.unitIds.map((id) => this.units.get(id)!).find((s) => s.playerId === unit.playerId && (UNIT_CONFIGS[s.type].airCapacity ?? 0) > this.cargoOf(s.id).length)
      : undefined;
    unit.carriedBy = boardShip?.id ?? carrier?.id;

    // Корабель везе пасажирів із собою; у порту вони сходять на берег
    const cargo = cfg.domain === 'sea' ? this.cargoOf(unit.id) : [];
    this.relocateUnit(unit, destX, destY);
    this.revealFog(unit.playerId, destX, destY, cfg.vision ?? 2);
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

  /** Хто на кого нападав і коли (для Ради безпеки ООН): ключ «нападник>жертва» → хід. */
  private aggression = new Map<string, number>();

  public noteAggression(attacker: number, victim: number): void {
    if (attacker === victim) return;
    this.aggression.set(`${attacker}>${victim}`, this.turnManager.turnNumber);
    this.diplomacy.onAggression(attacker, victim);
  }

  /** Чи нападав гравець на іншого за останні `turns` ходів. */
  public attackedRecently(attacker: number, victim: number, turns = 10): boolean {
    const t = this.aggression.get(`${attacker}>${victim}`);
    return t !== undefined && this.turnManager.turnNumber - t <= turns;
  }

  /**
   * Ядерний вибух (Civ 1): гинуть усі юніти на 3×3 клітинки (і свої теж),
   * міста втрачають половину жителів, земля вкривається радіоактивним смогом.
   */
  /** Чуже місто з SDI за 3 клітинки від цілі — воно збиває ракету (Civ 1). */
  private sdiCover(x: number, y: number, attacker: number): City | undefined {
    return [...this.cities.values()].find((c) => c.playerId !== attacker
      && c.buildings.includes(BuildingTypeKey.SdiDefense) && this.distance(c.x, c.y, x, y) <= 3);
  }

  private detonate(nuke: Unit, cx: number, cy: number): string {
    nuke.movesLeft = 0;
    this.removeUnit(nuke.id);
    let killed = 0;
    const hit: string[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= MAP_HEIGHT) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.tiles[y][(cx + dx + MAP_WIDTH) % MAP_WIDTH];
        for (const id of [...t.unitIds]) {
          const u = this.units.get(id);
          if (!u) continue;
          if (u.playerId !== nuke.playerId) this.noteAggression(nuke.playerId, u.playerId);
          killed++;
          this.removeUnit(id);
        }
        if (t.cityId) {
          const c = this.cities.get(t.cityId)!;
          this.noteAggression(nuke.playerId, c.playerId);
          c.size = Math.max(1, Math.ceil(c.size / 2));
          c.foodNeeded = c.size * 10;
          c.foodStored = Math.min(c.foodStored, c.foodNeeded);
          CityLogic.autoAssignWorkers(c, this.tiles, this.cityEnv(c));
          hit.push(c.name);
        } else if (t.terrain !== TerrainType.Ocean && Math.random() < 0.5) {
          t.hasPollution = true;
        }
      }
    }
    const who = this.players[nuke.playerId].nameUa;
    const msg = `☢️ ${who}: ядерний удар! Загинуло юнітів: ${killed}${hit.length ? `; місто ${hit.join(', ')} втратило половину жителів` : ''}.`;
    if (nuke.playerId !== 0) this.news.push(msg);
    return msg;
  }

  /** Літак заправляється у своєму місті або на своєму авіаносці. */
  private atAirBase(unit: Unit): boolean {
    const t = this.tiles[unit.y][unit.x];
    if (t.cityId && this.cities.get(t.cityId)!.playerId === unit.playerId) return true;
    const ship = unit.carriedBy ? this.units.get(unit.carriedBy) : undefined;
    return !!ship && !!UNIT_CONFIGS[ship.type].airCapacity;
  }

  // ---------- Утримання армії ----------

  /** Скільки юнітів утримує місто (і скільки з них поселенців). */
  public supportOf(cityId: string): { units: number; settlers: number; abroad: number } {
    const home = this.cities.get(cityId);
    let units = 0;
    let settlers = 0;
    let abroad = 0;
    for (const u of this.units.values()) {
      if (u.homeCityId !== cityId) continue;
      // Фанатики за Фундаменталізму — без утримання
      const gov = UNIT_CONFIGS[u.type].requiresGovernment;
      if (!(gov && this.players[u.playerId].government === gov)) units++;
      if (u.type === UnitTypeKey.Settlers) settlers++;
      // За кордоном (Civ 1): військовий поза своїми містами й далі за 3 клітинки від рідного
      const at = this.tiles[u.y][u.x].cityId;
      if (home && UNIT_CONFIGS[u.type].attack > 0 && !(at && this.cities.get(at)!.playerId === u.playerId)
        && this.distance(u.x, u.y, home.x, home.y) > 3) abroad++;
    }
    return { units, settlers, abroad };
  }

  /** Юніти, яких утримує місто, — найдальші першими (їх розпускають першими, як у Civ 1). */
  public supportedUnits(city: City): Unit[] {
    return [...this.units.values()]
      .filter((u) => u.homeCityId === city.id)
      .sort((a, b) => this.distance(b.x, b.y, city.x, city.y) - this.distance(a.x, a.y, city.x, city.y));
  }

  /** Бракує щитів — розпускаємо юніти; бракує їжі на поселенців — розпускаємо поселенців. */
  private enforceUpkeep(city: City, log: string[]): void {
    const mine = city.playerId === 0;
    let y = this.cityYields(city);
    while (y.shieldDeficit > 0) {
      const victim = this.supportedUnits(city)[0];
      if (!victim) break;
      if (mine) log.push(`🪖 ${city.name} не може утримувати військо: розпущено «${UNIT_CONFIGS[victim.type].nameUa}»`);
      this.removeUnit(victim.id);
      y = this.cityYields(city);
    }
    while (city.foodStored + y.foodSurplus < 0 && y.upkeepFood > 0) {
      const settlers = this.supportedUnits(city).find((u) => u.type === UnitTypeKey.Settlers);
      if (!settlers) break;
      if (mine) log.push(`🌾 ${city.name} не прогодує поселенців: їх розпущено`);
      this.removeUnit(settlers.id);
      y = this.cityYields(city);
    }
  }

  /** Переписати юніт на місто, де він стоїть (тепер його утримує це місто). */
  public rehome(unitId: string): City | undefined {
    const unit = this.units.get(unitId);
    const cityId = unit && this.tiles[unit.y][unit.x].cityId;
    const city = cityId ? this.cities.get(cityId) : undefined;
    if (!unit || !city || city.playerId !== unit.playerId || unit.homeCityId === city.id) return undefined;
    unit.homeCityId = city.id;
    return city;
  }

  /** AI: посадити своїх наземних юнітів, що стоять з кораблем у порту (скільки влізе). */
  public boardInPort(shipId: string, unitIds: string[]): number {
    const ship = this.units.get(shipId);
    if (!ship) return 0;
    let free = (UNIT_CONFIGS[ship.type].capacity ?? 0) - this.cargoOf(ship.id).length;
    let boarded = 0;
    for (const id of unitIds) {
      const u = this.units.get(id);
      if (free <= 0 || !u || u.playerId !== ship.playerId || u.x !== ship.x || u.y !== ship.y || UNIT_CONFIGS[u.type].domain !== 'land') continue;
      u.carriedBy = ship.id;
      u.isFortified = false;
      free--;
      boarded++;
    }
    return boarded;
  }

  /** Хто не зважає на зону контролю: дипломати, каравани, дослідники, партизани (Civ 1 / Civ II). */
  public ignoresZoc(unit: Unit): boolean {
    const cfg = UNIT_CONFIGS[unit.type];
    return cfg.domain !== 'land' || !!unit.carriedBy || AGENTS.has(unit.type) || !!cfg.wonderShields
      || unit.type === UnitTypeKey.Explorer || unit.type === UnitTypeKey.Partisans;
  }

  /** Клітинка поруч із наземним загоном того, з ким гравець воює (або варвара). */
  public inEnemyZoc(x: number, y: number, playerId: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      const row = this.tiles[y + dy];
      if (!row) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        for (const id of row[(x + dx + MAP_WIDTH) % MAP_WIDTH].unitIds) {
          const u = this.units.get(id)!;
          if (u.playerId === playerId || u.carriedBy || UNIT_CONFIGS[u.type].domain !== 'land') continue;
          if (u.playerId === this.barbarianId || playerId === this.barbarianId || this.diplomacy.atWar(playerId, u.playerId)) return true;
        }
      }
    }
    return false;
  }

  /** Чи забороняє зона контролю цей крок. Свої загін чи місто на цілі — можна (Civ 1). */
  public zocBlocks(unit: Unit, toX: number, toY: number): boolean {
    if (this.ignoresZoc(unit)) return false;
    const to = this.tiles[toY][toX];
    if (to.terrain === TerrainType.Ocean) return false;
    if (to.cityId && this.cities.get(to.cityId)!.playerId === unit.playerId) return false;
    if (to.unitIds.some((id) => this.units.get(id)!.playerId === unit.playerId)) return false;
    return this.inEnemyZoc(unit.x, unit.y, unit.playerId) && this.inEnemyZoc(toX, toY, unit.playerId);
  }

  /** Чужий підводний човен видно лише з сусідньої клітинки — від свого юніта чи міста (Civ 1). */
  public hiddenFrom(unit: Unit, viewer: number): boolean {
    if ((unit.type !== UnitTypeKey.Submarine && unit.type !== UnitTypeKey.MissileSubmarine) || unit.playerId === viewer) return false;
    for (let dy = -1; dy <= 1; dy++) {
      const t = this.tiles[unit.y + dy];
      if (!t) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const n = t[(unit.x + dx + MAP_WIDTH) % MAP_WIDTH];
        if (n.cityId && this.cities.get(n.cityId)!.playerId === viewer) return false;
        if (n.unitIds.some((id) => this.units.get(id)!.playerId === viewer)) return false;
      }
    }
    return true;
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
      TurnManager.learnTech(player, tech);
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
      target = civUnit(target, player.civ);
      if (target === unit.type) continue;
      const from = UNIT_CONFIGS[unit.type].nameUa;
      unit.type = target;
      return `${from} → ${UNIT_CONFIGS[target].nameUa}`;
    }
    return undefined;
  }

  /**
   * Забруднення (Civ 1): шанс = (щити − 20) × 3%, з фабрикою вдвічі вищий, з центром переробки — втричі нижчий.
   * З Автомобілем димлять і самі жителі: (розмір − 10) × 3%, якщо нема Масового транспорту.
   * Забруднюється випадкова оброблювана клітинка суші.
   */
  private pollute(city: City): string | undefined {
    // Забруднює виробництво, а не те, що лишилось після утримання армії
    const y = this.cityYields(city);
    const shields = y.disorder ? 0 : y.shieldsGross;
    // Фабрика — удвічі частіше, АЕС чи ГЕС — удвічі рідше
    const clean = city.buildings.includes(BuildingTypeKey.NuclearPlant) || city.buildings.includes(BuildingTypeKey.HydroPlant);
    const solar = city.buildings.includes(BuildingTypeKey.SolarPlant);
    const factor = (city.buildings.includes(BuildingTypeKey.Factory) ? 2 : 1) * (clean ? 0.5 : 1)
      * (city.buildings.includes(BuildingTypeKey.RecyclingCenter) ? 1 / 3 : 1)
      * (this.ownerWonders(city.playerId).has(BuildingTypeKey.EiffelTower) ? 0.75 : 1);
    const cars = this.players[city.playerId].knownTechs.includes('automobile') && !city.buildings.includes(BuildingTypeKey.MassTransit);
    const people = cars ? Math.max(0, city.size - 10) : 0;
    const chance = Math.min(0.6, ((solar ? 0 : Math.max(0, shields - 20) * factor) + people) * 0.03);
    if (Math.random() >= chance) return undefined;
    const options = city.workedTiles
      .map((p) => this.tiles[p.y][p.x])
      .filter((t) => t.terrain !== TerrainType.Ocean && !t.hasPollution && !t.cityId);
    if (!options.length) return undefined;
    options[Math.floor(Math.random() * options.length)].hasPollution = true;
    return `☁️ Забруднення біля міста ${city.name}! Пошліть робітників очистити [P].`;
  }

  /** Скільки забрудненої землі світ витримує без потепління: ~1 клітинка на 128. */
  public warmingSafe(): number {
    return Math.round((MAP_WIDTH * MAP_HEIGHT) / 128);
  }

  /**
   * Глобальне потепління (Civ 1): кожна забруднена клітинка понад норму наближає зміну клімату,
   * чиста планета повільно остигає. На межі — узбережжя заболочуються, поля висихають, ліси дичавіють.
   */
  /**
   * Випадкові події, щоб партії відрізнялись: у середньому раз на 80 ходів на цивілізацію, з 30-го ходу.
   * Людина бачить свої в стрічці; події AI лишаються тихими, щоб не засмічувати новини.
   */
  private randomEvents(out: string[]): void {
    if (this.turnManager.turnNumber < 30) return;
    for (const p of this.players) {
      if (p.isBarbarian || !p.alive || Math.random() >= 1 / 80) continue;
      const cities = [...this.cities.values()].filter((c) => c.playerId === p.id);
      if (!cities.length) continue;
      const msg = this.randomEvent(p, cities[Math.floor(Math.random() * cities.length)]);
      if (msg && p.id === 0) out.push(msg);
    }
  }

  /** Одна подія в місті; undefined — обставини не ті (подія не відбулась). */
  private randomEvent(p: Player, city: City): string | undefined {
    const around = (test: (t: TileData) => boolean) => {
      for (let dy = -1; dy <= 1; dy++) {
        const row = this.tiles[city.y + dy];
        if (!row) continue;
        for (let dx = -1; dx <= 1; dx++) if (test(row[(city.x + dx + MAP_WIDTH) % MAP_WIDTH])) return true;
      }
      return false;
    };
    const has = (b: BuildingTypeKey) => city.buildings.includes(b);
    const kinds = ['plague', 'famine', 'fire', 'quake', 'flood', 'gold', 'harvest', 'scientist', 'artist'] as const;
    switch (kinds[Math.floor(Math.random() * kinds.length)]) {
      case 'plague': {
        if (city.size < 5) return undefined;
        // Акведук (чиста вода) чи лікарня стримують пошесть
        const loss = has(BuildingTypeKey.Aqueduct) || has(BuildingTypeKey.Hospital) ? 1 : 2;
        city.size -= loss;
        city.foodNeeded = city.size * 10;
        city.foodStored = Math.min(city.foodStored, city.foodNeeded);
        CityLogic.autoAssignWorkers(city, this.tiles, this.cityEnv(city));
        return `🦠 Чума в місті ${city.name}: −${loss} ${loss === 1 ? 'рівень' : 'рівні'} населення${loss === 1 ? ' (акведук чи лікарня стримали пошесть)' : '. Акведук чи лікарня стримали б її'}.`;
      }
      case 'famine':
        if (has(BuildingTypeKey.Granary)) return `🌾 Неврожай біля міста ${city.name}, але комора зберегла запаси.`;
        city.foodStored = 0;
        return `🥀 Неврожай біля міста ${city.name}: запаси їжі пропали. Комора вберегла б їх.`;
      case 'fire':
        if (city.shieldsStored < 10 || !city.currentProduction.isBuilding) return undefined;
        city.shieldsStored = Math.floor(city.shieldsStored / 2);
        return `🔥 Пожежа на будові в місті ${city.name}: половина щитів згоріла.`;
      case 'quake': {
        if (!around((t) => t.terrain === TerrainType.Hills || t.terrain === TerrainType.Mountains)) return undefined;
        const pool = city.buildings.filter((b) => b !== BuildingTypeKey.Palace && !BUILDING_CONFIGS[b].isWonder);
        if (!pool.length) return undefined;
        const lost = pool[Math.floor(Math.random() * pool.length)];
        city.buildings = city.buildings.filter((b) => b !== lost);
        return `🌋 Землетрус біля міста ${city.name} зруйнував «${BUILDING_CONFIGS[lost].nameUa}».`;
      }
      case 'flood':
        if (!around((t) => t.hasRiver)) return undefined;
        city.foodStored = 0;
        return `🌊 Повінь на річці біля міста ${city.name}: запаси їжі змило.`;
      case 'gold': {
        const gold = 30 + this.turnManager.turnNumber;
        p.gold += gold;
        return `💰 Золота лихоманка біля міста ${city.name}: +${gold} зл. до скарбниці!`;
      }
      case 'harvest':
        city.foodStored = Math.max(city.foodStored, city.foodNeeded - 1);
        return `🌻 Багатий урожай біля міста ${city.name}: комори повні, місто от-от виросте.`;
      case 'scientist': {
        if (!p.currentTechId) return undefined;
        const add = Math.round(TurnManager.researchCost(p) / 2);
        p.researchProgress += add;
        return `🧪 У місті ${city.name} народився великий учений: +${add} колб до дослідження.`;
      }
      case 'artist': {
        // Подарунок — найдешевша ще не збудована споруда, що заспокоює людей
        const gift = Object.values(BUILDING_CONFIGS)
          .filter((b) => !b.isWonder && !b.coastal && !b.highland && !has(b.key) && (!b.requires || has(b.requires)) && (!b.civ || b.civ === p.civ)
            && (!b.prereqTech || p.knownTechs.includes(b.prereqTech))
            && ((b.effects?.content ?? 0) > 0 || b.key === BuildingTypeKey.Temple || b.key === BuildingTypeKey.Colosseum || b.key === BuildingTypeKey.Cathedral))
          .sort((a, b) => a.cost - b.cost)[0];
        if (!gift) return undefined;
        city.buildings.push(gift.key);
        return `🎨 Великий митець прикрасив місто ${city.name}: «${gift.nameUa}» у подарунок.`;
      }
    }
  }

  private globalWarming(): void {
    let polluted = 0;
    for (const row of this.tiles) for (const t of row) if (t.hasPollution) polluted++;
    const before = this.warming;
    this.warming = Math.max(0, this.warming + (polluted > this.warmingSafe() ? polluted - this.warmingSafe() : -2));
    if (before < WARMING_LIMIT / 2 && this.warming >= WARMING_LIMIT / 2) {
      this.news.push(`🌡️ Клімат теплішає: забрудненої землі ${polluted} клітинок. Очищайте смог [P], інакше почнеться глобальне потепління!`);
    }
    if (this.warming < WARMING_LIMIT) return;
    this.warming = 0;
    const land: TileData[] = [];
    for (const row of this.tiles) for (const t of row) if (t.terrain !== TerrainType.Ocean && !t.cityId) land.push(t);
    let changed = 0;
    for (let i = 0; i < Math.round((MAP_WIDTH * MAP_HEIGHT) / 200) && land.length; i++) {
      const t = land.splice(Math.floor(Math.random() * land.length), 1)[0];
      const coast = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => this.tiles[t.y + dy]?.[(t.x + dx + MAP_WIDTH) % MAP_WIDTH]?.terrain === TerrainType.Ocean);
      const next = coast && WARMING_COAST.has(t.terrain) ? TerrainType.Swamp : WARMING_INLAND[t.terrain];
      if (!next || next === t.terrain) continue;
      t.terrain = next;
      t.resource = ResourceType.None;
      t.hasIrrigation = false;
      t.hasMine = false;
      this.terrainChanges.push({ x: t.x, y: t.y });
      changed++;
    }
    for (const c of this.cities.values()) CityLogic.autoAssignWorkers(c, this.tiles, this.cityEnv(c));
    this.news.push(`🌍 Глобальне потепління! Змінився клімат ${changed} клітинок: узбережжя заболочуються, поля висихають, ліси стають джунглями.`);
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
  /** Річка, гори чи пагорби поруч із містом — є де поставити ГЕС (Civ 1). */
  public isHighland(city: City): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      const row = this.tiles[city.y + dy];
      if (!row) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const t = row[(city.x + dx + row.length) % row.length];
        if (t.hasRiver || t.terrain === TerrainType.Mountains || t.terrain === TerrainType.Hills) return true;
      }
    }
    return false;
  }

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
      // Складність: людині — менше задоволених на важких рівнях, AI — інша ціна виробництва
      baseContent: player.isAi ? 4 : DIFFICULTIES[this.options.difficulty].content,
      costFactor: player.isAi && !player.isBarbarian ? DIFFICULTIES[this.options.difficulty].aiCost : 1,
      support: this.supportOf(city.id),
      routeTrade: this.routeTrade(city),
      garrison: this.tiles[city.y][city.x].unitIds
        .map((id) => this.units.get(id))
        .filter((u) => u && u.playerId === city.playerId && UNIT_CONFIGS[u.type].attack > 0).length,
    };
  }

  /** Ціна викупу поточного виробництва (Civ 1): 2×решта + решта²/20; чудо — ×2, з порожнім запасом щитів — ×2. */
  public buyCost(city: City): number {
    const total = Math.round(CityLogic.getProductionCost(city.currentProduction) * (this.cityEnv(city).costFactor ?? 1));
    const left = total - city.shieldsStored;
    if (left <= 0) return 0;
    let cost = 2 * left + Math.floor((left * left) / 20);
    if (city.currentProduction.isBuilding && BUILDING_CONFIGS[city.currentProduction.key as BuildingTypeKey]?.isWonder) cost *= 2;
    if (city.shieldsStored === 0) cost *= 2;
    return cost;
  }

  /**
   * AI вирішує після кроку міст, а варвари ходять одразу за ним — оплачений захисник з'явився б, коли місто вже взяте.
   * Тому AI-місто під загрозою отримує готовий юніт одразу (людина свій отримує на кроці міст, до ходу варварів).
   */
  public completeUnitNow(city: City): Unit | undefined {
    if (city.currentProduction.isBuilding) return undefined;
    const total = Math.round(CityLogic.getProductionCost(city.currentProduction) * (this.cityEnv(city).costFactor ?? 1));
    if (city.shieldsStored < total) return undefined;
    city.shieldsStored -= total;
    const unit = this.createUnit(city.playerId, city.currentProduction.key as UnitTypeKey, city.x, city.y, city.id);
    if (this.trainsVeteran(city, unit.type)) unit.veteran = true;
    return unit;
  }

  /** Чи новий юніт міста — ветеран: казарми (наземні й кораблі), аеропорт (літаки), Сунь-цзи (наземні всюди), портові споруди (кораблі). */
  public trainsVeteran(city: City, type: UnitTypeKey): boolean {
    const cfg = UNIT_CONFIGS[type];
    if (cfg.attack === 0 || type === UnitTypeKey.Nuclear) return false;
    if (cfg.domain === 'air') return city.buildings.includes(BuildingTypeKey.Airport);
    if (cfg.domain === 'land' && this.ownerWonders(city.playerId).has(BuildingTypeKey.SunTzu)) return true;
    if (cfg.domain === 'sea' && city.buildings.includes(BuildingTypeKey.PortFacility)) return true;
    return city.buildings.includes(BuildingTypeKey.Barracks);
  }

  /** Продаж споруди людиною: одна на місто за хід, за її ціну; палац і чудеса не продаються. Повертає виручку. */
  public sellCityBuilding(city: City, key: BuildingTypeKey): number {
    const cfg = BUILDING_CONFIGS[key];
    const turn = this.turnManager.turnNumber;
    if (!cfg || cfg.isWonder || key === BuildingTypeKey.Palace || !city.buildings.includes(key) || city.soldTurn === turn) return 0;
    city.buildings = city.buildings.filter((b) => b !== key);
    city.soldTurn = turn;
    this.players[city.playerId].gold += cfg.cost;
    return cfg.cost;
  }

  /** Викуповує виробництво за золото: воно з'явиться наприкінці ходу. */
  public buyProduction(city: City): boolean {
    const player = this.players[city.playerId];
    const cost = this.buyCost(city);
    if (!cost || player.gold < cost) return false;
    player.gold -= cost;
    city.shieldsStored = Math.round(CityLogic.getProductionCost(city.currentProduction) * (this.cityEnv(city).costFactor ?? 1));
    city.boughtTurn = this.turnManager.turnNumber;
    return true;
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
    // Статуя Свободи: новий устрій одразу, без анархії
    if (this.ownerWonders(playerId).has(BuildingTypeKey.StatueOfLiberty)) {
      p.government = gov;
      p.targetGovernment = undefined;
      this.clampRates(p);
      return true;
    }
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

  /** Повний рух юніта з урахуванням чудес (Маяк: +1 кораблям) і Ядерної енергетики (+1 кораблям). */
  public unitMoves(unit: Unit): number {
    const cfg = UNIT_CONFIGS[unit.type];
    if (cfg.domain !== 'sea') return cfg.moves;
    const w = this.ownerWonders(unit.playerId);
    const atom = this.players[unit.playerId].knownTechs.includes('nuclear_power') ? 1 : 0;
    return cfg.moves + (w.has(BuildingTypeKey.Lighthouse) ? 1 : 0) + (w.has(BuildingTypeKey.Magellan) ? 2 : 0) + atom;
  }

  /** Караван у своєму місті віддає 50 щитів на чудо, яке там будується. */
  public helpWonder(unitId: string): { ok: boolean; reason?: string; city?: City } {
    const unit = this.units.get(unitId);
    const gift = unit && UNIT_CONFIGS[unit.type].wonderShields;
    if (!unit || !gift) return { ok: false, reason: 'Лише караван чи вантажівка' };
    const cityId = this.tiles[unit.y][unit.x].cityId;
    const city = cityId ? this.cities.get(cityId) : undefined;
    if (!city || city.playerId !== unit.playerId) return { ok: false, reason: 'Потрібно бути у вашому місті' };
    const prod = city.currentProduction;
    if (!prod.isBuilding || !BUILDING_CONFIGS[prod.key as BuildingTypeKey]?.isWonder) {
      return { ok: false, reason: 'Місто зараз не будує чудо світу' };
    }
    city.shieldsStored += gift;
    this.removeUnit(unitId);
    return { ok: true, city };
  }

  /** Торгівля з маршрутів: партнер мусить існувати, а з ворогом торгівля стоїть. */
  public routeTrade(city: City): number {
    let sum = 0;
    for (const r of city.tradeRoutes ?? []) {
      const partner = this.cities.get(r.cityId);
      if (!partner || this.diplomacy.atWar(city.playerId, partner.playerId)) continue;
      sum += r.trade;
    }
    return sum;
  }

  /** Що дасть караван з `home` у місті `target`: разовий прибуток і постійна торгівля (формули Civ 1). */
  public tradeRouteOffer(home: City, target: City): { bonus: number; trade: number } {
    // Торгівля самих клітинок, без уже наявних маршрутів — інакше маршрути підживлювали б одне одного
    const base = (c: City) => Math.max(1, this.cityYields(c).trade - this.routeTrade(c));
    const tA = base(home);
    const tB = base(target);
    const foreign = home.playerId !== target.playerId;
    const d = this.distance(home.x, home.y, target.x, target.y);
    const half = foreign ? 1 : 0.5;
    return {
      bonus: Math.max(1, Math.floor(((d + 10) * (tA + tB) / 24) * half)),
      trade: Math.max(1, Math.floor(((tA + tB + 4) / 8) * half)),
    };
  }

  /** Чому караван не може заснувати маршрут у цьому місті (undefined — може). */
  public tradeRouteProblem(unit: Unit, target: City): string | undefined {
    if (!UNIT_CONFIGS[unit.type].wonderShields) return 'Лише караван чи вантажівка';
    const home = unit.homeCityId ? this.cities.get(unit.homeCityId) : undefined;
    if (!home) return 'Караван без рідного міста не торгує';
    if (home.id === target.id) return 'Це рідне місто каравану';
    if (target.playerId !== unit.playerId && this.diplomacy.atWar(unit.playerId, target.playerId)) return 'З ворогом не торгують';
    if (target.playerId === unit.playerId && this.distance(home.x, home.y, target.x, target.y) < 10) {
      return 'Своє місто має бути щонайменше за 10 клітинок від рідного';
    }
    if ((home.tradeRoutes ?? []).some((r) => r.cityId === target.id)) return `Маршрут ${home.name} — ${target.name} уже є`;
    return undefined;
  }

  /**
   * Караван засновує торговий маршрут (Civ 1): разово золото й наука обом не діляться — усе власнику каравану,
   * а постійна торгівля йде обом містам. Понад 3 маршрути — замінюється найслабший, якщо новий кращий.
   */
  public establishTradeRoute(unitId: string, cityId: string): { ok: boolean; reason?: string; text?: string } {
    const unit = this.units.get(unitId);
    const target = this.cities.get(cityId);
    if (!unit || !target) return { ok: false, reason: 'Нема міста' };
    const problem = this.tradeRouteProblem(unit, target);
    if (problem) return { ok: false, reason: problem };
    const home = this.cities.get(unit.homeCityId!)!;
    const offer = this.tradeRouteOffer(home, target);
    const owner = this.players[unit.playerId];
    owner.gold += offer.bonus;
    owner.researchProgress += offer.bonus;
    const added = this.addRoute(home, target.id, offer.trade);
    this.addRoute(target, home.id, offer.trade);
    this.removeUnit(unitId);
    const route = added ? `, маршрут дає +${offer.trade} торгівлі за хід` : ', але в рідного міста вже 3 кращі маршрути';
    return { ok: true, text: `🐪 Караван з ${home.name} прибув до ${target.name}: +${offer.bonus} золота й науки${route}` };
  }

  private addRoute(city: City, partnerId: string, trade: number): boolean {
    // Зниклі міста не тримають місце
    const routes = (city.tradeRoutes ?? []).filter((r) => this.cities.has(r.cityId));
    if (routes.length >= 3) {
      routes.sort((a, b) => a.trade - b.trade);
      if (routes[0].trade >= trade) {
        city.tradeRoutes = routes;
        return false;
      }
      routes.shift();
    }
    routes.push({ cityId: partnerId, trade });
    city.tradeRoutes = routes;
    return true;
  }

  /** Коли востаннє нагадували, що місто вперлося в акведук чи каналізацію (не зберігається). */
  private growthNagTurn = new Map<string, number>();

  public processTurnEnd(): { techDiscovered?: string; completedItems: string[]; idleCities: string[] } {
    const completedItems: string[] = [];
    // Міста людини, що добудували споруду й перейшли на запасне ополчення, — як у Civ 1, питаємо, що далі
    const idleCities: string[] = [];
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
      this.enforceUpkeep(city, completedItems);
      const res = CityLogic.processTurn(city, this.tiles, this.cityEnv(city));
      if (res.coinage) this.players[city.playerId].gold += res.coinage;
      const mine = city.playerId === human.id;
      // Нагадування раз на 10 ходів, а не щоходу — інакше заглушує решту журналу
      const nag = mine && (res.needsAqueduct || res.needsSewer) && this.turnManager.turnNumber - (this.growthNagTurn.get(city.id) ?? -99) >= 10;
      if (nag) {
        this.growthNagTurn.set(city.id, this.turnManager.turnNumber);
        completedItems.push(`${city.name} не може рости далі без ${res.needsAqueduct ? 'акведука' : 'каналізації'}`);
      }
      if (!res.completedProduction) continue;
      if (!res.completedProduction.isBuilding) {
        const newUnit = this.createUnit(city.playerId, res.completedProduction.key as UnitTypeKey, city.x, city.y, city.id);
        // Казарми — ветерани серед наземних і кораблів, аеропорт — серед літаків
        if (this.trainsVeteran(city, newUnit.type)) newUnit.veteran = true;
        if (mine) completedItems.push(`${city.name} створило юніт: ${UNIT_CONFIGS[newUnit.type].nameUa}${newUnit.veteran ? ' (ветеран)' : ''}`);
      } else {
        const cfg = BUILDING_CONFIGS[res.completedProduction.key as BuildingTypeKey];
        if (cfg.spacePart) {
          // Частина корабля йде на стартовий майданчик, а не в місто; місто будує далі те саме, поки можна
          city.buildings = city.buildings.filter((b) => b !== cfg.key);
          const ship = this.spaceship(city.playerId);
          ship[cfg.spacePart]++;
          if (this.canBuildSpacePart(city.playerId, cfg.key)) city.currentProduction = { isBuilding: true, key: cfg.key };
          if (mine) completedItems.push(`🚀 ${city.name}: готово — ${cfg.nameUa.replace('🚀 ', '')} (${this.shipSummary(ship)})`);
          continue;
        }
        if (mine) idleCities.push(city.id);
        // Запасне ополчення з city.ts у 1900-х — марнування щитів: беремо сучасного оборонця
        if (city.currentProduction.key === UnitTypeKey.Militia) city.currentProduction = { isBuilding: false, key: civUnit(bestBasicDefender(this.players[city.playerId].knownTechs), this.players[city.playerId].civ) };
        if (cfg.isWonder) {
          if (cfg.key === BuildingTypeKey.Apollo) this.revealAllCities(city.playerId);
          if (cfg.key === BuildingTypeKey.MarcoPolo) this.diplomacy.meetEveryone(city.playerId);
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
          if (unit.task.kind === 'transform') this.terrainChanges.push({ x: tile.x, y: tile.y });
          // Жителі переходять на покращену клітинку одразу: місто без надлишку їжі не росте, і без цього зрошення не діяло б ніколи
          for (const c of this.cities.values()) {
            const dx = Math.abs(c.x - tile.x);
            if (Math.max(Math.min(dx, MAP_WIDTH - dx), Math.abs(c.y - tile.y)) <= 2) CityLogic.autoAssignWorkers(c, this.tiles, this.cityEnv(c));
          }
          if (unit.playerId === 0) {
            completedItems.push(`${UNIT_CONFIGS[unit.type].nameUa} завершили: ${TERRAFORM_INFO[unit.task.kind].nameUa.toLowerCase()}`);
          }
          unit.task = undefined;
        }
      }
      unit.movesLeft = unit.task ? 0 : this.unitMoves(unit);
      // Пальне: у своєму місті чи на авіаносці — повний бак, у небі — мінус хід, порожній бак — падіння
      const fuel = UNIT_CONFIGS[unit.type].fuel;
      if (fuel) {
        unit.fuel = this.atAirBase(unit) ? fuel : (unit.fuel ?? fuel) - 1;
        if (unit.fuel <= 0) {
          if (unit.playerId === 0) completedItems.push(`✈️ ${UNIT_CONFIGS[unit.type].nameUa}: скінчилось пальне — літак розбився`);
          this.removeUnit(unit.id);
        }
      }
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
    this.globalWarming();
    this.randomEvents(completedItems);

    // 4. Хід AI і навала варварів
    // Знайомства (юніти й міста поруч), потім дипломатія й ходи AI
    this.diplomacy.detectContacts();
    this.processAiTurns();
    const raid = this.spawnBarbarians();
    if (raid) completedItems.push(raid);

    // 5. Календар; загибель цивілізацій, кораблі до Альфи Центавра, кінець гри
    this.turnManager.advanceCalendar();
    this.checkEliminations();
    this.checkArrivals();
    this.checkGameEnd();
    completedItems.push(...this.news.splice(0));

    return {
      techDiscovered: humanTech,
      completedItems,
      idleCities,
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
      TurnManager.learnTech(player, tech);
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
        this.createUnit(this.barbarianId, UnitTypeKey.Legion, x, y);
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

  // ---------- Космічна гонка ----------

  public spaceship(playerId: number): Spaceship {
    const p = this.players[playerId];
    if (!p.spaceship) p.spaceship = { structural: 0, component: 0, module: 0 };
    return p.spaceship;
  }

  public shipSummary(s: Spaceship): string {
    return `каркасів ${s.structural}, двигунів ${s.component}, модулів ${s.module}`;
  }

  /** Чи може гравець будувати цю частину: технологія, «Аполлон» будь-де, ліміт, корабель ще не в польоті. */
  public canBuildSpacePart(playerId: number, key: BuildingTypeKey): boolean {
    const cfg = BUILDING_CONFIGS[key];
    if (!cfg.spacePart) return false;
    const p = this.players[playerId];
    const ship = this.spaceship(playerId);
    return (!cfg.prereqTech || p.knownTechs.includes(cfg.prereqTech))
      && this.isWonderBuilt(BuildingTypeKey.Apollo)
      && ship.arrivalYear === undefined
      && ship[cfg.spacePart] < SPACE_LIMITS[cfg.spacePart];
  }

  /** Політ: 20 років мінус 2 за кожен двигун (не менше 5). */
  public flightYears(s: Spaceship): number {
    return Math.max(5, 20 - 2 * s.component);
  }

  /** Шанс долетіти: 40% + 20% за модуль. */
  public flightSuccess(s: Spaceship): number {
    return Math.min(1, 0.4 + 0.2 * s.module);
  }

  /** Що заважає запуску (undefined — можна стартувати). */
  public launchProblem(playerId: number): string | undefined {
    const s = this.spaceship(playerId);
    if (s.arrivalYear !== undefined) return 'Корабель уже в польоті';
    if (s.component < 1) return 'Потрібен хоча б один двигун';
    if (s.module < 1) return 'Потрібен хоча б один модуль';
    if (s.component + s.module > s.structural) return `Бракує каркасів: двигуни й модулі (${s.component + s.module}) потребують стільки ж каркасів (є ${s.structural})`;
    const capital = [...this.cities.values()].some((c) => c.playerId === playerId && c.buildings.includes(BuildingTypeKey.Palace));
    if (!capital) return 'Запуск — лише зі столиці, а палацу немає';
    return undefined;
  }

  /** Запуск корабля до Альфи Центавра — новина для всього світу. */
  public launchSpaceship(playerId: number): boolean {
    if (this.launchProblem(playerId)) return false;
    const s = this.spaceship(playerId);
    s.arrivalYear = this.turnManager.year + this.flightYears(s);
    s.success = this.flightSuccess(s);
    const p = this.players[playerId];
    const msg = `🚀 ${p.nameUa} запустили космічний корабель до Альфи Центавра! Прибуття — ${TurnManager.formatYear(s.arrivalYear)}`;
    if (playerId !== 0) this.news.push(msg);
    return true;
  }

  /** «Аполлон»: власник бачить усі міста світу. */
  private revealAllCities(playerId: number): void {
    for (const c of this.cities.values()) this.revealFog(playerId, c.x, c.y, 1);
  }

  /** Кораблі, чий рік прибуття настав: успіх — перемога, невдача — корабель втрачено. */
  private checkArrivals(): void {
    if (this.gameOver) return;
    for (const p of this.players) {
      const s = p.spaceship;
      if (!p.alive || s?.arrivalYear === undefined || this.turnManager.year < s.arrivalYear) continue;
      if (Math.random() < (s.success ?? 0)) {
        this.news.push(`🌟 Корабель цивілізації ${p.nameUa} досяг Альфи Центавра! Колоністів: ${s.module * 10000}.`);
        this.gameOver = { reason: 'space', winner: p.id, year: this.turnManager.getYearString() };
        return;
      }
      this.news.push(`💥 Зв'язок із кораблем цивілізації ${p.nameUa} втрачено — колоністи не долетіли.`);
      p.spaceship = undefined;
    }
  }

  // ---------- Кінець гри ----------

  /** Чим закінчилась гра (undefined — гра триває). */
  public gameOver?: GameOver;

  /** Цивілізація без міст і поселенців гине (Civ 1). */
  private checkEliminations(): void {
    for (const p of this.players) {
      if (!p.alive || p.isBarbarian) continue;
      const hasCity = [...this.cities.values()].some((c) => c.playerId === p.id);
      const hasSettlers = [...this.units.values()].some((u) => u.playerId === p.id && u.type === UnitTypeKey.Settlers);
      if (hasCity || hasSettlers) continue;
      p.alive = false;
      p.spaceship = undefined;
      for (const u of [...this.units.values()]) if (u.playerId === p.id) this.removeUnit(u.id);
      this.news.push(`💀 Цивілізацію ${p.nameUa} знищено.`);
    }
  }

  /** Завоювання, загибель людини або 2100 рік. */
  private checkGameEnd(): void {
    if (this.gameOver) return;
    const year = this.turnManager.getYearString();
    if (!this.players[0].alive) {
      this.gameOver = { reason: 'destroyed', year };
      return;
    }
    const alive = this.players.filter((p) => p.alive && !p.isBarbarian);
    if (alive.length === 1) {
      this.gameOver = { reason: 'conquest', winner: alive[0].id, year };
      return;
    }
    if (this.turnManager.year >= 2100) {
      const best = alive.reduce((a, b) => (this.score(b.id).total > this.score(a.id).total ? b : a));
      this.gameOver = { reason: 'time', winner: best.id, year };
    }
  }

  /**
   * Рахунок цивілізації (у дусі Civ 1): задоволений громадянин +1, щасливий +2, чудо +20,
   * технологія майбутнього +5, долетілі модулі по +50, забруднені клітинки біля своїх міст −5.
   */
  public score(playerId: number): { citizens: number; wonders: number; future: number; space: number; pollution: number; total: number } {
    let citizens = 0;
    let pollution = 0;
    for (const c of this.cities.values()) {
      if (c.playerId !== playerId) continue;
      const y = this.cityYields(c);
      citizens += y.content + y.happy * 2;
      pollution += c.workedTiles.filter((t) => this.tiles[t.y][t.x].hasPollution).length;
    }
    const p = this.players[playerId];
    const wonders = this.ownerWonders(playerId).size * 20;
    const future = (p.futureTechs ?? 0) * 5;
    const space = this.gameOver?.reason === 'space' && this.gameOver.winner === playerId ? (p.spaceship?.module ?? 0) * 50 : 0;
    const total = citizens + wonders + future + space - pollution * 5;
    return { citizens, wonders, future, space, pollution: -pollution * 5, total };
  }

  // ---------- Збереження ----------

  /** Знімок усього стану гри (без кешів: unitIds і cityId клітинок відновлюються з юнітів і міст). */
  public serialize(): SaveData {
    const fogRow = (row: boolean[]) => row.map((b) => (b ? '1' : '0')).join('');
    return {
      version: 1,
      options: this.options,
      tiles: this.tiles.map((row) => row.map((t) => [
        TERRAINS.indexOf(t.terrain),
        RESOURCES.indexOf(t.resource),
        TILE_FLAGS.reduce((m, f, i) => (t[f] ? m | (1 << i) : m), 0),
      ] as [number, number, number])),
      units: [...this.units.values()],
      cities: [...this.cities.values()],
      players: this.players,
      fogs: [...this.playerFogs.entries()].map(([id, f]) => ({ id, explored: f.explored.map(fogRow), visible: f.visible.map(fogRow) })),
      turn: { turnNumber: this.turnManager.turnNumber, yearBC: this.turnManager.yearBC, isAD: this.turnManager.isAD },
      nextId: this.nextId,
      cityNameIndex: [...this.cityNameIndex.entries()],
      news: this.news,
      aggression: [...this.aggression.entries()],
      diplomacy: this.diplomacy.serialize(),
      barbarianId: this.barbarianId,
      gameOver: this.gameOver,
      warming: this.warming,
      uiData: this.uiData,
    };
  }

  private restore(s: SaveData): void {
    this.tiles = s.tiles.map((row, y) => row.map(([t, r, flags], x) => {
      const tile: TileData = {
        x, y, terrain: TERRAINS[t], resource: RESOURCES[r],
        hasRoad: false, hasRailroad: false, hasIrrigation: false, hasMine: false, hasRiver: false, unitIds: [],
      };
      TILE_FLAGS.forEach((f, i) => { if (flags & (1 << i)) tile[f] = true; });
      return tile;
    }));
    this.players = s.players;
    this.barbarianId = s.barbarianId;
    for (const u of s.units) {
      this.units.set(u.id, u);
      this.tiles[u.y][u.x].unitIds.push(u.id);
    }
    for (const c of s.cities) {
      this.cities.set(c.id, c);
      this.tiles[c.y][c.x].cityId = c.id;
    }
    const fogRow = (str: string) => [...str].map((ch) => ch === '1');
    for (const f of s.fogs) this.playerFogs.set(f.id, { explored: f.explored.map(fogRow), visible: f.visible.map(fogRow) });
    Object.assign(this.turnManager, s.turn);
    this.nextId = s.nextId;
    this.cityNameIndex = new Map(s.cityNameIndex);
    this.news = s.news;
    this.aggression = new Map(s.aggression);
    this.diplomacy.restore(s.diplomacy);
    this.gameOver = s.gameOver;
    this.uiData = s.uiData ?? {};
    this.warming = s.warming ?? 0;
  }

  /**
   * Захоплення міста: новий власник, населення −1, палац руйнується.
   * Підкуп дипломатом (`incited`): без втрати жителів, загони в місті переходять разом із ним.
   */
  /** Партизанська війна: при захопленні міста довкола з'являються ветерани-партизани колишнього власника (до 4). */
  private raisePartisans(city: City, ownerId: number): number {
    const owner = this.players[ownerId];
    if (!owner.alive || owner.isBarbarian || !owner.knownTechs.includes('guerrilla_warfare')) return 0;
    const want = Math.min(4, Math.max(1, Math.floor(city.size / 2)));
    let made = 0;
    for (let r = 1; r <= 2 && made < want; r++) {
      for (let dy = -r; dy <= r && made < want; dy++) {
        for (let dx = -r; dx <= r && made < want; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const y = city.y + dy;
          if (y < 0 || y >= MAP_HEIGHT) continue;
          const x = (city.x + dx + MAP_WIDTH) % MAP_WIDTH;
          const t = this.tiles[y][x];
          if (t.terrain === TerrainType.Ocean || t.cityId || t.unitIds.length) continue;
          const p = this.createUnit(ownerId, UnitTypeKey.Partisans, x, y);
          p.veteran = true;
          p.isFortified = true;
          made++;
        }
      }
    }
    return made;
  }

  /** Десант: зі свого міста, поки не ходив, — на розвідану вільну клітинку суші в радіусі. */
  public paradrop(unitId: string, x: number, y: number): { ok: boolean; reason?: string } {
    const unit = this.units.get(unitId);
    const cfg = unit && UNIT_CONFIGS[unit.type];
    if (!unit || !cfg?.paradrop) return { ok: false, reason: 'Стрибають лише десантники' };
    const from = this.tiles[unit.y][unit.x];
    if (!from.cityId || this.cities.get(from.cityId)!.playerId !== unit.playerId) return { ok: false, reason: 'Стрибають лише зі свого міста' };
    if (unit.movesLeft < cfg.moves) return { ok: false, reason: 'Цього ходу десантники вже рухались' };
    x = (x + MAP_WIDTH) % MAP_WIDTH;
    const t = this.tiles[y]?.[x];
    if (!t || this.distance(unit.x, unit.y, x, y) > cfg.paradrop) return { ok: false, reason: `Задалеко: стрибок — до ${cfg.paradrop} клітинок` };
    if (!this.playerFogs.get(unit.playerId)?.explored[y][x]) return { ok: false, reason: 'Туди ще не ходили розвідники' };
    if (t.terrain === TerrainType.Ocean) return { ok: false, reason: 'У море не стрибають' };
    if (t.unitIds.some((id) => this.units.get(id)?.playerId !== unit.playerId)
      || (t.cityId && this.cities.get(t.cityId)!.playerId !== unit.playerId)) return { ok: false, reason: 'Просто на ворога не стрибають' };
    unit.isFortified = false;
    unit.carriedBy = undefined;
    this.relocateUnit(unit, x, y);
    unit.movesLeft = 0;
    this.revealFog(unit.playerId, x, y, 2);
    return { ok: true };
  }

  public captureCity(city: City, newOwner: number, incited = false): string {
    const capitalFell = city.buildings.includes(BuildingTypeKey.Palace);
    const oldOwner = this.players[city.playerId];
    if (incited) {
      for (const id of this.tiles[city.y][city.x].unitIds) {
        const u = this.units.get(id)!;
        if (u.playerId !== oldOwner.id) continue;
        u.playerId = newOwner;
        u.homeCityId = city.id;
        u.aiTarget = undefined;
        u.aiMission = undefined;
      }
    }
    // Впала столиця — корабель (і в польоті теж) втрачено, як у Civ 1
    const ship = oldOwner.spaceship;
    if (city.buildings.includes(BuildingTypeKey.Palace) && ship && ship.structural + ship.component + ship.module > 0) {
      oldOwner.spaceship = undefined;
      this.news.push(`💥 ${oldOwner.nameUa} втратили столицю — а з нею й космічний корабель!`);
    }
    // Юніти, яких утримувало місто, лишаються без постачання й розходяться (Civ 1)
    const orphans = this.supportedUnits(city).filter((u) => u.playerId === oldOwner.id);
    orphans.forEach((u) => this.removeUnit(u.id));
    if (orphans.length && oldOwner.id === 0) this.news.push(`🪖 Разом із містом ${city.name} ви втратили військо, яке воно утримувало: ${orphans.length}`);
    const partisans = incited ? 0 : this.raisePartisans(city, oldOwner.id);
    if (partisans && (oldOwner.id === 0 || newOwner === 0)) this.news.push(`🌲 Довкола міста ${city.name} піднялися партизани (${oldOwner.nameUa}): ${partisans}`);
    city.playerId = newOwner;
    if (!incited) city.size = Math.max(1, city.size - 1);
    city.foodNeeded = city.size * 10;
    city.foodStored = 0;
    city.shieldsStored = 0;
    city.buildings = city.buildings.filter((b) => b !== BuildingTypeKey.Palace);
    city.currentProduction = { isBuilding: false, key: UnitTypeKey.Militia };
    CityLogic.autoAssignWorkers(city, this.tiles);
    const msg = incited
      ? `💰 Місто ${city.name} (${oldOwner.nameUa}) повстало й перейшло до: ${this.players[newOwner].nameUa}!`
      : `🔥 Місто ${city.name} (${oldOwner.nameUa}) захоплено — тепер воно належить: ${this.players[newOwner].nameUa}!`;
    if (newOwner !== 0) this.news.push(msg); // свої захоплення людина бачить одразу
    if (capitalFell) this.civilWar(oldOwner.id);
    return msg;
  }

  /**
   * Громадянська війна (Civ 1): упала столиця AI-імперії з 8+ містами — дальня від найбільшого міста половина
   * повстає новою цивілізацією (з вільних у CIVS), що одразу воює з колишньою. Новий гравець іде після варварів,
   * щоб не зсувати номери наявних.
   */
  private civilWar(oldId: number): void {
    const old = this.players[oldId];
    if (!old.isAi || old.isBarbarian) return;
    const cities = [...this.cities.values()].filter((c) => c.playerId === oldId);
    // Після падіння столиці лишилось 5+ міст (тобто імперія мала 6+)
    if (cities.length < 5) return;
    const used = new Set(this.players.map((p) => p.civ));
    const free = (Object.keys(CIVS) as CivKey[]).filter((c) => !used.has(c));
    if (!free.length) return;
    const civ = free[Math.floor(Math.random() * free.length)];
    const core = cities.reduce((a, b) => (b.size > a.size ? b : a));
    const rebels = cities.filter((c) => c !== core)
      .sort((a, b) => this.distance(b.x, b.y, core.x, core.y) - this.distance(a.x, a.y, core.x, core.y))
      .slice(0, Math.floor(cities.length / 2));
    const id = this.players.length;
    const p: Player = {
      id, civ, nameUa: CIVS[civ].nameUa, leaderUa: CIVS[civ].leaderUa, color: CIVS[civ].color, colorHex: CIVS[civ].colorHex,
      isAi: true, hostileFromTurn: CIVS[civ].hostileFromTurn, gold: Math.floor(old.gold / 2),
      taxRate: old.taxRate, scienceRate: old.scienceRate, luxuryRate: old.luxuryRate, researchProgress: 0,
      knownTechs: [...old.knownTechs], futureTechs: old.futureTechs, alive: true, government: old.government,
    };
    old.gold -= p.gold;
    this.players.push(p);
    const fog = this.playerFogs.get(oldId)!;
    this.playerFogs.set(id, { explored: fog.explored.map((r) => [...r]), visible: fog.visible.map((r) => [...r]) });
    const rebelIds = new Set(rebels.map((c) => c.id));
    for (const c of rebels) c.playerId = id;
    rebels.reduce((a, b) => (b.size > a.size ? b : a)).buildings.push(BuildingTypeKey.Palace);
    // Військо повсталих міст і все, що стоїть у них, переходить до повстанців (разом із пасажирами кораблів)
    const turned = new Set<string>();
    for (const u of this.units.values()) {
      const at = this.tiles[u.y][u.x].cityId;
      if (u.playerId === oldId && ((u.homeCityId && rebelIds.has(u.homeCityId)) || (at && rebelIds.has(at)))) turned.add(u.id);
    }
    for (const u of this.units.values()) if (u.carriedBy && turned.has(u.carriedBy)) turned.add(u.id);
    for (const uid of turned) {
      const u = this.units.get(uid)!;
      u.playerId = id;
      u.aiTarget = undefined;
      u.aiMission = undefined;
      if (u.homeCityId && !rebelIds.has(u.homeCityId)) u.homeCityId = undefined;
    }
    for (const c of rebels) CityLogic.autoAssignWorkers(c, this.tiles, this.cityEnv(c));
    this.diplomacy.meet(oldId, id);
    this.diplomacy.startWar(oldId, id);
    this.news.push(`⚔️ Громадянська війна! Після падіння столиці ${old.nameUa} розкололися: ${rebels.length} міст повстали й стали новою цивілізацією — ${p.nameUa} (лідер ${p.leaderUa}).`);
  }

  /**
   * Навала варварів (з ~2000 до н.е.): час від часу загін з'являється за 5–8 клітинок
   * від випадкового міста, на суші, де нікого немає.
   */
  private spawnBarbarians(): string | undefined {
    // З ~1000 до н.е.; спершу поодинці, з ~1 н.е. — загонами
    if (this.turnManager.turnNumber < DIFFICULTIES[this.options.difficulty].barbariansFrom || Math.random() > 0.1) return undefined;
    // Навали не накопичуються безкінечно
    if ([...this.units.values()].filter((u) => u.playerId === this.barbarianId).length >= 12) return undefined;
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

      this.createUnit(this.barbarianId, UnitTypeKey.Legion, x, y);
      // Пізніше — загони з вершниками
      if (this.turnManager.turnNumber > 100) {
        this.createUnit(this.barbarianId, this.turnManager.turnNumber > 130 ? UnitTypeKey.Cavalry : UnitTypeKey.Legion, x, y);
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
      if (c.playerId === this.barbarianId) continue;
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
      if (unit.playerId === this.barbarianId && this.units.has(unit.id)) this.moveBarbarian(unit);
    }
  }

  /** Назви міст по черзі, як у Civ 1: перша — столиця. */
  private generateCityName(playerId: number): string {
    const names = CIVS[this.players[playerId].civ ?? 'romans'].cityNames;
    const i = this.cityNameIndex.get(playerId) ?? 0;
    this.cityNameIndex.set(playerId, i + 1);
    return i < names.length ? names[i] : `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`;
  }

  /** Перевірка, чи може поселенець почати роботу на своїй клітинці. */
  public checkTask(unitId: string, kind: TerraformKind): TerraformCheck {
    const unit = this.units.get(unitId);
    if (!unit || !canTerraform(unit.type)) return { ok: false, turns: 0, reason: 'Лише робітники чи поселенці' };
    if (kind === 'transform' && unit.type !== UnitTypeKey.Engineers) return { ok: false, turns: 0, reason: 'Рельєф перетворюють лише інженери' };
    const tile = this.tiles[unit.y][unit.x];
    const player = this.players[unit.playerId];
    const check = checkTerraform(this.tiles, tile, kind, player);
    // Вибухівка: робітники (не поселенці) працюють удвічі швидше, як інженери Civ 1
    if (check.ok && (unit.type === UnitTypeKey.Engineers || (unit.type === UnitTypeKey.Workers && player.knownTechs.includes('explosives')))) {
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

/** Знімок гри для збереження (localStorage). Клітинки — компактно: [рельєф, ресурс, прапорці]. */
export interface SaveData {
  version: 1;
  options: GameOptions;
  tiles: [number, number, number][][];
  units: Unit[];
  cities: City[];
  players: Player[];
  /** Туман: рядки з '0'/'1' (розвідано, видно) */
  fogs: { id: number; explored: string[]; visible: string[] }[];
  turn: { turnNumber: number; yearBC: number; isAD: boolean };
  nextId: number;
  cityNameIndex: [number, number][];
  news: string[];
  aggression: [string, number][];
  barbarianId: number;
  gameOver?: GameOver;
  diplomacy?: DiplomacyData;
  warming?: number;
  uiData?: Record<string, unknown>;
}

const WARMING_COAST = new Set([TerrainType.Grassland, TerrainType.Plains, TerrainType.Tundra, TerrainType.Forest, TerrainType.Jungle]);
const WARMING_INLAND: Partial<Record<TerrainType, TerrainType>> = {
  [TerrainType.Grassland]: TerrainType.Plains, [TerrainType.Plains]: TerrainType.Desert, [TerrainType.Forest]: TerrainType.Jungle,
  [TerrainType.Glacier]: TerrainType.Tundra, [TerrainType.Tundra]: TerrainType.Plains,
};

const TERRAINS = Object.values(TerrainType);
const RESOURCES = Object.values(ResourceType);
const TILE_FLAGS = ['hasRoad', 'hasRailroad', 'hasIrrigation', 'hasMine', 'hasRiver', 'hasPollution', 'hasHut'] as const;

/** Застарілий, як у Civ 1: технологія його наступника вже відома. */
export function isObsoleteUnit(type: UnitTypeKey, knownTechs: string[]): boolean {
  const next = UPGRADES[type];
  if (!next) return false;
  const req = UNIT_CONFIGS[next].prereqTech;
  return !req || knownTechs.includes(req);
}

/** Найкращий відомий оборонець з лінійки Ополчення → … → Мотопіхота. */
export function bestBasicDefender(knownTechs: string[]): UnitTypeKey {
  let type = UnitTypeKey.Militia;
  while (isObsoleteUnit(type, knownTechs)) type = UPGRADES[type]!;
  return type;
}

/** Що чим застаріває (для Майстерні Леонардо). */
const UPGRADES: Partial<Record<UnitTypeKey, UnitTypeKey>> = {
  [UnitTypeKey.Militia]: UnitTypeKey.Phalanx,
  [UnitTypeKey.Phalanx]: UnitTypeKey.Pikemen,
  [UnitTypeKey.Pikemen]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Musketeers]: UnitTypeKey.Riflemen,
  [UnitTypeKey.Riflemen]: UnitTypeKey.MechInf,
  [UnitTypeKey.Archers]: UnitTypeKey.Crossbowmen,
  [UnitTypeKey.Legion]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Catapult]: UnitTypeKey.Trebuchet,
  [UnitTypeKey.Cannon]: UnitTypeKey.Artillery,
  [UnitTypeKey.Artillery]: UnitTypeKey.Howitzer,
  [UnitTypeKey.Cavalry]: UnitTypeKey.Knights,
  [UnitTypeKey.Chariot]: UnitTypeKey.Knights,
  [UnitTypeKey.Elephants]: UnitTypeKey.Crusaders,
  [UnitTypeKey.Knights]: UnitTypeKey.Crusaders,
  [UnitTypeKey.Crusaders]: UnitTypeKey.Dragoons,
  [UnitTypeKey.Dragoons]: UnitTypeKey.Armor,
  [UnitTypeKey.AlpineTroops]: UnitTypeKey.MechInf,
  [UnitTypeKey.Workers]: UnitTypeKey.Engineers,
  [UnitTypeKey.Caravan]: UnitTypeKey.Freight,
  [UnitTypeKey.Fighter]: UnitTypeKey.StealthFighter,
  [UnitTypeKey.Bomber]: UnitTypeKey.StealthBomber,
  [UnitTypeKey.Cruiser]: UnitTypeKey.AegisCruiser,
  [UnitTypeKey.Diplomat]: UnitTypeKey.Spy,
  [UnitTypeKey.Sail]: UnitTypeKey.Caravel,
  [UnitTypeKey.Caravel]: UnitTypeKey.Frigate,
  [UnitTypeKey.Frigate]: UnitTypeKey.Ironclad,
  [UnitTypeKey.Galleon]: UnitTypeKey.Transport,
  [UnitTypeKey.Ironclad]: UnitTypeKey.Cruiser,
  // Унікальні застарівають так само, як ті, кого замінюють
  [UnitTypeKey.Cossacks]: UnitTypeKey.Armor,
  [UnitTypeKey.Praetorians]: UnitTypeKey.Musketeers,
  [UnitTypeKey.WarChariot]: UnitTypeKey.Knights,
  [UnitTypeKey.Hoplites]: UnitTypeKey.Pikemen,
  [UnitTypeKey.BabylonBowmen]: UnitTypeKey.Musketeers,
  [UnitTypeKey.ChuKoNu]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Keshik]: UnitTypeKey.Crusaders,
  [UnitTypeKey.JaguarWarriors]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Longbowmen]: UnitTypeKey.Musketeers,
  [UnitTypeKey.HorseArchers]: UnitTypeKey.Knights,
  [UnitTypeKey.BatteringRam]: UnitTypeKey.Catapult,
  [UnitTypeKey.Bireme]: UnitTypeKey.Caravel,
  [UnitTypeKey.Crossbowmen]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Trebuchet]: UnitTypeKey.Cannon,
  [UnitTypeKey.Landsknechts]: UnitTypeKey.Musketeers,
  [UnitTypeKey.Grenadiers]: UnitTypeKey.Riflemen,
  [UnitTypeKey.Cuirassiers]: UnitTypeKey.Armor,
  [UnitTypeKey.ShipOfTheLine]: UnitTypeKey.Ironclad,
  [UnitTypeKey.Privateer]: UnitTypeKey.Destroyer,
  [UnitTypeKey.MachineGunners]: UnitTypeKey.MechInf,
  [UnitTypeKey.ArmoredCar]: UnitTypeKey.Armor,
  [UnitTypeKey.Dreadnought]: UnitTypeKey.Battleship,
  [UnitTypeKey.AntiTankGun]: UnitTypeKey.MechInf,
  [UnitTypeKey.RocketArtillery]: UnitTypeKey.Howitzer,
  [UnitTypeKey.ModernArmor]: UnitTypeKey.HoverTank,
  [UnitTypeKey.LaserInfantry]: UnitTypeKey.BattleMech,
  [UnitTypeKey.HoverTank]: UnitTypeKey.BattleMech,
  [UnitTypeKey.MissileSubmarine]: UnitTypeKey.PlasmaCruiser,
  [UnitTypeKey.Armor]: UnitTypeKey.ModernArmor,
  [UnitTypeKey.Panzer]: UnitTypeKey.ModernArmor,
  [UnitTypeKey.Battleship]: UnitTypeKey.PlasmaCruiser,
  [UnitTypeKey.Submarine]: UnitTypeKey.MissileSubmarine,
  [UnitTypeKey.MechInf]: UnitTypeKey.LaserInfantry,
  [UnitTypeKey.Conquistadors]: UnitTypeKey.Dragoons,
  [UnitTypeKey.Snipers]: UnitTypeKey.LaserInfantry,
  [UnitTypeKey.Zeppelin]: UnitTypeKey.Bomber,
  [UnitTypeKey.Balloon]: UnitTypeKey.Awacs,
};
