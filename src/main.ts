/**
 * Точка входу веб-ремастеру Civilization 1 (1991).
 * Ініціалізація PixiJS, ігрового світу, рендерера та обробників подій.
 */
import { Application } from 'pixi.js';
import { World } from './core/world';
import { UNIT_CONFIGS, GOVERNMENTS } from './core/constants';
import { GovernmentDialog } from './ui/government-dialog';
import { SpaceDialog } from './ui/space-dialog';
import { TurnManager } from './core/turn-manager';
import { GameOverDialog } from './ui/game-over-dialog';
import { GameMenuDialog } from './ui/game-menu-dialog';
import { DiplomacyDialog, MeetingDialog, DiplomatDialog } from './ui/diplomacy-dialog';
import { showMainMenu, MenuChoice } from './ui/main-menu';
import { saveGame, loadSave, takePendingLoad } from './ui/save-store';
import { MapRenderer } from './render/map-renderer';
import { Hud } from './ui/hud';
import { CityDialog } from './ui/city-dialog';
import { TechDialog } from './ui/tech-dialog';
import { SoundEffects } from './ui/sound-fx';
import { Unit } from './core/types';
import { SpriteAtlas } from './render/sprite-atlas';
import { TerrainBaker } from './render/terrain-baker';
import { TerraformKind, TERRAFORM_INFO } from './core/terraform';

async function bootstrap() {
  const container = document.getElementById('canvas-container')!;
  const appElement = document.getElementById('app')!;

  // 0. Головне меню; після «Завантажити» в грі сторінка перезапускається одразу з потрібним слотом
  const pending = takePendingLoad();
  const pendingSave = pending ? loadSave(pending) : undefined;
  const choice: MenuChoice = pendingSave ? { save: pendingSave } : await showMainMenu(appElement);

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
  const world = 'save' in choice ? new World(undefined, choice.save) : new World(choice.options);
  const terrainChunks = TerrainBaker.bake(world);
  const renderer = new MapRenderer(app, world, terrainChunks);
  const hud = new Hud(appElement, world, renderer);
  // Вітання з HTML пасує лише новій партії
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

    // Якщо є обраний юніт і клікнули на сусідню клітинку - рухаємося
    moveSelected(tileX, tileY);
  };

  // Рух обраного юніта. Клавіатура кличе напряму: заходить і на клітинку зі своїм юнітом чи містом
  function moveSelected(tileX: number, tileY: number): void {
    if (!selectedUnit || selectedUnit.movesLeft <= 0) return;
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
    if (!res.success) return;
    if (res.combatLog) {
      if (res.combatLog.includes('захопили')) SoundEffects.playCapture();
      else SoundEffects.playCombat();
      hud.addLogMessage(`⚔️ ${res.combatLog}`);
    } else if (res.event) {
      SoundEffects.playFoundCity();
      hud.addLogMessage(res.event);
    } else {
      SoundEffects.playMove();
    }

    renderer.refreshAll();
    if (selectedUnit.movesLeft <= 0) {
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

  hud.onEndTurn = () => {
    SoundEffects.playEndTurn();
    const result = world.processTurnEnd();

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
    showMeetings();
    // Автозбереження щоходу
    const saveError = saveGame(world, 'auto');
    if (saveError) hud.addLogMessage(`⚠️ ${saveError}`);
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
      hud.addLogMessage(`🔥 Революція! Два ходи анархії, потім — ${GOVERNMENTS[gov].nameUa}.`);
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
    const tfKey: Record<string, TerraformKind> = { KeyR: 'road', KeyI: 'irrigation', KeyM: 'mine', KeyP: 'clean' };
    if (tfKey[e.code]) {
      hud.onTerraform?.(tfKey[e.code]);
      return;
    }
    if (e.code === 'KeyH') {
      hud.onHelpWonder?.();
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
}

bootstrap().catch(console.error);
