/**
 * Точка входу веб-ремастеру Civilization 1 (1991).
 * Ініціалізація PixiJS, ігрового світу, рендерера та обробників подій.
 */
import { Application } from 'pixi.js';
import { SCENARIOS } from './core/scenarios';
import { World } from './core/world';
import { UNIT_CONFIGS, GOVERNMENTS, BUILDING_CONFIGS } from './core/constants';
import { GovernmentDialog } from './ui/government-dialog';
import { SpaceDialog } from './ui/space-dialog';
import { TurnManager } from './core/turn-manager';
import { GameOverDialog } from './ui/game-over-dialog';
import { GameMenuDialog } from './ui/game-menu-dialog';
import { HelpDialog } from './ui/help-dialog';
import { Tutorial } from './ui/tutorial';
import { StatsDialog } from './ui/stats-dialog';
import { recordTurn, noteMessage, historyOf } from './ui/history';
import { Achievements, AchievementsDialog } from './ui/achievements';
import { applyEntityNames, syncPlayerNames } from './i18n/entities';
import { DiplomacyDialog, MeetingDialog, DiplomatDialog } from './ui/diplomacy-dialog';
import { showMainMenu, MenuChoice } from './ui/main-menu';
import { saveGame, loadSave, takePendingLoad } from './ui/save-store';
import { MapRenderer } from './render/map-renderer';
import { Hud } from './ui/hud';
import { CityDialog } from './ui/city-dialog';
import { TechDialog } from './ui/tech-dialog';
import { SoundEffects } from './ui/sound-fx';
import { Unit, GameOptions } from './core/types';
import { SpriteAtlas } from './render/sprite-atlas';
import { TerrainBaker } from './render/terrain-baker';
import { TerraformKind, TERRAFORM_INFO } from './core/terraform';

/** Заставка з index.html: текст або сховати. Після показу чекаємо кадр — інакше важка генерація світу не дасть її намалювати. */
async function bootScreen(text?: string): Promise<void> {
  const el = document.getElementById('boot-loader');
  if (!el) return;
  el.classList.toggle('hidden', !text);
  if (!text) return;
  document.getElementById('boot-text')!.textContent = text;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * «Швидкий старт»: AI веде цивілізацію людини до 1000 н.е. (історію й хроніку теж пише),
 * потім керування переходить до гравця. Невдалий світ (людину знищено, мало міст) — генеруємо наново.
 */
async function quickStartWorld(options: GameOptions): Promise<World> {
  let w = new World(options);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) w = new World(options);
    w.players[0].isAi = true;
    recordTurn(w);
    while (w.turnManager.year < 1000 && !w.gameOver && w.players[0].alive) {
      // Шматками по 5 ходів — заставка встигає показати рік
      for (let i = 0; i < 5; i++) {
        const r = w.processTurnEnd();
        recordTurn(w);
        r.completedItems.forEach((m) => noteMessage(w, m));
      }
      await bootScreen(`⚡ Пишемо історію за вас: ${w.turnManager.getYearString()}…`);
    }
    const cities = [...w.cities.values()].filter((c) => c.playerId === 0).length;
    if (!w.gameOver && w.players[0].alive && cities >= 3) break;
  }
  w.players[0].isAi = false;
  // Зустрічі, що накопичились, поки за людину грав AI, — не показувати
  w.diplomacy.takeMeetings();
  w.uiData.quickStart = true;
  historyOf(w).events.push({ y: w.turnManager.year, text: '⚡ Швидкий старт: до цього року вашою цивілізацією правив AI-регент' });
  return w;
}

async function bootstrap() {
  // Мова: англійські назви юнітів, споруд, технологій і цивілізацій — до меню й світу
  applyEntityNames();
  const container = document.getElementById('canvas-container')!;
  const appElement = document.getElementById('app')!;

  // 0. Головне меню; після «Завантажити» в грі сторінка перезапускається одразу з потрібним слотом
  const pending = takePendingLoad();
  const pendingSave = pending ? loadSave(pending) : undefined;
  let choice: MenuChoice;
  if (pendingSave) {
    choice = { save: pendingSave };
  } else {
    await bootScreen();
    choice = await showMainMenu(appElement);
  }
  await bootScreen('save' in choice ? 'Відновлюємо світ…' : 'Творимо світ: континенти, річки, племена…');

  // 1. Ініціалізація графічного рушія PixiJS v8
  const app = new Application();
  await app.init({
    resizeTo: container,
    backgroundColor: 0x050811,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  container.appendChild(app.canvas);

  // Атлас піксель-арт спрайтів (рельєф, юніти, міста, ресурси)
  await SpriteAtlas.load();

  // 2. Створення світу та запікання рельєфу в шматки
  const world = 'save' in choice ? new World(undefined, choice.save) : choice.quick ? await quickStartWorld(choice.options) : new World(choice.options);
  syncPlayerNames(world.players);
  const terrainChunks = TerrainBaker.bake(world);
  const renderer = new MapRenderer(app, world, terrainChunks);
  const hud = new Hud(appElement, world, renderer);
  // Сценарій: мета — одразу в журнал
  if (world.scenario && !('save' in choice)) hud.addLogMessage(`📜 ${SCENARIOS[world.scenario.key].nameUa}: ${SCENARIOS[world.scenario.key].goalUa}`);
  const tutorial = new Tutorial(world);
  hud.tutorial = tutorial;
  // Вітання з HTML пасує лише новій партії
  if (!('save' in choice) && choice.quick) {
    const first = appElement.querySelector('.log-entry');
    if (first) first.textContent = `⚡ ${world.turnManager.getYearString()}: ваша імперія вже росте. Огляньте міста (клік по місту), «📊» — статистика, F1 — довідка.`;
  }
  if ('save' in choice) {
    const first = appElement.querySelector('.log-entry');
    if (first) first.textContent = `💾 Партію продовжено: ${world.turnManager.getYearString()}, хід ${world.turnManager.turnNumber}.`;
  }
  const cityDialog = new CityDialog(appElement, world, () => {
    renderer.refreshAll();
    hud.update(selectedUnit);
  });
  const techDialog = new TechDialog(appElement);
  const govDialog = new GovernmentDialog(appElement, world);
  const spaceDialog = new SpaceDialog(appElement, world);
  const gameOverDialog = new GameOverDialog(appElement, world);
  const gameMenu = new GameMenuDialog(appElement, world);
  const helpDialog = new HelpDialog(appElement);
  gameMenu.onHelp = () => helpDialog.show();
  // Історія партії: знімок показників щоходу й хроніка з журналу (у збереженні, через world.uiData)
  const statsDialog = new StatsDialog(appElement, world);
  gameMenu.onStats = () => statsDialog.show();
  hud.onOpenStats = () => statsDialog.show();
  recordTurn(world);
  // Досягнення: перевіряються з кожним повідомленням журналу (дія гравця) і після ходу
  const achievements = new Achievements(world);
  const achievementsDialog = new AchievementsDialog(appElement);
  gameMenu.onAchievements = () => achievementsDialog.show();
  hud.onMessage = (text) => {
    noteMessage(world, text);
    achievements.check();
  };
  const diplomacyDialog = new DiplomacyDialog(appElement, world, () => hud.update(selectedUnit));
  const meetingDialog = new MeetingDialog(appElement, world);
  const diplomatDialog = new DiplomatDialog(appElement, world);
  /** Зустрічі з лідерами, що накопичились за хід */
  const showMeetings = () => {
    const meetings = world.diplomacy.takeMeetings();
    if (meetings.length) meetingDialog.showAll(meetings, (text) => { SoundEffects.playForMessages([text]); hud.addLogMessage(text); hud.update(selectedUnit); });
  };
  // Збережену завершену партію не оголошуємо вдруге
  let gameOverShown = !!world.gameOver;

  let selectedUnit: Unit | undefined;
  // Хід, що порушить мир, — до повторного підтвердження
  let pendingTreachery: string | undefined;

  // Вибір першого юніта гравця
  function selectNextAvailableUnit(): void {
    selectedUnit = undefined;
    for (const unit of world.units.values()) {
      if (unit.playerId === 0 && unit.movesLeft > 0 && !unit.isFortified) {
        selectedUnit = unit;
        renderer.centerOn(unit.x, unit.y);
        break;
      }
    }
    hud.update(selectedUnit);
  }

  selectNextAvailableUnit();

  // 3. Обробка кліку по карті
  renderer.onTileClick = (tileX, tileY) => {
    const tile = world.tiles[tileY][tileX];

    // Якщо клікнули на власне місто - відкриваємо екран управління
    if (tile.cityId) {
      const city = world.cities.get(tile.cityId);
      if (city && city.playerId === 0) {
        tutorial.mark('city-opened');
        hud.update(selectedUnit);
        cityDialog.show(city);
        return;
      }
    }

    // Якщо клікнули на власного юніта - обираємо його
    if (tile.unitIds.length > 0) {
      const u = world.units.get(tile.unitIds[0]);
      if (u && u.playerId === 0) {
        selectedUnit = u;
        hud.update(selectedUnit);
        return;
      }
    }

    // Десантники в місті: клік по далекій клітинці — стрибок
    if (selectedUnit && UNIT_CONFIGS[selectedUnit.type].paradrop && world.distance(selectedUnit.x, selectedUnit.y, tileX, tileY) > 1) {
      const res = world.paradrop(selectedUnit.id, tileX, tileY);
      hud.addLogMessage(res.ok ? `🪂 ${UNIT_CONFIGS[selectedUnit.type].nameUa} висадилися з неба.` : `🪂 ${res.reason}`);
      renderer.refreshAll();
      if (res.ok) selectNextAvailableUnit();
      return;
    }

    // Якщо є обраний юніт і клікнули на сусідню клітинку - рухаємося
    moveSelected(tileX, tileY);
  };

  // Рух обраного юніта. Клавіатура кличе напряму: заходить і на клітинку зі своїм юнітом чи містом
  function moveSelected(tileX: number, tileY: number): void {
    if (!selectedUnit || selectedUnit.movesLeft <= 0) return;
    // Напад у мирі — зрада, яку пам'ятають усі AI: випадкова стрілка не повинна її починати
    const victim = world.peaceVictim(selectedUnit, tileX, tileY);
    const key = `${selectedUnit.id}:${tileX},${tileY}`;
    if (victim !== undefined && world.diplomacy.senateForbidsWar(0)) {
      hud.addLogMessage(`🏛️ Сенат забороняє порушувати мир із ${world.players[victim].nameUa} за Демократії.`);
      return;
    }
    if (victim !== undefined && pendingTreachery !== key) {
      pendingTreachery = key;
      hud.addLogMessage(`⚠️ У нас мир із ${world.players[victim].nameUa}. Напад — зрада, яку запам'ятають усі. Повторіть хід, щоб напасти.`);
      return;
    }
    pendingTreachery = undefined;
    const res = world.moveUnit(selectedUnit.id, tileX, tileY);
    if (res.diplomatCity) {
      const unitId = selectedUnit.id;
      diplomatDialog.show(unitId, res.diplomatCity, (text) => {
        if (text) hud.addLogMessage(text);
        renderer.refreshAll();
        selectNextAvailableUnit();
      });
      return;
    }
    showMeetings();
    if (!res.success) {
      if (res.event) hud.addLogMessage(res.event);
      return;
    }
    if (res.combatLog) {
      if (res.combatLog.includes('захоплено')) SoundEffects.playCapture();
      else SoundEffects.playCombat();
      hud.addLogMessage(`⚔️ ${res.combatLog}`);
    } else if (res.event) {
      SoundEffects.playFoundCity();
      hud.addLogMessage(res.event);
    } else {
      SoundEffects.playMove();
    }

    renderer.refreshAll();
    // Караван, що заснував маршрут у чужому місті, зник
    if (selectedUnit.movesLeft <= 0 || !world.units.has(selectedUnit.id)) {
      selectNextAvailableUnit();
    } else {
      hud.update(selectedUnit);
    }
  }

  // 4. Дії кнопок HUD
  hud.onBuildCity = () => {
    if (!selectedUnit) return;
    const city = world.foundCity(selectedUnit.id);
    if (city) {
      SoundEffects.playFoundCity();
      hud.addLogMessage(`🏛️ Засновано місто ${city.name}!`);
      renderer.refreshAll();
      selectNextAvailableUnit();
    }
  };

  hud.onTerraform = (kind) => {
    if (!selectedUnit) return;
    const res = world.startTask(selectedUnit.id, kind);
    if (!res.ok) {
      hud.addLogMessage(`⚠️ ${res.reason}`);
      return;
    }
    hud.addLogMessage(`⚒️ ${UNIT_CONFIGS[selectedUnit.type].nameUa} взялися до роботи: ${TERRAFORM_INFO[kind].nameUa.toLowerCase()}, ${res.turns} ход.`);
    renderer.refreshAll();
    selectNextAvailableUnit();
  };

  hud.onRatesChanged = () => {
    renderer.refreshAll(); // колір назв міст (безлад) залежить від розкоші
    hud.update(selectedUnit);
  };

  hud.onHelpWonder = () => {
    if (!selectedUnit) return;
    const res = world.helpWonder(selectedUnit.id);
    if (!res.ok) {
      hud.addLogMessage(`⚠️ ${res.reason}`);
      return;
    }
    hud.addLogMessage(`🐪 Караван віддав 50 щитів на чудо світу в місті ${res.city!.name}`);
    renderer.refreshAll();
    selectNextAvailableUnit();
  };

  hud.onTradeRoute = () => {
    if (!selectedUnit) return;
    const cityId = world.tiles[selectedUnit.y][selectedUnit.x].cityId;
    const res = cityId ? world.establishTradeRoute(selectedUnit.id, cityId) : { ok: false, reason: 'Потрібно бути в місті' };
    if (!res.ok) {
      hud.addLogMessage(`⚠️ ${res.reason}`);
      return;
    }
    SoundEffects.playFoundCity();
    hud.addLogMessage(res.text!);
    renderer.refreshAll();
    selectNextAvailableUnit();
  };

  hud.onGreatPerson = () => {
    if (!selectedUnit) return;
    const res = world.useGreatPerson(selectedUnit.id);
    hud.addLogMessage(res.ok ? res.text : `⚠️ ${res.text}`);
    if (!res.ok) return;
    renderer.refreshAll();
    selectNextAvailableUnit();
  };

  hud.onFortify = () => {
    if (!selectedUnit) return;
    selectedUnit.isFortified = true;
    selectedUnit.movesLeft = 0;
    hud.addLogMessage(`🛡️ Юніт укріпився на позиції.`);
    selectNextAvailableUnit();
  };

  hud.onWait = () => {
    // Шукаємо наступний юніт, відмінний від поточного
    let found = false;
    for (const unit of world.units.values()) {
      if (unit.playerId === 0 && unit.movesLeft > 0 && unit.id !== selectedUnit?.id) {
        selectedUnit = unit;
        renderer.centerOn(unit.x, unit.y);
        found = true;
        break;
      }
    }
    if (!found) selectNextAvailableUnit();
    hud.update(selectedUnit);
  };

  /** «Гаряче місце»: завіса між ходами людей — наступний гравець бачить лише свій світ. */
  function hotseatCurtain(): void {
    const p = world.players[0];
    const curtain = document.createElement('div');
    curtain.className = 'modal-overlay hotseat-curtain';
    curtain.style.cssText = 'background:#0b1020;z-index:9999';
    curtain.innerHTML = `
      <div class="tech-modal" style="max-width:420px;text-align:center">
        <h2>🪑 Хід гравця ${world.hotseat!.index + 1}</h2>
        <p><span class="mm-swatch" style="background:${p.color}"></span> <b>${p.nameUa}</b> — ${p.leaderUa}</p>
        <p class="modal-subtitle">Передайте пристрій. Решта — не підглядайте!</p>
        <button class="btn-primary" id="hotseat-go">▶ Почати хід</button>
      </div>`;
    appElement.appendChild(curtain);
    curtain.querySelector('#hotseat-go')!.addEventListener('click', () => curtain.remove());
  }

  /** Новий гравець 0 після передачі ходу: свій туман, свої юніти й зустрічі. */
  function startHumanTurn(): void {
    selectedUnit = undefined;
    renderer.refreshAll();
    selectNextAvailableUnit();
    hud.update(selectedUnit);
    showMeetings();
    hotseatCurtain();
  }

  hud.onEndTurn = () => {
    SoundEffects.playEndTurn();
    tutorial.mark('end-turn');
    // «Гаряче місце»: спершу ходять усі люди по черзі, потім — світ
    if (world.hotseat && world.humansAlive() > 1 && world.passHotseat() === 'player') {
      startHumanTurn();
      return;
    }
    const result = world.processTurnEnd();
    recordTurn(world);
    achievements.check();

    for (const item of result.completedItems) {
      hud.addLogMessage(`⚙️ ${item}`);
    }

    const news = [...result.completedItems];
    if (result.techDiscovered) news.push('💡');
    SoundEffects.playForMessages(news);

    if (result.techDiscovered) {
      hud.addLogMessage(`💡 Вчені відкрили технологію: ${result.techDiscovered}!`);
      techDialog.show(world.players[0], (tech) => {
        hud.addLogMessage(`🔬 Розпочато дослідження: ${tech.nameUa}`);
        hud.update(selectedUnit);
      });
    }

    renderer.refreshAll();
    selectNextAvailableUnit();
    // Екран міста — під діалогами дослідження й зустрічей, тож спершу видно їх
    const idle = result.idleCities.map((id) => world.cities.get(id)).filter((c) => c && c.playerId === 0);
    if (idle.length) {
      cityDialog.show(idle[0]!, `✅ Збудовано: ${BUILDING_CONFIGS[idle[0]!.buildings[idle[0]!.buildings.length - 1]].nameUa}. Оберіть, що будувати далі.`);
      for (const c of idle.slice(1)) hud.addLogMessage(`🏗️ ${c!.name}: оберіть, що будувати далі (зараз — Ополчення)`);
    }
    showMeetings();
    // Автозбереження щоходу
    const saveError = saveGame(world, 'auto');
    if (saveError) hud.addLogMessage(`⚠️ ${saveError}`);
    if (world.hotseat && world.humansAlive() > 1) hotseatCurtain();
    // Кінець гри показуємо один раз; далі можна дивитися на світ
    if (world.gameOver && !gameOverShown) {
      gameOverShown = true;
      gameOverDialog.show();
    }
  };

  hud.onOpenGameMenu = () => gameMenu.show();
  hud.onOpenDiplomacy = () => diplomacyDialog.show();

  hud.onDisband = () => {
    if (!selectedUnit) return;
    if (world.cargoOf(selectedUnit.id).length) {
      hud.addLogMessage('⚠️ Спершу висадіть пасажирів');
      return;
    }
    hud.addLogMessage(`🗑️ Розпущено: ${UNIT_CONFIGS[selectedUnit.type].nameUa}`);
    world.removeUnit(selectedUnit.id);
    selectedUnit = undefined;
    renderer.refreshAll();
    selectNextAvailableUnit();
  };

  hud.onRehome = () => {
    if (!selectedUnit) return;
    const city = world.rehome(selectedUnit.id);
    if (city) hud.addLogMessage(`🏠 ${UNIT_CONFIGS[selectedUnit.type].nameUa}: тепер утримує місто ${city.name}`);
    hud.update(selectedUnit);
  };

  hud.onOpenSpace = () => {
    spaceDialog.show(() => {
      SoundEffects.playLaunch();
      hud.addLogMessage(`🚀 Космічний корабель стартував до Альфи Центавра! Прибуття — ${TurnManager.formatYear(world.players[0].spaceship?.arrivalYear ?? 0)}`);
      hud.update(selectedUnit);
    });
  };

  hud.onOpenGovernment = () => {
    govDialog.show((gov) => {
      // Статуя Свободи міняє устрій без анархії
      hud.addLogMessage(world.players[0].government === gov
        ? `🗽 Новий устрій без анархії (Статуя Свободи): ${GOVERNMENTS[gov].nameUa}.`
        : `🔥 Революція! Два ходи анархії, потім — ${GOVERNMENTS[gov].nameUa}.`);
      renderer.refreshAll();
      hud.update(selectedUnit);
    });
  };

  hud.onOpenTechs = () => {
    techDialog.show(world.players[0], (tech) => {
      hud.addLogMessage(`🔬 Обрано дослідження: ${tech.nameUa}`);
      hud.update(selectedUnit);
    });
  };

  // Музика: браузер дає звук лише після жесту гравця, тож збережене «увімкнено» стартує з першим кліком чи клавішею
  hud.onToggleMusic = () => hud.updateMusicButton(SoundEffects.toggleMusic());
  if (SoundEffects.musicWanted()) {
    hud.updateMusicButton(true);
    const resume = () => {
      if (SoundEffects.musicWanted()) SoundEffects.startMusic();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  hud.onToggleGrid = () => {
    const isVisible = renderer.toggleGrid();
    hud.updateGridButton(isVisible);
    hud.addLogMessage(isVisible ? '📐 Тактичну сітку тайлів увімкнено.' : '📐 Тактичну сітку тайлів вимкнено.');
  };

  // 5. Гарячі клавіші (QoL керування)
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    // Поки відкрите вікно (місто, радник) — гарячі клавіші гри не працюють
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;

    if (e.key === 'F1' || e.key === '?') {
      e.preventDefault();
      helpDialog.show();
      return;
    }

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      hud.onEndTurn?.();
      return;
    }

    if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
      hud.onBuildCity?.();
      return;
    }
    // Роботи поселенців: R/I/M (та сама клавіша в українській розкладці)
    const tfKey: Record<string, TerraformKind> = { KeyR: 'road', KeyI: 'irrigation', KeyM: 'mine', KeyP: 'clean', KeyO: 'transform' };
    if (tfKey[e.code]) {
      hud.onTerraform?.(tfKey[e.code]);
      return;
    }
    if (e.code === 'KeyH') {
      hud.onHelpWonder?.();
      return;
    }
    if (e.code === 'KeyT') {
      hud.onTradeRoute?.();
      return;
    }
    if (e.code === 'KeyJ') {
      hud.onGreatPerson?.();
      return;
    }
    if (e.code === 'KeyD' && e.shiftKey) {
      hud.onDisband?.();
      return;
    }
    if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
      hud.onFortify?.();
      return;
    }
    if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
      hud.onWait?.();
      return;
    }
    if (e.key === 'g' || e.key === 'G' || e.key === 'п' || e.key === 'П') {
      hud.onToggleGrid?.();
      return;
    }

    // Рух юніта стрілками клавіатури або WASD / Numpad
    if (!selectedUnit || selectedUnit.movesLeft <= 0) return;

    let dx = 0;
    let dy = 0;

    switch (e.key) {
      case 'ArrowUp':
      case '8':
        dy = -1;
        break;
      case 'ArrowDown':
      case '2':
        dy = 1;
        break;
      case 'ArrowLeft':
      case '4':
        dx = -1;
        break;
      case 'ArrowRight':
      case '6':
        dx = 1;
        break;
      case '7': // Верх-ліво
        dx = -1;
        dy = -1;
        break;
      case '9': // Верх-право
        dx = 1;
        dy = -1;
        break;
      case '1': // Низ-ліво
        dx = -1;
        dy = 1;
        break;
      case '3': // Низ-право
        dx = 1;
        dy = 1;
        break;
    }

    if (dx !== 0 || dy !== 0) {
      e.preventDefault();
      moveSelected(selectedUnit.x + dx, selectedUnit.y + dy);
    }
  });

  // 6. Ігровий цикл PixiJS (лише плавна анімація камери та курсору)
  app.ticker.add(() => {
    renderer.renderFrame(selectedUnit);
  });
  void bootScreen();
}

bootstrap().catch((e) => {
  console.error(e);
  // Відвідувач без WebGL чи з блокованим сховищем має бачити причину, а не чорний екран
  void bootScreen(`⚠️ Гру не вдалося запустити: ${e instanceof Error ? e.message : e}. Спробуйте інший браузер.`);
});
