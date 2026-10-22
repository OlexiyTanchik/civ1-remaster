/**
 * Головне меню перед грою (як заставка Civ 1): продовжити, нова гра, завантажити, Зал слави.
 * Нова гра: цивілізація, кількість суперників, розмір мапи, складність.
 */
import { CIVS, MAP_SIZES, DIFFICULTIES } from '../core/constants';
import { CivKey, DifficultyKey, GameOptions, MapSizeKey } from '../core/types';
import { SaveData } from '../core/world';
import { SLOTS, SlotId, listSaves, loadSave, slotName } from './save-store';
import { hallOfFameHtml } from './game-over-dialog';
import { helpHtml, aboutHtml } from './help-dialog';

export type MenuChoice = { options: GameOptions } | { save: SaveData };

export function showMainMenu(container: HTMLElement): Promise<MenuChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay main-menu-overlay';
    container.appendChild(overlay);
    const done = (choice: MenuChoice) => {
      overlay.remove();
      resolve(choice);
    };

    const frame = (body: string, back = true) => {
      overlay.innerHTML = `
        <div class="tech-modal main-menu">
          <div class="main-menu-title">CIVILIZATION</div>
          <div class="main-menu-sub">ремастер 1991 · від перших поселень до Альфи Центавра</div>
          ${body}
          ${back ? '<button class="civ-btn main-menu-back" id="mm-back">← Назад</button>' : ''}
        </div>`;
      overlay.querySelector('#mm-back')?.addEventListener('click', home);
    };

    function home(): void {
      const saves = listSaves();
      const auto = saves.auto;
      frame(`
        <div class="main-menu-buttons">
          ${auto ? `<button class="btn-primary" id="mm-continue">▶ Продовжити<small>${auto.civ}, ${auto.year}</small></button>` : ''}
          <button class="btn-primary" id="mm-new">🌍 Нова гра</button>
          <button class="btn-primary" id="mm-load" ${Object.keys(saves).length ? '' : 'disabled'}>📂 Завантажити гру</button>
          <button class="btn-primary" id="mm-hall">🏛️ Зал слави</button>
          <div class="main-menu-row">
            <button class="civ-btn" id="mm-help">❓ Як грати</button>
            <button class="civ-btn" id="mm-about">ℹ️ Про гру</button>
          </div>
        </div>`, false);
      overlay.querySelector('#mm-continue')?.addEventListener('click', () => openSlot('auto'));
      overlay.querySelector('#mm-new')?.addEventListener('click', newGame);
      overlay.querySelector('#mm-load')?.addEventListener('click', loadList);
      overlay.querySelector('#mm-hall')?.addEventListener('click', () => frame(`<h3 class="hall-title">🏛️ Зал слави</h3>${hallOfFameHtml()}`));
      overlay.querySelector('#mm-help')?.addEventListener('click', () => frame(helpHtml()));
      overlay.querySelector('#mm-about')?.addEventListener('click', () => frame(aboutHtml()));
    }

    function openSlot(slot: SlotId): void {
      const save = loadSave(slot);
      if (save) done({ save });
      else frame(`<p class="tech-unlocks">⚠️ ${slotName(slot)}: збереження пошкоджене або зникло.</p>`);
    }

    function loadList(): void {
      const saves = listSaves();
      frame(`
        <h3 class="hall-title">📂 Завантажити гру</h3>
        <div class="save-slots">
          ${SLOTS.map((s) => {
            const m = saves[s];
            return `<div class="save-slot">
              <div><b>${slotName(s)}</b>${m ? `<br>${m.civ}, ${m.year} (хід ${m.turn})<br><small>${m.details} · ${m.date}</small>` : '<br><small>порожньо</small>'}</div>
              <button class="btn-primary" data-slot="${s}" ${m ? '' : 'disabled'}>Завантажити</button>
            </div>`;
          }).join('')}
        </div>`);
      overlay.querySelectorAll<HTMLButtonElement>('button[data-slot]').forEach((b) =>
        b.addEventListener('click', () => openSlot(b.dataset.slot as SlotId)));
    }

    function newGame(): void {
      const pick = { civ: 'rus' as CivKey, rivals: 2, mapSize: 'normal' as MapSizeKey, difficulty: 'prince' as DifficultyKey };
      const radio = <T extends string>(name: string, items: [T, string, string?][], current: T) => items.map(([v, label, hint]) => `
        <label class="mm-option ${v === current ? 'selected' : ''}" title="${hint ?? ''}">
          <input type="radio" name="${name}" value="${v}" ${v === current ? 'checked' : ''}> ${label}
        </label>`).join('');
      frame(`
        <h3 class="hall-title">Оберіть цивілізацію</h3>
        <div class="mm-grid mm-civs">
          ${(Object.keys(CIVS) as CivKey[]).map((k) => `
            <label class="mm-option ${k === pick.civ ? 'selected' : ''}">
              <input type="radio" name="civ" value="${k}" ${k === pick.civ ? 'checked' : ''}>
              <span class="mm-swatch" style="background:${CIVS[k].color}"></span>
              <span><b>${CIVS[k].nameUa}</b><br><small>${CIVS[k].leaderUa}</small></span>
            </label>`).join('')}
        </div>
        <h3 class="hall-title">Суперників</h3>
        <div class="mm-grid">${radio('rivals', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], String(pick.rivals))}</div>
        <h3 class="hall-title">Розмір мапи</h3>
        <div class="mm-grid">${radio('mapSize', (Object.keys(MAP_SIZES) as MapSizeKey[]).map((k) => [k, `${MAP_SIZES[k].nameUa} ${MAP_SIZES[k].w}×${MAP_SIZES[k].h}`]), pick.mapSize)}</div>
        <h3 class="hall-title">Складність</h3>
        <div class="mm-grid">${radio('difficulty', (Object.keys(DIFFICULTIES) as DifficultyKey[]).map((k) => [k, DIFFICULTIES[k].nameUa, DIFFICULTIES[k].descriptionUa]), pick.difficulty)}</div>
        <p class="tech-unlocks" id="mm-diff-note">${DIFFICULTIES[pick.difficulty].descriptionUa}</p>
        <button class="btn-primary main-menu-start" id="mm-start">⚔️ Почати гру</button>`);

      // Підсвічування обраного варіанта в кожній групі
      overlay.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((input) => {
        input.addEventListener('change', () => {
          overlay.querySelectorAll<HTMLInputElement>(`input[name=${input.name}]`).forEach((i) =>
            i.closest('.mm-option')?.classList.toggle('selected', i.checked));
          if (input.name === 'difficulty') {
            overlay.querySelector('#mm-diff-note')!.textContent = DIFFICULTIES[input.value as DifficultyKey].descriptionUa;
          }
        });
      });
      overlay.querySelector('#mm-start')?.addEventListener('click', () => {
        const val = (name: string) => overlay.querySelector<HTMLInputElement>(`input[name=${name}]:checked`)!.value;
        done({
          options: {
            civ: val('civ') as CivKey,
            rivals: Number(val('rivals')),
            mapSize: val('mapSize') as MapSizeKey,
            difficulty: val('difficulty') as DifficultyKey,
          },
        });
      });
    }

    home();
  });
}
