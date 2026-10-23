/**
 * Навчання для перших хвилин: п'ять кроків поверх гри (місто → дослідження → виробництво → кінець ходу → дорога).
 * Крок зараховується, коли гравець справді це зробив; навчання можна пропустити, вибір пам'ятає браузер.
 */
import { World } from '../core/world';
import { UnitTypeKey } from '../core/types';

const TUTORIAL_KEY = 'civ1-remaster-tutorial';

/** Події з інтерфейсу, яких не видно в стані світу. */
export type TutorialEvent = 'city-opened' | 'end-turn';

interface Step {
  title: string;
  text: (w: World) => string;
  done: (w: World, seen: Set<TutorialEvent>) => boolean;
}

const own = (w: World) => [...w.units.values()].filter((u) => u.playerId === 0);

const STEPS: Step[] = [
  {
    title: '🏛️ Заснуйте місто',
    text: () => 'Ваші поселенці стоять на мапі (жовта рамка). Натисніть <kbd>B</kbd> або «🏛️ Місто» в панелі — найкраще біля річки чи моря.',
    done: (w) => [...w.cities.values()].some((c) => c.playerId === 0),
  },
  {
    title: '🧪 Оберіть дослідження',
    text: () => 'Клікніть «🧪 Обрати дослідження» в панелі ліворуч. Кожна технологія відкриває нові юніти, споруди чи чудеса.',
    done: (w) => !!w.players[0].currentTechId || w.players[0].knownTechs.length > 0,
  },
  {
    title: '⚙️ Виробництво',
    text: () => 'Клікніть на своє місто й оберіть, що будувати. Для початку — <b>Робітники</b>: вони прокладуть дороги й зрошуватимуть поля.',
    done: (_w, seen) => seen.has('city-opened'),
  },
  {
    title: '⌛ Кінець ходу',
    text: () => 'Натисніть <kbd>Enter</kbd> або червону кнопку «Кінець ходу»: місто виростить хліб, збере щити, вчені — колби.',
    done: (_w, seen) => seen.has('end-turn'),
  },
  {
    title: '🛤️ Дорога',
    text: (w) => own(w).some((u) => u.type === UnitTypeKey.Workers || u.type === UnitTypeKey.Settlers)
      ? 'Оберіть Робітників і натисніть <kbd>R</kbd> на клітинці біля міста: по дорозі рух утричі швидший, а на траві й рівнині вона дає +1 торгівлі.'
      : 'Завершуйте ходи (<kbd>Enter</kbd>), поки місто збудує Робітників, — потім оберіть їх і натисніть <kbd>R</kbd> біля міста.',
    done: (w) => own(w).some((u) => u.task?.kind === 'road')
      || [...w.cities.values()].some((c) => c.playerId === 0 && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
        const t = w.tiles[c.y + dy]?.[(c.x + dx + w.tiles[0].length) % w.tiles[0].length];
        return !!t?.hasRoad && !t.cityId;
      })),
  },
];

export class Tutorial {
  private step = 0;
  private seen = new Set<TutorialEvent>();
  private active: boolean;
  /** Хід, коли навчання пройдено: до його кінця висить «Навчання завершено» */
  private doneTurn?: number;

  constructor(private world: World) {
    let state: string | null = null;
    try {
      state = localStorage.getItem(TUTORIAL_KEY);
    } catch {
      // без сховища навчання просто щоразу пропонується
    }
    // Лише на початку нової партії: у збереженій грі середини століть кроки вже не мають сенсу
    this.active = state !== 'done' && world.turnManager.turnNumber <= 3;
  }

  public mark(e: TutorialEvent): void {
    this.seen.add(e);
  }

  /** Поточний крок (зараховані проскакуються) або завершальна нотатка; undefined — навчання нема. */
  public current(): string | undefined {
    const turn = this.world.turnManager.turnNumber;
    if (this.active) {
      while (this.step < STEPS.length && STEPS[this.step].done(this.world, this.seen)) this.step++;
      if (this.step < STEPS.length) {
        const s = STEPS[this.step];
        // На телефоні нема клавіш, а панель схована в шухляді
        const phone = typeof matchMedia === 'function' && matchMedia('(max-width: 799px)').matches;
        const hint = phone ? '<br><small>📱 Накази й дослідження — у панелі «☰» унизу; кінець ходу — «Хід ⌛».</small>' : '';
        return `<b>Навчання ${this.step + 1}/${STEPS.length}: ${s.title}</b><br>${s.text(this.world)}${hint}`;
      }
      this.finish();
      this.doneTurn = turn;
    }
    if (this.doneTurn === turn) return '<b>🎓 Навчання завершено!</b> Далі радник підказуватиме, що робити. Довідка — <kbd>F1</kbd>.';
    return undefined;
  }

  /** Чи йде ще навчання (тоді в плашці кнопка «Пропустити»). */
  public isRunning(): boolean {
    return this.active;
  }

  public skip(): void {
    this.finish();
  }

  private finish(): void {
    this.active = false;
    try {
      localStorage.setItem(TUTORIAL_KEY, 'done');
    } catch {
      // приватний режим: наступна партія запропонує навчання знову
    }
  }
}
