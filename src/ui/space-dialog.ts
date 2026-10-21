/**
 * Космічна гонка (Civ 1): корабель до Альфи Центавра.
 * Показує зібрані частини, час польоту й шанс долетіти, кнопку запуску та кораблі суперників.
 */
import { World } from '../core/world';
import { SpacePart, Spaceship } from '../core/types';
import { SPACE_LIMITS } from '../core/constants';
import { SpriteAtlas } from '../render/sprite-atlas';
import { TurnManager } from '../core/turn-manager';

const PARTS: { key: SpacePart; nameUa: string; frame: string }[] = [
  { key: 'structural', nameUa: 'Каркаси', frame: 'sp_structural' },
  { key: 'component', nameUa: 'Двигуни', frame: 'sp_component' },
  { key: 'module', nameUa: 'Модулі', frame: 'sp_module' },
];

export class SpaceDialog {
  private overlay: HTMLElement;
  private onLaunch?: () => void;

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

  public show(onLaunch: () => void): void {
    this.onLaunch = onLaunch;
    this.render();
    this.overlay.classList.remove('hidden');
  }

  private render(): void {
    const w = this.world;
    const ship = w.spaceship(0);
    const flying = ship.arrivalYear !== undefined;
    const problem = w.launchProblem(0);
    const status = flying
      ? `Корабель летить! Прибуття — ${TurnManager.formatYear(ship.arrivalYear!)}, шанс долетіти ${Math.round((ship.success ?? 0) * 100)}%.`
      : `Політ триватиме ${w.flightYears(ship)} р., шанс долетіти ${Math.round(w.flightSuccess(ship) * 100)}%.`;

    const rivals = w.players
      .filter((p) => p.id !== 0 && p.alive && !p.isBarbarian)
      .map((p) => `<li>${p.nameUa}: ${this.rivalStatus(p.spaceship)}</li>`)
      .join('');

    this.overlay.innerHTML = `
      <div class="tech-modal">
        <div class="city-header">
          <h2>🚀 Космічна гонка: до Альфи Центавра</h2>
          <button class="btn-close" id="space-close-btn">✖</button>
        </div>
        <p class="modal-subtitle">Частини будують ваші міста (потрібна Програма «Аполлон» будь-де у світі). Кожен двигун і модуль
          тримається на своєму каркасі. Двигуни скорочують політ, модулі — бережуть колоністів. Запуск — зі столиці;
          втратите столицю — втратите й корабель. Хто першим долетить — переміг.</p>
        <canvas id="space-canvas" class="space-canvas" width="400" height="132"></canvas>
        <p class="space-status">${w.shipSummary(ship)}. ${status}</p>
        ${flying ? '' : `<p class="tech-unlocks">${problem ? `⚠️ ${problem}` : '✅ Корабель готовий до старту.'}</p>`}
        <button class="btn-primary" id="space-launch-btn" ${flying || problem ? 'disabled' : ''}>🚀 Запуск!</button>
        <div class="space-rivals"><b>Суперники:</b><ul>${rivals || '<li>—</li>'}</ul></div>
      </div>
    `;
    this.drawShip(this.overlay.querySelector('#space-canvas') as HTMLCanvasElement, ship);
    document.getElementById('space-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('space-launch-btn')?.addEventListener('click', () => {
      if (this.world.launchSpaceship(0)) {
        this.onLaunch?.();
        this.render();
      }
    });
  }

  private rivalStatus(s?: Spaceship): string {
    if (!s || s.structural + s.component + s.module === 0) return 'корабля немає';
    if (s.arrivalYear !== undefined) return `🚀 ЛЕТИТЬ, прибуття ${TurnManager.formatYear(s.arrivalYear)}`;
    return `будує (${this.world.shipSummary(s)})`;
  }

  /** Ряди частин: зібрані — яскраві, вільні місця — ледь видні. */
  private drawShip(canvas: HTMLCanvasElement, ship: Spaceship): void {
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Зорі
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 3 ? '#3b4a6b' : '#c8d4ff';
      ctx.fillRect((i * 97) % canvas.width, (i * 53) % canvas.height, 1, 1);
    }
    PARTS.forEach((part, row) => {
      const y = 8 + row * 42;
      ctx.fillStyle = '#9fb3d9';
      ctx.font = '10px monospace';
      ctx.fillText(part.nameUa, 4, y + 22);
      for (let i = 0; i < SPACE_LIMITS[part.key]; i++) {
        ctx.globalAlpha = i < ship[part.key] ? 1 : 0.15;
        SpriteAtlas.draw(ctx, part.frame, 64 + i * 28, y, 28, 28);
      }
      ctx.globalAlpha = 1;
    });
  }

  private close(): void {
    this.overlay.classList.add('hidden');
  }
}
