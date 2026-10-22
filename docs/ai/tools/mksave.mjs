// Готова партія для гри людиною в браузері: AI грає за всіх N ходів, потім гравець 0 — знову людина.
//   npx esbuild docs/ai/tools/entry.ts --bundle --format=esm --platform=node --outfile=<tmp>/bundle.mjs
//   node docs/ai/tools/mksave.mjs <tmp>/bundle.mjs <ходів> <сід> tmp-save.json   (330 ходів ≈ 1981 р.)
// У браузері (Vite на :3000): fetch('/tmp-save.json') → кожну пару ключ/значення в localStorage → reload → «Продовжити».
// tmp-save.json після перевірки видалити.
const [bundle, turns, seed, out] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
// Мапа сіється й з Date.now — без підміни прогони неповторювані
Math.random = mulberry(seed); const realNow = Date.now; let fake = seed * 1000; Date.now = () => fake++;
const { World, saveGame } = await import((await import('url')).pathToFileURL(bundle).href);
const w = new World({ civ: 'rus', rivals: 3, mapSize: 'small', difficulty: 'prince' });
Date.now = realNow;
w.players[0].isAi = true;
for (let t = 0; t < turns && !w.gameOver; t++) w.processTurnEnd();
// Зустрічі, що накопичились, поки за людину грав AI, — не показувати
w.players[0].isAi = false; w.diplomacy.takeMeetings();
const me = w.players[0];
console.log(w.turnManager.getYearString(), 'міст', [...w.cities.values()].filter(c => c.playerId === 0).length, 'техн.', me.knownTechs.length, 'зл.', me.gold, me.government);
console.log(saveGame(w, 'auto') ?? 'збережено');
(await import('fs')).writeFileSync(out, JSON.stringify(Object.fromEntries(store)));
