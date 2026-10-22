/**
 * Єдиний атлас спрайтів ремастеру (генерується tools/process-sprites.py).
 * Ті самі кадри використовуються і в Pixi (юніти, міста), і в 2D-запіканні рельєфу.
 */
import { Texture, Rectangle, TextureSource } from 'pixi.js';
import { TerrainType, ResourceType, UnitTypeKey } from '../core/types';

interface FrameData {
  frame: { x: number; y: number; w: number; h: number };
}

export const TERRAIN_FRAME: Partial<Record<TerrainType, string>> = {
  [TerrainType.Ocean]: 't_ocean',
  [TerrainType.Grassland]: 't_grassland',
  [TerrainType.Plains]: 't_plains',
  [TerrainType.Desert]: 't_desert',
  [TerrainType.Tundra]: 't_tundra',
  [TerrainType.Glacier]: 't_glacier',
  [TerrainType.Swamp]: 't_swamp',
};

export const OVERLAY_FRAME: Partial<Record<TerrainType, string>> = {
  [TerrainType.Hills]: 'o_hills',
  [TerrainType.Mountains]: 'o_mountains',
  [TerrainType.Forest]: 'o_forest',
  [TerrainType.Jungle]: 'o_jungle',
};

export const RESOURCE_FRAME: Partial<Record<ResourceType, string>> = {
  [ResourceType.Oasis]: 'r_oasis',
  [ResourceType.Oil]: 'r_oil',
  [ResourceType.Coal]: 'r_coal',
  [ResourceType.Gold]: 'r_gold',
  [ResourceType.Iron]: 'r_iron',
  [ResourceType.Fish]: 'r_fish',
  [ResourceType.Game]: 'r_game',
};

/** Замінники відсутніх кадрів за префіксом id. */
const FALLBACK_FRAME: Record<string, string> = { u_: 'u_militia', b_: 'b_granary', w_: 'w_pyramids', sp_: 'sp_module' };

export class SpriteAtlas {
  public static image: HTMLImageElement;
  private static frames: Record<string, FrameData> = {};
  private static source: TextureSource;
  private static textures = new Map<string, Texture>();
  /** Кадри, домальовані кодом (без генерації спрайтів). */
  private static extra = new Map<string, HTMLCanvasElement>();
  private static warned = new Set<string>();

  public static async load(): Promise<void> {
    // Від BASE_URL: гра працює й з підкаталогу (GitHub Pages) чи будь-якого статичного хостингу
    const base = `${import.meta.env.BASE_URL}assets/sprites/`;
    const json = await fetch(`${base}atlas.json`).then((r) => r.json());
    this.frames = json.frames;
    this.image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${base}${json.meta.image}`;
    });
    this.source = Texture.from(this.image).source;
    this.source.scaleMode = 'nearest';
    if (!this.has('u_howitzer') && this.has('u_artillery')) this.extra.set('u_howitzer', this.drawHowitzer());
  }

  /** Гаубиця — перефарбована в темний камуфляж Артилерія з гусеницями. */
  private static drawHowitzer(): HTMLCanvasElement {
    const { x, y, w, h } = this.rect('u_artillery');
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(this.image, x, y, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(48, 64, 24, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const u = Math.max(1, Math.round(w / 32));
    ctx.fillStyle = '#1c1c14';
    ctx.fillRect(Math.round(w * 0.18), h - 5 * u, Math.round(w * 0.64), 3 * u);
    ctx.fillStyle = '#6b6b55';
    for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(w * 0.22) + i * Math.round(w * 0.12), h - 4 * u, u, u);
    return c;
  }

  public static has(name: string): boolean {
    return name in this.frames || this.extra.has(name);
  }

  /**
   * Кадр, якого ще нема в атласі (код нового вмісту йде раніше за спрайти), — замінник за префіксом.
   */
  private static resolve(name: string): string {
    if (this.has(name)) return name;
    const prefix = Object.keys(FALLBACK_FRAME).find((p) => name.startsWith(p));
    const alt = prefix && this.has(FALLBACK_FRAME[prefix]) ? FALLBACK_FRAME[prefix] : Object.keys(this.frames)[0];
    if (!this.warned.has(name)) {
      this.warned.add(name);
      console.warn(`Спрайт "${name}" відсутній в атласі — малюю "${alt}"`);
    }
    return alt;
  }

  public static rect(name: string): { x: number; y: number; w: number; h: number } {
    name = this.resolve(name);
    const own = this.extra.get(name);
    if (own) return { x: 0, y: 0, w: own.width, h: own.height };
    return this.frames[name].frame;
  }

  public static texture(name: string): Texture {
    name = this.resolve(name);
    let tex = this.textures.get(name);
    if (!tex) {
      const own = this.extra.get(name);
      if (own) {
        tex = Texture.from(own);
        tex.source.scaleMode = 'nearest';
        this.textures.set(name, tex);
        return tex;
      }
      const { x, y, w, h } = this.rect(name);
      tex = new Texture({ source: this.source, frame: new Rectangle(x, y, w, h) });
      this.textures.set(name, tex);
    }
    return tex;
  }

  public static unitTexture(type: UnitTypeKey): Texture {
    return this.texture(`u_${type}`);
  }

  public static cityTexture(size: number): Texture {
    return this.texture(size <= 3 ? 'c_tier1' : size <= 7 ? 'c_tier2' : 'c_tier3');
  }

  /** Малює кадр на 2D-полотні (для запікання та HUD). */
  public static draw(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, dw?: number, dh?: number): void {
    name = this.resolve(name);
    const own = this.extra.get(name);
    if (own) return ctx.drawImage(own, dx, dy, dw ?? own.width, dh ?? own.height);
    const { x, y, w, h } = this.rect(name);
    ctx.drawImage(this.image, x, y, w, h, dx, dy, dw ?? w, dh ?? h);
  }

  /** Окреме полотно з одним кадром (джерело для createPattern). */
  public static toCanvas(name: string): HTMLCanvasElement {
    name = this.resolve(name);
    const own = this.extra.get(name);
    if (own) return own;
    const { w, h } = this.rect(name);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    this.draw(c.getContext('2d')!, name, 0, 0);
    return c;
  }
}
