/**
 * Автентичні ретро-звукові ефекти й фонова мелодія на чистому Web Audio API (без сторонніх файлів).
 */
const MUSIC_KEY = 'civ1-remaster-music';

/** Нота мелодії: півтон від A4 (null — пауза) і тривалість у восьмих. */
type Note = [number | null, number];

// Повільний «марш цивілізацій» у дусі DOS-chiptune: ля мінор → до мажор, 16 тактів по 8 восьмих
const LEAD: Note[] = [
  [0, 2], [3, 1], [5, 1], [7, 3], [5, 1],
  [3, 2], [5, 2], [0, 4],
  [-2, 2], [0, 1], [3, 1], [5, 3], [3, 1],
  [2, 2], [-2, 2], [0, 4],
  [7, 2], [8, 1], [7, 1], [5, 2], [3, 2],
  [5, 2], [7, 2], [10, 4],
  [12, 3], [10, 1], [7, 2], [5, 2],
  [3, 2], [2, 2], [0, 4],
  [3, 2], [5, 1], [7, 1], [10, 3], [8, 1],
  [7, 2], [5, 2], [3, 4],
  [5, 2], [3, 1], [2, 1], [0, 3], [-2, 1],
  [0, 4], [null, 4],
  [12, 2], [10, 1], [8, 1], [7, 3], [5, 1],
  [3, 2], [7, 2], [5, 4],
  [3, 2], [2, 1], [0, 1], [-2, 2], [-5, 2],
  [0, 6], [null, 2],
];
// Бас — корінь акорду на кожен такт (півтони від A2)
const BASS: number[] = [0, 0, -2, -2, 3, 3, 3, -2, 3, 3, -4, 0, 3, -2, -4, 0];

export class SoundEffects {
  private static ctx?: AudioContext;
  private static musicGain?: GainNode;
  private static musicTimer?: number;
  private static musicStep = 0;
  private static musicNext = 0;

  private static getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx || null;
  }

  /** Один тон: хвиля, частота (з ковзанням до `to`), гучність, початок через `delay` секунд. */
  private static tone(type: OscillatorType, freq: number, dur: number, vol: number, delay = 0, to?: number, out?: AudioNode): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain);
    gain.connect(out ?? ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Послідовність нот: [частота, тривалість] одна за одною. */
  private static melody(type: OscillatorType, notes: [number, number][], vol: number, gap = 0): void {
    let t = 0;
    for (const [f, d] of notes) {
      this.tone(type, f, d, vol, t);
      t += d + gap;
    }
  }

  /**
   * Короткий звук переміщення юніта.
   */
  public static playMove(): void {
    this.tone('triangle', 220, 0.08, 0.15, 0, 110);
  }

  /**
   * Урочиста фанфара при заснуванні нового міста.
   */
  public static playFoundCity(): void {
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) => this.tone('square', f, 0.25, 0.12, i * 0.1)); // C4 E4 G4 C5
  }

  /**
   * Звук бою та ударів.
   */
  public static playCombat(): void {
    this.tone('sawtooth', 140, 0.2, 0.2, 0, 40);
  }

  /**
   * Арпеджіо наукового відкриття.
   */
  public static playTechDiscovered(): void {
    [440, 554.37, 659.25, 880].forEach((f, i) => this.tone('sine', f, 0.35, 0.2, i * 0.12)); // A4 C#5 E5 A5
  }

  /** Тихе клацання вибору в меню. */
  public static playClick(): void {
    this.tone('square', 660, 0.04, 0.06);
  }

  /** Чудо світу: урочистий хорал у два голоси. */
  public static playWonder(): void {
    const chord: [number, number][] = [[392, 0.3], [523.25, 0.3], [659.25, 0.3], [783.99, 0.7]]; // G4 C5 E5 G5
    this.melody('square', chord, 0.09);
    this.melody('triangle', chord.map(([f, d]) => [f / 2, d] as [number, number]), 0.14);
  }

  /** Оголошення війни: низький барабан і тривожна фанфара. */
  public static playWar(): void {
    for (let i = 0; i < 3; i++) this.tone('sawtooth', 110, 0.15, 0.2, i * 0.18, 45);
    this.melody('square', [[220, 0.15], [220, 0.15], [207.65, 0.45]], 0.1, 0.03);
  }

  /** Мир: м'яка спадна мелодія. */
  public static playPeace(): void {
    this.melody('sine', [[659.25, 0.25], [587.33, 0.25], [523.25, 0.25], [392, 0.6]], 0.16);
  }

  /** Захоплення міста: удар і переможні сурми. */
  public static playCapture(): void {
    this.tone('sawtooth', 160, 0.25, 0.2, 0, 50);
    this.melody('square', [[392, 0.12], [392, 0.12], [523.25, 0.4]], 0.1, 0.02);
  }

  /** Запуск корабля: висхідний гул двигунів. */
  public static playLaunch(): void {
    this.tone('sawtooth', 60, 1.6, 0.12, 0, 600);
    this.tone('square', 120, 1.6, 0.05, 0.1, 1200);
  }

  /** Втрата міста чи загибель цивілізації: спадний мінор. */
  public static playLoss(): void {
    this.melody('triangle', [[329.63, 0.3], [311.13, 0.3], [261.63, 0.7]], 0.18);
  }

  /**
   * Звук для пачки повідомлень за хід: грає одну найважливішу подію (з десятка новин — не какофонію).
   * Розпізнає повідомлення за значком і словами, які вже пишуть `World` і `Diplomacy`.
   */
  public static playForMessages(messages: string[]): void {
    const rules: [(m: string) => boolean, () => void][] = [
      [(m) => m.startsWith('🚀') && /запустили|стартував/.test(m), () => this.playLaunch()],
      [(m) => m.startsWith('🔥') && m.includes('захопили'), () => this.playCapture()],
      [(m) => m.startsWith('⚔️') && m.includes('війн'), () => this.playWar()],
      [(m) => m.startsWith('💀'), () => this.playLoss()],
      [(m) => m.startsWith('🌟'), () => this.playWonder()],
      [(m) => m.startsWith('🕊️'), () => this.playPeace()],
      [(m) => m.startsWith('💡') || m.startsWith('📚') || m.startsWith('🧬'), () => this.playTechDiscovered()],
    ];
    for (const [match, play] of rules) {
      if (messages.some(match)) {
        play();
        return;
      }
    }
  }

  /**
   * Клацання завершення ходу.
   */
  public static playEndTurn(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // ---------- Фонова мелодія ----------

  /** Збережений вибір гравця; типово музика вимкнена (сторінка не повинна раптом заграти). */
  public static musicWanted(): boolean {
    try {
      return localStorage.getItem(MUSIC_KEY) === '1';
    } catch {
      return false;
    }
  }

  public static isMusicPlaying(): boolean {
    return this.musicTimer !== undefined;
  }

  /** Перемикач музики з HUD: запам'ятовує вибір. Повертає новий стан. */
  public static toggleMusic(): boolean {
    const on = !this.isMusicPlaying();
    try {
      localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
    } catch {
      // Приватний режим: вибір просто не збережеться
    }
    if (on) this.startMusic();
    else this.stopMusic();
    return on;
  }

  /**
   * Мелодія грає по колу. Ноти плануються на ~0.5 с наперед таймером (класичний планувальник WebAudio),
   * тож не збиваються, коли головний потік зайнятий кінцем ходу.
   */
  public static startMusic(): void {
    const ctx = this.getContext();
    if (!ctx || this.musicTimer !== undefined) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(ctx.destination);
    this.musicStep = 0;
    this.musicNext = ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  public static stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    // Обриваємо вже заплановані ноти разом із вузлом гучності
    this.musicGain?.disconnect();
    this.musicGain = undefined;
  }

  private static scheduleMusic(): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out) return;
    const eighth = 0.27; // ~110 ударів на хвилину
    const bars = LEAD.reduce((s, [, d]) => s + d, 0) / 8;
    while (this.musicNext < ctx.currentTime + 0.5) {
      // musicStep — номер восьмої в циклі; ноти й бас шукаємо за ним
      const step = this.musicStep % (bars * 8);
      let pos = 0;
      for (const [semi, len] of LEAD) {
        if (pos === step && semi !== null) {
          const f = 440 * Math.pow(2, semi / 12);
          this.tone('square', f, len * eighth * 0.9, 0.05, this.musicNext - ctx.currentTime, undefined, out);
        }
        pos += len;
      }
      // Бас: корінь і квінта по чвертях — «ум-па» старих звукових карт
      if (step % 2 === 0) {
        const root = 110 * Math.pow(2, BASS[Math.floor(step / 8) % BASS.length] / 12);
        const f = (step % 4 === 0) ? root : root * 1.5;
        this.tone('triangle', f, eighth * 1.6, 0.12, this.musicNext - ctx.currentTime, undefined, out);
      }
      this.musicNext += eighth;
      this.musicStep++;
    }
  }
}
