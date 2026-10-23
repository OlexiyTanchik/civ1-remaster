/**
 * «📊 Статистика» (радники Civ 1): графіки за історію партії, топ-5 міст світу, демографія, хроніка.
 * Чужі цивілізації видно лише після знайомства (після кінця гри — усі).
 */
import { World } from '../core/world';
import { TERRAIN_DATA, MAP_WIDTH, MAP_HEIGHT } from '../core/constants';
import { CityLogic } from '../core/city';
import { historyOf, statOf, STAT_NAMES, yearLabel } from './history';

type Tab = 'charts' | 'cities' | 'demo' | 'chronicle';

/** Мапа світу дрібними клітинками: рельєф, міста кольором власника; туман — як бачить людина (або все). */
export function drawWorldMap(w: World, canvas: HTMLCanvasElement, cell: number, revealAll: boolean): void {
  canvas.width = MAP_WIDTH * cell;
  canvas.height = MAP_HEIGHT * cell;
  const ctx = canvas.getContext('2d')!;
  const fog = w.playerFogs.get(0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (!revealAll && fog && !fog.explored[y][x]) continue;
      const t = w.tiles[y][x];
      ctx.fillStyle = `#${TERRAIN_DATA[t.terrain].color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  for (const c of w.cities.values()) {
    if (!revealAll && fog && !fog.explored[c.y][c.x]) continue;
    const r = Math.max(2, Math.round(cell * (1 + Math.min(c.size, 20) / 20)));
    ctx.fillStyle = w.players[c.playerId].color;
    ctx.fillRect(c.x * cell + cell / 2 - r, c.y * cell + cell / 2 - r, r * 2, r * 2);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(c.x * cell + cell / 2 - r + 0.5, c.y * cell + cell / 2 - r + 0.5, r * 2 - 1, r * 2 - 1);
  }
}

export class StatsDialog {
  private overlay: HTMLElement;
  private tab: Tab = 'charts';
  private metric = 0;

  constructor(container: HTMLElement, private world: World) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    container.appendChild(this.overlay);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.close();
    });
  }

  /** Хто видимий людині: вона сама, знайомі, а після кінця гри — усі. */
  private visibleCivs(): number[] {
    const w = this.world;
    return w.players
      .filter((p) => !p.isBarbarian && (p.id === 0 || !!w.gameOver || w.diplomacy.hasContact(0, p.id)))
      .map((p) => p.id);
  }

  public show(tab?: Tab): void {
    if (tab) this.tab = tab;
    const tabs: [Tab, string][] = [['charts', '📈 Графіки'], ['cities', '🏙️ Топ-5 міст'], ['demo', '👥 Демографія'], ['chronicle', '📜 Хроніка']];
    this.overlay.innerHTML = `
      <div class="tech-modal stats-modal">
        <div class="city-header">
          <h2>📊 Статистика · ${this.world.turnManager.getYearString()}</h2>
          <button class="btn-close" data-close title="Закрити [Esc]">✖</button>
        </div>
        <div class="stats-tabs">${tabs.map(([t, l]) => `<button class="civ-btn ${t === this.tab ? 'active' : ''}" data-tab="${t}">${l}</button>`).join('')}</div>
        <div class="stats-body">${this.body()}</div>
      </div>`;
    this.overlay.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.tab as Tab)));
    this.overlay.querySelectorAll<HTMLElement>('[data-metric]').forEach((b) => b.addEventListener('click', () => {
      this.metric = Number(b.dataset.metric);
      this.show();
    }));
    this.overlay.classList.remove('hidden');
    if (this.tab === 'charts') this.drawChart();
  }

  private body(): string {
    switch (this.tab) {
      case 'charts': return this.chartsHtml();
      case 'cities': return this.citiesHtml();
      case 'demo': return this.demoHtml();
      default: return this.chronicleHtml();
    }
  }

  private legend(): string {
    return this.visibleCivs().map((id) => {
      const p = this.world.players[id];
      return `<span class="stats-legend"><i style="background:${p.color}"></i>${p.nameUa}${p.alive ? '' : ' 💀'}</span>`;
    }).join('');
  }

  private chartsHtml(): string {
    const n = historyOf(this.world).points.length;
    return `
      <div class="stats-metrics">${STAT_NAMES.map((name, i) => `<button class="civ-btn ${i === this.metric ? 'active' : ''}" data-metric="${i}">${name}</button>`).join('')}</div>
      ${n < 2 ? '<p class="modal-subtitle">Історія збирається з кожним ходом — завершіть кілька ходів.</p>' : '<canvas class="stats-chart" id="stats-chart"></canvas>'}
      <div class="stats-legends">${this.legend()}</div>`;
  }

  /** Лінійний графік обраного показника; вісь X — роки партії. */
  private drawChart(): void {
    const canvas = this.overlay.querySelector<HTMLCanvasElement>('#stats-chart');
    if (!canvas) return;
    const pts = historyOf(this.world).points;
    const ids = this.visibleCivs();
    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const pad = { l: 40, r: 8, t: 8, b: 22 };
    let max = 1;
    for (const pt of pts) for (const id of ids) max = Math.max(max, pt.v[id]?.[this.metric] ?? 0);
    const x = (i: number) => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
    ctx.fillStyle = '#060d1a';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Courier New, monospace';
    ctx.fillStyle = '#8aa0bf';
    ctx.strokeStyle = '#1a3258';
    for (let k = 0; k <= 4; k++) {
      const v = Math.round((max * k) / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y(v) + 0.5);
      ctx.lineTo(W - pad.r, y(v) + 0.5);
      ctx.stroke();
      ctx.fillText(String(v), 4, y(v) + 3);
    }
    // Підписи років: початок, середина, кінець
    for (const i of [0, Math.floor((pts.length - 1) / 2), pts.length - 1]) {
      const label = yearLabel(pts[i].y);
      ctx.fillText(label, Math.min(W - pad.r - label.length * 6, Math.max(pad.l, x(i) - label.length * 3)), H - 6);
    }
    for (const id of ids) {
      ctx.strokeStyle = this.world.players[id].color;
      ctx.lineWidth = id === 0 ? 2.5 : 1.5;
      ctx.beginPath();
      let started = false;
      pts.forEach((pt, i) => {
        const v = pt.v[id]?.[this.metric];
        if (v === undefined) return;
        if (!started) ctx.moveTo(x(i), y(v));
        else ctx.lineTo(x(i), y(v));
        started = true;
      });
      ctx.stroke();
    }
  }

  private citiesHtml(): string {
    const w = this.world;
    const known = new Set(this.visibleCivs());
    const top = [...w.cities.values()]
      .sort((a, b) => b.size - a.size || b.buildings.length - a.buildings.length)
      .slice(0, 5);
    return `
      <p class="modal-subtitle">Найбільші міста світу (як у Civ 1: розмір, потім споруди).</p>
      <table class="hall-table">
        <tr><th>#</th><th>Місто</th><th>Цивілізація</th><th>Жителі</th><th>Споруд</th></tr>
        ${top.map((c, i) => {
          const p = w.players[c.playerId];
          const owner = known.has(p.id) || p.isBarbarian ? `<span class="stats-legend"><i style="background:${p.color}"></i>${p.nameUa}</span>` : '<span class="dim">невідома цивілізація</span>';
          return `<tr class="${c.playerId === 0 ? 'hall-me' : ''}"><td>${i + 1}</td><td>${c.name}</td><td>${owner}</td><td>${CityLogic.population(c.size).toLocaleString('uk-UA')}</td><td>${c.buildings.length}</td></tr>`;
        }).join('')}
      </table>`;
  }

  /** Демографія: наші показники й місце серед усіх живих цивілізацій. */
  private demoHtml(): string {
    const w = this.world;
    const alive = w.players.filter((p) => !p.isBarbarian && p.alive);
    const metric = (id: number) => {
      let pop = 0, sci = 0, shields = 0;
      for (const c of w.cities.values()) {
        if (c.playerId !== id) continue;
        pop += CityLogic.population(c.size);
        const y = w.cityYields(c);
        sci += y.science;
        shields += y.shields;
      }
      const s = statOf(w, id);
      return [pop, w.players[id].gold, sci, shields, s[1], s[2], s[3]];
    };
    const names = ['👥 Населення', '💰 Золото', '🧪 Наука за хід', '🛡️ Виробництво за хід', '🏛️ Міста', '📚 Технології', '⚔️ Армія'];
    const all = alive.map((p) => ({ id: p.id, m: metric(p.id) }));
    const mine = all.find((a) => a.id === 0)?.m ?? metric(0);
    const place = (i: number) => 1 + all.filter((a) => a.id !== 0 && a.m[i] > mine[i]).length;
    return `
      <p class="modal-subtitle">Місце серед ${alive.length} цивілізацій (бачать і ті, з ким ви ще не знайомі).</p>
      <table class="hall-table">
        <tr><th>Показник</th><th>Ваша цивілізація</th><th>Місце</th></tr>
        ${names.map((n, i) => {
          const pl = place(i);
          return `<tr><td>${n}</td><td><b>${mine[i].toLocaleString('uk-UA')}</b></td><td>${pl === 1 ? '🥇 1' : pl === 2 ? '🥈 2' : pl === 3 ? '🥉 3' : pl}</td></tr>`;
        }).join('')}
      </table>`;
  }

  private chronicleHtml(): string {
    const ev = historyOf(this.world).events;
    if (!ev.length) return '<p class="modal-subtitle">Хроніка порожня: її пишуть столиця, чудеса, війни, нові епохи.</p>';
    return `<div class="journal-list">${[...ev].reverse().map((e) => `<div class="journal-row"><span class="dim">${yearLabel(e.y)}</span> ${e.text}</div>`).join('')}</div>`;
  }

  private close(): void {
    this.overlay.classList.add('hidden');
  }
}
