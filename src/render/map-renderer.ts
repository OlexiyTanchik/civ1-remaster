/**
 * Рендерер карти на PixiJS.
 * Оптимізована архітектура без витоків пам'яті: спрайти створюються один раз і лише оновлюють стан.
 */
import { Application, Container, Sprite, Graphics, Text, TextStyle } from 'pixi.js';
import { World } from '../core/world';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, UNIT_CONFIGS } from '../core/constants';
import { Unit } from '../core/types';
import { ImprovementRenderer } from './improvement-renderer';
import { SpriteAtlas } from './sprite-atlas';
import { TerrainChunk } from './terrain-baker';
import { TERRAFORM_INFO } from '../core/terraform';

/** Кроки зуму: цілі та «половинні» кратності тримають піксель-арт рівним. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];

export class MapRenderer {
  public container: Container;
  private terrainLayer: Container;
  private improvements: ImprovementRenderer;
  private gridLayer: Graphics;
  private cityLayer: Container;
  private unitLayer: Container;
  private fogLayer: Container;
  private overlayLayer: Graphics;

  // Постійна сітка спрайтів (без перестворення кожен кадр!)
  private fogSprites: Graphics[][] = [];
  private unitSprites: Map<string, Container> = new Map();
  private cityContainers: Map<string, Container> = new Map();

  public showGrid: boolean = true;
  public zoom: number = 1;
  public cameraX: number = 0;
  public cameraY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  public onTileClick?: (tileX: number, tileY: number) => void;

  constructor(
    private app: Application,
    private world: World,
    private terrainChunks: TerrainChunk[]
  ) {
    this.container = new Container();
    this.app.stage.addChild(this.container);

    this.terrainLayer = new Container();
    this.improvements = new ImprovementRenderer(world);
    this.gridLayer = new Graphics();
    this.cityLayer = new Container();
    this.unitLayer = new Container();
    this.fogLayer = new Container();
    this.overlayLayer = new Graphics();

    // Правильний Z-порядок: рельєф -> дороги -> тактична сітка -> міста -> юніти -> туман війни -> виділення
    this.container.addChild(this.terrainLayer);
    this.container.addChild(this.improvements.container);
    this.container.addChild(this.gridLayer);
    this.container.addChild(this.cityLayer);
    this.container.addChild(this.unitLayer);
    this.container.addChild(this.fogLayer);
    this.container.addChild(this.overlayLayer);

    this.initPersistentGrid();
    this.setupInteractions();
    this.centerOnInitialUnit();
    this.refreshAll();
  }

  /**
   * Створює шар рельєфу (запечений суцільний або тайловий) та шар туману війни.
   */
  private initPersistentGrid(): void {
    for (const chunk of this.terrainChunks) {
      const sprite = Sprite.from(chunk.canvas);
      sprite.texture.source.scaleMode = 'nearest';
      sprite.position.set(chunk.x, chunk.y);
      this.terrainLayer.addChild(sprite);
    }

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.fogSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        // Шар туману війни
        const fog = new Graphics();
        fog.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        fog.fill({ color: 0x050811, alpha: 1.0 });
        this.fogLayer.addChild(fog);
        this.fogSprites[y][x] = fog;
      }
    }

    this.renderGrid();
  }

  /**
   * Малює або очищає чітку тактичну сітку тайлів Civ 1.
   */
  public renderGrid(): void {
    this.gridLayer.clear();
    if (!this.showGrid) return;

    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridLayer.moveTo(x * TILE_SIZE, 0);
      this.gridLayer.lineTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridLayer.moveTo(0, y * TILE_SIZE);
      this.gridLayer.lineTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
    this.gridLayer.stroke({ color: 0x000000, width: 1, alpha: 0.18 });
  }

  /**
   * Перемикач відображення сітки.
   */
  public toggleGrid(): boolean {
    this.showGrid = !this.showGrid;
    this.renderGrid();
    return this.showGrid;
  }

  private setupInteractions(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 1) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.cameraX;
        this.dragStartY = e.clientY - this.cameraY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.cameraX = e.clientX - this.dragStartX;
      this.cameraY = e.clientY - this.dragStartY;
      this.clampCamera();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const i = ZOOM_STEPS.indexOf(this.zoom);
      const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + (e.deltaY < 0 ? 1 : -1)))];
      if (next === this.zoom) return;
      // Зум відносно курсора
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.cameraX = mx - ((mx - this.cameraX) * next) / this.zoom;
      this.cameraY = my - ((my - this.cameraY) * next) / this.zoom;
      this.zoom = next;
      this.clampCamera();
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - this.cameraX) / (TILE_SIZE * this.zoom);
      const clickY = (e.clientY - rect.top - this.cameraY) / (TILE_SIZE * this.zoom);

      const tileX = ((Math.floor(clickX) % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH;
      const tileY = Math.floor(clickY);

      if (tileY >= 0 && tileY < MAP_HEIGHT && this.onTileClick) {
        this.onTileClick(tileX, tileY);
      }
    });
  }

  private centerOnInitialUnit(): void {
    for (const unit of this.world.units.values()) {
      if (unit.playerId === 0) {
        this.centerOn(unit.x, unit.y);
        break;
      }
    }
  }

  public centerOn(tileX: number, tileY: number): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    this.cameraX = screenW / 2 - tileX * TILE_SIZE * this.zoom;
    this.cameraY = screenH / 2 - tileY * TILE_SIZE * this.zoom;
    this.clampCamera();
  }

  private clampCamera(): void {
    const screenH = this.app.screen.height;
    const maxCameraY = 100;
    const minCameraY = screenH - MAP_HEIGHT * TILE_SIZE * this.zoom - 100;
    this.cameraY = Math.max(minCameraY, Math.min(maxCameraY, this.cameraY));
  }

  /**
   * Оновлення туману, юнітів та міст при зміні стану гри (викликається за подією, не щокадру!).
   */
  public refreshAll(): void {
    const humanFog = this.world.playerFogs.get(0);

    // 1. Оновлення видимості туману війни
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const isExplored = humanFog ? humanFog.explored[y][x] : true;
        const fogSprite = this.fogSprites[y][x];
        fogSprite.visible = !isExplored;
      }
    }

    // 2. Оновлення берегових ліній, доріг та річок
    this.improvements.refresh();

    // 3. Оновлення юнітів
    this.syncUnits();

    // 4. Оновлення міст
    this.syncCities();
  }

  private syncUnits(): void {
    const currentIds = new Set<string>();
    const humanFog = this.world.playerFogs.get(0);

    for (const unit of this.world.units.values()) {
      currentIds.add(unit.id);
      const isVisible = humanFog ? humanFog.explored[unit.y][unit.x] : true;
      const player = this.world.players[unit.playerId];

      let cont = this.unitSprites.get(unit.id);
      if (!cont) {
        cont = new Container();
        // Підставка в кольорі гравця (як кольоровий фон юніта в Civ 1)
        cont.addChild(new Graphics());
        const sprite = new Sprite(SpriteAtlas.unitTexture(unit.type));
        sprite.anchor.set(0.5, 1);
        sprite.position.set(TILE_SIZE / 2, TILE_SIZE - 3);
        cont.addChild(sprite);
        const letter = new Text({
          text: '',
          style: new TextStyle({
            fontFamily: 'Courier New, monospace',
            fontSize: 16,
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: { color: '#000000', width: 4 },
          }),
        });
        letter.position.set(3, 1);
        cont.addChild(letter);
        this.unitLayer.addChild(cont);
        this.unitSprites.set(unit.id, cont);
      }

      const base = cont.children[0] as Graphics;
      base.clear();
      base.ellipse(TILE_SIZE / 2, TILE_SIZE - 7, 22, 7).fill({ color: player.colorHex, alpha: 0.85 });
      base.ellipse(TILE_SIZE / 2, TILE_SIZE - 7, 22, 7).stroke({ color: 0x000000, width: 2, alpha: 0.6 });
      if (unit.isFortified) {
        // Укріплення: кам'яна рамка навколо юніта
        base.rect(3, 3, TILE_SIZE - 6, TILE_SIZE - 6).stroke({ color: 0xb8b0a0, width: 3 });
      }
      if (unit.veteran) {
        // Шеврон ветерана: дві золоті галочки в правому верхньому куті
        for (const dy of [0, 5]) {
          base.moveTo(TILE_SIZE - 17, 5 + dy).lineTo(TILE_SIZE - 11, 10 + dy).lineTo(TILE_SIZE - 5, 5 + dy);
        }
        base.stroke({ color: 0x000000, width: 4 });
        for (const dy of [0, 5]) {
          base.moveTo(TILE_SIZE - 17, 5 + dy).lineTo(TILE_SIZE - 11, 10 + dy).lineTo(TILE_SIZE - 5, 5 + dy);
        }
        base.stroke({ color: 0xf1c40f, width: 2 });
      }
      (cont.children[1] as Sprite).texture = SpriteAtlas.unitTexture(unit.type);
      const letter = cont.children[2] as Text;
      const cargo = UNIT_CONFIGS[unit.type].capacity ? this.world.cargoOf(unit.id).length : 0;
      letter.text = unit.task ? TERRAFORM_INFO[unit.task.kind].letter : cargo ? `+${cargo}` : unit.isFortified ? 'F' : '';

      cont.position.set(unit.x * TILE_SIZE, unit.y * TILE_SIZE);
      cont.visible = isVisible && !unit.carriedBy; // пасажири сховані в кораблі
    }

    // Видалення юнітів, яких більше немає
    for (const [id, cont] of this.unitSprites.entries()) {
      if (!currentIds.has(id)) {
        this.unitLayer.removeChild(cont);
        cont.destroy({ children: true });
        this.unitSprites.delete(id);
      }
    }
  }

  private syncCities(): void {
    const currentIds = new Set<string>();
    const humanFog = this.world.playerFogs.get(0);

    const style = new TextStyle({
      fontFamily: 'Courier New, monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#54fcfc', // Класичний ціановий колір міст Civ 1
      stroke: { color: '#000000', width: 3 },
    });

    for (const city of this.world.cities.values()) {
      currentIds.add(city.id);
      const isVisible = humanFog ? humanFog.explored[city.y][city.x] : true;

      let cityCont = this.cityContainers.get(city.id);
      if (!cityCont) {
        cityCont = new Container();
        const player = this.world.players[city.playerId];
        const sprite = new Sprite(SpriteAtlas.cityTexture(city.size));
        cityCont.addChild(sprite);

        // Бейдж населення в кольорі гравця, як в оригінальній Civ 1
        const badge = new Graphics();
        badge.rect(0, 0, 16, 16).fill({ color: player.colorHex });
        badge.rect(0, 0, 16, 16).stroke({ color: 0x000000, width: 2 });
        cityCont.addChild(badge);

        const numText = new Text({
          text: `${city.size}`,
          style: new TextStyle({
            fontFamily: 'Courier New, monospace',
            fontSize: 13,
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: { color: '#000000', width: 3 },
          }),
        });
        numText.anchor.set(0.5);
        numText.position.set(8, 8);
        cityCont.addChild(numText);

        const label = new Text({
          text: city.name,
          style: style.clone(), // свій стиль: колір міняється при безладі
        });
        label.anchor.set(0.5, 0);
        label.position.set(TILE_SIZE / 2, TILE_SIZE - 2);
        cityCont.addChild(label);

        this.cityLayer.addChild(cityCont);
        this.cityContainers.set(city.id, cityCont);
      } else {
        const spr = cityCont.children[0] as Sprite;
        if (spr) spr.texture = SpriteAtlas.cityTexture(city.size);
        const numText = cityCont.children[2] as Text;
        if (numText) numText.text = `${city.size}`;
      }

      // Безлад — назва міста червона, як у Civ 1
      const label = cityCont.children[3] as Text;
      label.style.fill = this.world.cityYields(city).disorder ? '#ff5050' : '#54fcfc';

      cityCont.position.set(city.x * TILE_SIZE, city.y * TILE_SIZE);
      cityCont.visible = isVisible;
    }

    for (const [id, cont] of this.cityContainers.entries()) {
      if (!currentIds.has(id)) {
        this.cityLayer.removeChild(cont);
        cont.destroy({ children: true });
        this.cityContainers.delete(id);
      }
    }
  }

  /**
   * Легкий покадровий рендер: тільки оновлення камери та рамки виділеного юніта (0 виділень пам'яті!).
   */
  public renderFrame(selectedUnit?: Unit): void {
    this.container.scale.set(this.zoom);
    this.container.position.set(this.cameraX, this.cameraY);

    this.overlayLayer.clear();
    if (selectedUnit) {
      const time = performance.now() * 0.005;
      const alpha = 0.5 + Math.sin(time) * 0.4;
      this.overlayLayer.rect(
        selectedUnit.x * TILE_SIZE - 1,
        selectedUnit.y * TILE_SIZE - 1,
        TILE_SIZE + 2,
        TILE_SIZE + 2
      );
      this.overlayLayer.stroke({ color: 0xf1c40f, width: 2, alpha });
    }
  }
}
