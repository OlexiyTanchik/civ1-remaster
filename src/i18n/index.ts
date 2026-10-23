/**
 * Мова інтерфейсу: українська (основна, нею написано код) або англійська.
 * Ключ перекладу — сам український рядок: без перекладу показується він же, тож порожніх місць не буває.
 * Плейсхолдери {0}, {1}… підставляються однаково в обох мовах.
 */
import { EN_UI } from './en-ui';
import { translateMessageEn } from './en-messages';

export type Lang = 'uk' | 'en';
const LANG_KEY = 'civ1-remaster-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    // без сховища — за мовою браузера
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
  return nav.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

export const lang: Lang = detect();

/** Змінити мову: назви юнітів, міст і цивілізацій підміняються на старті, тож — перезавантаження сторінки. */
export function setLang(l: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // приватний режим: після перезавантаження знову спрацює мова браузера
  }
  location.reload();
}

/** Переклад рядка інтерфейсу з підстановкою {0}, {1}… */
export function t(uk: string, ...args: (string | number)[]): string {
  const s = lang === 'en' ? EN_UI[uk] ?? uk : uk;
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s;
}

/** Повідомлення з ядра гри (журнал, новини, зустрічі): переклад за шаблонами, решта — як є. */
export function tm(text: string): string {
  return lang === 'en' ? translateMessageEn(text) : text;
}

/** Кнопка-перемикач мови для меню. */
export function langSwitchHtml(): string {
  return `<button class="civ-btn lang-switch" data-lang="${lang === 'en' ? 'uk' : 'en'}" title="${lang === 'en' ? 'Українська' : 'English'}">${lang === 'en' ? '🇺🇦 Українська' : '🇬🇧 English'}</button>`;
}

export function bindLangSwitch(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.lang-switch').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));
}
