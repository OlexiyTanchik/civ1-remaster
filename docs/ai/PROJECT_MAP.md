# PROJECT_MAP — ремастер Civilization 1

Читати першим. Мета: нова сесія не перечитує весь код. План і статус етапів — у [ROADMAP.md](ROADMAP.md).

## Стек і запуск
- TypeScript + Vite 6 + PixiJS 8, без фреймворку UI (HTML-рядки в `src/ui`). ~5000 рядків.
- `npm run dev` (порт 3000 у `.claude/launch.json`; якщо зайнятий — Vite бере 3001). `npm run build` = `tsc` + збірка.
- Збірка з відносними шляхами (`base: './'`), ресурси — від `import.meta.env.BASE_URL`; деплой — `.github/workflows/deploy.yml` (GitHub Pages). Заставка `#boot-loader` в `index.html` знімається `bootScreen()` у `main.ts`. Портфоліо-опис — `README.md`, знімки — `docs/screenshots/`, картинка для посилань — `public/og-image.png`.
- Перевірка типів: `npx tsc --noEmit`.

## Файли
| Файл | Що всередині |
|---|---|
| `src/main.ts` | Bootstrap: Pixi, атлас, світ, рендерер, HUD, діалоги; обробники кнопок і гарячих клавіш; `moveSelected` |
| `src/core/types.ts` | Усі типи й енуми: `TileData`, `Unit`, `City`, `Player`, `UnitTypeKey`, `BuildingTypeKey`, `GovernmentKey/Config` |
| `src/core/constants.ts` | `MAP_WIDTH/HEIGHT` — `export let`, міняє `setMapSize` до створення світу; `MAP_SIZES`, `DIFFICULTIES`, `CIVS` (10 цивілізацій: лідер, колір, характер, міста), `DEFAULT_OPTIONS`. Дані: `TERRAIN_DATA`, `UNIT_CONFIGS`, `BUILDING_CONFIGS` (чудеса — `isWonder`), `TECH_TREE` (70 техн., `era` 1–6; далі `FUTURE_TECH`), `SPACE_LIMITS`, `GOVERNMENTS`, `FAT_CROSS_OFFSETS`, `TILE_SIZE=64`, мапа 80×50 |
| `src/core/world.ts` | `new World(options, save?)`; `serialize()` / відновлення (`SaveData`, клітинки `[рельєф, ресурс, прапорці]`). Стан гри й правила між системами: рух/бій/посадка на кораблі й авіаносці, пальне літаків, ядерний вибух (`detonate`, SDI — `sdiCover`), невидимий підводний човен (`hiddenFrom`), зона контролю (`zocBlocks`/`inEnemyZoc`, AI — у `pathStep`), агресія для ООН (`attackedRecently`), захоплення міст (`captureCity`, і підкупом), викуп виробництва (`buyCost`/`buyProduction`, AI — ще `completeUnitNow`), хатки, варвари, кінець ходу, економіка, утримання, революції, чудеса (Леонардо, Дарвін), забруднення |
| `src/core/city.ts` | `CityLogic`: видобуток міста (`calculateYields` → артисти → `yieldsWith`), щастя, корупція, множники будівель, ріст, виробництво, `autoAssignWorkers` |
| `src/core/terraform.ts` | Роботи на землі (road/railroad, irrigation, mine, clean), `tileYield` (ресурси `RESOURCE_BONUS`, бонуси, щитові луки, залізниця, забруднення) |
| `src/core/unit.ts` | `UnitLogic`: вартість руху (дорога 1/3, залізниця 0), `canMoveTo`, бій (`resolveCombat`: ветерани, мури, пікінери проти `MOUNTED`) |
| `src/core/diplomacy.ts` | `Diplomacy` (`world.diplomacy`): стосунки пар (`relation`: контакт, війна), ставлення (`attitude`), `onAggression` (напад у мирі = зрада), `detectContacts`, рішення AI (`aiTurn`), зустрічі для людини (`takeMeetings`/`answer`), обмін, `diplomatAct` (посольство, крадіжка, підкуп `inciteCost`, саботаж; вибір AI — `aiDiplomatChoice`) |
| `src/ui/diplomacy-dialog.ts` | Вікна: «🤝 Дипломатія», зустрічі з лідерами, дія дипломата |
| `src/core/ai-fleet.ts` | `FleetAi`: континенти (`continentOf`), морський BFS (`seaSearch`/`sail`), пороми (`ferry`, `awaitFerry`, `overseasSite`, `overseasTarget`), бойові кораблі (`strike`), літаки (`moveAir`) |
| `src/core/ai.ts` | `AiController`: дослідження, устрій, розкіш/податки, виробництво за пріоритетами, ролі юнітів, BFS-шлях |
| `src/core/turn-manager.ts` | Календар (`year` числом, `formatYear`), `researchCost` = (відомих+майбутніх+1)×10, `processPlayerEconomy`, `getAvailableTechs` (порожньо → технологія майбутнього), `learnTech`/`techById` — **завжди через них** |
| `src/core/map-generator.ts` | Генерація мапи: 5 ядер континентів (зсув від зерна), протоки `STRAIT_WIDTH` по межах між ядрами, біоми за шумом |
| `src/render/sprite-atlas.ts` | Атлас: Pixi-текстури й `draw()` на 2D-полотно; мапи `TERRAIN_FRAME`, `OVERLAY_FRAME`, `RESOURCE_FRAME` |
| `src/render/terrain-baker.ts` | Запікання рельєфу піксельно, шматками 16×16 тайлів: дизеринг біомів, берег, річки, накладки, ресурси, щит на луках |
| `src/render/map-renderer.ts` | Шари Pixi: рельєф, покращення, сітка, міста, юніти, туман, рамка; зум кроками 0.5–3 |
| `src/render/improvement-renderer.ts` | Іригація, дороги, колії, шахти, хатки, смог (перемальовується в `refreshAll`) |
| `src/ui/hud.ts` | Бічна панель: ставки, лад, юніт, накази (сітка 2 колонки), кнопки «🎵 Музика» і «💡 Поради»; «Порада радника» (`adviceText`, плашка `.advisor-tip` над мапою; до 120-го ходу — для новачка, далі — `lateAdvice`) |
| `src/ui/city-dialog.ts` | Екран міста у 2 колонки; `productionOptions` (техи, `requires`, `coastal`, палац лише якщо втрачений) |
| `src/ui/city-panorama.ts` | Панорама 384×216: `BUILDING_SLOTS` для кожної споруди/чуда, житла від центру назовні |
| `src/ui/tutorial.ts` | `Tutorial`: 5 кроків навчання (місто → дослідження → виробництво → кінець ходу → дорога) у плашці радника; `mark('city-opened'/'end-turn')` з `main.ts`; пропуск пам'ятає `civ1-remaster-tutorial` |
| `src/ui/help-dialog.ts` | `helpHtml` («Як грати»: мета, перші ходи, клавіші, правила), `aboutHtml` («Про гру»), `HelpDialog` (F1 / «?», «💾 Гра») |
| `src/ui/main-menu.ts` | Головне меню перед грою (`showMainMenu` → опції нової гри або збереження) |
| `src/ui/save-store.ts` | localStorage: слоти `auto`, `1..3`, метадані; `setPendingLoad` + перезавантаження сторінки для завантаження з гри |
| `src/ui/game-menu-dialog.ts` | «💾 Гра»: зберегти / завантажити / головне меню |
| `src/ui/space-dialog.ts` | Вікно космічної гонки: частини (спрайти `sp_*`), час і шанс польоту, запуск, кораблі суперників |
| `src/ui/game-over-dialog.ts` | Кінець гри: підсумок, рахунок усіх цивілізацій, «Зал слави» в localStorage (`civ1-remaster-hall-of-fame`) |
| `src/ui/tech-dialog.ts`, `government-dialog.ts`, `minimap.ts` | Радник (показує «що відкриває»), революція, мінікарта |
| `src/ui/sound-fx.ts` | `SoundEffects`: звуки WebAudio (`tone`/`melody`), `playForMessages` — один звук за хід за значком повідомлення (🌟 ⚔️ 🕊️ 🔥 🚀 💀 💡); фонова мелодія (`LEAD`/`BASS`, планувальник наперед), `toggleMusic` + localStorage |
| `src/style.css` | DOS-стиль; блок «Усе вміщається в екран» у кінці |
| `assets_src/sprites.json` | Маніфест спрайтів: стилі за `kind`, розміри, промпти |
| `tools/gen-sprites.mjs` | Генерація Gemini (див. «Графіка») |
| `tools/process-sprites.py` | Нарізка сіток (білі лінії між клітинками стирає `_erase_grid_lines`) → вирізання фону → зменшення → палітра → контур → `public/assets/sprites/atlas.png/json` |

## Модель даних і координати
- Мапа `world.tiles[y][x]`, 80×50 типово (64×40 / 112×70), **зациклена по X** (завжди `(x + W) % W`), по Y — ні. Відстань: `world.distance()` (Чебишов із зацикленням).
- Світові пікселі = клітинка × `TILE_SIZE` (64). Рельєф запечений у полотна по 1024 px.
- Війна лише за дипломатією: `ai.mayAttack` → `diplomacy.atWar` (варвари — завжди). Усі напади йдуть через `World.noteAggression` → `diplomacy.onAggression`.
- Людина: хід на загін/місто тих, з ким мир (`World.peaceVictim`), — лише після повтору (`main.ts`, `pendingTreachery`). Сенат: `diplomacy.senateForbidsWar` (Демократія — не можна нападати/оголошувати війну); за Республіки й Демократії мирну пропозицію AI приймає сам.
- Продаж споруди людиною — `World.sellCityBuilding` (одна на місто за хід, `City.soldTurn`); автопродаж при банкрутстві — `sellBuilding`.
- Спрайти, домальовані кодом без атласу: `SpriteAtlas.extra` (Гаубиця з Артилерії).
- Гравці: `0` — людина, `1..N` — суперники (`player.civ`, `hostileFromTurn` з характеру: 45/80/110), останній — варвари (`world.barbarianId`, `isBarbarian`). `new World()` без опцій — Русь проти Риму й Єгипту.
- Складність: `cityEnv` дає `baseContent` (людині) і `costFactor` (AI); `player.researchFactor` (людині).
- `Unit`: `task` (робота R/I/M/P), `veteran`, `carriedBy` (id корабля чи авіаносця), `fuel` (літаки), `aiTarget`. Пасажири стоять на клітинці корабля, але сховані.
- `UnitConfig`: `capacity` (сухопутні пасажири), `airCapacity` (літаки на авіаносці), `fuel` (ходів у повітрі), `requiresWonder` (ядерна ракета — Мангеттен будь-де).
  Етап 8: `allTerrainAsRoad` (будь-який рельєф — 1/3 руху, Дослідник), `vision` (радіус огляду, типово 2). Ветеран новому юніту — лише через `World.trainsVeteran` (казарми, аеропорт, портові споруди, Сунь-цзи).
  Агенти в чужих містах — `AGENTS` (Дипломат, Шпигун), не порівнювати з `UnitTypeKey.Diplomat`.
  Ще прапорці `UnitConfig`: `paradrop` (`World.paradrop`), `marine` (атака з корабля — `resolveCombat(…, mods.fromShip)`), `hover` (гелікоптер: без пального, у небі його б'ють усі; AI веде як наземний `attack`), `wonderShields` (караван 50, вантажівка 80 — `helpWonder`).
  `UnitLogic.resolveCombat(a, d, tile, walls, mods)`: `mods` — `coastal` (Берегова оборона), `sam` (ЗРК), `fromShip`.
  Авіація: `interceptor` (збиває літаки в небі — Винищувач, Стелс-винищувач; не порівнювати з `UnitTypeKey.Fighter`), `missile` (зникає після удару), `stealth` (ЗРК і AEGIS не діють), `antiAir` (AEGIS ×5).
  Нові технології Етапу 8 стоять у `RESEARCH_ORDER` після космічних: кожна зайва технологія дорожчає наступні, і AI не встигав до 2100.
- Перетворення рельєфу інженерами (`TRANSFORM` у `terraform.ts`, робота `transform`, клавіша O): `World.terrainChanges` → `MapRenderer.rebakeTerrain` перепікає шматки 16×16 (`TerrainBaker.rebake`). Без рендерера (симуляції) список лише росте — не страшно.
- Торгові маршрути (Етап 9): `City.tradeRoutes` (`{cityId, trade}`, торгівля порахована при заснуванні), `World.establishTradeRoute`/`tradeRouteProblem`/`tradeRouteOffer`; у видобуток — `CityEnv.routeTrade` (`World.routeTrade`: зниклі міста й війна не рахуються). Караван у чужому місті — гілка в `moveUnit`; AI — `routeTarget` в `ai.ts`.
- Капіталізація — «споруда» `Coinage` з `coinage: true` (ніколи не добудовується, `processTurn` повертає `coinage` → золото). Фундаменталізм: `GovernmentConfig.noUnhappy/scienceFactor/tithes`; Фанатики — `UnitConfig.requiresGovernment` (лише за ним будуються й тоді не на утриманні, `supportOf`).
- `TileData`: `hasRoad/hasRailroad/hasIrrigation/hasMine/hasRiver/hasHut/hasPollution`, `cityId`, `unitIds`.
- Ідентифікатори спрайтів: `t_` рельєф, `o_` накладки, `u_<UnitTypeKey>`, `c_tier1..3`, `r_` ресурси, `i_` покращення, `b_<BuildingTypeKey>`, `w_<BuildingTypeKey>` (чудеса), `h_` житла, `bd_` фон панорами.

## Порядок кінця ходу (`World.processTurnEnd`)
1. Міста: зірване чудо → Ополчення; варварським містам щити = 0; `CityLogic.processTurn`; нові юніти (казарми → ветеран); новини про чудеса (Дарвін дає техи).
2. Революції (анархія спливає) → економіка всіх гравців (золото/наука по містах) → утримання будівель, продаж при банкрутстві → Велика бібліотека.
3. Роботи юнітів, відновлення руху (`unitMoves`: Маяк, Магеллан, Ядерна енергетика); пальне літаків (поза базою −1, нуль — падіння).
4. Леонардо → забруднення → оголошення війни → `processAiTurns` (AI, потім варвари) → навала варварів.
5. Календар → `checkEliminations` (без міст і поселенців — загибель) → `checkArrivals` (кораблі) → `checkGameEnd` (`world.gameOver`: space / conquest / destroyed / time 2100); у стрічку додаються `news`.

## Космос і кінець гри
- Частини корабля — «будівлі» з `spacePart` і `requiresWonder: Apollo`: після завершення знімаються з міста й додаються до `player.spaceship`; місто будує ту саму частину далі (`canBuildSpacePart`).
- `launchProblem` (двигун, модуль, каркасів ≥ двигуни+модулі, є палац) → `launchSpaceship` (рік прибуття, шанс). Захоплення столиці стирає корабель.
- `world.score(id)` — рахунок; `main.ts` показує `GameOverDialog` один раз, коли з'явився `world.gameOver`.
- AI: `nextSpacePart` / `maybeLaunch` в `ai.ts` (ціль `SHIP_GOAL` 6/3/3).

## Ключові правила (де шукати)
- Видобуток міста: **завжди `world.cityYields(city)`** — вона передає `CityEnv` (устрій, столиця, чудеса, гарнізон). `CityLogic.calculateYields` без env рахує як Деспотизм.
- Деспотизм/анархія: −1 до видобутку клітинки понад 2 (`applyGovernment`). Республіка/Демократія: +1 торгівлі.
- Щастя: 4 задоволені; храм 2 (Оракул ×2), колізей 3, собор 3 (Мікеланджело — всюди), Висячі сади +1, Бах +2, воєнний стан Монархії (або поліція Жіночого права — до 2, береться більше), Шекспір — 0 невдоволених; армія за кордоном (`supportOf().abroad`, `GovernmentConfig.abroadUnhappy`: Республіка 1, Демократія 2, Жіноче право −1) робить задоволених невдоволеними; розкіш 2 = +1 щасливий; безлад, коли невдоволених > щасливих; автоматичні артисти 🎭 (+2 розкоші).
- Корупція = відстань до палацу × `corruptionPerTile` (Суд ÷2).
- Утримання армії: `unit.homeCityId`; `GovernmentConfig.freeUnits/settlerFood`; `cityEnv.support` → `CityYields.upkeepShields/upkeepFood/shieldDeficit/shieldsGross`; розпуск — `World.enforceUpkeep` перед `processTurn`; `rehome`, `boardInPort`.
- Межі росту: 10 без акведука, 16 без каналізації (`processTurn` → `needsAqueduct/needsSewer`).
- Жителі на клітинках (`autoAssignWorkers`): при рості/голоді, заснуванні, захопленні й **після завершених робіт на землі поруч**. Клітинка міста — джерело води для іригації (`CITY_IRRIGABLE` у `terraform.ts`).
- Множники: щити — Піраміди, фабрика, електростанція (або Гребля Гувера); золото — ринок → банк → біржа (по +50%, ланцюжком `requires`).
- Забруднення (`World.pollute`): щити понад 20 (фабрика ×2) + з Автомобілем жителі понад 10, якщо нема Масового транспорту.
- Літаки (`domain: 'air'`): рух 1 за клітинку будь-де, не захоплюють міст, у небі їх збиває лише Винищувач, без бонусу рельєфу/укріплення; Аеропорт — ветерани-літаки, Казарми — решта.
- Вибухівка: `World.checkTask` удвічі скорочує роботи Робітників (не поселенців). Підводний човен атакує лише в морі.
- Бій: атака/(атака+захист), рельєф, укріплення ×1.5, мури/Великий мур ×3, ветеран ×1.5, пікінери ×2 проти кінноти (не танків); поза містом гине весь стос; переможець лишається на місці.

## AI (`src/core/ai.ts`)
- `takeTurn`: дослідження (`RESEARCH_ORDER`, навмання з 3 найближчих — щоб AI мали чим мінятися) → устрій → розкіш → податки → **спершу юніти, потім виробництво міст**.
- Виробництво — ланцюг пріоритетів у `chooseProduction`; будівлі лише якщо `affordable` (крім храму, ринку, мурів); стеля армії `cities*2+2`; запасний варіант — чудеса, робітники, поселенці, каравани (не нескінченні захисники!).
- Ролі за типом юніта: поселенці (`findCitySite`), робітники (`bestTaskAt`: очищення → шахта в пагорбах → іригація → дорога/колія; необроблювані клітинки міста — лише під іригацію), караван, атака (шанси ≥ 0.55), захист/гарнізон (`garrisonNeed`), розвідка.
- Поселенці — лише якщо місто їх прогодує (`fedSettlers`): інакше `enforceUpkeep` розпускає їх наступного ж ходу.
- Розвідка морем: перший корабель гравця, поки є незнайомі цивілізації, пливе до нерозвіданої води (`FleetAi.scout`); `needsScout` → місто будує корабель.
- Флот і авіація — `ai-fleet.ts`: пасажири з `unit.aiMission` чекають у порту, пором (`aiWait`) збирає 1 поселенця чи 2–3 десантники; літаки атакують у радіусі (рух−1)/2; ООН: `mayAttack` не дає нападати на власника, якщо той сам не нападав 10 ходів.

## Графіка
- Генерація: `node tools/gen-sprites.mjs` — типово **gemini-3.1-flash-lite-image, сітки 3×3** (≈0.4¢ за спрайт). Pro ($0.134/картинка) — лише з дозволу Олексія. Flash (не lite) дописує підписи — не брати.
- Потім `python -I tools/process-sprites.py` (сирі файли в `assets_src/raw`, у git не йдуть). Тестова тека: `--out=assets_src/test/x`, потім `process-sprites.py --raw=assets_src/test/x` (лише прев'ю).
- Ключ: `.env.local` (`GEMINI_API_KEY`), у `.gitignore`.

## Як перевіряти
- Панораму міста без браузера: скрипт складає `bd_land` і всі `BUILDING_SLOTS` з атласу (`python -I docs/ai/tools/pano.py [КлючіДляРамки…]` → `docs/ai/tools/pano.png`, у git не йде) — так знайдено чудеса, сховані за палацом.
- Логіку — у браузері (Vite dev): `const {World} = await import('/src/core/world.ts'); const w = new World(); …` — той самий код, що в грі. Можна створювати юніти/міста, примусово кидати `Math.random`.
- Повна партія без людини: `w.players[0].isAi = true` (інакше бездіяльна людина гине й гра закінчується). Три AI — довше: ганяти шматками по 50–100 ходів, світ тримати в `window`.
- Симуляції AI: `for (t…) w.processTurnEnd()`. **Ліміт виклику ~45 с** — 2 світи по 300 ходів ≈ 28 с.
- Без браузера: зібрати скрипт `node_modules/.bin/esbuild sim.ts --bundle --platform=node --outfile=sim.cjs` і `node sim.cjs` (~3 с на світ × 300 ходів). Для повторюваності підмінити `Math.random` (LCG) **і `Date.now`** — зерно мапи береться з `Date.now()`.
- Перевизначений у сторінці `Math.random` живе до перезавантаження — після тестів бою робити `location.reload()`.
- Гра не виставляє `world` у `window`: щоб побачити тестові юніти на мапі, тимчасово обгорнути `World.prototype.processTurnEnd` (захопити `this`) і натиснути «Кінець ходу».
- Діалоги на будь-якому розмірі: `resize_window` + `new CityDialog(app, w, ()=>{}).show(city)` поверх сторінки.
- У консолі можуть висіти старі помилки HMR («TerrainBaker.load is not a function») — це залишки ранніх правок, фільтрувати.

## Пастки
- `world.ts` ↔ `ai.ts` — циклічний імпорт: в `ai.ts` лише `import type { World }`.
- Після завершення будівлі виробництво скидається на Ополчення; AI переобирає щоходу, людина — сама.
- Гарячі клавіші ігноруються, поки відкрите будь-яке `.modal-overlay:not(.hidden)`.
- Pixi 8: `g.rect(...).fill({...})`, шляхи `moveTo/lineTo` + один `stroke()`; `Text` зі спільним `TextStyle` — клонувати перед зміною кольору.
- Консоль Windows у cp1251: Python-скрипти з кирилицею — `sys.stdout.reconfigure(encoding="utf-8")`. Великі патчі через heredoc ламаються на лапках — писати скрипт у scratchpad і запускати `python -I`.
- `mv` інколи дає «Permission denied» (файл зайнятий) — не форсувати.

## Конвенції
- Українською: інтерфейс, коментарі, повідомлення. Коментарі — короткі «чому», у стилі сусіднього коду.
- Перед зміною файлу — копія `<файл>.bakN` (їх уже ~54 — можна перенести в `_to_delete/`). Видалення — лише в `_to_delete/` (у `.gitignore`).
- Новий вміст додається пакетом своєї епохи; кожен етап закінчується перевіркою (правила на тестовому світі + симуляції AI + погляд у грі) і позначкою в ROADMAP.
