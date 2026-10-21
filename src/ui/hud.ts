/**
 * Автентичний класичний інтерфейс Civilization 1 (1991 DOS):
 * Бічна панель з міні-картою, статусом імперії, карткою юніта та командами.
 */
import { World } from '../core/world';
import { Unit, UnitTypeKey, BuildingTypeKey } from '../core/types';
import { MAP_WIDTH, MAP_HEIGHT, UNIT_CONFIGS, TERRAIN_DATA, BUILDING_CONFIGS, GOVERNMENTS } from '../core/constants';
import { MiniMap } from './minimap';
import { TurnManager } from '../core/turn-manager';
import { MapRenderer } from '../render/map-renderer';
import { SpriteAtlas } from '../render/sprite-atlas';
import { TerraformKind, TERRAFORM_INFO, canTerraform, terraformName } from '../core/terraform';

const TERRAFORM_KINDS: TerraformKind[] = ['road', 'irrigation', 'mine', 'clean'];
const TERRAFORM_ICONS: Record<TerraformKind, string> = { road: '🛤️', irrigation: '💧', mine: '⛏️', clean: '🧹' };

function turnsWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'хід';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'ходи';
  return 'ходів';
}

export class Hud {
  private sidebarEl: HTMLElement;
  public minimap: MiniMap;
  public onBuildCity?: () => void;
  public onFortify?: () => void;
  public onWait?: () => void;
  public onEndTurn?: () => void;
  public onOpenTechs?: () => void;
  public onToggleGrid?: () => void;
  public onTerraform?: (kind: TerraformKind) => void;
  public onHelpWonder?: () => void;
  public onRatesChanged?: () => void;
  public onOpenGovernment?: () => void;
  public onOpenSpace?: () => void;
  public onOpenGameMenu?: () => void;
  public onRehome?: () => void;

  constructor(
    private container: HTMLElement,
    private world: World,
    renderer: MapRenderer
  ) {
    this.sidebarEl = document.createElement('aside');
    this.sidebarEl.className = 'civ-sidebar';
    const mount = document.getElementById('sidebar-container') || this.container;
    mount.appendChild(this.sidebarEl);

    this.sidebarEl.innerHTML = `
      <div class="civ-game-title">CIVILIZATION</div>

      <!-- Світ / Міні-карта -->
      <div class="civ-panel-box minimap-box-container">
        <div class="panel-header">СВІТ (${MAP_WIDTH}×${MAP_HEIGHT})</div>
        <div id="minimap-box" class="minimap-wrapper"></div>
      </div>

      <!-- Статус Цивілізації -->
      <div class="civ-panel-box status-box-container">
        <div class="civ-name-badge" id="hud-civ-name">🇺🇦 Київська Русь</div>
        <div class="status-rows">
          <div class="status-row highlight-gold" id="hud-year">4000 до н.е.</div>
          <div class="status-row" id="hud-gold">Скарбниця: 50 зл.</div>
          <div class="status-row rates-row">
            <span>💰 <b id="rate-tax">50%</b></span>
            <button class="rate-btn" data-rate="tax" data-d="-1" title="Податки −10%">−</button><button class="rate-btn" data-rate="tax" data-d="1" title="Податки +10%">+</button>
            <span>🎉 <b id="rate-lux">0%</b></span>
            <button class="rate-btn" data-rate="lux" data-d="-1" title="Розкіш −10%">−</button><button class="rate-btn" data-rate="lux" data-d="1" title="Розкіш +10%">+</button>
            <span>🧪 <b id="rate-sci">50%</b></span>
          </div>
          <div class="status-row tech-link" id="hud-tech">🧪 Обрати дослідження</div>
          <div class="status-row" id="hud-pop">Населення: 10,000</div>
          <div class="status-row tech-link" id="hud-gov" title="Змінити державний устрій">🏛️ Лад: Деспотизм</div>
          <div class="status-row" id="hud-score">🏆 Рахунок: 0</div>
          <div class="status-row tech-link hidden" id="hud-space" title="Космічний корабель до Альфи Центавра">🚀 Космічна гонка</div>
        </div>
      </div>

      <!-- Картка Активного Юніта -->
      <div class="civ-panel-box unit-box-container" id="unit-panel">
        <div class="panel-header">АКТИВНИЙ ЮНІТ</div>
        <div class="unit-card-flex">
          <canvas id="unit-portrait-canvas" width="56" height="56" class="unit-portrait"></canvas>
          <div class="unit-info-col">
            <div class="unit-name-text" id="unit-title">Оберіть юніт</div>
            <div class="unit-terrain-text" id="unit-terrain"></div>
          </div>
        </div>
      </div>

      <!-- Команди та Накази -->
      <div class="civ-panel-box actions-box-container">
        <div class="panel-header">НАКАЗИ</div>
        <div class="action-buttons-list">
          <button class="civ-btn" id="btn-build-city" title="Заснувати місто [B]">🏛️ Місто [B]</button>
          ${TERRAFORM_KINDS.map((k) => `<button class="civ-btn" id="btn-tf-${k}"></button>`).join('')}
          <button class="civ-btn" id="btn-help-wonder">🌟 На чудо [H]</button>
          <button class="civ-btn" id="btn-rehome" title="Переписати юніт на це місто: воно його утримуватиме">🏠 Дім</button>
          <button class="civ-btn" id="btn-fortify" title="Укріпитися: +50% захисту [F]">🛡️ Укріпити [F]</button>
          <button class="civ-btn" id="btn-wait" title="Чекати: наступний юніт [W]">⏳ Чекати [W]</button>
          <button class="civ-btn" id="btn-toggle-grid" title="Сітка клітинок [G]">📐 Сітка ✓ [G]</button>
          <button class="civ-btn" id="btn-game-menu" title="Зберегти, завантажити, головне меню">💾 Гра</button>
          <button class="civ-btn civ-btn-end-turn" id="btn-end-turn">КІНЕЦЬ ХОДУ ⌛</button>
        </div>
      </div>
    `;

    const miniMapBox = document.getElementById('minimap-box')!;
    this.minimap = new MiniMap(miniMapBox, this.world, renderer);

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('btn-build-city')?.addEventListener('click', () => this.onBuildCity?.());
    for (const k of TERRAFORM_KINDS) {
      document.getElementById(`btn-tf-${k}`)?.addEventListener('click', () => this.onTerraform?.(k));
    }
    document.getElementById('btn-help-wonder')?.addEventListener('click', () => this.onHelpWonder?.());
    document.getElementById('hud-gov')?.addEventListener('click', () => this.onOpenGovernment?.());
    document.getElementById('hud-space')?.addEventListener('click', () => this.onOpenSpace?.());
    document.getElementById('btn-game-menu')?.addEventListener('click', () => this.onOpenGameMenu?.());
    document.getElementById('btn-rehome')?.addEventListener('click', () => this.onRehome?.());
    // Ставки: податки й розкіш ±10%, наука — решта (межа залежить від устрою)
    this.sidebarEl.querySelectorAll<HTMLButtonElement>('.rate-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ok = this.world.adjustRate(0, btn.dataset.rate as 'tax' | 'lux', Number(btn.dataset.d) as 1 | -1);
        if (!ok) {
          const gov = GOVERNMENTS[this.world.players[0].government];
          this.addLogMessage(gov.maxRate
            ? `⚠️ За устрою «${gov.nameUa}» жодна ставка не може перевищувати ${gov.maxRate * 10}%`
            : '⚠️ Під час анархії ставки не діють');
        }
        this.onRatesChanged?.();
      });
    });
    document.getElementById('btn-fortify')?.addEventListener('click', () => this.onFortify?.());
    document.getElementById('btn-wait')?.addEventListener('click', () => this.onWait?.());
    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => this.onToggleGrid?.());
    document.getElementById('btn-end-turn')?.addEventListener('click', () => this.onEndTurn?.());
    document.getElementById('hud-tech')?.addEventListener('click', () => this.onOpenTechs?.());
  }

  public updateGridButton(show: boolean): void {
    const btn = document.getElementById('btn-toggle-grid');
    if (btn) {
      btn.textContent = show ? '📐 Сітка ✓ [G]' : '📐 Сітка ✗ [G]';
    }
  }

  public update(selectedUnit?: Unit): void {
    const human = this.world.players[0];

    const civNameEl = document.getElementById('hud-civ-name');
    if (civNameEl) civNameEl.textContent = `👑 ${human.nameUa}`;

    const yearEl = document.getElementById('hud-year');
    if (yearEl) yearEl.textContent = this.world.turnManager.getYearString();

    for (const [id, v] of [['rate-tax', human.taxRate], ['rate-lux', human.luxuryRate], ['rate-sci', human.scienceRate]] as const) {
      const el = document.getElementById(id);
      if (el) el.textContent = `${v * 10}%`;
    }

    const govEl = document.getElementById('hud-gov');
    if (govEl) {
      govEl.textContent = human.government === 'anarchy' && human.targetGovernment
        ? `🏛️ Лад: Анархія (ще ${human.revolutionTurns} ход.)`
        : `🏛️ Лад: ${GOVERNMENTS[human.government].nameUa}`;
    }

    const goldEl = document.getElementById('hud-gold');
    if (goldEl) {
      // Чистий дохід: податки міст мінус утримання будівель
      const net = this.world.netIncome(human.id);
      goldEl.innerHTML = `Скарбниця: ${human.gold} зл. <span class="${net < 0 ? 'income-bad' : 'income-good'}">(${net >= 0 ? '+' : ''}${net}/хід)</span>`;
      goldEl.title = `Утримання будівель: −${this.world.upkeepOf(human.id)} зл./хід`;
    }

    const techEl = document.getElementById('hud-tech');
    if (techEl) {
      if (human.currentTechId) {
        const t = TurnManager.techById(human.currentTechId)!;
        techEl.textContent = `🧪 ${t.nameUa} (${human.researchProgress}/${TurnManager.researchCost(human)})`;
      } else {
        techEl.textContent = '🧪 Обрати дослідження';
      }
    }

    const popEl = document.getElementById('hud-pop');
    if (popEl) {
      let totalPop = 0;
      for (const c of this.world.cities.values()) {
        if (c.playerId === 0) totalPop += c.size * 10000;
      }
      if (totalPop === 0) totalPop = 10000;
      popEl.textContent = `Населення: ${totalPop.toLocaleString()} чол.`;
    }

    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = `🏆 Рахунок: ${this.world.score(0).total}`;
    // Космічна гонка з'являється в панелі, щойно хтось збудував «Аполлон» або ми вміємо літати в космос
    const spaceEl = document.getElementById('hud-space');
    if (spaceEl) {
      const open = this.world.isWonderBuilt(BuildingTypeKey.Apollo) || human.knownTechs.includes('space_flight');
      spaceEl.classList.toggle('hidden', !open);
      const ship = human.spaceship;
      spaceEl.textContent = ship?.arrivalYear !== undefined ? `🚀 Корабель летить: прибуття ${TurnManager.formatYear(ship.arrivalYear)}` : '🚀 Космічна гонка';
    }

    const titleEl = document.getElementById('unit-title');
    const terrainEl = document.getElementById('unit-terrain');
    const portraitCanvas = document.getElementById('unit-portrait-canvas') as HTMLCanvasElement | null;
    const btnBuild = document.getElementById('btn-build-city') as HTMLButtonElement | null;
    const btnFortify = document.getElementById('btn-fortify') as HTMLButtonElement | null;

    if (selectedUnit) {
      const cfg = UNIT_CONFIGS[selectedUnit.type];
      const currentTile = this.world.tiles[selectedUnit.y][selectedUnit.x];
      const terrainYield = TERRAIN_DATA[currentTile.terrain];

      if (titleEl) {
        titleEl.textContent = `${selectedUnit.veteran ? '★ ' : ''}${cfg.nameUa} (${selectedUnit.movesLeft.toFixed(1)}/${cfg.moves} рух)`;
      }
      if (terrainEl) {
        const notes = [
          selectedUnit.veteran ? 'Ветеран +50%' : '',
          selectedUnit.isFortified ? 'Укріплений' : '',
          selectedUnit.carriedBy && cfg.domain !== 'air' ? 'На кораблі — стрілкою на сушу, щоб висадитись' : '',
          selectedUnit.carriedBy && cfg.domain === 'air' ? 'На авіаносці' : '',
          cfg.capacity ? `Пасажирів ${this.world.cargoOf(selectedUnit.id).length}/${cfg.capacity}` : '',
          cfg.airCapacity ? `Літаків ${this.world.cargoOf(selectedUnit.id).length}/${cfg.airCapacity}` : '',
          selectedUnit.homeCityId ? `🏠 ${this.world.cities.get(selectedUnit.homeCityId)?.name ?? '—'}` : '',
          cfg.fuel ? `⛽ Пальне: ${selectedUnit.fuel ?? cfg.fuel}/${cfg.fuel} ход. — сідайте в місті чи на авіаносці` : '',
        ].filter(Boolean).join(' • ');
        terrainEl.textContent = `Рельєф: ${currentTile.terrain} (Захист: x${terrainYield.defenseBonus})${notes ? ' • ' + notes : ''}`;
      }

      if (portraitCanvas) {
        portraitCanvas.style.display = 'block';
        const ctx = portraitCanvas.getContext('2d')!;
        const size = portraitCanvas.width;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = `#${human.colorHex.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, size, size);
        SpriteAtlas.draw(ctx, `u_${selectedUnit.type}`, 0, 0, size, size);
      }

      if (btnBuild) {
        btnBuild.style.display = selectedUnit.type === UnitTypeKey.Settlers ? 'block' : 'none';
      }
      this.updateTerraformButtons(selectedUnit);
      if (selectedUnit.task && terrainEl) {
        const t = selectedUnit.task;
        terrainEl.textContent = `Працює: ${TERRAFORM_INFO[t.kind].nameUa} — ще ${t.turnsLeft} ${turnsWord(t.turnsLeft)}`;
      }
      if (btnFortify) {
        btnFortify.disabled = selectedUnit.movesLeft <= 0;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Оберіть юніт для наказу';
      if (terrainEl) terrainEl.textContent = 'Клікніть на фігурку або [W]';
      if (portraitCanvas) portraitCanvas.style.display = 'none';
      if (btnBuild) btnBuild.style.display = 'none';
      this.updateTerraformButtons(undefined);
    }

    this.minimap.update();
  }

  /** Кнопки робіт поселенця: показуємо лише поселенцям, неможливі — вимкнені з поясненням. */
  private updateTerraformButtons(unit?: Unit): void {
    // «Дім»: лише у своєму місті, яке ще не утримує цей юніт
    const rehomeBtn = document.getElementById('btn-rehome') as HTMLButtonElement | null;
    if (rehomeBtn) {
      const cityId = unit && this.world.tiles[unit.y][unit.x].cityId;
      const city = cityId ? this.world.cities.get(cityId) : undefined;
      const show = !!unit && !!city && city.playerId === unit.playerId && unit.homeCityId !== city.id;
      rehomeBtn.style.display = show ? 'block' : 'none';
      if (show) rehomeBtn.textContent = `🏠 Дім: ${city!.name}`;
    }
    const helpBtn = document.getElementById('btn-help-wonder') as HTMLButtonElement | null;
    if (helpBtn) {
      helpBtn.style.display = unit?.type === UnitTypeKey.Caravan ? 'block' : 'none';
      if (unit?.type === UnitTypeKey.Caravan) {
        const tile = this.world.tiles[unit.y][unit.x];
        const city = tile.cityId ? this.world.cities.get(tile.cityId) : undefined;
        const ok = !!city && city.currentProduction.isBuilding && !!BUILDING_CONFIGS[city.currentProduction.key as BuildingTypeKey]?.isWonder;
        helpBtn.disabled = !ok;
        helpBtn.title = ok ? 'Віддати 50 щитів на чудо світу [H]' : 'Заведіть караван у місто, яке будує чудо світу';
      }
    }
    for (const k of TERRAFORM_KINDS) {
      const btn = document.getElementById(`btn-tf-${k}`) as HTMLButtonElement | null;
      if (!btn) continue;
      if (!unit || !canTerraform(unit.type)) {
        btn.style.display = 'none';
        continue;
      }
      btn.style.display = 'block';
      const info = { ...TERRAFORM_INFO[k], nameUa: terraformName(this.world.tiles[unit.y][unit.x], k) };
      const check = this.world.checkTask(unit.id, k);
      btn.disabled = !check.ok || !!unit.task;
      btn.textContent = check.ok
        ? `${TERRAFORM_ICONS[k]} ${info.nameUa} [${info.hotkey}] ${check.turns}х`
        : `${TERRAFORM_ICONS[k]} ${info.nameUa} [${info.hotkey}]`;
      btn.title = check.ok ? `${info.nameUa} [${info.hotkey}]: ${check.turns} ${turnsWord(check.turns)} роботи` : check.reason ?? '';
    }
  }

  public addLogMessage(msg: string): void {
    const logBox = document.getElementById('message-log');
    if (!logBox) return;
    logBox.innerHTML = `<span class="log-entry">${msg}</span>`;
  }
}
