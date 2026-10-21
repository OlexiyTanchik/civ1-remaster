"""
Обробка сирих спрайтів (assets_src/raw) у піксель-арт атлас для гри.

  python -I tools/process-sprites.py

Кроки:
  - юніти/міста/накладки/ресурси: прибрати пурпуровий фон, обрізати, зменшити
    до розміру з sprites.json, квантувати палітру, додати 1px темний контур;
  - рельєф: зменшити до 128x128, зробити безшовним, квантувати;
  - упакувати все в public/assets/sprites/atlas.png + atlas.json (формат Pixi);
  - зберегти assets_src/preview.png для швидкого огляду.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_src" / "raw"
OUT_DIR = ROOT / "public" / "assets" / "sprites"
OUTLINE = (24, 18, 28, 255)
ATLAS_W = 1024
PAD = 2


def key_out_magenta(img: Image.Image) -> Image.Image:
    """Фон → прозорість. Колір фону міряємо по краю: Gemini інколи дає не чистий #FF00FF."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg_color = np.median(border, axis=0)
    dist = np.sqrt(((a - bg_color) ** 2).sum(axis=-1))
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Пурпурові відтінки (облямівка, затінений фон у замкнених ділянках) теж прибираємо
    magenta = (r > g + 70) & (b > g + 50) & (np.abs(r - b) < 70)
    bg = (dist < 90) | magenta
    rgba = np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def downscale_rgba(img: Image.Image, w: int, h: int) -> Image.Image:
    """Зменшення з premultiplied alpha, потім жорсткий поріг альфи (без напівпрозорих країв)."""
    a = np.asarray(img).astype(np.float32) / 255.0
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4]
    small = np.stack(
        [np.asarray(Image.fromarray((pm[..., i] * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BOX))
         for i in range(4)], axis=-1).astype(np.float32) / 255.0
    alpha = small[..., 3:4]
    rgb = np.where(alpha > 0.01, small[..., :3] / np.maximum(alpha, 1e-4), 0)
    # Пурпурова облямівка, що лишилась на краях, — гасимо
    out = np.dstack([np.clip(rgb, 0, 1), (alpha > 0.5).astype(np.float32)])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def quantize_rgba(img: Image.Image, colors: int) -> Image.Image:
    alpha = np.asarray(img)[..., 3]
    q = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    rgb = np.asarray(q.convert("RGB"))
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def add_outline(img: Image.Image) -> Image.Image:
    a = np.asarray(img).copy()
    solid = a[..., 3] > 0
    grow = np.zeros_like(solid)
    grow[1:, :] |= solid[:-1, :]
    grow[:-1, :] |= solid[1:, :]
    grow[:, 1:] |= solid[:, :-1]
    grow[:, :-1] |= solid[:, 1:]
    edge = grow & ~solid
    a[edge] = OUTLINE
    return Image.fromarray(a, "RGBA")


def process_object(raw: Image.Image, size: int, anchor: str) -> Image.Image:
    keyed = key_out_magenta(raw)
    bbox = keyed.getbbox()
    if not bbox:
        raise ValueError("порожнє зображення після видалення фону")
    keyed = keyed.crop(bbox)
    inner = size - 2  # місце під контур
    scale = inner / max(keyed.width, keyed.height)
    w, h = max(1, round(keyed.width * scale)), max(1, round(keyed.height * scale))
    small = quantize_rgba(downscale_rgba(keyed, w, h), 32)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - w) // 2
    y = size - h - 1 if anchor == "bottom" else (size - h) // 2
    canvas.paste(small, (x, y))
    return add_outline(canvas)


def process_terrain(raw: Image.Image, size: int) -> Image.Image:
    """Зменшення + безшовність: змішування з копією, зсунутою на пів розміру."""
    img = np.asarray(raw.convert("RGB").resize((size, size), Image.Resampling.BOX)).astype(np.float32)
    rolled = np.roll(img, (size // 2, size // 2), axis=(0, 1))
    t = np.abs(np.linspace(-1, 1, size))
    edge = np.maximum(t[None, :], t[:, None])  # 0 у центрі, 1 на краях
    w = np.clip((edge - 0.45) / 0.55, 0, 1)[..., None]
    w = w * w * (3 - 2 * w)
    mixed = img * (1 - w) + rolled * w
    out = Image.fromarray(mixed.astype(np.uint8), "RGB")
    return out.quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def process_backdrop(raw: Image.Image, w: int, h: int) -> Image.Image:
    """Широкий фон: обрізати під пропорцію, зменшити, квантувати без дизерингу."""
    img = raw.convert("RGB")
    target = w / h
    if img.width / img.height > target:
        nw = round(img.height * target)
        img = img.crop(((img.width - nw) // 2, 0, (img.width + nw) // 2, img.height))
    else:
        nh = round(img.width / target)
        img = img.crop((0, (img.height - nh) // 2, img.width, (img.height + nh) // 2))
    img = img.resize((w, h), Image.Resampling.BOX)
    return img.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def pack(sprites: dict[str, Image.Image]):
    """Полична упаковка за висотою."""
    order = sorted(sprites, key=lambda k: -sprites[k].height)
    frames, x, y, shelf = {}, PAD, PAD, 0
    for k in order:
        im = sprites[k]
        if x + im.width + PAD > ATLAS_W:
            x, y, shelf = PAD, y + shelf + PAD, 0
        frames[k] = (x, y, im.width, im.height)
        x += im.width + PAD
        shelf = max(shelf, im.height)
    height = 1
    while height < y + shelf + PAD:
        height *= 2
    atlas = Image.new("RGBA", (ATLAS_W, height), (0, 0, 0, 0))
    for k, (fx, fy, _, _) in frames.items():
        atlas.paste(sprites[k], (fx, fy))
    return atlas, frames


# ---------- Нарізка сіток (gen-sprites.mjs --grid) ----------

def _runs(occ: np.ndarray, min_gap: int, min_len: int) -> list[list[int]]:
    """Суцільні ділянки True; ділянки з проміжком < min_gap зливаємо, дрібне сміття відкидаємо."""
    runs, start = [], None
    for i, v in enumerate(list(occ) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if runs and start - runs[-1][1] < min_gap:
                runs[-1][1] = i
            else:
                runs.append([start, i])
            start = None
    return [r for r in runs if r[1] - r[0] >= min_len]


def _reduce(runs: list[list[int]], n: int) -> list[list[int]]:
    """Забагато ділянок → зливаємо сусідні з найменшим проміжком (шматки одного спрайта)."""
    runs = [r[:] for r in runs]
    while len(runs) > n:
        i = min(range(len(runs) - 1), key=lambda k: runs[k + 1][0] - runs[k][1])
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    return runs


def _erase_grid_lines(rgb: Image.Image) -> Image.Image:
    """Flash-Lite інколи малює білі лінії між клітинками — фарбуємо їх фоном, інакше вони липнуть до спрайтів."""
    a = np.asarray(rgb).copy()
    v = a.astype(np.int16)
    light = (v.min(axis=-1) > 170) & (v.max(axis=-1) - v.min(axis=-1) < 40)
    a[light.mean(axis=1) > 0.5, :] = (255, 0, 255)
    a[:, light.mean(axis=0) > 0.5] = (255, 0, 255)
    return Image.fromarray(a, "RGB")


def slice_grid(img: Image.Image, cols: int, rows: int, count: int) -> list[Image.Image]:
    """Ріже сітку по порожніх смугах фону; якщо смуги не знайшлись — рівними клітинками."""
    rgb = _erase_grid_lines(img.convert("RGB"))
    mask = np.asarray(key_out_magenta(rgb))[..., 3] > 0
    H, W = mask.shape
    gap, small = max(4, W // 60), max(6, W // 50)
    row_runs = _reduce(_runs(mask.any(axis=1), gap, small), rows)
    if len(row_runs) != rows:
        row_runs = [[H * r // rows, H * (r + 1) // rows] for r in range(rows)]
    cells = []
    for r, (y0, y1) in enumerate(row_runs):
        n = min(cols, count - r * cols)
        col_runs = _reduce(_runs(mask[y0:y1].any(axis=0), gap, small), n)
        if len(col_runs) != n:
            col_runs = [[W * c // cols, W * (c + 1) // cols] for c in range(n)]
        for x0, x1 in col_runs:
            pad = 6
            cells.append(rgb.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))))
    return cells


def slice_all_grids(raw_dir: Path) -> None:
    """Нарізає кожну сітку з raw_dir/_grids у raw_dir/<id>.png (якщо сітка новіша за файл)."""
    grid_dir = raw_dir / "_grids"
    if not grid_dir.exists():
        return
    for meta_path in sorted(grid_dir.glob("*.json")):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        grid_path = meta_path.with_suffix(".png")
        targets = [raw_dir / f"{i}.png" for i in meta["ids"]]
        if all(t.exists() and t.stat().st_mtime >= grid_path.stat().st_mtime for t in targets):
            continue
        cells = slice_grid(Image.open(grid_path), meta["cols"], meta["rows"], len(meta["ids"]))
        for cell, target in zip(cells, targets):
            # Поле навколо, щоб key_out_magenta виміряв фон по краю
            framed = Image.new("RGB", (cell.width + 16, cell.height + 16), (255, 0, 255))
            framed.paste(cell, (8, 8))
            framed.save(target)
        print(f"Сітка {grid_path.name} → {len(cells)} спрайтів")


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")  # консоль Windows за замовчуванням cp1251
    raw_arg = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--raw=")), None)
    raw_dir = (ROOT / raw_arg) if raw_arg else RAW
    slice_all_grids(raw_dir)
    manifest = json.loads((ROOT / "assets_src" / "sprites.json").read_text(encoding="utf-8"))
    sizes = manifest["sizes"]
    out: dict[str, Image.Image] = {}
    missing = []
    for s in manifest["sprites"]:
        path = raw_dir / f"{s['id']}.png"
        if not path.exists():
            if not raw_arg:
                missing.append(s["id"])
            continue
        raw = Image.open(path)
        kind = s["kind"]
        if kind == "terrain":
            out[s["id"]] = process_terrain(raw, sizes[kind])
        elif kind == "backdrop":
            out[s["id"]] = process_backdrop(raw, *sizes[kind])
        else:
            out[s["id"]] = process_object(raw, sizes[kind], "center" if kind == "resource" else "bottom")

    if raw_arg:
        # Тестова тека: лише прев'ю обробленого, атлас гри не чіпаємо
        prev_atlas, _ = pack(out)
        prev = Image.new("RGBA", prev_atlas.size, (90, 90, 100, 255))
        prev.alpha_composite(prev_atlas)
        prev.resize((prev.width * 2, prev.height * 2), Image.Resampling.NEAREST).save(raw_dir / "preview.png")
        print(f"Прев'ю: {raw_dir / 'preview.png'} ({len(out)} спрайтів)")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas, frames = pack(out)
    atlas.save(OUT_DIR / "atlas.png")
    data = {
        "frames": {
            k: {
                "frame": {"x": x, "y": y, "w": w, "h": h},
                "sourceSize": {"w": w, "h": h},
                "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            }
            for k, (x, y, w, h) in frames.items()
        },
        "meta": {"image": "atlas.png", "size": {"w": atlas.width, "h": atlas.height}, "scale": 1},
    }
    (OUT_DIR / "atlas.json").write_text(json.dumps(data, indent=1), encoding="utf-8")

    # Прев'ю: атлас ×3 на сірому фоні + рельєф 3×3 для перевірки швів
    prev = Image.new("RGBA", (atlas.width, atlas.height), (90, 90, 100, 255))
    prev.alpha_composite(atlas)
    prev = prev.resize((atlas.width * 2, atlas.height * 2), Image.Resampling.NEAREST)
    prev.save(ROOT / "assets_src" / "preview.png")
    terr = [k for k in out if k.startswith("t_")]
    if terr:
        T = sizes["terrain"]
        tp = Image.new("RGBA", (len(terr) * T * 2, T * 2))
        for i, k in enumerate(terr):
            for dy in range(2):
                for dx in range(2):
                    tp.paste(out[k], (i * T * 2 + dx * T, dy * T))
        tp.save(ROOT / "assets_src" / "preview_terrain.png")

    print(f"Атлас {atlas.width}x{atlas.height}, спрайтів: {len(out)}")
    if missing:
        print(f"Немає сирих файлів: {', '.join(missing)}")


if __name__ == "__main__":
    main()
