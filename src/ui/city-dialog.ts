/**
 * Модальне вікно управління містом за автентичним дизайном Civ 1.
 */
import { City, UnitTypeKey, BuildingTypeKey } from '../core/types';
import { World } from '../core/world';
import { CityLogic } from '../core/city';
import { UNIT_CONFIGS, BUILDING_CONFIGS, GOVERNMENTS } from '../core/constants';
import { drawCityPanorama, PANORAMA_W, PANORAMA_H } from './city-panorama';

export class CityDialog {
  private overlay: HTMLElement;
  private currentCity?: City;

  constructor(private container: HTMLElement, private world: World, private onUpdate: () => void) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    this.container.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  public show(city: City): void {
    this.currentCity = city;
    this.overlay.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.overlay.classList.add('hidden');
    this.currentCity = undefined;
    this.onUpdate();
  }

  /**
   * Що місто може виробляти: лише відкрите технологіями, без уже збудованих споруд,
   * кораблі — тільки в прибережних містах. Палац не будується (є в столиці від заснування).
   */
  private productionOptions(city: City): { isBuilding: boolean; key: string; name: string; cost: number; description: string }[] {
    const known = this.world.players[city.playerId].knownTechs;
    const hasTech = (t?: string) => !t || known.includes(t);
    const coastal = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dy]) => {
      const row = this.world.tiles[city.y + dy];
      const t = row?.[(city.x + dx + row.length) % row.length];
      return t?.terrain === 'ocean';
    });

    const units = Object.values(UNIT_CONFIGS)
      .filter((u) => hasTech(u.prereqTech) && (u.domain !== 'sea' || coastal))
      .filter((u) => !u.requiresWonder || this.world.isWonderBuilt(u.requiresWonder))
      .map((u) => ({ isBuilding: false, key: u.key as string, name: u.nameUa, cost: u.cost, description: u.descriptionUa }));
    const buildings = Object.values(BUILDING_CONFIGS)
      .filter((b) => (b.key !== BuildingTypeKey.Palace || !this.hasPalace(city.playerId)) && hasTech(b.prereqTech) && !city.buildings.includes(b.key))
      .filter((b) => (!b.requires || city.buildings.includes(b.requires)) && (!b.coastal || coastal) && (!b.highland || this.world.isHighland(city)))
      .filter((b) => !b.isWonder || !this.world.isWonderBuilt(b.key))
      .filter((b) => !b.spacePart || this.world.canBuildSpacePart(city.playerId, b.key))
      .map((b) => ({ isBuilding: true, key: b.key as string, name: `${b.isWonder ? '🌟 ' : ''}${b.nameUa}`, cost: b.cost, description: b.descriptionUa }));
    return [...units, ...buildings];
  }

  /** Хто на утриманні міста і скільки це коштує (Civ 1). */
  private supportLine(city: City, yields: { upkeepShields: number; upkeepFood: number; shieldsGross: number }): string {
    const units = this.world.supportedUnits(city);
    if (!units.length) return '';
    const free = GOVERNMENTS[this.world.players[city.playerId].government].freeUnits;
    const names = units.map((u) => UNIT_CONFIGS[u.type].nameUa).join(', ');
    return `
            <div class="city-stat" title="${names}">
              <span>🪖 На утриманні ${units.length} юн. (безкоштовно ${free})</span>
              <span class="stat-val ${yields.upkeepShields ? 'bad' : 'good'}">${yields.upkeepShields ? `−${yields.upkeepShields} щит.` : 'без витрат'}</span>
              <span class="dim">виробляє ${yields.shieldsGross}</span>
            </div>`;
  }

  /** Палац будується лише тоді, коли його немає в жодному місті гравця (втрачено столицю). */
  /** Викуп за золото, як у Civ 1: готове наприкінці ходу, до того виробництво не змінити. */
  private buyLine(city: City): string {
    if (city.boughtTurn === this.world.turnManager.turnNumber) return '<div class="city-stat"><span class="dim">💰 Викуплено — буде готове наприкінці ходу</span></div>';
    const cost = this.world.buyCost(city);
    if (!cost) return '';
    const gold = this.world.players[city.playerId].gold;
    return `<div class="city-stat">
      <button class="btn-primary" id="city-buy-btn"${gold < cost ? ' disabled' : ''} title="Решта щитів за золото; з порожнім запасом — удвічі дорожче, чудеса — теж удвічі">💰 Купити за ${cost} зл.</button>
      <span class="dim">у скарбниці ${gold}</span>
    </div>`;
  }

  private hasPalace(playerId: number): boolean {
    return [...this.world.cities.values()].some((c) => c.playerId === playerId && c.buildings.includes(BuildingTypeKey.Palace));
  }

  private render(): void {
    if (!this.currentCity) return;
    const city = this.currentCity;
    const yields = this.world.cityYields(city);
    const prodCost = CityLogic.getProductionCost(city.currentProduction);

    const prodName = city.currentProduction.isBuilding
      ? BUILDING_CONFIGS[city.currentProduction.key as BuildingTypeKey]?.nameUa ?? city.currentProduction.key
      : UNIT_CONFIGS[city.currentProduction.key as UnitTypeKey]?.nameUa ?? city.currentProduction.key;

    const options = this.productionOptions(city);
    const bought = city.boughtTurn === this.world.turnManager.turnNumber;
    const prodButton = (o: (typeof options)[number]) => {
      const active = o.isBuilding === city.currentProduction.isBuilding && o.key === city.currentProduction.key;
      return `<button class="btn-action${active ? ' active' : ''}"${bought ? ' disabled' : ''} data-type="${o.isBuilding ? 'building' : 'unit'}" data-key="${o.key}" title="${o.description}">${o.name} <span class="cost">${o.cost}🛡️</span></button>`;
    };
    const groups: [string, typeof options][] = [
      ['Юніти', options.filter((o) => !o.isBuilding)],
      ['Споруди', options.filter((o) => o.isBuilding && !BUILDING_CONFIGS[o.key as BuildingTypeKey]?.isWonder)],
      ['Чудеса світу', options.filter((o) => o.isBuilding && BUILDING_CONFIGS[o.key as BuildingTypeKey]?.isWonder)],
    ];
    const upkeep = city.buildings.reduce((a, b) => a + (BUILDING_CONFIGS[b]?.maintenance ?? 0), 0);
    const pct = (a: number, b: number) => Math.max(0, Math.min(100, (a / b) * 100));

    // Дві колонки (як екран міста Civ 1): зліва вид міста й показники, справа споруди й виробництво.
    // Висота вікна не перевищує екран; довгий список виробництва гортається всередині своєї колонки.
    this.overlay.innerHTML = `
      <div class="city-modal city-modal--wide">
        <div class="city-header">
          <h2>🏛️ ${city.name} · ${(city.size * 10000).toLocaleString('uk-UA')} жителів${yields.disorder ? ' <span class="disorder-badge">БЕЗЛАД</span>' : ''}</h2>
          <button class="btn-close" id="city-close-btn">✖</button>
        </div>

        <div class="city-columns">
          <div class="city-col">
            <canvas id="city-panorama" class="city-panorama" width="${PANORAMA_W}" height="${PANORAMA_H}"></canvas>

            <div class="city-stat">
              <span>🌾 Їжа ${yields.food} − ${city.size * 2}${yields.upkeepFood ? ` − ${yields.upkeepFood} <span class="dim">(поселенці)</span>` : ''}</span>
              <span class="stat-val ${yields.foodSurplus >= 0 ? 'good' : 'bad'}">${yields.foodSurplus >= 0 ? '+' : ''}${yields.foodSurplus}/хід</span>
              <span class="dim">${city.foodStored}/${city.foodNeeded}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill food" style="width: ${pct(city.foodStored, city.foodNeeded)}%"></div></div>

            <div class="city-stat">
              <span>🛡️ ${prodName}</span>
              <span class="stat-val good">+${yields.shields}/хід</span>
              <span class="dim">${city.shieldsStored}/${prodCost}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill shields" style="width: ${pct(city.shieldsStored, prodCost)}%"></div></div>
            ${this.buyLine(city)}
            ${this.supportLine(city, yields)}

            <div class="city-stat">
              <span>💰 Торгівля ${yields.trade}${yields.corruption ? ` <span class="dim">(корупція −${yields.corruption})</span>` : ''}</span>
              <span>золото +${yields.gold} · наука +${yields.science}${yields.luxury ? ` · розкіш +${yields.luxury}` : ''}</span>
            </div>
            <div class="city-stat">
              <span class="citizens" title="Щасливі / задоволені / невдоволені / артисти (+2 розкоші, не працюють на землі)">${'😊'.repeat(yields.happy)}${'🙂'.repeat(yields.content)}${'😠'.repeat(yields.unhappy)}${'🎭'.repeat(yields.entertainers)}</span>
              ${yields.abroadUnhappy ? `<span class="dim">армія за кордоном: ${yields.abroadUnhappy} 😠</span>` : ''}
              ${yields.disorder ? '<span class="stat-val bad">Безлад: потрібен храм, колізей або розкіш</span>' : ''}
            </div>
          </div>

          <div class="city-col">
            <h4 class="city-subhead">Споруди <span class="dim">утримання −${upkeep} зл./хід</span></h4>
            <div class="building-chips">
              ${city.buildings.map((b) => `<span class="chip${BUILDING_CONFIGS[b]?.isWonder ? ' chip--wonder' : ''}" title="${BUILDING_CONFIGS[b]?.descriptionUa ?? ''}">${BUILDING_CONFIGS[b]?.isWonder ? '🌟' : ''}${BUILDING_CONFIGS[b]?.nameUa ?? b}</span>`).join('') || '<span class="dim">ще нічого не збудовано</span>'}
            </div>

            <h4 class="city-subhead">Виробництво</h4>
            <div class="prod-list" id="prod-buttons">
              ${groups.filter(([, list]) => list.length).map(([title, list]) => `
                <div class="prod-group-title">${title}</div>
                <div class="btn-group">${list.map(prodButton).join('')}</div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('city-close-btn')?.addEventListener('click', () => this.close());

    const panorama = this.overlay.querySelector<HTMLCanvasElement>('#city-panorama');
    if (panorama) drawCityPanorama(panorama, city);

    document.getElementById('city-buy-btn')?.addEventListener('click', () => {
      if (this.world.buyProduction(city)) {
        this.onUpdate();
        this.render();
      }
    });

    const buttons = this.overlay.querySelectorAll('#prod-buttons button');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const isBuilding = btn.getAttribute('data-type') === 'building';
        const key = btn.getAttribute('data-key')!;
        city.currentProduction = { isBuilding, key };
        this.render();
      });
    });
  }
}
