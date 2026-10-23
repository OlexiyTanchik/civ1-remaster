/**
 * Англійські назви сутностей: на старті (до меню й світу) підміняємо `nameUa`/`descriptionUa` у даних гри.
 * Так англійською стає все, що їх показує, — і вікна, і повідомлення ядра, — без змін у `src/core`.
 */
import { UNIT_CONFIGS, BUILDING_CONFIGS, TECH_TREE, FUTURE_TECH, GOVERNMENTS, CIVS, TERRAIN_NAMES_UA, DIFFICULTIES, MAP_SIZES, MAP_TYPES } from '../core/constants';
import type { Player } from '../core/types';
import { TERRAFORM_INFO } from '../core/terraform';
import { lang } from './index';
import { EN_ENTITIES } from './en-entities';

type Named = { nameUa: string; descriptionUa?: string };

function apply(target: Record<string, Named>, source: Record<string, [string, string?]>): void {
  for (const [key, [name, desc]] of Object.entries(source)) {
    const item = target[key];
    if (!item) continue;
    item.nameUa = name;
    if (desc && item.descriptionUa !== undefined) item.descriptionUa = desc;
  }
}

export function applyEntityNames(): void {
  if (lang !== 'en') return;
  const e = EN_ENTITIES;
  apply(UNIT_CONFIGS as unknown as Record<string, Named>, e.units);
  apply(BUILDING_CONFIGS as unknown as Record<string, Named>, e.buildings);
  apply(TECH_TREE as unknown as Record<string, Named>, e.techs);
  apply({ future: FUTURE_TECH as unknown as Named }, { future: e.future });
  apply(GOVERNMENTS as unknown as Record<string, Named>, e.governments);
  apply(DIFFICULTIES as unknown as Record<string, Named>, e.difficulties);
  apply(MAP_TYPES as unknown as Record<string, Named>, e.mapTypes);
  for (const [k, n] of Object.entries({ road: 'Road', irrigation: 'Irrigation', mine: 'Mine', clean: 'Clean pollution', transform: 'Transform' })) {
    if (k in TERRAFORM_INFO) TERRAFORM_INFO[k as keyof typeof TERRAFORM_INFO].nameUa = n;
  }
  for (const [k, n] of Object.entries(e.mapSizes)) if (k in MAP_SIZES) MAP_SIZES[k as keyof typeof MAP_SIZES].nameUa = n;
  for (const [k, n] of Object.entries(e.terrain)) if (k in TERRAIN_NAMES_UA) TERRAIN_NAMES_UA[k as keyof typeof TERRAIN_NAMES_UA] = n;
  for (const [k, [name, leader, cities]] of Object.entries(e.civs)) {
    const c = CIVS[k as keyof typeof CIVS];
    if (!c) continue;
    c.nameUa = name;
    c.leaderUa = leader;
    // Нові міста отримають англійські назви; довший український список (якщо доповнять) не обрізаємо
    cities.forEach((n, i) => { if (i < c.cityNames.length) c.cityNames[i] = n; });
  }
}

/** Гравці зі збереження іншою мовою: назви цивілізацій і лідерів — з поточних даних. */
export function syncPlayerNames(players: Player[]): void {
  for (const p of players) {
    if (p.civ && CIVS[p.civ]) {
      p.nameUa = CIVS[p.civ].nameUa;
      p.leaderUa = CIVS[p.civ].leaderUa;
    } else if (p.isBarbarian) {
      p.nameUa = lang === 'en' ? 'Barbarians' : 'Варвари';
      p.leaderUa = lang === 'en' ? 'Chieftain' : 'Вождь';
    }
  }
}
