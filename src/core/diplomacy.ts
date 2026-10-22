/**
 * Дипломатія (Civ 1): знайомство, мир і війна, ставлення лідерів, данина, обмін технологіями, посольства.
 * Знайомляться цивілізації, чиї юніти чи міста опинились за 2 клітинки (або через посольство / Марко Поло).
 * Після знайомства — мир; напад під час миру — оголошення війни й порушена угода.
 * Пропозиції AI людині не виконуються одразу, а стають «зустрічами», які людина приймає чи відхиляє.
 */
import type { World } from './world';
import { BuildingTypeKey, City, Player, Tech, UnitTypeKey } from './types';
import { UNIT_CONFIGS, BUILDING_CONFIGS, MAP_WIDTH, MAP_HEIGHT } from './constants';
import { TurnManager } from './turn-manager';

export interface Relation {
  contact: boolean;
  war: boolean;
  /** Хід, з якого діє поточний стан */
  since: number;
}

/** Доручення дипломата: посольство, крадіжка технології, підкуп міста, саботаж. */
export type DiplomatAction = 'embassy' | 'steal' | 'incite' | 'sabotage';

export type MeetingKind = 'contact' | 'peace' | 'tribute' | 'trade' | 'war';

/** Зустріч AI-лідера з людиною: повідомлення й (для пропозицій) кнопки «так/ні». */
export interface Meeting {
  from: number;
  kind: MeetingKind;
  text: string;
  /** Данина: скільки золота хоче */
  gold?: number;
  /** Обмін: що AI дає і що хоче взамін */
  give?: string;
  want?: string;
}

export interface DiplomacyData {
  relations: [string, Relation][];
  attitude: [string, number][];
  meetings: Meeting[];
  lastOffer: [string, number][];
}

/** Ставлення лідера (−10..10) словами. */
export function attitudeWord(a: number): string {
  if (a >= 4) return 'дружнє';
  if (a >= 1) return 'приязне';
  if (a > -2) return 'стримане';
  if (a > -5) return 'вороже';
  return 'ненависне';
}

export class Diplomacy {
  private relations = new Map<string, Relation>();
  /** Ставлення «хто>до кого» */
  private attitudes = new Map<string, number>();
  /** Зустрічі, що чекають на людину */
  private meetings: Meeting[] = [];
  /** Коли востаннє AI щось пропонував (щоб не набридати): «хто>кому:що» → хід */
  private lastOffer = new Map<string, number>();

  constructor(private world: World) {}

  private key(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  public relation(a: number, b: number): Relation {
    const k = this.key(a, b);
    let r = this.relations.get(k);
    if (!r) {
      r = { contact: false, war: false, since: 0 };
      this.relations.set(k, r);
    }
    return r;
  }

  private turn(): number {
    return this.world.turnManager.turnNumber;
  }

  private civ(id: number): Player {
    return this.world.players[id];
  }

  /** Варвари воюють з усіма; решта — лише після оголошення війни. */
  public atWar(a: number, b: number): boolean {
    if (a === b) return false;
    if (this.civ(a).isBarbarian || this.civ(b).isBarbarian) return true;
    return this.relation(a, b).war;
  }

  public hasContact(a: number, b: number): boolean {
    return this.relation(a, b).contact;
  }

  /** Посольство: своє або Марко Поло. */
  public hasEmbassy(a: number, b: number): boolean {
    return (this.civ(a).embassies ?? []).includes(b) || this.world.ownerWonders(a).has(BuildingTypeKey.MarcoPolo);
  }

  /** Характер: войовничий, звичайний чи мирний (з якого ходу лідер готовий воювати). */
  private character(p: Player): 'warlike' | 'normal' | 'peaceful' {
    const t = p.hostileFromTurn ?? 80;
    return t <= 50 ? 'warlike' : t >= 100 ? 'peaceful' : 'normal';
  }

  public attitude(from: number, to: number): number {
    const k = `${from}>${to}`;
    if (!this.attitudes.has(k)) {
      const c = this.character(this.civ(from));
      this.attitudes.set(k, c === 'warlike' ? -1 : c === 'peaceful' ? 1 : 0);
    }
    return this.attitudes.get(k)!;
  }

  private mood(from: number, to: number, delta: number): void {
    const a = this.attitude(from, to) + delta;
    this.attitudes.set(`${from}>${to}`, Math.max(-10, Math.min(10, a)));
  }

  /** Сила армії: атака наземних бойових юнітів + трохи за міста. */
  public strength(id: number): number {
    let s = 0;
    for (const u of this.world.units.values()) {
      if (u.playerId !== id) continue;
      const cfg = UNIT_CONFIGS[u.type];
      if (cfg.attack > 0 && cfg.domain !== 'sea') s += cfg.attack * (u.veteran ? 1.5 : 1);
    }
    for (const c of this.world.cities.values()) if (c.playerId === id) s += 2;
    return s;
  }

  private visible(a: number, b: number): boolean {
    // Людина бачить новини про чужі війни, якщо знайома хоч з одним
    return this.hasContact(0, a) || this.hasContact(0, b);
  }

  private news(text: string, a: number, b: number): void {
    if (a !== 0 && b !== 0 && this.visible(a, b)) this.world.pushNews(text);
  }

  // ---------- Події ----------

  /** Знайомство. Людині — зустріч з лідером. */
  public meet(a: number, b: number): void {
    const r = this.relation(a, b);
    if (r.contact || this.civ(a).isBarbarian || this.civ(b).isBarbarian) return;
    r.contact = true;
    r.war = false;
    r.since = this.turn();
    const ai = a === 0 ? b : b === 0 ? a : undefined;
    if (ai === undefined) return;
    const p = this.civ(ai);
    const greet = {
      warlike: `«Я — ${p.leaderUa}, володар народу ${p.nameUa}. Наші мечі гострі. Тримайтеся подалі від наших кордонів.»`,
      normal: `«Вітаю! Я — ${p.leaderUa}, ${p.nameUa} радо знатимуть ваш народ. Хай буде мир між нами.»`,
      peaceful: `«Мир вам, сусіди! Я — ${p.leaderUa}. ${p.nameUa} шанують торгівлю й дружбу.»`,
    }[this.character(p)];
    this.meetings.push({ from: ai, kind: 'contact', text: greet });
  }

  /** Будь-який напад: якщо був мир — це оголошення війни й порушена угода. */
  public onAggression(attacker: number, victim: number): void {
    if (attacker === victim || this.civ(attacker).isBarbarian || this.civ(victim).isBarbarian) return;
    const r = this.relation(attacker, victim);
    if (!r.contact) {
      // Знайомство через бій — угоди ще не було, тож і зради нема
      r.contact = true;
      this.startWar(attacker, victim);
      return;
    }
    if (r.war) {
      this.mood(victim, attacker, -0.3);
      return;
    }
    // Підступний напад: усі AI запам'ятовують
    const p = this.civ(attacker);
    p.brokenTreaties = (p.brokenTreaties ?? 0) + 1;
    for (const other of this.world.players) {
      if (other.id === attacker || other.isBarbarian || !other.isAi) continue;
      this.mood(other.id, attacker, other.id === victim ? -5 : -2);
    }
    this.startWar(attacker, victim, true);
  }

  public startWar(a: number, b: number, treachery = false): void {
    const r = this.relation(a, b);
    if (r.war) return;
    r.contact = true;
    r.war = true;
    r.since = this.turn();
    const pa = this.civ(a);
    const pb = this.civ(b);
    if (b === 0 && !treachery) {
      this.meetings.push({ from: a, kind: 'war', text: `«${pa.leaderUa}: ваш народ слабкий, а наші війська голодні до слави. Відтепер між нами — війна!»` });
    }
    if (a === 0 && pb.isAi) this.world.pushNews(`⚔️ Ви оголосили війну: ${pb.nameUa}${treachery ? ' (мирну угоду порушено — інші лідери це запам\'ятають)' : ''}`);
    this.news(`⚔️ Оголошено війну: ${pa.nameUa} → ${pb.nameUa}`, a, b);
  }

  public makePeace(a: number, b: number): void {
    const r = this.relation(a, b);
    if (!r.war) return;
    r.war = false;
    r.since = this.turn();
    this.mood(a, b, 1);
    this.mood(b, a, 1);
    this.news(`🕊️ Укладено мир: ${this.civ(a).nameUa} і ${this.civ(b).nameUa}`, a, b);
  }

  /** Технології, які `from` знає, а `to` — ні (і які `to` вже може зрозуміти — є всі передумови). */
  public tradeable(from: number, to: number): Tech[] {
    const known = new Set(this.civ(from).knownTechs);
    return TurnManager.getAvailableTechs(this.civ(to)).filter((t) => known.has(t.id));
  }

  private exchange(a: number, giveA: Tech, b: number, giveB: Tech): void {
    TurnManager.learnTech(this.civ(b), giveA);
    TurnManager.learnTech(this.civ(a), giveB);
  }

  // ---------- Людина пропонує ----------

  /** Людина просить миру: AI погоджується, якщо втомився від війни, слабший або непогано ставиться. */
  public proposePeace(ai: number): { ok: boolean; text: string } {
    const p = this.civ(ai);
    const r = this.relation(0, ai);
    if (!r.war) return { ok: false, text: 'Ми й так у мирі.' };
    const weaker = this.strength(ai) < this.strength(0) * 0.9;
    const tired = this.turn() - r.since >= 8;
    const ok = (tired && (weaker || this.attitude(ai, 0) > -3)) || (weaker && this.attitude(ai, 0) > -6);
    if (!ok) return { ok: false, text: `«${p.leaderUa}: мир? Спершу переможіть нас на полі бою!»` };
    this.makePeace(0, ai);
    return { ok: true, text: `«${p.leaderUa}: досить крові. Хай буде мир.»` };
  }

  /** Сенат (Civ 1): за Демократії не дає порушити мир — ні нападом, ні оголошенням війни. */
  public senateForbidsWar(player: number): boolean {
    return this.civ(player).government === 'democracy';
  }

  public declareWar(ai: number): boolean {
    if (this.senateForbidsWar(0)) return false;
    this.onAggression(0, ai);
    return true;
  }

  /** Людина пропонує обмін: AI згоден, якщо ставлення не вороже й обмін не на його шкоду. */
  public proposeTrade(ai: number, giveId: string, wantId: string): { ok: boolean; text: string } {
    const p = this.civ(ai);
    const give = this.tradeable(0, ai).find((t) => t.id === giveId);
    const want = this.tradeable(ai, 0).find((t) => t.id === wantId);
    if (!give || !want) return { ok: false, text: 'Такий обмін неможливий.' };
    if (this.relation(0, ai).war) return { ok: false, text: `«${p.leaderUa}: з ворогами не торгуємо.»` };
    const fair = give.era >= want.era;
    if (this.attitude(ai, 0) < -1 || !fair) return { ok: false, text: `«${p.leaderUa}: ні, ця угода нам невигідна.»` };
    this.exchange(0, give, ai, want);
    this.mood(ai, 0, 1);
    return { ok: true, text: `«${p.leaderUa}: чудова угода! Наші вчені вже вивчають «${give.nameUa}».»` };
  }

  // ---------- Відповіді людини на зустрічі ----------

  public takeMeetings(): Meeting[] {
    return this.meetings.splice(0);
  }

  public answer(m: Meeting, accept: boolean): string {
    const p = this.civ(m.from);
    const human = this.civ(0);
    if (m.kind === 'peace') {
      if (!accept) { this.mood(m.from, 0, -1); return 'Війна триває.'; }
      this.makePeace(0, m.from);
      return `🕊️ Мир із народом ${p.nameUa}.`;
    }
    if (m.kind === 'tribute') {
      if (accept && human.gold >= (m.gold ?? 0)) {
        human.gold -= m.gold ?? 0;
        p.gold += m.gold ?? 0;
        this.mood(m.from, 0, 2);
        return `💰 Ви сплатили данину: ${m.gold} зл.`;
      }
      this.mood(m.from, 0, -2);
      this.startWar(m.from, 0, true);
      return `⚔️ ${p.leaderUa} оголошує вам війну!`;
    }
    if (m.kind === 'trade') {
      const give = TurnManager.techById(m.give!);
      const want = TurnManager.techById(m.want!);
      if (!accept || !give || !want) { this.mood(m.from, 0, -0.5); return 'Обмін відхилено.'; }
      this.exchange(m.from, give, 0, want);
      this.mood(m.from, 0, 1);
      return `📜 Обмін: ви отримали «${give.nameUa}», віддали «${want.nameUa}».`;
    }
    return '';
  }

  // ---------- Знайомства за відстанню ----------

  /** Юніти чи міста двох цивілізацій за 2 клітинки — знайомство. */
  public detectContacts(): void {
    const w = this.world;
    const owners = new Map<number, Set<number>>();
    const mark = (x: number, y: number, id: number) => {
      const k = y * MAP_WIDTH + x;
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k)!.add(id);
    };
    const entities: { x: number; y: number; id: number }[] = [];
    for (const u of w.units.values()) entities.push({ x: u.x, y: u.y, id: u.playerId });
    for (const c of w.cities.values()) entities.push({ x: c.x, y: c.y, id: c.playerId });
    for (const e of entities) mark(e.x, e.y, e.id);
    for (const e of entities) {
      if (this.civ(e.id).isBarbarian) continue;
      for (let dy = -2; dy <= 2; dy++) {
        const y = e.y + dy;
        if (y < 0 || y >= MAP_HEIGHT) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const set = owners.get(y * MAP_WIDTH + (e.x + dx + MAP_WIDTH) % MAP_WIDTH);
          if (!set) continue;
          for (const other of set) if (other !== e.id && !this.civ(other).isBarbarian) this.meet(e.id, other);
        }
      }
    }
  }

  /** Марко Поло: знайомство з усіма живими цивілізаціями. */
  public meetEveryone(id: number): void {
    for (const p of this.world.players) if (p.id !== id && p.alive && !p.isBarbarian) this.meet(id, p.id);
  }

  // ---------- Рішення AI ----------

  private offerDue(from: number, to: number, what: string, every: number): boolean {
    const k = `${from}>${to}:${what}`;
    const last = this.lastOffer.get(k) ?? -Infinity;
    if (this.turn() - last < every) return false;
    this.lastOffer.set(k, this.turn());
    return true;
  }

  /** Хід AI у дипломатії: війна, мир, данина, обмін. */
  public aiTurn(ai: Player): void {
    const w = this.world;
    const char = this.character(ai);
    const hostilePhase = this.turn() >= (ai.hostileFromTurn ?? Infinity);
    for (const other of w.players) {
      if (other.id === ai.id || other.isBarbarian || !other.alive || !this.hasContact(ai.id, other.id)) continue;
      const r = this.relation(ai.id, other.id);
      const ratio = this.strength(ai.id) / Math.max(1, this.strength(other.id));
      // Ставлення повільно тепліє в мирі й холоне на війні
      this.mood(ai.id, other.id, r.war ? -0.03 : 0.02);

      if (r.war) {
        const long = this.turn() - r.since >= 10;
        const wantsPeace = long && (ratio < 0.8 || char === 'peaceful' || (char === 'normal' && this.turn() - r.since >= 25));
        if (!wantsPeace || Math.random() > 0.15) continue;
        if (other.isAi) {
          // Другий AI погоджується, якщо теж не рветься до бою
          const otherRatio = 1 / Math.max(0.01, ratio);
          if (otherRatio < 1.3 || this.character(other) !== 'warlike') this.makePeace(ai.id, other.id);
        } else if (other.government === 'republic' || other.government === 'democracy') {
          // Сенат Республіки й Демократії приймає мир сам — як у Civ 1
          this.makePeace(ai.id, 0);
          this.world.pushNews(`🏛️ Сенат прийняв мирну пропозицію: ${ai.nameUa} (${ai.leaderUa}) — війну закінчено.`);
        } else if (this.offerDue(ai.id, 0, 'peace', 10)) {
          this.meetings.push({ from: ai.id, kind: 'peace', text: `«${ai.leaderUa}: ця війна виснажує обидва наші народи. Укладімо мир?»` });
        }
        continue;
      }

      // Мир: войовничий і сильніший може напасти
      // Войовничому досить рівних сил, іншим — переваги
      if (hostilePhase && ratio >= (char === 'warlike' ? 0.9 : 1.1)) {
        if (w.ownerWonders(other.id).has(BuildingTypeKey.UnitedNations) && !w.attackedRecently(other.id, ai.id)) continue;
        const base = char === 'warlike' ? 0.08 : char === 'normal' ? 0.03 : 0.008;
        const att = this.attitude(ai.id, other.id);
        const chance = base * (att < -2 ? 2.5 : att < 0 ? 1.5 : att > 3 ? 0.3 : 1) * (this.turn() - r.since < 10 ? 0.3 : 1);
        if (Math.random() < chance) {
          // Людині войовничий спершу виставляє данину
          if (!other.isAi && char !== 'peaceful' && other.gold >= 50 && this.offerDue(ai.id, 0, 'tribute', 20)) {
            const gold = Math.min(Math.floor(other.gold / 2), 50 + this.turn());
            this.meetings.push({ from: ai.id, kind: 'tribute', gold, text: `«${ai.leaderUa}: ваші землі багаті, а наші воїни невдоволені. Сплатіть ${gold} зл. — і ми залишимо вас у спокої.»` });
          } else {
            this.startWar(ai.id, other.id);
          }
          continue;
        }
      }

      // Обмін технологіями: досить стриманого ставлення (войовничі стартують з −1 і інакше не мінялись десятиліттями)
      if (this.attitude(ai.id, other.id) <= -2) continue;
      const give = this.tradeable(ai.id, other.id);
      const want = this.tradeable(other.id, ai.id);
      if (!give.length || !want.length) continue;
      if (other.isAi) {
        if (this.attitude(other.id, ai.id) > -2 && Math.random() < 0.08) {
          this.exchange(ai.id, give[0], other.id, want[0]);
          this.mood(ai.id, other.id, 0.5);
          this.mood(other.id, ai.id, 0.5);
        }
      } else if (Math.random() < 0.04 && this.offerDue(ai.id, 0, 'trade', 15)) {
        const g = give[Math.floor(Math.random() * give.length)];
        const t = want[Math.floor(Math.random() * want.length)];
        this.meetings.push({ from: ai.id, kind: 'trade', give: g.id, want: t.id, text: `«${ai.leaderUa}: наші вчені знають «${g.nameUa}». Поміняємось на ваше «${t.nameUa}»?»` });
      }
    }
  }

  // ---------- Збереження ----------

  public serialize(): DiplomacyData {
    return {
      relations: [...this.relations.entries()],
      attitude: [...this.attitudes.entries()],
      meetings: this.meetings,
      lastOffer: [...this.lastOffer.entries()],
    };
  }

  public restore(d?: DiplomacyData): void {
    if (!d) return;
    this.relations = new Map(d.relations);
    this.attitudes = new Map(d.attitude);
    this.meetings = d.meetings;
    this.lastOffer = new Map(d.lastOffer);
  }

  /**
   * Ціна підкупу міста (Civ 1): (скарбниця власника + 1000) × жителі / (відстань до його столиці + 3);
   * місто в безладі — удвічі дешевше. Столицю не підкупити (Infinity).
   */
  public inciteCost(city: City): number {
    const w = this.world;
    if (city.buildings.includes(BuildingTypeKey.Palace)) return Infinity;
    const owner = this.civ(city.playerId);
    const capital = [...w.cities.values()].find((c) => c.playerId === owner.id && c.buildings.includes(BuildingTypeKey.Palace));
    // Без столиці — як найдальша провінція
    const dist = capital ? w.distance(capital.x, capital.y, city.x, city.y) : 32;
    let cost = (owner.gold + 1000) * city.size / (dist + 3);
    if (w.cityYields(city).disorder) cost /= 2;
    return Math.round(cost);
  }

  /** AI-дипломат: посольство; на війні — підкуп, якщо по кишені, інакше крадіжка чи саботаж. */
  public aiDiplomatChoice(me: number, city: City): DiplomatAction {
    if (!this.hasEmbassy(me, city.playerId) && !this.civ(city.playerId).isBarbarian) return 'embassy';
    if (!this.atWar(me, city.playerId)) return 'steal';
    if (this.inciteCost(city) <= this.civ(me).gold * 0.6) return 'incite';
    if (!(city.stolenBy ?? []).includes(me) && this.tradeable(city.playerId, me).length) return 'steal';
    return 'sabotage';
  }

  /** Дипломат у чужому місті: посольство, крадіжка технології, підкуп чи саботаж. */
  public diplomatAct(unitId: string, cityId: string, action: DiplomatAction): string {
    const w = this.world;
    const unit = w.units.get(unitId);
    const city = w.cities.get(cityId);
    if (!unit || !city || unit.type !== UnitTypeKey.Diplomat || city.playerId === unit.playerId) return '';
    if (w.distance(unit.x, unit.y, city.x, city.y) > 1) return '';
    const me = this.civ(unit.playerId);
    const them = this.civ(city.playerId);
    const cost = action === 'incite' ? this.inciteCost(city) : 0;
    if (cost > me.gold) return `💰 Підкуп міста ${city.name} коштує ${cost === Infinity ? 'більше, ніж є золота у світі' : cost + ' 💰'}.`;
    // Підкуп і саботаж — ворожі дії: у мирі це віроломний напад (до знайомства — просто війна)
    if (action === 'incite' || action === 'sabotage') w.noteAggression(me.id, them.id);
    this.meet(me.id, them.id);
    w.removeUnit(unit.id);
    if (action === 'embassy') {
      me.embassies = [...new Set([...(me.embassies ?? []), them.id])];
      this.mood(them.id, me.id, 0.5);
      return `🏛️ Відкрито посольство: ${them.nameUa}. Тепер ви бачите їхні технології й скарбницю.`;
    }
    if (action === 'incite') {
      me.gold -= cost;
      return w.captureCity(city, me.id, true);
    }
    if (action === 'sabotage') {
      // Як у Civ 1: навмання або згорає накопичене виробництво, або руйнується звичайна будівля
      const pool = city.buildings.filter((b) => b !== BuildingTypeKey.Palace && !BUILDING_CONFIGS[b].isWonder);
      const pick = Math.floor(Math.random() * (pool.length + 1));
      if (pick === pool.length) {
        city.shieldsStored = 0;
        return `💣 Саботаж у місті ${city.name}: виробництво знищено.`;
      }
      city.buildings = city.buildings.filter((b) => b !== pool[pick]);
      return `💣 Саботаж у місті ${city.name}: зруйновано «${BUILDING_CONFIGS[pool[pick]].nameUa}».`;
    }
    const options = this.tradeable(them.id, me.id);
    city.stolenBy = [...(city.stolenBy ?? [])];
    if (!options.length || city.stolenBy.includes(me.id)) return `🕵️ У місті ${city.name} нема чого красти.`;
    const tech = options[Math.floor(Math.random() * options.length)];
    TurnManager.learnTech(me, tech);
    city.stolenBy.push(me.id);
    // Шпигунство в мирний час — дипломатичний скандал
    if (!this.relation(me.id, them.id).war) this.mood(them.id, me.id, -3);
    return `🕵️ Дипломат викрав у місті ${city.name}: «${tech.nameUa}»!`;
  }
}
