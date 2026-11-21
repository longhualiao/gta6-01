// Deterministic screenshot scenes behind ?shot=chase|street|title|beach.
// Each one stages a real game state (a chase, a street on foot, the title, a
// beach drive), then steps the simulation forward with a scripted driver, so
// the frame is what the game really looks like and the same seed gives the
// same frame.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { makeCar, spawnPolice } from './entities.js';
import { startMission } from './missions.js';
import { addWanted } from './player.js';

function scriptedInput(moves) {
  let frame = 0;
  const mouse = { x: 640, y: 360, down: false, clicked: false };
  return {
    mouse,
    isDown() { return false; },
    wasPressed() { return false; },
    consume() {},
    moveVector() { return moves(frame++); },
    anyKeyPressed() { return false; },
    endFrame() {},
  };
}

/** Drive toward a point: up = forward, left/right to steer. */
function driveToward(game, tx, ty) {
  const car = game.player.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return () => ({ x: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, y: -1 });
}

/** Walk toward a point. */
function walkToward(game, tx, ty) {
  return () => {
    const dx = tx - game.player.x; const dy = ty - game.player.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };
}

function snapCamera(game) {
  const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
  game.camera.x = Math.max(game.view.w / 2, Math.min(5200 - game.view.w / 2, px));
  game.camera.y = Math.max(game.view.h / 2, Math.min(5200 - game.view.h / 2, py));
}

function runSteps(game, seconds, moves) {
  const fake = scriptedInput(moves);
  const real = game.input;
  game.input = fake;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(STEP);
  game.input = real;
  snapCamera(game);
}

function stageChase(game) {
  // Player in a yellow sportscar tearing east down the avenue, two police cars
  // in pursuit behind, three wanted stars, mission one live: drive to the club.
  // Clear the chase road of traffic and pedestrians so the run is clean.
  game.entities.cars = game.entities.cars.filter((c) => !(c.y > 880 && c.y < 1120 && c.x > 1100 && c.x < 4700));
  game.entities.peds = game.entities.peds.filter((q) => !(q.y > 880 && q.y < 1120 && q.x > 1100 && q.x < 4700));
  const car = makeCar(game.rng, 1400, 1000, 0, 'sport');
  car.driver = 'player';
  car.color = '#ff6b35';
  car.speed = 500;
  car.wasStolen = true;
  game.entities.cars.push(car);
  game.player.inCar = true;
  game.player.car = car;
  game.player.x = car.x; game.player.y = car.y;
  game.player.money = 1250;
  game.player.carsStolen = 1;
  addWanted(game, 3);
  startMission(game);
  // No extra units from the wanted logic while staging: these two are the shot.
  game.player.spawnTimer = 999;
  game.player.copTimer = 999;
  // Two units in pursuit, staggered behind on the same road, already at speed.
  for (let i = 0; i < 2; i += 1) {
    const cop = makeCar(game.rng, 1000 - i * 140, 1000 + (i === 0 ? -34 : 34), 0, 'police');
    cop.driver = 'police';
    cop.targetSpeed = 620;
    cop.speed = 620;
    cop.chaseOffset = i === 0 ? -40 : 40;
    game.entities.police.push(cop);
    game.entities.cars.push(cop);
  }
  runSteps(game, 3, driveToward(game, 4600, 1000));
  // Frame the player right of centre so the pursuit reads behind them.
  game.camera.x = Math.max(game.view.w / 2, game.camera.x - 260);
  return { screen: SCREEN_PLAY };
}

function stageStreet(game) {
  // On foot at the marina, pistol out, three debtors to deal with (mission five
  // live), a police car closing in, traffic and pedestrians around.
  game.player.x = 4400; game.player.y = 3400;
  game.player.angle = 0;
  game.player.money = 540;
  game.player.weapon = 'pistol';
  addWanted(game, 1);
  game.missions.index = 4;
  startMission(game);
  spawnPolice(game, 1);
  runSteps(game, 4, walkToward(game, 4600, 3400));
  return { screen: SCREEN_PLAY };
}

function stageBeach(game) {
  // Sunset cruise south down the beach road, ocean on the right, palms along
  // the sand, marina job live.
  const car = makeCar(game.rng, 4600, 3000, Math.PI / 2, 'sedan');
  car.driver = 'player';
  car.color = '#e8e8e8';
  car.speed = 380;
  car.wasStolen = true;
  game.entities.cars.push(car);
  game.player.inCar = true;
  game.player.car = car;
  game.player.x = car.x; game.player.y = car.y;
  game.player.money = 3400;
  game.player.missionsDone = 4;
  game.missions.index = 4;
  startMission(game);
  runSteps(game, 3, driveToward(game, 4600, 4200));
  return { screen: SCREEN_PLAY };
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Unknown names stage the title.
 */
export function stageShot(name, game) {
  game.state.screen = SCREEN_PLAY;
  if (name === 'chase') return stageChase(game);
  if (name === 'street') return stageStreet(game);
  if (name === 'beach') return stageBeach(game);
  game.state.screen = SCREEN_TITLE;
  return { screen: SCREEN_TITLE };
}
