/**
 * Вибір державного устрою (революція, як у Civ 1): 2 ходи анархії, потім новий лад.
 */
import { World } from '../core/world';
import { GovernmentKey } from '../core/types';
import { GOVERNMENTS, TECH_TREE } from '../core/constants';

const CHOICES: GovernmentKey[] = ['despotism', 'monarchy', 'communism', 'republic', 'democracy'];

export class GovernmentDialog {
  private overlay: HTMLElement;

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

  public show(onRevolution: (gov: GovernmentKey) => void): void {
    const player = this.world.players[0];
    const current = GOVERNMENTS[player.government];
    const status = player.government === 'anarchy' && player.targetGovernment
      ? `Анархія! Ще ${player.revolutionTurns} ход. до встановлення: ${GOVERNMENTS[player.targetGovernment].nameUa}.`
      : `Зараз: ${current.nameUa}.`;

    this.overlay.innerHTML = `
      <div class="tech-modal">
        <div class="city-header">
          <h2>🏛️ Державний устрій</h2>
          <button class="btn-close" id="gov-close-btn">✖</button>
        </div>
        <p class="modal-subtitle">${status} Зміна устрою — це революція: 2 ходи анархії без податків і науки.</p>
        <div class="tech-list">
          ${CHOICES.map((key) => {
            const g = GOVERNMENTS[key];
            const isCurrent = player.government === key || player.targetGovernment === key;
            const locked = g.prereqTech && !player.knownTechs.includes(g.prereqTech);
            const note = isCurrent ? 'Діє зараз' : locked ? `Потрібна технологія: ${TECH_TREE[g.prereqTech!].nameUa}` : '';
            return `
              <div class="tech-card">
                <div class="tech-card-header"><h3>${g.nameUa}</h3><span class="tech-cost">ставки до ${g.maxRate * 10}%</span></div>
                <p>${g.descriptionUa}</p>
                ${note ? `<p class="tech-unlocks">${note}</p>` : ''}
                <button class="btn-primary" data-gov="${key}" ${isCurrent || locked || player.government === 'anarchy' ? 'disabled' : ''}>Революція!</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
    this.overlay.classList.remove('hidden');

    document.getElementById('gov-close-btn')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-gov]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gov = btn.dataset.gov as GovernmentKey;
        if (this.world.startRevolution(0, gov)) {
          this.close();
          onRevolution(gov);
        }
      });
    });
  }

  private close(): void {
    this.overlay.classList.add('hidden');
  }
}
