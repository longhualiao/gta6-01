// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, wasted, busted. Progress (money, missions, best run) saves to
// localStorage after every mission and on pause.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|title|beach (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP, WORLD } from './config.js';
import { createRandom, hashSeed } from './random.js';
import { generateCity } from './city.js';
import { createAudio } from './audio.js';
import { createInput, ACTION } from './input.js';
import { createEntities, updateEntities, cleanupPolice } from './entities.js';
import { createPlayer, updatePlayer } from './player.js';
import { createMissions, updateMissions, missionMarker, missionObjective, startMission, currentMission } from './missions.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WASTED, SCREEN_BUSTED } from './render.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'solmar-city-save-v1';
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 250, missions: 0, best: 0 };
    const data = JSON.parse(raw);
    return { money: data.money || 250, missions: data.missions || 0, best: data.best || 0 };
  } catch {
    return { money: 250, missions: 0, best: 0 };
  }
}

function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

function createGame(seedValue) {
  const rng = createRandom(seedValue);
  const city = generateCity(rng);
  const game = {
    rng,
    city,
    audio: createAudio(),
    input: null,
    entities: null,
    player: null,
    missions: null,
    camera: { x: city.safehouse.x, y: city.safehouse.y },
    view: { w: 1280, h: 720 },
    time: 0,
    clockMin: 10 * 60 + 24,
    hudMessage: '',
    hudMessageT: 0,
    missionMarker: null,
    objectiveText: '',
    clockText: '10:24',
    save: loadSave(),
    titleRng: createRandom(hashSeed('solmar-skyline')),
    state: { screen: SCREEN_TITLE, missionBanner: null, wasted: false, busted: false },
  };
  game.entities = createEntities(city, rng);
  game.player = createPlayer(city);
  game.player.money = game.save.money;
  game.player.missionsDone = game.save.missions;
  game.missions = createMissions();
  game.missions.index = Math.min(game.save.missions, 5);
  return game;
}

const game = createGame(seed);
game.input = createInput(canvas);
window.__solmar = game; // inspection hook: live state for play-testing

function resize() {
  game.view.w = window.innerWidth;
  game.view.h = window.innerHeight;
  renderer.resize(game.view.w, game.view.h);
}
window.addEventListener('resize', resize);
resize();

function updateClock() {
  const total = game.clockMin + game.time * 2;
  const hh = Math.floor(total / 60) % 24;
  const mm = Math.floor(total % 60);
  game.clockText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function saveProgress() {
  game.save.money = game.player.money;
  game.save.missions = game.player.missionsDone;
  game.save.best = Math.max(game.save.best, game.player.money);
  storeSave(game.save);
}

/** One fixed simulation step. */
game.step = function step(dt) {
  game.time += dt;
  updateClock();
  if (game.hudMessageT > 0) game.hudMessageT -= dt;
  if (game.hudMessageT <= 0) game.hudMessage = '';
  if (game.state.missionBanner) {
    game.state.missionBanner.t -= dt;
    if (game.state.missionBanner.t <= 0) game.state.missionBanner = null;
  }
  updatePlayer(game, dt);
  updateEntities(game, dt);
  updateMissions(game, dt);
  cleanupPolice(game);
  // Camera follows the player (or their car) with a little look-ahead.
  const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
  const lookX = game.player.inCar && game.player.car ? Math.cos(game.player.car.angle) * 60 : 0;
  const lookY = game.player.inCar && game.player.car ? Math.sin(game.player.car.angle) * 60 : 0;
  const tx = Math.max(game.view.w / 2, Math.min(WORLD - game.view.w / 2, px + lookX));
  const ty = Math.max(game.view.h / 2, Math.min(WORLD - game.view.h / 2, py + lookY));
  game.camera.x += (tx - game.camera.x) * Math.min(1, 5 * dt);
  game.camera.y += (ty - game.camera.y) * Math.min(1, 5 * dt);
  game.missionMarker = missionMarker(game);
  game.objectiveText = missionObjective(game.missions);
  if (game.state.wasted) game.state.screen = SCREEN_WASTED;
  if (game.state.busted) game.state.screen = SCREEN_BUSTED;
  // Autosave after each completed mission.
  if (game.player.missionsDone !== game.save.missions) saveProgress();
};

function resetRun() {
  const fresh = createGame(seed);
  game.entities = fresh.entities;
  game.player = fresh.player;
  game.missions = fresh.missions;
  game.time = 0;
  game.state = { screen: SCREEN_PLAY, missionBanner: null, wasted: false, busted: false };
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.audio.startMusic();
}

function handleKeys() {
  const input = game.input;
  if (input.wasPressed(ACTION.MUTE)) {
    const muted = game.audio.toggleMute();
    game.hudMessage = muted ? 'Sound off' : 'Sound on';
    game.hudMessageT = 2;
  }
  if (game.state.screen === SCREEN_TITLE) {
    if (input.wasPressed(ACTION.CONFIRM) || input.anyKeyPressed()) {
      game.audio.unlock();
      game.audio.startMusic();
      game.state.screen = SCREEN_PLAY;
    }
    return;
  }
  if (game.state.screen === SCREEN_WASTED || game.state.screen === SCREEN_BUSTED) {
    if (input.wasPressed(ACTION.CONFIRM)) {
      saveProgress();
      resetRun();
    }
    return;
  }
  if (input.wasPressed(ACTION.PAUSE)) {
    if (game.state.screen === SCREEN_PLAY) {
      game.state.screen = SCREEN_PAUSED;
      saveProgress();
    } else if (game.state.screen === SCREEN_PAUSED) {
      game.state.screen = SCREEN_PLAY;
    }
    return;
  }
  if (game.state.screen === SCREEN_PLAY) {
    if (input.wasPressed(ACTION.CONFIRM) && !game.missions.active && currentMission(game.missions)) {
      startMission(game);
    }
  }
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  resize();
  runShot(shot);
} else {
  let last = performance.now();
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handleKeys();
    if (game.state.screen === SCREEN_PLAY) {
      let remaining = elapsed;
      while (remaining > 0) {
        const dt = Math.min(STEP, remaining);
        try {
          game.step(dt);
        } catch (err) {
          // One bad step must never kill the whole game loop.
          console.error('step failed:', err);
        }
        remaining -= dt;
      }
    } else {
      game.time += elapsed;
      updateClock();
    }
    renderer.draw(game, game.state.screen);
    status.textContent = game.objectiveText;
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
