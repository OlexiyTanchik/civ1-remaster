/**
 * Міні-карта світу 80x50 з інтерактивним переміщенням камери.
 */
import { World } from '../core/world';
import { MAP_WIDTH, MAP_HEIGHT, TERRAIN_DATA } from '../core/constants';
import { MapRenderer } from '../render/map-renderer';

export class MiniMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(
    private container: HTMLElement,
    private world: World,
    private renderer: MapRenderer
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_WIDTH;
    this.canvas.height = MAP_HEIGHT;
    this.canvas.className = 'minimap-canvas';
    this.ctx = this.canvas.getContext('2d')!;

    this.container.appendChild(this.canvas);
    this.setupClick();
  }

  private setupClick(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = MAP_WIDTH / rect.width;
      const scaleY = MAP_HEIGHT / rect.height;

      const clickX = Math.floor((e.clientX - rect.left) * scaleX);
      const clickY = Math.floor((e.clientY - rect.top) * scaleY);

      if (clickX >= 0 && clickX < MAP_WIDTH && clickY >= 0 && clickY < MAP_HEIGHT) {
        this.renderer.centerOn(clickX, clickY);
      }
    });
  }

  /**
   * Оновлює пікселі міні-карти та рамку огляду камери.
   */
  public update(): void {
    const imgData = this.ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    const data = imgData.data;
    const humanFog = this.world.playerFogs.get(0);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const idx = (y * MAP_WIDTH + x) * 4;
        const isExplored = humanFog ? humanFog.explored[y][x] : true;

        if (!isExplored) {
          data[idx] = 10;
          data[idx + 1] = 15;
          data[idx + 2] = 25;
          data[idx + 3] = 255;
          continue;
        }

        const tile = this.world.tiles[y][x];
        const hex = TERRAIN_DATA[tile.terrain].color;
        data[idx] = (hex >> 16) & 0xff;
        data[idx + 1] = (hex >> 8) & 0xff;
        data[idx + 2] = hex & 0xff;
        data[idx + 3] = 255;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);

    // Малюємо маркери міст та юнітів
    for (const city of this.world.cities.values()) {
      if (humanFog && !humanFog.explored[city.y][city.x]) continue;
      this.ctx.fillStyle = city.playerId === 0 ? '#3498db' : '#e74c3c';
      this.ctx.fillRect(city.x - 1, city.y - 1, 3, 3);
    }

    // Рамка поточної зони огляду
    this.drawViewportRect();
  }

  private drawViewportRect(): void {
    const tileW = 32 * this.renderer.zoom;
    const tileH = 32 * this.renderer.zoom;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const left = -this.renderer.cameraX / tileW;
    const top = -this.renderer.cameraY / tileH;
    const width = screenW / tileW;
    const height = screenH / tileH;

    this.ctx.strokeStyle = '#f1c40f';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(left, top, width, height);
  }
}
