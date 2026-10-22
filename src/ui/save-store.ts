/**
 * Збереження партій у localStorage: автозбереження щоходу і три ручні слоти.
 * Перехід між партіями — через перезавантаження сторінки з «відкладеною дією» в sessionStorage.
 */
import { World, SaveData } from '../core/world';
import { CIVS, DIFFICULTIES, MAP_SIZES } from '../core/constants';

export type SlotId = 'auto' | '1' | '2' | '3';
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];

export interface SaveMeta {
  civ: string;
  year: string;
  turn: number;
  date: string;
  details: string;
}

const KEY = (slot: SlotId) => `civ1-remaster-save-${slot}`;
const META_KEY = 'civ1-remaster-saves';
const PENDING_KEY = 'civ1-remaster-pending-load';

export function slotName(slot: SlotId): string {
  return slot === 'auto' ? 'Автозбереження' : `Слот ${slot}`;
}

export function listSaves(): Partial<Record<SlotId, SaveMeta>> {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Зберігає гру; повертає текст помилки або undefined. */
export function saveGame(world: World, slot: SlotId): string | undefined {
  const o = world.options;
  const human = world.players[0];
  const meta: SaveMeta = {
    civ: `${human.nameUa} (${human.leaderUa})`,
    year: world.turnManager.getYearString(),
    turn: world.turnManager.turnNumber,
    date: new Date().toLocaleString('uk-UA'),
    details: `${MAP_SIZES[o.mapSize].nameUa} мапа · ${DIFFICULTIES[o.difficulty].nameUa} · суперників ${world.players.filter((p) => !p.isBarbarian).length - 1} · рахунок ${world.score(0).total}`,
  };
  try {
    localStorage.setItem(KEY(slot), JSON.stringify(world.serialize()));
    localStorage.setItem(META_KEY, JSON.stringify({ ...listSaves(), [slot]: meta }));
    return undefined;
  } catch (e) {
    return `Не вдалося зберегти (${(e as Error).name}): сховище браузера недоступне чи переповнене`;
  }
}

export function loadSave(slot: SlotId): SaveData | undefined {
  try {
    const raw = localStorage.getItem(KEY(slot));
    return raw ? (JSON.parse(raw) as SaveData) : undefined;
  } catch {
    return undefined;
  }
}

/** Після перезавантаження сторінки одразу відкрити цей слот (а не головне меню). */
export function setPendingLoad(slot: SlotId): void {
  try {
    sessionStorage.setItem(PENDING_KEY, slot);
  } catch {
    // без sessionStorage просто відкриється головне меню
  }
}

export function takePendingLoad(): SlotId | undefined {
  try {
    const slot = sessionStorage.getItem(PENDING_KEY) as SlotId | null;
    sessionStorage.removeItem(PENDING_KEY);
    return slot && SLOTS.includes(slot) ? slot : undefined;
  } catch {
    return undefined;
  }
}

/** Короткий опис цивілізації для меню. */
export function civLabel(key: keyof typeof CIVS): string {
  return `${CIVS[key].nameUa} — ${CIVS[key].leaderUa}`;
}
