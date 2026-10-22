/**
 * Меню під час гри: зберегти в слот, завантажити збережене, вийти в головне меню.
 * Завантаження й вихід перезавантажують сторінку (світ і рендерер будуються наново).
 */
import { World } from '../core/world';
import { SLOTS, SlotId, listSaves, saveGame, setPendingLoad, slotName } from './save-store';

export class GameMenuDialog {
  private overlay: HTMLElement;
  private note = '';
  public onHelp?: () => void;

  constructor(private container: HTMLElement, private world: World) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    this.container.appendChild(this.overlay);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.close();
    });
  }

  public show(): void {
    this.note = '';
    this.render();
    this.overlay.classList.remove('hidden');
  }

  private render(): void {
    const saves = listSaves();
    this.overlay.innerHTML = `
      <div class="tech-modal">
        <div class="city-header">
          <h2>💾 Гра</h2>
          <button class="btn-close" id="gm-close-btn">✖</button>
        </div>
        <p class="modal-subtitle">Гра зберігається автоматично після кожного ходу. Збереження живуть у цьому браузері.</p>
        ${this.note ? `<p class="tech-unlocks">${this.note}</p>` : ''}
        <div class="save-slots">
          ${SLOTS.map((s) => {
            const m = saves[s];
            return `<div class="save-slot">
              <div><b>${slotName(s)}</b>${m ? `<br>${m.civ}, ${m.year} (хід ${m.turn})<br><small>${m.details} · ${m.date}</small>` : '<br><small>порожньо</small>'}</div>
              <div class="save-slot-buttons">
                ${s === 'auto' ? '' : `<button class="btn-primary" data-save="${s}">Зберегти</button>`}
                <button class="btn-primary" data-load="${s}" ${m ? '' : 'disabled'}>Завантажити</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <p class="modal-subtitle">Завантаження чи вихід у меню відкидають усе, що сталося після останнього збереження.</p>
        <div class="gm-bottom">
          <button class="civ-btn" id="gm-help-btn" title="Клавіші, мета, правила [F1]">❓ Як грати</button>
          <button class="civ-btn" id="gm-menu-btn">🏠 Головне меню</button>
        </div>
      </div>
    `;
    document.getElementById('gm-close-btn')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-save]').forEach((b) => b.addEventListener('click', () => {
      const slot = b.dataset.save as SlotId;
      const err = saveGame(this.world, slot);
      this.note = err ? `⚠️ ${err}` : `✅ Збережено: ${slotName(slot)}`;
      this.render();
    }));
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-load]').forEach((b) => b.addEventListener('click', () => {
      setPendingLoad(b.dataset.load as SlotId);
      location.reload();
    }));
    document.getElementById('gm-menu-btn')?.addEventListener('click', () => location.reload());
    document.getElementById('gm-help-btn')?.addEventListener('click', () => {
      this.close();
      this.onHelp?.();
    });
  }

  private close(): void {
    this.overlay.classList.add('hidden');
  }
}
