// Одна партія 4 AI до кінця гри (мала мапа), підсумок — рядок JSON.
//   npx esbuild docs/ai/tools/sim-entry.ts --bundle --format=esm --platform=node --outfile=<tmp>/b.mjs
//   node docs/ai/tools/sim.mjs <tmp>/b.mjs <сід> [ходів]
// WATCH=ключі юнітів/споруд — скільки юнітів створено й скільки споруд стоїть наприкінці; KEYS=підрядки новин — скільки разів і коли вперше.
// Паралельно: printf "%s\n" 1 2 3 4 | xargs -P 4 -I{} node docs/ai/tools/sim.mjs <tmp>/b.mjs {}
const [bundle, seed, maxT] = [process.argv[2], +process.argv[3], +(process.argv[4] ?? 600)];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
Math.random = mulberry(seed); const realNow = Date.now; let fake = seed * 1000; Date.now = () => fake++;
const M = await import((await import('url')).pathToFileURL(bundle).href);
const w = new M.World({ civ: 'rus', rivals: 3, mapSize: 'small', difficulty: 'prince' });
Date.now = realNow;
w.players[0].isAi = true;
globalThis.__stats = {};
const t0 = realNow();
const keys = (process.env.KEYS ?? '').split(',').filter(Boolean);
// WATCH=ключі юнітів/споруд: скільки юнітів створено й скільки споруд стоїть наприкінці
const watch = (process.env.WATCH ?? '').split(',').filter(Boolean);
const made = {};
if (watch.length) { const orig = w.createUnit.bind(w); w.createUnit = (pid, type, x, y) => { if (watch.includes(type)) made[type] = (made[type] ?? 0) + 1; return orig(pid, type, x, y); }; }
for (let t = 0; t < maxT && !w.gameOver; t++) {
  const r = w.processTurnEnd();
  for (const m of r.completedItems ?? []) for (const k of keys) if (m.includes(k)) { globalThis.__stats[k] = (globalThis.__stats[k] ?? 0) + 1; if (!globalThis.__stats[k + '@']) globalThis.__stats[k + '@'] = w.turnManager.getYearString(); }
}
for (const c of w.cities.values()) for (const b of c.buildings) if (watch.includes(b)) made[b] = (made[b] ?? 0) + 1;
globalThis.__stats.made = made;
const alive = w.players.filter(p => !p.isBarbarian && p.alive).length;
console.log(JSON.stringify({ seed, over: w.gameOver ? `${w.gameOver.reason} ${w.gameOver.year}` : w.turnManager.getYearString(), dead: w.players.filter(p => !p.isBarbarian && !p.alive).length, alive, cities: w.cities.size, s: realNow() - t0, ...globalThis.__stats }));
