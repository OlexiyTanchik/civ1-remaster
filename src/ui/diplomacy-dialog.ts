/**
 * Дипломатія для людини: стосунки з лідерами, мир/війна, обмін технологіями (через посольство),
 * зустрічі, які пропонують AI-лідери, і вибір дії дипломата в чужому місті.
 */
import { World } from '../core/world';
import { Meeting, DiplomatAction, attitudeWord } from '../core/diplomacy';
import { GOVERNMENTS } from '../core/constants';

abstract class Modal {
  protected overlay: HTMLElement;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    container.appendChild(this.overlay);
  }

  protected open(html: string): void {
    this.overlay.innerHTML = `<div class="tech-modal diplo-modal">${html}</div>`;
    this.overlay.classList.remove('hidden');
  }

  protected close(): void {
    this.overlay.classList.add('hidden');
  }
}

/** Вікно «🤝 Дипломатія». */
export class DiplomacyDialog extends Modal {
  private note = '';

  constructor(container: HTMLElement, private world: World, private onChange: () => void) {
    super(container);
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
  }

  private render(): void {
    const w = this.world;
    const d = w.diplomacy;
    const senate = d.senateForbidsWar(0);
    const known = w.players.filter((p) => p.id !== 0 && !p.isBarbarian && d.hasContact(0, p.id));
    const rows = known.map((p) => {
      const war = d.atWar(0, p.id);
      const embassy = d.hasEmbassy(0, p.id);
      const cities = [...w.cities.values()].filter((c) => c.playerId === p.id).length;
      const intel = embassy
        ? `<small>🏛️ Посольство: ${GOVERNMENTS[p.government].nameUa} · міст ${cities} · ${p.gold} зл. · технологій ${p.knownTechs.length}</small>`
        : '<small>Посольства нема — відправте Дипломата або збудуйте Посольство Марко Поло</small>';
      const giveOpts = d.tradeable(0, p.id).map((t) => `<option value="${t.id}">${t.nameUa}</option>`).join('');
      const wantOpts = d.tradeable(p.id, 0).map((t) => `<option value="${t.id}">${t.nameUa}</option>`).join('');
      const trade = embassy && !war && giveOpts && wantOpts ? `
        <div class="diplo-trade">
          Дати <select data-give="${p.id}">${giveOpts}</select>
          за <select data-want="${p.id}">${wantOpts}</select>
          <button class="btn-primary" data-trade="${p.id}">📜 Обмін</button>
        </div>` : '';
      return `
        <div class="diplo-row">
          <div class="diplo-head">
            <span class="mm-swatch" style="background:${p.color}"></span>
            <b>${p.nameUa}</b> — ${p.leaderUa}${p.alive ? '' : ' 💀'}
            <span class="diplo-state ${war ? 'war' : 'peace'}">${war ? '⚔️ Війна' : '🕊️ Мир'}</span>
          </div>
          <div><small>Ставлення до вас: ${attitudeWord(d.attitude(p.id, 0))}</small></div>
          ${intel}
          <div class="diplo-actions">
            ${p.alive ? (war
              ? `<button class="btn-primary" data-peace="${p.id}">🕊️ Запропонувати мир</button>`
              : `<button class="civ-btn" data-war="${p.id}"${senate ? ' title="Сенат за Демократії не дозволить"' : ''}>⚔️ Оголосити війну</button>`) : ''}
          </div>
          ${p.alive ? trade : ''}
        </div>`;
    }).join('');

    const broken = w.players[0].brokenTreaties ?? 0;
    this.open(`
      <div class="city-header">
        <h2>🤝 Дипломатія</h2>
        <button class="btn-close" id="diplo-close">✖</button>
      </div>
      <p class="modal-subtitle">Знайомство — коли ваші юніти чи міста опиняються поруч з чужими. Напад під час миру — це війна,
        і всі лідери запам'ятають зраду${broken ? ` (ви порушили угод: ${broken})` : ''}.
        Сенат Республіки й Демократії сам приймає мир, який пропонують суперники; за Демократії він ще й забороняє нападати першим.</p>
      ${this.note ? `<p class="tech-unlocks">${this.note}</p>` : ''}
      ${rows || '<p>Ви ще ні з ким не знайомі. Розвідуйте світ!</p>'}
    `);
    this.overlay.querySelector('#diplo-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-peace]').forEach((b) => b.addEventListener('click', () => {
      this.note = d.proposePeace(Number(b.dataset.peace)).text;
      this.onChange();
      this.render();
    }));
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-war]').forEach((b) => b.addEventListener('click', () => {
      this.note = d.declareWar(Number(b.dataset.war))
        ? `⚔️ Війну оголошено: ${w.players[Number(b.dataset.war)].nameUa}. Усі лідери вважають це зрадою угоди.`
        : '🏛️ Сенат забороняє порушувати мир за Демократії. Змініть устрій або чекайте, поки нападуть на вас.';
      this.onChange();
      this.render();
    }));
    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-trade]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.trade!;
      const give = this.overlay.querySelector<HTMLSelectElement>(`select[data-give="${id}"]`)!.value;
      const want = this.overlay.querySelector<HTMLSelectElement>(`select[data-want="${id}"]`)!.value;
      this.note = d.proposeTrade(Number(id), give, want).text;
      this.onChange();
      this.render();
    }));
  }
}

/** Зустрічі з лідерами після ходу: по одній, із відповіддю «так/ні» для пропозицій. */
export class MeetingDialog extends Modal {
  private queue: Meeting[] = [];
  private onAnswer?: (text: string) => void;

  constructor(container: HTMLElement, private world: World) {
    super(container);
  }

  public showAll(meetings: Meeting[], onAnswer: (text: string) => void): void {
    this.queue.push(...meetings);
    this.onAnswer = onAnswer;
    if (this.overlay.classList.contains('hidden')) this.next();
  }

  private next(): void {
    const m = this.queue.shift();
    if (!m) return this.close();
    const p = this.world.players[m.from];
    const question = m.kind === 'peace' || m.kind === 'tribute' || m.kind === 'trade';
    const title = { contact: '🤝 Знайомство', peace: '🕊️ Пропозиція миру', tribute: '💰 Вимога данини', trade: '📜 Обмін технологіями', war: '⚔️ Оголошення війни' }[m.kind];
    const yes = { peace: 'Укласти мир', tribute: `Сплатити ${m.gold} зл.`, trade: 'Поміняємось' } as Record<string, string>;
    const no = { peace: 'Війна триває', tribute: 'Ні! (війна)', trade: 'Ні' } as Record<string, string>;
    this.open(`
      <div class="city-header"><h2>${title}</h2></div>
      <div class="diplo-meeting">
        <div class="diplo-crest" style="background:${p.color}">${p.leaderUa.charAt(0)}</div>
        <div><b>${p.leaderUa}</b>, ${p.nameUa}<p>${m.text}</p></div>
      </div>
      <div class="hall-buttons">
        ${question
          ? `<button class="btn-primary" id="meet-yes">${yes[m.kind]}</button><button class="civ-btn" id="meet-no">${no[m.kind]}</button>`
          : '<button class="btn-primary" id="meet-ok">Гаразд</button>'}
      </div>
    `);
    const reply = (accept: boolean) => {
      const text = this.world.diplomacy.answer(m, accept);
      if (text) this.onAnswer?.(text);
      this.next();
    };
    this.overlay.querySelector('#meet-yes')?.addEventListener('click', () => reply(true));
    this.overlay.querySelector('#meet-no')?.addEventListener('click', () => reply(false));
    this.overlay.querySelector('#meet-ok')?.addEventListener('click', () => this.next());
  }
}

/** Дипломат біля чужого міста: посольство, крадіжка, підкуп чи саботаж. */
export class DiplomatDialog extends Modal {
  constructor(container: HTMLElement, private world: World) {
    super(container);
  }

  public show(unitId: string, cityId: string, onDone: (text: string) => void): void {
    const w = this.world;
    const city = w.cities.get(cityId)!;
    const owner = w.players[city.playerId];
    const hasEmbassy = w.diplomacy.hasEmbassy(0, owner.id);
    const war = w.diplomacy.atWar(0, owner.id);
    const cost = w.diplomacy.inciteCost(city);
    const canIncite = cost <= w.players[0].gold;
    const incite = cost === Infinity ? 'столицю не підкупити' : `${cost} 💰${canIncite ? '' : ', бракує золота'}`;
    const warNote = war ? '' : ', це віроломний напад!';
    this.open(`
      <div class="city-header"><h2>🕵️ Дипломат біля міста ${city.name}</h2></div>
      <p class="modal-subtitle">${owner.nameUa} (${war ? 'війна' : 'мир'}). Дипломат виконає одне доручення і більше не повернеться.</p>
      <div class="hall-buttons">
        <button class="btn-primary" id="dip-embassy" ${hasEmbassy ? 'disabled' : ''}>🏛️ Відкрити посольство</button>
        <button class="btn-primary" id="dip-steal">🕵️ Викрасти технологію${war ? '' : ' (скандал!)'}</button>
        <button class="btn-primary" id="dip-incite" ${canIncite ? '' : 'disabled'}>💰 Підкупити місто (${incite}${warNote})</button>
        <button class="btn-primary" id="dip-sabotage">💣 Саботаж: виробництво чи будівля${war ? '' : ' (віроломний напад!)'}</button>
        <button class="civ-btn" id="dip-cancel">Повернутися</button>
      </div>
    `);
    const act = (kind: DiplomatAction) => {
      const text = w.diplomacy.diplomatAct(unitId, cityId, kind);
      this.close();
      onDone(text);
    };
    this.overlay.querySelector('#dip-embassy')?.addEventListener('click', () => act('embassy'));
    this.overlay.querySelector('#dip-steal')?.addEventListener('click', () => act('steal'));
    this.overlay.querySelector('#dip-incite')?.addEventListener('click', () => act('incite'));
    this.overlay.querySelector('#dip-sabotage')?.addEventListener('click', () => act('sabotage'));
    this.overlay.querySelector('#dip-cancel')?.addEventListener('click', () => this.close());
  }
}
