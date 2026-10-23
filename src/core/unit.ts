/**
 * Логіка юнітів, переміщення та бойова система за правилами 1991 року.
 */
import { UNIT_CONFIGS, TERRAIN_DATA, MAP_WIDTH } from './constants';
import { Unit, TileData, UnitTypeKey } from './types';

/** Кіннота, проти якої стоять піки. */
const MOUNTED = new Set([UnitTypeKey.Cavalry, UnitTypeKey.Chariot, UnitTypeKey.Elephants, UnitTypeKey.Knights, UnitTypeKey.Crusaders,
  UnitTypeKey.WarChariot, UnitTypeKey.Keshik, UnitTypeKey.Cossacks, UnitTypeKey.HorseArchers, UnitTypeKey.Cuirassiers, UnitTypeKey.RajaElephants]);
/** Бронетехніка: протитанкова гармата тримає її вдвічі краще */
const ARMORED = new Set([UnitTypeKey.ArmoredCar, UnitTypeKey.Armor, UnitTypeKey.Panzer, UnitTypeKey.ModernArmor, UnitTypeKey.HoverTank, UnitTypeKey.BattleMech]);

export class UnitLogic {
  /**
   * Обчислює витрати очок руху на вхід у клітинку.
   */
  public static getMovementCost(fromTile: TileData, toTile: TileData, asRoad = false): number {
    // Дороги знижують вартість пересування до 1/3 очка руху
    // Місто в Civ 1 діє як клітинка з дорогою
    const fromRoad = fromTile.hasRoad || !!fromTile.cityId;
    const toRoad = toTile.hasRoad || !!toTile.cityId;
    if (fromTile.hasRailroad && toTile.hasRailroad) {
      return 0;
    }
    // Дослідник проходить будь-який рельєф, як дорогою
    if ((fromRoad && toRoad) || asRoad) {
      return 1 / 3;
    }

    const terrain = TERRAIN_DATA[toTile.terrain];
    return terrain ? terrain.moveCost : 1;
  }

  /**
   * Перевіряє, чи може юніт здійснити рух на цільову клітинку.
   */
  public static canMoveTo(unit: Unit, targetTile: TileData): boolean {
    const config = UNIT_CONFIGS[unit.type];
    if (config.domain === 'land' && targetTile.terrain === 'ocean') {
      return false; // Сухопутні юніти не ходять по воді без транспорту
    }
    if (config.domain === 'sea' && targetTile.terrain !== 'ocean' && !targetTile.cityId) {
      return false; // Кораблі можуть заходити тільки у воду або портове місто
    }
    return unit.movesLeft > 0;
  }

  /**
   * Вирішення бою між атакуючим та захисником за класичною формулою 1991 року.
   */
  public static resolveCombat(
    attacker: Unit,
    defender: Unit,
    defTile: TileData,
    hasWalls: boolean = false,
    mods: { coastal?: boolean; sam?: boolean; fromShip?: boolean } = {}
  ): { attackerWon: boolean; logUa: string } {
    const aCfg = UNIT_CONFIGS[attacker.type];
    const dCfg = UNIT_CONFIGS[defender.type];

    // Ветерани: +50% атаки й захисту
    // З корабля на берег б'є на повну лише морська піхота
    const attackPower = Math.max(1, aCfg.attack) * (attacker.veteran ? 1.5 : 1) * (mods.fromShip && !aCfg.marine ? 0.5 : 1);
    let defensePower = Math.max(1, dCfg.defense) * (defender.veteran ? 1.5 : 1);

    // Бонус місцевості (літаку в небі рельєф не допомагає)
    const inSky = dCfg.domain === 'air';
    const terrainBonus = inSky ? 1.0 : TERRAIN_DATA[defTile.terrain]?.defenseBonus ?? 1.0;
    defensePower *= terrainBonus;

    // Пікінери проти вершників — захист ×2 (танки й мотопіхота — не коні)
    if ((defender.type === UnitTypeKey.Pikemen || defender.type === UnitTypeKey.ChuKoNu) && MOUNTED.has(attacker.type)) {
      defensePower *= 2;
    }
    if (defender.type === UnitTypeKey.AntiTankGun && ARMORED.has(attacker.type)) defensePower *= 2;

    // Бонус укріплення (+50%)
    if (defender.isFortified && !inSky) {
      defensePower *= 1.5;
    }

    // Бонус міських мурів або Великого муру (потроєння захисту проти сухопутних сил)
    if (hasWalls && aCfg.domain === 'land') {
      defensePower *= 3.0;
    }
    // Берегова оборона: захист ×2 проти кораблів
    if (mods.coastal && aCfg.domain === 'sea') {
      defensePower *= 2.0;
    }
    // ЗРК: захист ×2 проти літаків і гелікоптерів (не стелс); AEGIS — ×5
    if (mods.sam && aCfg.domain === 'air' && !aCfg.stealth) {
      defensePower *= 2.0;
    }
    if (dCfg.antiAir && aCfg.domain === 'air' && !aCfg.stealth) {
      defensePower *= 5.0;
    }

    // Класичний раунд бою Civ 1: імовірність перемоги = Attack / (Attack + Defense)
    const totalPower = attackPower + defensePower;
    const attackerWinProb = attackPower / totalPower;
    const roll = Math.random();

    const attackerWon = roll < attackerWinProb;

    const logUa = attackerWon
      // Без дієслів у родах і відмінках: «Гаубиця здолав», «відбив напад Танки» читалися з помилками
      ? `${aCfg.nameUa} ⟶ ${dCfg.nameUa}: перемога нападу! (Атака: ${attackPower.toFixed(1)} проти Захисту: ${defensePower.toFixed(1)})`
      : `${aCfg.nameUa} ⟶ ${dCfg.nameUa}: оборона встояла! (Захист: ${defensePower.toFixed(1)} проти Атаки: ${attackPower.toFixed(1)})`;

    return { attackerWon, logUa };
  }

  /**
   * Перевіряє суміжність двох точок з урахуванням горизонтального зациклення карти.
   */
  public static isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    if (Math.abs(y1 - y2) > 1) return false;
    const dx = Math.abs(x1 - x2);
    return dx <= 1 || dx === MAP_WIDTH - 1;
  }
}
