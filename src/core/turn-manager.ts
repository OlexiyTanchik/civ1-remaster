/**
 * Менеджер ходів, календар Civ 1 та розподіл економіки гравців.
 */
import { Player, Tech } from './types';
import { TECH_TREE, FUTURE_TECH } from './constants';

export class TurnManager {
  public turnNumber: number = 1;
  public yearBC: number = 4000;
  public isAD: boolean = false;

  /**
   * Форматований рядок поточної дати (наприклад: "4000 до н.е." або "1500 н.е.").
   */
  public getYearString(): string {
    if (!this.isAD) {
      return `${this.yearBC} до н.е.`;
    }
    return `${this.yearBC} н.е.`;
  }

  /** Рік числом у підпис: −500 → «500 до н.е.». */
  public static formatYear(year: number): string {
    return year < 0 ? `${-year} до н.е.` : `${year} н.е.`;
  }

  /** Рік числом: до н.е. — від'ємний. */
  public get year(): number {
    return this.isAD ? this.yearBC : -this.yearBC;
  }

  /**
   * Просування календаря на наступний хід за автентичною шкалою Civ 1.
   */
  public advanceCalendar(): void {
    this.turnNumber += 1;

    if (!this.isAD) {
      let step = 50;
      if (this.yearBC <= 1000) step = 25;
      if (this.yearBC <= 500) step = 20;

      this.yearBC -= step;
      if (this.yearBC <= 0) {
        this.isAD = true;
        this.yearBC = Math.abs(this.yearBC) + 20;
      }
    } else {
      let step = 20;
      if (this.yearBC >= 1500) step = 10;
      if (this.yearBC >= 1750) step = 5;
      if (this.yearBC >= 1850) step = 2;
      if (this.yearBC >= 1900) step = 1;

      this.yearBC += step;
    }
  }

  /**
   * Ціна наступного відкриття росте з кількістю відомих технологій (як у Civ 1):
   * перша — 10 колб, десята — 100. Тому епохи змінюються повільно.
   * Після 30-ї — ще +3,5% за кожну: великі міста пізньої гри закривали все дерево до 1950 р.
   */
  public static researchCost(player: Player): number {
    const n = player.knownTechs.length + (player.futureTechs ?? 0);
    const late = 1 + Math.max(0, n - 30) * 0.035;
    return Math.round((n + 1) * 10 * late * (player.researchFactor ?? 1));
  }

  /** Технологія за id (включно з технологією майбутнього). */
  public static techById(id: string): Tech | undefined {
    return id === FUTURE_TECH.id ? FUTURE_TECH : TECH_TREE[id];
  }

  /** Гравець опановує технологію: звичайна — у список, майбутнього — лічильник. */
  public static learnTech(player: Player, tech: Tech): void {
    if (tech.id === FUTURE_TECH.id) player.futureTechs = (player.futureTechs ?? 0) + 1;
    else if (!player.knownTechs.includes(tech.id)) player.knownTechs.push(tech.id);
    if (player.currentTechId === tech.id) player.currentTechId = undefined;
  }

  /**
   * Зарахування золота й науки гравцю (суми вже пораховані по містах з усіма бонусами).
   * Дослідження AI обирає AiController.
   */
  public processPlayerEconomy(
    player: Player,
    goldGain: number,
    scienceGain: number
  ): { techDiscovered?: Tech } {
    player.gold += goldGain;
    player.researchProgress += scienceGain;

    let techDiscovered: Tech | undefined;
    const cost = TurnManager.researchCost(player);
    if (player.currentTechId && player.researchProgress >= cost) {
      techDiscovered = TurnManager.techById(player.currentTechId)!;
      TurnManager.learnTech(player, techDiscovered);
      player.researchProgress -= cost;
      player.currentTechId = undefined; // Потребує вибору нової технології
    }

    return { techDiscovered };
  }

  /**
   * Повертає список технологій, доступних для дослідження зараз.
   */
  public static getAvailableTechs(player: Player): Tech[] {
    const available: Tech[] = [];

    for (const techId in TECH_TREE) {
      if (player.knownTechs.includes(techId)) continue;
      const tech = TECH_TREE[techId];

      const prereqsMet = tech.prereqs.every((req) => player.knownTechs.includes(req));
      if (prereqsMet) {
        available.push(tech);
      }
    }
    // Усе дерево відоме — далі технології майбутнього
    if (!available.length) available.push(FUTURE_TECH);

    return available;
  }
}
