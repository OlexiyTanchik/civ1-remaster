/**
 * Менеджер ходів, календар Civ 1 та розподіл економіки гравців.
 */
import { Player, Tech } from './types';
import { TECH_TREE } from './constants';

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
   */
  public static researchCost(player: Player): number {
    return (player.knownTechs.length + 1) * 10;
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
      techDiscovered = TECH_TREE[player.currentTechId];
      player.knownTechs.push(techDiscovered.id);
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

    return available;
  }
}
