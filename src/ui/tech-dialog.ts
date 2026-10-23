/**
 * Модальне вікно вибору наукового дослідження (Науковий Радник Civ 1).
 */
import { CivKey, Player, Tech } from '../core/types';
import { TurnManager } from '../core/turn-manager';
import { SoundEffects } from './sound-fx';
import { UNIT_CONFIGS, BUILDING_CONFIGS, TECH_TREE, GOVERNMENTS, unitForCiv } from '../core/constants';

/** Що саме відкриває технологія: юніти, споруди, чудеса, наступні технології. */
function unlocksOf(techId: string, civ?: CivKey): string {
  const parts: string[] = [];
  for (const u of Object.values(UNIT_CONFIGS)) if (u.prereqTech === techId && unitForCiv(u, civ)) parts.push(`${u.civ ? '⭐' : '⚔️'} ${u.nameUa}`);
  for (const b of Object.values(BUILDING_CONFIGS)) {
    if (b.prereqTech === techId && (!b.civ || b.civ === civ)) parts.push(`${b.isWonder ? '🌟' : '🏛️'} ${b.nameUa}`);
  }
  if (techId === 'bridge_building') parts.push('🛤️ Дороги через річки');
  if (techId === 'explosives') parts.push('⛏️ Робітники працюють удвічі швидше');
  if (techId === 'automobile') parts.push('☁️ Великі міста забруднюють і без фабрик');
  if (techId === 'nuclear_power') parts.push('⚓ Кораблі +1 рух');
  if (techId === 'future_tech') parts.push('🏆 +5 до рахунку цивілізації');
  for (const g of Object.values(GOVERNMENTS)) if (g.prereqTech === techId) parts.push(`👑 Устрій: ${g.nameUa}`);
  const next = Object.values(TECH_TREE).filter((t) => t.prereqs.includes(techId)).map((t) => t.nameUa);
  if (next.length) parts.push(`→ ${next.join(', ')}`);
  return parts.join(' · ');
}

export class TechDialog {
  private overlay: HTMLElement;
  private onTechSelected?: (tech: Tech) => void;

  constructor(private container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    this.container.appendChild(this.overlay);
    // Закрити без вибору безпечно: дослідження лишається поточним (на телефоні вікно — на весь екран, тож потрібна кнопка)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.overlay.classList.add('hidden');
    });
  }

  public show(player: Player, onSelect: (tech: Tech) => void): void {
    this.onTechSelected = onSelect;
    const available = TurnManager.getAvailableTechs(player);
    const cost = TurnManager.researchCost(player);
    this.overlay.classList.remove('hidden');

    this.overlay.innerHTML = `
      <div class="tech-modal">
        <div class="city-header">
          <h2>📜 Науковий Радник: Оберіть дослідження</h2>
          <button class="btn-close" id="tech-close-btn" title="Закрити [Esc]">✖</button>
        </div>
        <p class="modal-subtitle">Яку галузь знань мають розвивати вчені вашої цивілізації?</p>

        <div class="tech-list">
          ${available.map((tech) => `
            <div class="tech-card" data-id="${tech.id}">
              <div class="tech-card-header">
                <h3>${tech.nameUa}</h3>
                <span class="tech-cost">🧪 ${cost} колб</span>
              </div>
              <p>${tech.descriptionUa}</p>
              <p class="tech-unlocks">${unlocksOf(tech.id, player.civ) || '—'}</p>
              <button class="btn-primary" data-id="${tech.id}">Досліджувати</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.overlay.querySelector('#tech-close-btn')?.addEventListener('click', () => this.overlay.classList.add('hidden'));
    const buttons = this.overlay.querySelectorAll('.tech-card button');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const techId = btn.getAttribute('data-id')!;
        const selected = available.find((t) => t.id === techId);
        if (selected) {
          player.currentTechId = selected.id;
          SoundEffects.playClick();
          this.overlay.classList.add('hidden');
          if (this.onTechSelected) this.onTechSelected(selected);
        }
      });
    });
  }
}
