/**
 * Довідка «Як грати» й «Про гру»: той самий текст у головному меню й у грі (F1 або «?»).
 */

const KEYS: [string, string][] = [
  ['Стрілки, цифри 1–9', 'рух обраного юніта (7 9 1 3 — по діагоналі)'],
  ['Клік / тап', 'свій юніт — обрати, сусідня клітинка — піти, своє місто — відкрити'],
  ['Перетягування, колесо', 'прокрутка й масштаб мапи'],
  ['B', 'заснувати місто (поселенці)'],
  ['R · I · M · P · O', 'дорога · іригація · шахта · очищення · перетворення рельєфу'],
  ['F · W', 'укріпитися · наступний юніт'],
  ['H · T', 'караван: на чудо світу · торговий маршрут'],
  ['Shift+D', 'розпустити юніт'],
  ['G', 'сітка клітинок'],
  ['Enter / Пробіл', 'кінець ходу'],
  ['Esc', 'закрити вікно'],
  ['F1 або ?', 'ця довідка'],
];

/** «Як грати»: мета, перші кроки, клавіші, головні правила. */
export function helpHtml(): string {
  return `
    <div class="help-body">
      <h3 class="hall-title">🎯 Мета</h3>
      <p>Проведіть свій народ від одного поселенця 4000 р. до н.е. до космічної ери. Перемога — це:</p>
      <ul>
        <li>🚀 <b>Космос</b>: першим довести корабель до Альфи Центавра;</li>
        <li>⚔️ <b>Завоювання</b>: лишитись єдиною цивілізацією;</li>
        <li>🏆 <b>Рахунок</b>: у 2100 р. перемагає найбільший рахунок (щасливі жителі, чудеса, технології).</li>
      </ul>
      <h3 class="hall-title">🌱 Перші ходи</h3>
      <ol>
        <li>Поселенці → <b>[B]</b>: заснуйте столицю біля річки чи моря.</li>
        <li>Клік на «🧪» у панелі — оберіть дослідження.</li>
        <li>Клік на місто — оберіть, що будувати: Ополчення для захисту, Робітників для доріг і полів, Поселенців для нових міст.</li>
        <li><b>Enter</b> — кінець ходу. Повторюйте, розбудовуйте імперію, знайомтесь із сусідами (🤝 Дипломатія).</li>
      </ol>
      <h3 class="hall-title">⌨️ Керування</h3>
      <table class="help-keys">${KEYS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
      <h3 class="hall-title">📜 Головні правила</h3>
      <ul>
        <li><b>Місто</b> обробляє клітинки навколо: 🌾 їжа — ріст, 🛡️ щити — виробництво, 💰 торгівля — золото, наука й розкіш.</li>
        <li><b>Щастя</b>: великі міста невдоволені — храми, розкіш і чудеса тримають порядок, інакше безлад зупиняє місто.</li>
        <li><b>Армію</b> утримують міста щитами; за Республіки й Демократії війська за кордоном злять народ.</li>
        <li><b>Війна</b> — лише після оголошення; напад у мирі — зрада, яку інші лідери пам'ятають.</li>
        <li><b>Технології</b> відкривають нові юніти, споруди, чудеса й устрої — нічого не з'являється «наперед».</li>
        <li>Гра <b>зберігається сама</b> щоходу («💾 Гра» — ще 3 слоти); збереження живуть у цьому браузері.</li>
      </ul>
    </div>`;
}

/** «Про гру»: що це й хто зробив. */
export function aboutHtml(): string {
  return `
    <div class="help-body">
      <p><b>Civilization — ремастер 1991</b>: вебверсія покрокової стратегії Сіда Мейєра з правилами оригіналу —
      від перших поселень до космічної гонки, з AI-суперниками, дипломатією, флотом і авіацією.</p>
      <ul>
        <li>Автор: <b>Олексій Танчик</b> — <a href="https://github.com/OlexiyTanchik" target="_blank" rel="noopener">github.com/OlexiyTanchik</a>.</li>
        <li>Код написано разом з AI-асистентом Claude Code; піксельні спрайти згенеровано Gemini й оброблено власним конвеєром.</li>
        <li>TypeScript, Vite, PixiJS; звук і музика синтезуються в браузері (Web Audio).</li>
      </ul>
      <p class="dim">Некомерційний фанатський проєкт. Civilization — торгова марка її правовласників; проєкт з ними не пов'язаний.</p>
    </div>`;
}

/** Вікно довідки в грі. */
export class HelpDialog {
  private overlay: HTMLElement;

  constructor(container: HTMLElement) {
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

  public show(tab: 'help' | 'about' = 'help'): void {
    this.overlay.innerHTML = `
      <div class="tech-modal help-modal">
        <div class="city-header">
          <h2>${tab === 'help' ? '❓ Як грати' : 'ℹ️ Про гру'}</h2>
          <button class="btn-close" data-close>✖</button>
        </div>
        ${tab === 'help' ? helpHtml() : aboutHtml()}
        <button class="civ-btn" data-tab="${tab === 'help' ? 'about' : 'help'}">${tab === 'help' ? 'ℹ️ Про гру' : '❓ Як грати'}</button>
      </div>`;
    this.overlay.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    this.overlay.querySelector<HTMLElement>('[data-tab]')?.addEventListener('click', (e) =>
      this.show((e.currentTarget as HTMLElement).dataset.tab as 'help' | 'about'));
    this.overlay.classList.remove('hidden');
  }

  private close(): void {
    this.overlay.classList.add('hidden');
  }
}
