/**
 * Історія партії для статистики й «Історії цивілізації»: раз на хід — показники всіх цивілізацій,
 * плюс хроніка ключових подій із повідомлень. Живе в `world.uiData`, тож зберігається разом із партією.
 */
import { World } from '../core/world';
import { TurnManager } from '../core/turn-manager';
import { UNIT_CONFIGS } from '../core/constants';

/** Показники цивілізації в точці: рахунок, міста, технології, армія. */
export type Stat = [number, number, number, number];
export const STAT_NAMES = ['🏆 Рахунок', '🏛️ Міста', '🧪 Технології', '⚔️ Армія'];

export interface HistoryData {
  /** Точки по ходах: рік і показники за id гравця (варварів нема) */
  points: { y: number; v: Record<number, Stat> }[];
  events: { y: number; text: string }[];
  /** Найвища епоха людини — для подій «нова епоха» */
  era?: number;
}

export const ERA_NAMES = ['', 'Античність', 'Середньовіччя', 'Новий час', 'Індустріальна доба', 'Сучасність', 'Атомна доба', 'Космічна ера'];

export function historyOf(w: World): HistoryData {
  let h = w.uiData.history as HistoryData | undefined;
  if (!h) {
    h = { points: [], events: [] };
    w.uiData.history = h;
  }
  return h;
}

/** Показники гравця зараз. */
export function statOf(w: World, id: number): Stat {
  let cities = 0;
  for (const c of w.cities.values()) if (c.playerId === id) cities++;
  let army = 0;
  for (const u of w.units.values()) if (u.playerId === id && UNIT_CONFIGS[u.type].attack > 0) army++;
  const p = w.players[id];
  return [w.score(id).total, cities, p.knownTechs.length + (p.futureTechs ?? 0), army];
}

/** Знімок після ходу (і на старті партії); той самий рік двічі не пишемо. */
export function recordTurn(w: World): void {
  const h = historyOf(w);
  const y = w.turnManager.year;
  if (h.points.length && h.points[h.points.length - 1].y === y) return;
  const v: Record<number, Stat> = {};
  for (const p of w.players) if (!p.isBarbarian && p.alive) v[p.id] = statOf(w, p.id);
  h.points.push({ y, v });
  // Нова епоха людини — теж подія хроніки
  const era = Math.max(0, ...w.players[0].knownTechs.map((id) => TurnManager.techById(id)?.era ?? 0));
  if (h.era !== undefined && era > h.era && ERA_NAMES[era]) h.events.push({ y, text: `📖 Ваша цивілізація увійшла в нову епоху: ${ERA_NAMES[era]}` });
  h.era = era;
}

// Що з повідомлень іде в хроніку: заснування міст людиною лише перше (столиця)
const CHRONICLE = /^(🌟|⚔️ .*(війн)|🕊️|🔥 .*захопили|💀|🚀 .*(запустили|стартував)|🏛️ .*(Засновано місто|новий устрій)|📚|🧬|☢️)/u;

/** Повідомлення з журналу: ключове — у хроніку. */
export function noteMessage(w: World, text: string): void {
  if (!CHRONICLE.test(text)) return;
  // Зміни устрою в чужих цивілізаціях — не наша історія
  if (text.includes('новий устрій') && !text.includes(w.players[0].nameUa)) return;
  const h = historyOf(w);
  if (text.includes('Засновано місто')) {
    if (h.events.some((e) => e.text.includes('Засновано місто'))) return;
    text = text.replace('Засновано місто', 'Засновано столицю —');
  }
  // Новини світу повторюються в кількох місцях — дубль за той самий рік не пишемо
  const y = w.turnManager.year;
  if (h.events.some((e) => e.y === y && e.text === text)) return;
  h.events.push({ y, text });
  if (h.events.length > 400) h.events.splice(0, h.events.length - 400);
}

export function yearLabel(y: number): string {
  return TurnManager.formatYear(y);
}
