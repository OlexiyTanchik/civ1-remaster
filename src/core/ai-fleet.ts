/**
 * AI на морі й у повітрі (наскрізний блок B).
 * Пороми переправляють поселенців на інші континенти й армії до ворожих прибережних міст;
 * бойові кораблі б'ють ворожі кораблі й прибережні загони, коли шанси добрі, інакше стоять у портах;
 * літаки базуються в містах і атакують лише в радіусі, з якого встигають повернутися того ж ходу.
 */
import type { World } from './world';
import type { AiController } from './ai';
import { City, Unit, UnitTypeKey, TerrainType, Player } from './types';
import { UNIT_CONFIGS, MAP_WIDTH, MAP_HEIGHT } from './constants';

type Step = { x: number; y: number };

/** Скільки ходів пором чекає в порту, поки збереться десант. */
const FERRY_PATIENCE = 4;
/** Скільки ходів пасажир чекає на пором, перш ніж відмовитись від переправи. */
const PASSENGER_PATIENCE = 30;
/** Найбільше одночасних десантників на гравця. */
const MAX_INVADERS = 6;

const NEIGHBORS: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export class FleetAi {
  private continentIds?: Int32Array;
  private continentSize = '';

  constructor(private world: World, private ai: AiController) {}

  // ---------- Континенти ----------

  /** Номер суходолу (заливка 8 напрямками); −1 — море. Рахуємо раз на мапу. */
  public continentOf(x: number, y: number): number {
    const key = `${MAP_WIDTH}x${MAP_HEIGHT}`;
    if (!this.continentIds || this.continentSize !== key) {
      const ids = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
      let next = 0;
      for (let sy = 0; sy < MAP_HEIGHT; sy++) {
        for (let sx = 0; sx < MAP_WIDTH; sx++) {
          if (ids[sy * MAP_WIDTH + sx] !== -1 || this.world.tiles[sy][sx].terrain === TerrainType.Ocean) continue;
          const stack = [sy * MAP_WIDTH + sx];
          ids[stack[0]] = next;
          while (stack.length) {
            const k = stack.pop()!;
            const cx = k % MAP_WIDTH;
            const cy = Math.floor(k / MAP_WIDTH);
            for (const [dx, dy] of NEIGHBORS) {
              const ny = cy + dy;
              if (ny < 0 || ny >= MAP_HEIGHT) continue;
              const nk = ny * MAP_WIDTH + (cx + dx + MAP_WIDTH) % MAP_WIDTH;
              if (ids[nk] !== -1 || this.world.tiles[ny][nk % MAP_WIDTH].terrain === TerrainType.Ocean) continue;
              ids[nk] = next;
              stack.push(nk);
            }
          }
          next++;
        }
      }
      this.continentIds = ids;
      this.continentSize = key;
    }
    return this.continentIds[y * MAP_WIDTH + x];
  }

  private touchesSea(x: number, y: number): boolean {
    return this.neighbors(x, y).some((p) => this.world.tiles[p.y][p.x].terrain === TerrainType.Ocean);
  }

  private neighbors(x: number, y: number): Step[] {
    const out: Step[] = [];
    for (const [dx, dy] of NEIGHBORS) {
      const ny = y + dy;
      if (ny >= 0 && ny < MAP_HEIGHT) out.push({ x: (x + dx + MAP_WIDTH) % MAP_WIDTH, y: ny });
    }
    return out;
  }

  /** Свої прибережні міста (порти). */
  private ports(playerId: number): City[] {
    return this.ai.citiesOf(playerId).filter((c) => this.ai.isCoastal(c));
  }

  // ---------- Морський шлях ----------

  /**
   * Пошук у ширину по воді й своїх портах: перший крок до найближчої клітинки, що задовольняє `isGoal`.
   * Чужі юніти й міста — перешкоди (крім самої цілі, якщо `allowEnemyGoal`).
   */
  private seaSearch(unit: Unit, isGoal: (x: number, y: number) => boolean, allowEnemyGoal = false): { step: Step; dest: Step; dist: number } | null {
    const w = this.world;
    const key = (x: number, y: number) => y * MAP_WIDTH + x;
    const start = key(unit.x, unit.y);
    const prev = new Map<number, number>([[start, -1]]);
    const dist = new Map<number, number>([[start, 0]]);
    const queue = [start];
    const foreign = (x: number, y: number) => {
      const t = w.tiles[y][x];
      if (t.cityId && w.cities.get(t.cityId)!.playerId !== unit.playerId) return true;
      return t.unitIds.some((id) => w.units.get(id)?.playerId !== unit.playerId);
    };
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const cx = cur % MAP_WIDTH;
      const cy = Math.floor(cur / MAP_WIDTH);
      if (cur !== start && isGoal(cx, cy)) {
        let node = cur;
        while (prev.get(node) !== start) node = prev.get(node)!;
        return { step: { x: node % MAP_WIDTH, y: Math.floor(node / MAP_WIDTH) }, dest: { x: cx, y: cy }, dist: dist.get(cur)! };
      }
      for (const n of this.neighbors(cx, cy)) {
        const k = key(n.x, n.y);
        if (prev.has(k)) continue;
        const t = w.tiles[n.y][n.x];
        const goal = isGoal(n.x, n.y);
        const ownPort = !!t.cityId && w.cities.get(t.cityId)!.playerId === unit.playerId;
        if (t.terrain !== TerrainType.Ocean && !ownPort && !(goal && allowEnemyGoal)) continue;
        if (foreign(n.x, n.y) && !(goal && allowEnemyGoal)) continue;
        prev.set(k, cur);
        dist.set(k, dist.get(cur)! + 1);
        queue.push(k);
      }
    }
    return null;
  }

  /** Пливе до цілі, поки є рух; з `allowEnemyGoal` останній крок може бути атакою. */
  private sail(unit: Unit, isGoal: (x: number, y: number) => boolean, allowEnemyGoal = false): boolean {
    let moved = false;
    for (let guard = 0; guard < 12 && unit.movesLeft > 0 && this.world.units.has(unit.id); guard++) {
      if (isGoal(unit.x, unit.y) && !allowEnemyGoal) break;
      const found = this.seaSearch(unit, isGoal, allowEnemyGoal);
      if (!found) break;
      const res = this.world.moveUnit(unit.id, found.step.x, found.step.y);
      if (!res.success) break;
      moved = true;
      if (res.combatLog) break;
    }
    return moved;
  }

  // ---------- Пасажири ----------

  /** Наземні юніти гравця, що чекають на пором (ще не на борту). */
  private waiting(playerId: number): Unit[] {
    return [...this.world.units.values()].filter((u) => u.playerId === playerId && u.aiMission && !u.carriedBy);
  }

  /**
   * Пасажир: перевіряємо, чи ціль ще має сенс; іде до найближчого свого порту на своєму континенті й чекає.
   * Повертає false, якщо місію скасовано (тоді юніт діє за звичайною роллю).
   */
  public awaitFerry(unit: Unit): boolean {
    const m = unit.aiMission!;
    const w = this.world;
    const player = w.players[unit.playerId];
    const t = w.tiles[m.target.y][m.target.x];
    const stillValid = m.purpose === 'settle'
      ? this.ai.canFoundAt(m.target.x, m.target.y)
      : !!t.cityId && w.cities.get(t.cityId)!.playerId !== unit.playerId && this.ai.mayAttack(player, w.cities.get(t.cityId)!.playerId);
    unit.aiWait = (unit.aiWait ?? 0) + 1;
    if (!stillValid || unit.aiWait > PASSENGER_PATIENCE || this.continentOf(unit.x, unit.y) === this.continentOf(m.target.x, m.target.y)) {
      unit.aiMission = undefined;
      unit.aiWait = 0;
      return false;
    }
    const here = this.continentOf(unit.x, unit.y);
    const port = this.ports(unit.playerId)
      .filter((c) => this.continentOf(c.x, c.y) === here)
      .sort((a, b) => w.distance(a.x, a.y, unit.x, unit.y) - w.distance(b.x, b.y, unit.x, unit.y))[0];
    if (!port) {
      unit.aiMission = undefined;
      return false;
    }
    if (unit.x !== port.x || unit.y !== port.y) this.ai.walkTo(unit, port);
    return true;
  }

  /** Місце для міста за морем (для поселенців, яким на своєму суходолі тісно). */
  public overseasSite(unit: Unit): Step | undefined {
    const w = this.world;
    const player = w.players[unit.playerId];
    if (!player.knownTechs.includes('map_making') || !this.ports(unit.playerId).length) return undefined;
    const home = this.continentOf(unit.x, unit.y);
    let best: Step | undefined;
    let bestScore = -Infinity;
    for (let dy = -22; dy <= 22; dy++) {
      for (let dx = -22; dx <= 22; dx++) {
        const y = unit.y + dy;
        if (y < 2 || y >= MAP_HEIGHT - 2) continue;
        const x = (unit.x + dx + MAP_WIDTH) % MAP_WIDTH;
        if (w.tiles[y][x].terrain === TerrainType.Ocean || this.continentOf(x, y) === home) continue;
        if (!this.touchesSea(x, y) || !this.ai.canFoundAt(x, y)) continue;
        const score = this.ai.siteScore(x, y) - Math.max(Math.abs(dx), Math.abs(dy)) * 0.8;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best;
  }

  /** Вороже прибережне місто за морем для десанту. */
  public overseasTarget(unit: Unit): Step | undefined {
    const w = this.world;
    const player = w.players[unit.playerId];
    if (!player.knownTechs.includes('map_making') || !this.ports(unit.playerId).length) return undefined;
    const invaders = [...w.units.values()].filter((u) => u.playerId === unit.playerId && u.aiMission?.purpose === 'invade').length;
    if (invaders >= MAX_INVADERS) return undefined;
    const home = this.continentOf(unit.x, unit.y);
    const targets = [...w.cities.values()].filter((c) => c.playerId !== unit.playerId
      && this.ai.mayAttack(player, c.playerId)
      && this.continentOf(c.x, c.y) !== home
      && this.ai.isCoastal(c)
      && w.distance(c.x, c.y, unit.x, unit.y) <= 35);
    targets.sort((a, b) => w.distance(a.x, a.y, unit.x, unit.y) - w.distance(b.x, b.y, unit.x, unit.y));
    return targets[0] && { x: targets[0].x, y: targets[0].y };
  }

  /** Скільки пасажирів чекає й чи бракує поромів (для виробництва). */
  public needsFerry(playerId: number): boolean {
    const waiting = this.waiting(playerId).length;
    if (!waiting) return false;
    const ferries = [...this.world.units.values()].filter((u) => u.playerId === playerId && (UNIT_CONFIGS[u.type].capacity ?? 0) > 0);
    const room = ferries.reduce((s, f) => s + (UNIT_CONFIGS[f.type].capacity ?? 0), 0);
    return ferries.length === 0 || (waiting > room && ferries.length < 2);
  }

  // ---------- Кораблі ----------

  public moveShip(unit: Unit): void {
    const cfg = UNIT_CONFIGS[unit.type];
    const cargo = this.world.cargoOf(unit.id);
    if (cfg.capacity && (cargo.length || this.waiting(unit.playerId).length)) return this.ferry(unit, cargo);
    if (cfg.attack >= 2 && this.strike(unit)) return;
    if (!cargo.length && this.isScout(unit) && this.scout(unit)) return;
    this.toPort(unit);
  }

  // ---------- Розвідка ----------

  /** Живі цивілізації, з якими гравець ще не знайомий. */
  private unmet(playerId: number): Set<number> {
    const w = this.world;
    return new Set(w.players
      .filter((p) => p.id !== playerId && p.alive && !p.isBarbarian && !w.diplomacy.hasContact(playerId, p.id))
      .map((p) => p.id));
  }

  /** Розвідник — перший корабель гравця, поки є незнайомі цивілізації. */
  private isScout(unit: Unit): boolean {
    if (!this.unmet(unit.playerId).size) return false;
    for (const u of this.world.units.values()) {
      if (u.playerId === unit.playerId && UNIT_CONFIGS[u.type].domain === 'sea') return u.id === unit.id;
    }
    return false;
  }

  /** Чи треба збудувати корабель-розвідник: є незнайомі, а кораблів нема зовсім. */
  public needsScout(playerId: number): boolean {
    const player = this.world.players[playerId];
    if (!player.knownTechs.includes('map_making') || !this.unmet(playerId).size) return false;
    return ![...this.world.units.values()].some((u) => u.playerId === playerId && UNIT_CONFIGS[u.type].domain === 'sea');
  }

  /** Розвідка: до найближчої нерозвіданої води або до міст незнайомців (знайомство — за 2 клітинки). */
  private scout(unit: Unit): boolean {
    const w = this.world;
    const fog = w.playerFogs.get(unit.playerId);
    const unmet = this.unmet(unit.playerId);
    const strangers = [...w.cities.values()].filter((c) => unmet.has(c.playerId));
    return this.sail(unit, (x, y) => (w.tiles[y][x].terrain === TerrainType.Ocean && !!fog && !fog.explored[y][x])
      || strangers.some((c) => w.distance(c.x, c.y, x, y) <= 2));
  }

  /** Порожній корабель — до найближчого свого порту; там чекає. */
  private toPort(unit: Unit): void {
    const w = this.world;
    const t = w.tiles[unit.y][unit.x];
    if (t.cityId && w.cities.get(t.cityId)!.playerId === unit.playerId) return;
    const portIds = new Set(this.ports(unit.playerId).map((c) => c.id));
    this.sail(unit, (x, y) => !!w.tiles[y][x].cityId && portIds.has(w.tiles[y][x].cityId!));
  }

  /** Бойовий корабель: удар по ворожому кораблю чи прибережному загону в межах ходу, якщо шанси добрі. */
  private strike(unit: Unit): boolean {
    const w = this.world;
    const player = w.players[unit.playerId];
    let best: { x: number; y: number; score: number } | undefined;
    for (const other of w.units.values()) {
      if (other.playerId === unit.playerId || other.carriedBy || !this.ai.mayAttack(player, other.playerId)) continue;
      const d = w.distance(unit.x, unit.y, other.x, other.y);
      if (d > unit.movesLeft + 1) continue;
      const t = w.tiles[other.y][other.x];
      const atSea = t.terrain === TerrainType.Ocean;
      if (!atSea && (unit.type === UnitTypeKey.Submarine || !this.touchesSea(other.x, other.y))) continue;
      if (UNIT_CONFIGS[other.type].domain === 'air' && !t.cityId) continue; // літак у небі кораблем не зіб'єш
      const odds = this.ai.odds(unit, other.x, other.y);
      if (odds < 0.6) continue;
      const score = odds * 10 - d;
      if (!best || score > best.score) best = { x: other.x, y: other.y, score };
    }
    if (!best) return false;
    const target = best;
    // Підпливаємо до сусідньої з ціллю води й б'ємо
    const adjacent = (x: number, y: number) => w.distance(x, y, target.x, target.y) <= 1 && w.tiles[y][x].terrain === TerrainType.Ocean;
    if (!adjacent(unit.x, unit.y)) this.sail(unit, adjacent);
    if (unit.movesLeft > 0 && w.units.has(unit.id) && w.distance(unit.x, unit.y, target.x, target.y) <= 1) {
      w.moveUnit(unit.id, target.x, target.y);
    }
    return true;
  }

  /** Пором: зібрати пасажирів у порту, доплисти до цілі, висадити. */
  private ferry(unit: Unit, cargo: Unit[]): void {
    const w = this.world;
    const cfg = UNIT_CONFIGS[unit.type];
    if (!cargo.length) {
      // Порожній — до порту, де найбільше пасажирів
      const byCity = new Map<string, Unit[]>();
      for (const p of this.waiting(unit.playerId)) {
        const cityId = w.tiles[p.y][p.x].cityId;
        if (cityId && w.cities.get(cityId)!.playerId === unit.playerId) byCity.set(cityId, [...(byCity.get(cityId) ?? []), p]);
      }
      const here = w.tiles[unit.y][unit.x].cityId;
      if (here && byCity.has(here)) {
        w.boardInPort(unit.id, byCity.get(here)!.map((p) => p.id));
        unit.aiWait = 0;
        return;
      }
      if (!byCity.size) return this.toPort(unit);
      this.sail(unit, (x, y) => !!w.tiles[y][x].cityId && byCity.has(w.tiles[y][x].cityId!));
      return;
    }

    const mission = cargo.find((c) => c.aiMission)?.aiMission;
    const here = w.tiles[unit.y][unit.x].cityId;
    if (!mission) {
      // Пасажири без мети — висаджуємо в порту
      if (here) cargo.forEach((c) => { c.carriedBy = undefined; });
      else this.toPort(unit);
      return;
    }

    // У порту: добираємо пасажирів і чекаємо, поки збереться десант (поселенцям вистачає одного)
    if (here) {
      const more = this.waiting(unit.playerId).filter((p) => p.x === unit.x && p.y === unit.y).map((p) => p.id);
      w.boardInPort(unit.id, more);
      const need = mission.purpose === 'settle' ? 1 : Math.min(cfg.capacity ?? 1, 3);
      unit.aiWait = (unit.aiWait ?? 0) + 1;
      if (w.cargoOf(unit.id).length < need && unit.aiWait <= FERRY_PATIENCE) return;
    }

    const goalLand = this.continentOf(mission.target.x, mission.target.y);
    const landing = (x: number, y: number) => w.tiles[y][x].terrain === TerrainType.Ocean
      && this.neighbors(x, y).some((n) => this.continentOf(n.x, n.y) === goalLand && !this.blocked(unit.playerId, n.x, n.y));
    if (!landing(unit.x, unit.y)) {
      this.sail(unit, landing);
      if (!landing(unit.x, unit.y)) {
        // Не доплисти — відмовляємось від переправи
        if (!this.seaSearch(unit, landing)) {
          w.cargoOf(unit.id).forEach((c) => { c.aiMission = undefined; });
        }
        return;
      }
    }
    // Висадка: кожен пасажир — на найближчу до цілі вільну клітинку суходолу
    const spots = this.neighbors(unit.x, unit.y)
      .filter((n) => this.continentOf(n.x, n.y) === goalLand && !this.blocked(unit.playerId, n.x, n.y))
      .sort((a, b) => w.distance(a.x, a.y, mission.target.x, mission.target.y) - w.distance(b.x, b.y, mission.target.x, mission.target.y));
    for (const c of w.cargoOf(unit.id)) {
      const spot = spots[0];
      if (!spot || c.movesLeft <= 0) continue;
      const res = w.moveUnit(c.id, spot.x, spot.y);
      if (res.success && w.units.has(c.id)) {
        c.aiMission = undefined;
        c.aiWait = 0;
        c.aiTarget = undefined;
      }
    }
    unit.aiWait = 0;
  }

  /** Клітинка зайнята чужими (не висаджуватись туди). */
  private blocked(playerId: number, x: number, y: number): boolean {
    const t = this.world.tiles[y][x];
    if (t.cityId && this.world.cities.get(t.cityId)!.playerId !== playerId) return true;
    return t.unitIds.some((id) => this.world.units.get(id)?.playerId !== playerId);
  }

  // ---------- Літаки ----------

  /** Літак: з бази б'є ціль у половині радіуса (щоб повернутися), поза базою — летить додому. */
  public moveAir(unit: Unit): void {
    const w = this.world;
    const player = w.players[unit.playerId];
    if (unit.type === UnitTypeKey.Nuclear) return; // ядерну зброю AI не застосовує
    if (this.atBase(unit) && unit.movesLeft > 1) {
      const target = this.airTarget(unit, player, Math.floor((unit.movesLeft - 1) / 2));
      if (target) this.flyTo(unit, target);
    }
    if (!this.atBase(unit) && unit.movesLeft > 0 && w.units.has(unit.id)) {
      const bases = this.ai.citiesOf(unit.playerId)
        .sort((a, b) => w.distance(a.x, a.y, unit.x, unit.y) - w.distance(b.x, b.y, unit.x, unit.y));
      if (bases[0]) this.flyTo(unit, bases[0]);
    }
  }

  private atBase(unit: Unit): boolean {
    const t = this.world.tiles[unit.y][unit.x];
    return (!!t.cityId && this.world.cities.get(t.cityId)!.playerId === unit.playerId) || !!unit.carriedBy;
  }

  private airTarget(unit: Unit, player: Player, radius: number): Step | undefined {
    const w = this.world;
    let best: { x: number; y: number; score: number } | undefined;
    for (const other of w.units.values()) {
      if (other.playerId === unit.playerId || other.carriedBy || !this.ai.mayAttack(player, other.playerId)) continue;
      const d = w.distance(unit.x, unit.y, other.x, other.y);
      if (d > radius) continue;
      const t = w.tiles[other.y][other.x];
      if (UNIT_CONFIGS[other.type].domain === 'air' && !t.cityId && unit.type !== UnitTypeKey.Fighter) continue;
      const odds = this.ai.odds(unit, other.x, other.y);
      if (odds < 0.6) continue;
      const score = odds * 10 - d + (t.cityId ? 3 : 0);
      if (!best || score > best.score) best = { x: other.x, y: other.y, score };
    }
    return best;
  }

  /** Політ навпростець (над будь-чим), оминаючи чужі клітинки; останній крок у ворожу ціль — атака. */
  private flyTo(unit: Unit, target: Step): void {
    const w = this.world;
    for (let guard = 0; guard < 20 && unit.movesLeft > 0 && w.units.has(unit.id); guard++) {
      const d = w.distance(unit.x, unit.y, target.x, target.y);
      if (d === 0) return;
      if (d === 1) {
        w.moveUnit(unit.id, target.x, target.y);
        return;
      }
      const next = this.neighbors(unit.x, unit.y)
        .filter((n) => !this.blocked(unit.playerId, n.x, n.y))
        .sort((a, b) => w.distance(a.x, a.y, target.x, target.y) - w.distance(b.x, b.y, target.x, target.y))[0];
      if (!next || w.distance(next.x, next.y, target.x, target.y) >= d) return;
      if (!w.moveUnit(unit.id, next.x, next.y).success) return;
    }
  }
}
