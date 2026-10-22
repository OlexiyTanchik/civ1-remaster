# Civilization — ремастер 1991 у браузері

**▶ Грати: [demo URL — додати після публікації](#деплой)** · [English below](#english)

Вебверсія класичної покрокової стратегії Sid Meier's Civilization (1991): від одного поселенця 4000 р. до н.е. до польоту на Альфу Центавра. Правила оригіналу, піксельна графіка, AI-суперники, дипломатія, флот, авіація й космічна гонка. Без встановлення, просто в браузері.

![Розвинена імперія 1120 н.е.](docs/screenshots/game.png)

| Нова гра | Екран міста |
|---|---|
| ![Вибір цивілізації](docs/screenshots/new-game.png) | ![Місто з панорамою](docs/screenshots/city.png) |

## Що є в грі

- **Від Античності до космосу:** 84 технології в шести епохах, 50 видів юнітів, 35 споруд і 31 чудо світу. Кожна технологія відкриває щось нове, і нічого не з'являється «наперед».
- **Міста за правилами Civ 1:** їжа, щити й торгівля з клітинок, щастя й безлад, корупція, забруднення, торгові маршрути. Панорама міста змінюється з кожною спорудою.
- **Мапа, що змінюється від праці:** дороги, залізниця, зрошення, шахти й перетворення рельєфу. Туман війни, хатки племен, варвари.
- **AI-суперники:** 10 цивілізацій із власним характером. AI досліджує, будує, розвідує море, висаджує десанти, водить авіацію і вирішує, коли воювати.
- **Дипломатія:** зустрічі з лідерами, мир і війна, данина, обмін технологіями. Є посольства, дипломати й шпигуни (крадіжка, саботаж, підкуп міст), а напад під час миру лідери пам'ятають як зраду.
- **6 державних устроїв**, від Деспотизму до Демократії й Фундаменталізму, з революцією та анархією.
- **Космічна гонка й кінець гри:** перемога кораблем, завоюванням або рахунком у 2100 р. Є «Зал слави».
- **Для новачків:** покрокове навчання на перших ходах, поради радника, довідка `F1`.
- **Звук і музика** синтезуються в браузері (Web Audio) у дусі DOS-chiptune.
- **Збереження:** автоматичне після кожного ходу плюс 3 слоти в браузері. Три розміри мапи й п'ять рівнів складності.

## Технології

- **TypeScript** (strict) + **Vite 6** + **PixiJS 8**, без UI-фреймворку: інтерфейс складається з HTML-рядків і CSS у стилі DOS.
- **Графіка:** піксельні спрайти згенеровано моделлю Gemini за маніфестом (`assets_src/sprites.json`). Власний конвеєр на Python (`tools/process-sprites.py`) нарізає сітки, вирізає фон, зменшує, зводить до палітри, обводить контуром і пакує в атлас. Рельєф «запікається» на полотна шматками 16×16 клітинок: дизеринг біомів, береги, річки.
- **Розробка в парі з AI:** код написано разом з Claude Code. Дорожня карта, мапа проєкту й журнал рішень лежать у [`docs/ai/`](docs/ai/).

## Архітектура

- `src/core/` — чиста логіка гри без DOM: `World` (стан і правила між системами, кінець ходу, збереження), `CityLogic`, `Diplomacy`, `AiController` + `FleetAi`, дані (`constants.ts`), генератор мапи.
- `src/render/` — шари PixiJS: рельєф, покращення, міста, юніти, туман; атлас спрайтів.
- `src/ui/` — бічна панель, діалоги (місто, наука, дипломатія, космос), головне меню, навчання, звук.
- Логіка не залежить від рендера, тож AI-партії на сотні ходів ганяються в Node для перевірки балансу.

Детальніше: [`docs/ai/PROJECT_MAP.md`](docs/ai/PROJECT_MAP.md) (файли й правила) і [`docs/ai/ROADMAP.md`](docs/ai/ROADMAP.md) (етапи й результати симуляцій).

## Запуск

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # статична збірка в dist/
npm run preview   # перегляд збірки
```

## Деплой

Збірка використовує відносні шляхи (`base: './'`), тож `dist/` працює з будь-якого каталогу будь-якого статичного хостингу.

- **GitHub Pages:** воркфлоу [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) збирає й публікує гру при кожному пуші в `main`. Щоб його увімкнути: **Settings → Pages → Source: GitHub Actions**. Для приватного репозиторію Pages працює лише на платних планах GitHub, тож репозиторій треба зробити публічним або скористатися варіантом нижче.
- **Netlify / Vercel / Cloudflare Pages:** підключити репозиторій, команда збірки `npm run build`, каталог публікації `dist`.

Після публікації вкажіть URL демо вгорі цього файлу. Для прев'ю посилань у соцмережах також варто вписати повну адресу картинки в `og:image` в `index.html`.

## Правові примітки

Некомерційний фанатський проєкт. Civilization — торгова марка її правовласників, і цей проєкт з ними не пов'язаний.

---

<a id="english"></a>

# Civilization — a 1991 remaster for the browser

**▶ Play: [demo URL — add after publishing](#deployment)**

A web remake of Sid Meier's Civilization (1991), the classic turn-based strategy game. You lead one band of settlers in 4000 BC to a starship bound for Alpha Centauri. The game keeps the original rules and adds pixel-art graphics, AI rivals, diplomacy, naval and air warfare, and the space race. It runs in the browser with nothing to install.

## Features

- **From antiquity to the stars:** 84 technologies across six eras, 50 unit types, 35 city improvements and 31 Wonders of the World. Each one unlocks only when its technology is discovered.
- **Civ 1 city management:** food, production and trade from worked tiles, happiness and civil disorder, corruption, pollution and trade routes. Each city has a panorama that grows with its buildings.
- **A map shaped by your work:** roads, railroads, irrigation, mines and terraforming. Fog of war, tribal huts and barbarians.
- **AI rivals:** 10 civilizations, each led by a leader with their own personality. The AI researches, builds, scouts the seas, ferries invasions, flies air strikes and decides when to go to war.
- **Diplomacy:** leader meetings, war and peace, tribute and tech trading. Embassies, diplomats and spies can steal, sabotage and bribe, and leaders remember broken treaties.
- **6 governments**, from Despotism to Democracy and Fundamentalism, with revolutions and anarchy.
- **Space race and endgame:** win by spaceship, by conquest or by score in 2100. Past games go into a Hall of Fame.
- **Newcomer-friendly:** a step-by-step tutorial for the first turns, advisor tips, and an `F1` help screen.
- **Sound and music** are synthesized live with Web Audio in a DOS-chiptune style.
- **Saves:** an autosave every turn plus 3 manual slots in the browser. Three map sizes and five difficulty levels.

## Tech stack

- **TypeScript** (strict) + **Vite 6** + **PixiJS 8**. There is no UI framework: the interface is plain HTML templates styled as a DOS-era UI.
- **Art pipeline:** the pixel sprites were generated with Gemini from a sprite manifest. A Python pipeline then slices the grids, removes backgrounds, downscales, quantizes to a palette, outlines and packs everything into an atlas. Terrain is baked onto canvas chunks with dithered biomes, coastlines and rivers.
- **AI-assisted development:** the code was written together with Claude Code. The roadmap, project map and design notes are in [`docs/ai/`](docs/ai/).

## Architecture

- `src/core/` holds the DOM-free game logic: `World` (state, cross-system rules, turn processing, save/load), `CityLogic`, `Diplomacy`, `AiController` + `FleetAi`, the game data and the map generator.
- `src/render/` holds the PixiJS layers (terrain, improvements, cities, units, fog) and the sprite atlas.
- `src/ui/` holds the sidebar, dialogs, main menu, tutorial and audio.
- Because the logic is independent from rendering, balance is tested by running full AI-only games of hundreds of turns in Node.

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static build in dist/
npm run preview   # serve the build
```

<a id="deployment"></a>

## Deployment

The build uses relative paths, so `dist/` works from any folder on any static host.

- **GitHub Pages:** the included workflow builds and deploys on every push to `main`. To turn it on, set **Settings → Pages → Source: GitHub Actions**. Pages for private repositories requires a paid GitHub plan, so make the repo public or use one of the options below.
- **Netlify / Vercel / Cloudflare Pages:** connect the repo and set the build command to `npm run build` and the output directory to `dist`.

## Legal

This is a non-commercial fan project. Civilization is a trademark of its respective owners, and this project is not affiliated with them.
