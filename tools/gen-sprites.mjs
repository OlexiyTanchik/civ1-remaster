/**
 * Генерація сирих спрайтів через Gemini image API.
 *
 * За замовчуванням — найдешевше: модель Flash-Lite і сітки 3×3 (9 спрайтів одного типу за запит).
 *   Сітка зберігається в <out>/_grids/, нарізає її tools/process-sprites.py.
 *   Рельєф і фони в сітку не годяться — вони завжди йдуть поодинці.
 * Проба 2026-10-21: Flash-Lite дав чисті сітки; Flash дописував підписи під спрайтами (не брати).
 *
 * Запуск:
 *   node tools/gen-sprites.mjs                              — згенерувати відсутні
 *   node tools/gen-sprites.mjs legion forest                — перегенерувати вказані
 *   node tools/gen-sprites.mjs --single                     — по одному спрайту на запит
 *   node tools/gen-sprites.mjs --grid=2x2                   — інший розмір сітки
 *   node tools/gen-sprites.mjs --model=gemini-3-pro-image   — дорожча модель ($0.134 за запит + «роздуми»)
 *
 * Ціни (ai.google.dev/gemini-api/docs/pricing, перевірено 2026-10-21), за 1 картинку 1K:
 *   gemini-3-pro-image $0.134 · gemini-3.1-flash-image $0.067 · gemini-3.1-flash-lite-image $0.0336.
 *   Сітка 3×3 на Flash-Lite ≈ 0.4¢ за спрайт.
 *   node tools/gen-sprites.mjs --out=assets_src/test/x      — інша тека (для порівнянь)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const MODEL = opt('model') || process.env.MODEL || 'gemini-3.1-flash-lite-image';
const OUT_DIR = join(ROOT, opt('out') || 'assets_src/raw');
const GRID = args.includes('--single') ? undefined : (opt('grid') ?? '3x3').split('x').map(Number); // [cols, rows]
const CONCURRENCY = 3;

// Ключ — з оточення або з .env.local (не комітиться)
function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('GEMINI_API_KEY не знайдено (.env.local або змінна оточення)');
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'assets_src', 'sprites.json'), 'utf8'));
const KEY = loadKey();
let tokensOut = 0;

function singlePrompt(entry) {
  return `${manifest.style.common} ${manifest.style[entry.kind]} Subject: ${entry.prompt}`;
}

function gridPrompt(group, cols, rows) {
  const list = group.map((e, i) => `${i + 1}) ${e.prompt}`).join(' ');
  return `${manifest.style.common} ${manifest.style[group[0].kind]} ` +
    `LAYOUT: one sprite sheet with exactly ${group.length} separate items arranged in a grid of ${cols} columns and ${rows} rows, ` +
    `reading left to right, top to bottom. Each item is centered in its own equal cell and is drawn at the same scale and in the same style as the others. ` +
    `Leave wide empty magenta gaps between items; no item may touch or cross into another cell. ` +
    `No grid lines, no cell borders, no frames, no numbers, no labels. Items: ${list}`;
}

async function request(prompt, aspect, label) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const img = (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData);
    if (img) {
      tokensOut += json.usageMetadata?.candidatesTokenCount ?? 0;
      return Buffer.from(img.inlineData.data, 'base64');
    }
    const reason = json.error?.message ?? json.candidates?.[0]?.finishReason ?? 'немає зображення';
    console.warn(`  ${label}: спроба ${attempt} — ${reason}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`${label}: не вдалося згенерувати`);
}

/** Завдання: або один спрайт, або сітка зі спрайтів одного типу. */
function buildJobs(queue) {
  const single = (e) => async () => {
    writeFileSync(join(OUT_DIR, `${e.id}.png`), await request(singlePrompt(e), e.aspect ?? '1:1', e.id));
    return [e.id];
  };
  // Рельєф і фони — цілі зображення, у сітку не годяться
  const whole = (e) => e.kind === 'terrain' || e.kind === 'backdrop';
  if (!GRID) return queue.map(single);

  const [cols, rows] = GRID;
  const perGrid = cols * rows;
  const byKind = new Map();
  const jobs = queue.filter(whole).map(single);
  for (const e of queue.filter((e) => !whole(e))) {
    byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  }
  for (const entries of byKind.values()) {
    for (let i = 0; i < entries.length; i += perGrid) {
      const group = entries.slice(i, i + perGrid);
      const c = Math.min(cols, group.length);
      const r = Math.ceil(group.length / c);
      jobs.push(async () => {
        const name = group.map((e) => e.id).join('+');
        const gridDir = join(OUT_DIR, '_grids');
        mkdirSync(gridDir, { recursive: true });
        writeFileSync(join(gridDir, `${name}.png`), await request(gridPrompt(group, c, r), '1:1', name));
        writeFileSync(join(gridDir, `${name}.json`), JSON.stringify({ ids: group.map((e) => e.id), cols: c, rows: r, model: MODEL }));
        return group.map((e) => e.id);
      });
    }
  }
  return jobs;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const only = args.filter((a) => !a.startsWith('--'));
  const queue = manifest.sprites.filter((s) =>
    only.length ? only.includes(s.id) : !existsSync(join(OUT_DIR, `${s.id}.png`))
  );
  const jobs = buildJobs(queue);
  console.log(`Модель ${MODEL}, спрайтів: ${queue.length}, запитів: ${jobs.length}${GRID ? ` (сітка ${GRID.join('x')})` : ''}`);

  const failed = [];
  const worker = async () => {
    while (jobs.length) {
      const job = jobs.shift();
      try {
        console.log(`  ✓ ${(await job()).join(', ')}`);
      } catch (e) {
        failed.push(e.message);
        console.error(`  ✗ ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Вихідних токенів зображень: ${tokensOut}`);
  if (failed.length) process.exit(1);
}

main();
