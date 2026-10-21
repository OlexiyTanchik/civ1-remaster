/**
 * Генератор карт Civilization 1 (1991) із регіональною зв'язністю біомів.
 * Створює плавні ландшафти (гірські хребти, суцільні лісові масиви, широкі рівнини та пустелі),
 * а не хаотичну шахівницю 1х1.
 */
import { MAP_WIDTH, MAP_HEIGHT } from './constants';
import { TerrainType, ResourceType, TileData } from './types';

export class MapGenerator {
  public static generateWorld(seed: number = Date.now()): TileData[][] {
    const tiles: TileData[][] = [];
    const landMask = this.generateContinents(seed);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      tiles[y] = [];
      const latDist = Math.abs(y - MAP_HEIGHT / 2) / (MAP_HEIGHT / 2);

      for (let x = 0; x < MAP_WIDTH; x++) {
        const isLand = landMask[y][x];
        const terrain = this.determineTerrain(latDist, isLand, x, y, seed);
        const resource = this.determineResource(terrain, x, y, seed);

        tiles[y][x] = {
          x,
          y,
          terrain,
          resource,
          hasRoad: false,
          hasRailroad: false,
          hasIrrigation: false,
          hasMine: false,
          hasRiver: false,
          unitIds: [],
        };
      }
    }

    this.placeRivers(tiles);
    return tiles;
  }

  /**
   * Створює 4-5 суцільних континентів з океанічними проливами.
   */
  private static generateContinents(seed: number): boolean[][] {
    let grid: boolean[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));

    // 5 великих континентальних ядер
    const centers = [
      { x: 16, y: 18, size: 16 },
      { x: 38, y: 32, size: 18 },
      { x: 62, y: 20, size: 17 },
      { x: 25, y: 36, size: 15 },
      { x: 70, y: 34, size: 14 },
    ];

    for (let y = 3; y < MAP_HEIGHT - 3; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const noise = this.smoothNoise(x, y, 0.08, seed) * 10 - 5;
        for (const c of centers) {
          const dx = Math.min(Math.abs(x - c.x), MAP_WIDTH - Math.abs(x - c.x));
          const dy = (y - c.y) * 1.4;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist + noise < c.size) {
            grid[y][x] = true;
          }
        }
      }
    }

    // 2 кроки клітинного автомата для природних берегів
    for (let iter = 0; iter < 2; iter++) {
      const next: boolean[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
      for (let y = 3; y < MAP_HEIGHT - 3; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = (x + dx + MAP_WIDTH) % MAP_WIDTH;
              if (grid[y + dy][nx]) count++;
            }
          }
          next[y][x] = count >= 5;
        }
      }
      grid = next;
    }

    return grid;
  }

  /**
   * Визначає біом за допомогою плавного 2D-шуму (регіональні ліси, гірські хребти, пустелі).
   */
  private static determineTerrain(lat: number, isLand: boolean, x: number, y: number, seed: number): TerrainType {
    if (lat > 0.88) return TerrainType.Glacier;
    if (lat > 0.76) return isLand ? TerrainType.Tundra : TerrainType.Ocean;
    if (!isLand) return TerrainType.Ocean;

    // Плавний шум висоти (масштаб 0.1) для гірських хребтів
    const elevation = this.smoothNoise(x, y, 0.1, seed + 10);
    // Плавний шум вологості (масштаб 0.07) для лісів і пустель
    const moisture = this.smoothNoise(x, y, 0.07, seed + 50);

    // 1. Гірські хребти та передгір'я (плавні пасма гір)
    if (elevation > 0.78) return TerrainType.Mountains;
    if (elevation > 0.65) return TerrainType.Hills;

    // 2. Екваторіальний пояс (lat < 0.28)
    if (lat < 0.28) {
      if (moisture > 0.62) return TerrainType.Jungle;
      if (moisture < 0.32) return TerrainType.Desert;
      return elevation > 0.48 ? TerrainType.Plains : TerrainType.Grassland;
    }

    // 3. Субтропічний пояс (0.28 <= lat < 0.52)
    if (lat < 0.52) {
      if (moisture < 0.30) return TerrainType.Desert;
      if (moisture > 0.64) return TerrainType.Forest;
      if (moisture > 0.58 && elevation < 0.38) return TerrainType.Swamp;
      return elevation > 0.46 ? TerrainType.Plains : TerrainType.Grassland;
    }

    // 4. Помірний та субарктичний пояс
    if (moisture > 0.55) return TerrainType.Forest;
    if (moisture > 0.48 && elevation < 0.35) return TerrainType.Swamp;
    return elevation > 0.45 ? TerrainType.Plains : TerrainType.Grassland;
  }

  private static determineResource(terrain: TerrainType, x: number, y: number, seed: number): ResourceType {
    // Ресурси зустрічаються рідко (~8% тайлів) і прив'язані до місцевості
    const hash = Math.sin(x * 93.123 + y * 45.678 + seed) * 31234.567;
    const r = hash - Math.floor(hash);
    if (r > 0.08) return ResourceType.None;

    switch (terrain) {
      case TerrainType.Ocean: return ResourceType.Fish;
      case TerrainType.Desert: return ResourceType.Oasis;
      case TerrainType.Hills: return ResourceType.Coal;
      case TerrainType.Mountains: return ResourceType.Gold;
      case TerrainType.Forest: return ResourceType.Game;
      case TerrainType.Plains: return ResourceType.Iron;
      default: return ResourceType.None;
    }
  }

  /**
   * Плавний інтерпольований 2D-шум із горизонтальним зацикленням карти.
   */
  private static smoothNoise(x: number, y: number, scale: number, seed: number): number {
    const gx = x * scale;
    const gy = y * scale;
    const x0 = Math.floor(gx);
    const x1 = x0 + 1;
    const y0 = Math.floor(gy);
    const y1 = y0 + 1;

    const sx = gx - x0;
    const sy = gy - y0;
    const fx = sx * sx * (3 - 2 * sx);
    const fy = sy * sy * (3 - 2 * sy);

    const hash = (ix: number, iy: number) => {
      const wrapX = ((ix % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH;
      const n = Math.sin(wrapX * 127.1 + iy * 311.7 + seed) * 43758.5453;
      return n - Math.floor(n);
    };

    const top = hash(x0, y0) * (1 - fx) + hash(x1, y0) * fx;
    const bot = hash(x0, y1) * (1 - fx) + hash(x1, y1) * fx;
    return top * (1 - fy) + bot * fy;
  }

  private static placeRivers(tiles: TileData[][]): void {
    for (let y = 6; y < MAP_HEIGHT - 6; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (tiles[y][x].terrain === TerrainType.Hills || tiles[y][x].terrain === TerrainType.Mountains) {
          if (Math.sin(x * 37 + y * 19) > 0.90) {
            this.traceRiver(tiles, x, y);
          }
        }
      }
    }
  }

  private static traceRiver(tiles: TileData[][], startX: number, startY: number): void {
    let cx = startX;
    let cy = startY;
    for (let i = 0; i < 6; i++) {
      if (cy < 2 || cy >= MAP_HEIGHT - 2) break;
      const tile = tiles[cy][cx];
      if (tile.terrain === TerrainType.Ocean) break;
      tile.hasRiver = true;

      const dx = Math.floor(Math.sin(i * 1.7) * 2);
      const dy = Math.floor(Math.cos(i * 1.3) * 2);
      cx = (cx + dx + MAP_WIDTH) % MAP_WIDTH;
      cy = Math.max(2, Math.min(MAP_HEIGHT - 3, cy + dy));
    }
  }
}
