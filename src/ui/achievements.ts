/**
 * Досягнення: ~20 цілей на всі партії, зберігаються в браузері (localStorage, у try/catch).
 * Перевіряються після кожної дії й ходу за станом світу; приховані — пасхалки, опис видно лише після відкриття.
 */
import { World } from '../core/world';
import { BuildingTypeKey } from '../core/types';
import { CIVS, MAP_WIDTH, MAP_HEIGHT, FAT_CROSS_OFFSETS } from '../core/constants';
import { SoundEffects } from './sound-fx';

const ACHV_KEY = 'civ1-remaster-achievements';

interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  hidden?: boolean;
  check: (w: World) => boolean;
}

const mine = (w: World) => [...w.cities.values()].filter((c) => c.playerId === 0);
const rivals = (w: World) => w.players.filter((p) => p.id !== 0 && !p.isBarbarian);

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_city', icon: '🏛️', title: 'Перший камінь', desc: 'Заснуйте столицю.', check: (w) => mine(w).length >= 1 },
  { id: 'cities_5', icon: '🏘️', title: 'Князівство', desc: 'Майте 5 міст.', check: (w) => mine(w).length >= 5 },
  { id: 'cities_10', icon: '🏙️', title: '10 міст', desc: 'Майте 10 міст.', check: (w) => mine(w).length >= 10 },
  { id: 'cities_20', icon: '🗺️', title: 'Імперія', desc: 'Майте 20 міст.', check: (w) => mine(w).length >= 20 },
  { id: 'big_city', icon: '🌆', title: 'Мегаполіс', desc: 'Виростіть місто до розміру 15.', check: (w) => mine(w).some((c) => c.size >= 15) },
  { id: 'wonder_1', icon: '🌟', title: 'Перше чудо', desc: 'Збудуйте чудо світу.', check: (w) => w.ownerWonders(0).size >= 1 },
  { id: 'wonder_7', icon: '✨', title: 'Сім чудес', desc: 'Володійте сімома чудесами світу.', check: (w) => w.ownerWonders(0).size >= 7 },
  { id: 'contact', icon: '👋', title: 'Ми не самі', desc: 'Познайомтесь з іншою цивілізацією.', check: (w) => rivals(w).some((p) => w.diplomacy.hasContact(0, p.id)) },
  {
    id: 'peace_all', icon: '🕊️', title: 'Мир з усіма', desc: 'Знайомі щонайменше з трьома цивілізаціями — і ні з ким не воюєте.',
    check: (w) => {
      const known = rivals(w).filter((p) => p.alive && w.diplomacy.hasContact(0, p.id));
      return known.length >= 3 && known.every((p) => !w.diplomacy.atWar(0, p.id));
    },
  },
  {
    id: 'capital', icon: '👑', title: 'Завойовник столиць', desc: 'Захопіть столицю іншої цивілізації.',
    // Перше місто кожної цивілізації — її столиця (назва з її списку)
    check: (w) => {
      const capitals = new Set(rivals(w).map((p) => (p.civ ? CIVS[p.civ].cityNames[0] : '')).filter(Boolean));
      return mine(w).some((c) => capitals.has(c.name));
    },
  },
  { id: 'conquest', icon: '⚔️', title: 'Єдиний правитель', desc: 'Лишіться єдиною цивілізацією на Землі.', check: (w) => w.gameOver?.reason === 'conquest' && w.gameOver.winner === 0 },
  { id: 'republic', icon: '🗳️', title: 'Влада народу', desc: 'Встановіть Республіку чи Демократію.', check: (w) => ['republic', 'democracy'].includes(w.players[0].government) },
  { id: 'techs_30', icon: '📚', title: 'Вчений народ', desc: 'Знайте 30 технологій.', check: (w) => w.players[0].knownTechs.length >= 30 },
  { id: 'techs_all', icon: '🧠', title: 'Майбутнє вже тут', desc: 'Відкрийте технологію майбутнього.', check: (w) => (w.players[0].futureTechs ?? 0) >= 1 },
  { id: 'gold_1000', icon: '💰', title: 'Скарбниця', desc: 'Назбирайте 1000 золотих.', check: (w) => w.players[0].gold >= 1000 },
  {
    id: 'explorer', icon: '🧭', title: 'Картограф', desc: 'Розвідайте половину світу.',
    check: (w) => {
      const fog = w.playerFogs.get(0);
      if (!fog) return false;
      let seen = 0;
      for (const row of fog.explored) for (const e of row) if (e) seen++;
      return seen >= (MAP_WIDTH * MAP_HEIGHT) / 2;
    },
  },
  {
    id: 'railroad', icon: '🚂', title: 'Залізний кінь', desc: 'Прокладіть залізницю біля свого міста.',
    check: (w) => mine(w).some((c) => FAT_CROSS_OFFSETS.some((o) => w.tiles[c.y + o.dy]?.[(c.x + o.dx + MAP_WIDTH) % MAP_WIDTH]?.hasRailroad)),
  },
  { id: 'un', icon: '🇺🇳', title: 'Голос світу', desc: 'Збудуйте ООН.', check: (w) => w.ownerWonders(0).has(BuildingTypeKey.UnitedNations) },
  { id: 'launch', icon: '🚀', title: 'До зірок', desc: 'Запустіть космічний корабель.', check: (w) => w.players[0].spaceship?.arrivalYear !== undefined },
  {
    id: 'alpha_1900', icon: '🌌', title: 'Альфа Центавра до 1900', desc: 'Долетіть до Альфи Центавра раніше за 1900 рік.',
    check: (w) => w.gameOver?.reason === 'space' && w.gameOver.winner === 0 && (w.players[0].spaceship?.arrivalYear ?? Infinity) < 1900,
  },
  { id: 'victory', icon: '🏆', title: 'Переможець', desc: 'Виграйте партію будь-яким способом.', check: (w) => w.gameOver?.winner === 0 && w.gameOver.reason !== 'destroyed' },
  { id: 'altanka', icon: '🌳', title: 'Сумська альтанка', desc: 'Побачення над Пслом: збудуйте Сумську альтанку.', hidden: true, check: (w) => w.ownerWonders(0).has(BuildingTypeKey.SumyAltanka) },
  { id: 'school', icon: '🎓', title: 'Випускник', desc: 'Збудуйте Сумську школу №1 — учителі пам\'ятають кожного.', hidden: true, check: (w) => w.ownerWonders(0).has(BuildingTypeKey.SumySchool) },
];

function loadUnlocked(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ACHV_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Список досягнень (для меню й гри): відкриті — з датою, приховані — «???». */
export function achievementsHtml(): string {
  const got = loadUnlocked();
  const count = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  return `
    <p class="modal-subtitle">Відкрито ${count} з ${ACHIEVEMENTS.length}. Досягнення спільні для всіх партій у цьому браузері.</p>
    <div class="achv-grid">
      ${ACHIEVEMENTS.map((a) => {
        const date = got[a.id];
        const secret = a.hidden && !date;
        return `<div class="achv ${date ? 'achv-got' : ''}" title="${secret ? 'Приховане досягнення' : a.desc}">
          <span class="achv-icon">${secret ? '❔' : a.icon}</span>
          <span><b>${secret ? '???' : a.title}</b><br><small>${secret ? 'Пасхалка — знайдіть самі' : a.desc}${date ? ` · ${date}` : ''}</small></span>
        </div>`;
      }).join('')}
    </div>`;
}

export class Achievements {
  /** Що вже виконано на момент старту «швидкого старту»: це заслуга AI, не гравця */
  private baseline = new Set<string>();
  private toastEl?: HTMLElement;
  private toastTimer?: number;

  constructor(private world: World) {
    if (world.uiData.quickStart) {
      const base = (world.uiData.achvBaseline as string[] | undefined)
        ?? ACHIEVEMENTS.filter((a) => a.check(world)).map((a) => a.id);
      world.uiData.achvBaseline = base;
      this.baseline = new Set(base);
    }
  }

  /** Перевірити все; нові — у сховище й сповіщенням. */
  public check(): void {
    const got = loadUnlocked();
    const fresh = ACHIEVEMENTS.filter((a) => !got[a.id] && !this.baseline.has(a.id) && a.check(this.world));
    if (!fresh.length) return;
    const date = new Date().toLocaleDateString('uk-UA');
    for (const a of fresh) got[a.id] = date;
    try {
      localStorage.setItem(ACHV_KEY, JSON.stringify(got));
    } catch {
      // приватний режим: сповіщення покажемо, але не запам'ятаємо
    }
    fresh.forEach((a, i) => setTimeout(() => this.toast(a), i * 2600));
  }

  private toast(a: Achievement): void {
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'achv-toast hidden';
      document.body.appendChild(this.toastEl);
    }
    const el = this.toastEl;
    el.innerHTML = `<span class="achv-icon">${a.icon}</span><span><small>🏅 Досягнення!</small><br><b>${a.title}</b><br><small>${a.desc}</small></span>`;
    el.classList.remove('hidden');
    SoundEffects.playClick();
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2400);
  }
}

/** Вікно списку досягнень у грі. */
export class AchievementsDialog {
  private overlay: HTMLElement;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    container.appendChild(this.overlay);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.overlay.classList.add('hidden');
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.overlay.classList.add('hidden');
    });
  }

  public show(): void {
    this.overlay.innerHTML = `
      <div class="tech-modal help-modal">
        <div class="city-header"><h2>🏅 Досягнення</h2><button class="btn-close" data-close>✖</button></div>
        ${achievementsHtml()}
      </div>`;
    this.overlay.querySelector('[data-close]')?.addEventListener('click', () => this.overlay.classList.add('hidden'));
    this.overlay.classList.remove('hidden');
  }
}
