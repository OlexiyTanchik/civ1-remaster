/**
 * Кінець гри: перемога чи поразка, рахунок цивілізацій і «Зал слави» (зберігається в браузері).
 */
import { World } from '../core/world';

interface HallEntry {
  date: string;
  civ: string;
  result: string;
  year: string;
  score: number;
}

const HALL_KEY = 'civ1-remaster-hall-of-fame';

function loadHall(): HallEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HALL_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Таблиця «Залу слави»: 10 найкращих партій (і для головного меню). */
export function hallOfFameHtml(): string {
  const hall = loadHall().sort((a, b) => b.score - a.score).slice(0, 10);
  return `
    <div class="hall-table-wrap">
      <table class="hall-table">
        <tr><th>#</th><th>Дата</th><th>Цивілізація</th><th>Підсумок</th><th>Рік</th><th>Рахунок</th></tr>
        ${hall.map((h, i) => `<tr><td>${i + 1}</td><td>${h.date}</td><td>${h.civ}</td><td>${h.result}</td><td>${h.year}</td><td><b>${h.score}</b></td></tr>`).join('') || '<tr><td colspan="6">Поки порожньо — зіграйте першу партію до кінця.</td></tr>'}
      </table>
    </div>`;
}

export class GameOverDialog {
  private overlay: HTMLElement;
  private recorded = false;

  constructor(private container: HTMLElement, private world: World) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    this.container.appendChild(this.overlay);
  }

  public show(): void {
    const w = this.world;
    const over = w.gameOver;
    if (!over) return;
    const human = w.players[0];
    const winner = over.winner !== undefined ? w.players[over.winner] : undefined;
    const won = over.winner === 0;
    const headline = this.headline(over.reason, won, winner?.nameUa);
    const myScore = w.score(0).total;

    if (!this.recorded) {
      this.recorded = true;
      this.saveHall({ date: new Date().toLocaleDateString('uk-UA'), civ: human.nameUa, result: won ? 'Перемога' : 'Поразка', year: over.year, score: myScore });
    }

    const rows = w.players
      .filter((p) => !p.isBarbarian)
      .map((p) => ({ p, s: w.score(p.id) }))
      .sort((a, b) => b.s.total - a.s.total)
      .map(({ p, s }) => `
        <tr class="${p.id === 0 ? 'hall-me' : ''}">
          <td>${p.nameUa}${p.alive ? '' : ' 💀'}</td><td>${s.citizens}</td><td>${s.wonders}</td><td>${s.future}</td>
          <td>${s.space}</td><td>${s.pollution}</td><td><b>${s.total}</b></td>
        </tr>`).join('');

    this.overlay.innerHTML = `
      <div class="tech-modal">
        <div class="city-header"><h2>${headline.title}</h2></div>
        <p class="modal-subtitle">${headline.text} (${over.year})</p>
        <div class="hall-table-wrap">
          <table class="hall-table">
            <tr><th>Цивілізація</th><th>Громадяни</th><th>Чудеса</th><th>Майбутнє</th><th>Космос</th><th>Смог</th><th>Рахунок</th></tr>
            ${rows}
          </table>
        </div>
        <h3 class="hall-title">🏛️ Зал слави</h3>
        ${hallOfFameHtml()}
        <div class="hall-buttons">
          <button class="btn-primary" id="go-new-btn">Нова гра</button>
          <button class="btn-primary" id="go-close-btn">Подивитися на світ</button>
        </div>
      </div>
    `;
    this.overlay.classList.remove('hidden');
    document.getElementById('go-new-btn')?.addEventListener('click', () => location.reload());
    document.getElementById('go-close-btn')?.addEventListener('click', () => this.overlay.classList.add('hidden'));
  }

  private headline(reason: string, won: boolean, winnerName?: string): { title: string; text: string } {
    if (reason === 'destroyed') return { title: '💀 Кінець цивілізації', text: 'Вашу цивілізацію знищено. Історію напишуть інші.' };
    if (reason === 'space') {
      return won
        ? { title: '🌟 ПЕРЕМОГА! Альфа Центавра', text: 'Ваші колоністи першими ступили на землю іншої зорі.' }
        : { title: '🚀 Поразка в космічній гонці', text: `${winnerName} першими досягли Альфи Центавра.` };
    }
    if (reason === 'conquest') {
      return won
        ? { title: '⚔️ ПЕРЕМОГА! Світ під вашою владою', text: 'Жодної іншої цивілізації не лишилось.' }
        : { title: '⚔️ Поразка', text: `${winnerName} підкорили світ.` };
    }
    return won
      ? { title: '⌛ 2100 рік: ваша цивілізація — найвеличніша', text: 'Час вийшов, і ваш рахунок найвищий.' }
      : { title: '⌛ 2100 рік: час вийшов', text: `Найвищий рахунок — у цивілізації ${winnerName}.` };
  }

  private saveHall(entry: HallEntry): void {
    try {
      localStorage.setItem(HALL_KEY, JSON.stringify([...loadHall(), entry]));
    } catch {
      // Сховище недоступне (приватне вікно) — Зал слави просто не запам'ятає гру
    }
  }
}
