// Vehicles, traffic, pedestrians and police: the living city.
// Cars follow the road grid, pedestrians stroll the sidewalks, and the police
// chase the player when the wanted level rises.
import { WORLD, CAR, TRAFFIC_SPEED, POLICE_SPEED } from './config.js';
import { randInt, randRange, pick } from './random.js';
import { collideBuildings, clampWorld, nearestRoadPoint } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33d', '#e8e8e8', '#2f2f38', '#7ab648', '#c96fd0', '#e08a3d', '#8fb8c9'];
const TAXI_COLOR = '#f2c230';
const TRUCK_COLORS = ['#b8b0a0', '#7d8fb3', '#a05a4f'];

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function makeCar(rng, x, y, angle, kind) {
  const color = kind === 'taxi' ? TAXI_COLOR : kind === 'truck' ? pick(rng, TRUCK_COLORS) : kind === 'police' ? '#1c2733' : pick(rng, CAR_COLORS);
  return {
    x, y, angle, speed: 0, color, kind: kind || 'sedan',
    health: CAR.health, driver: 'parked', route: [], routeIndex: 0,
    targetSpeed: 0, stuck: 0, siren: 0, smoke: 0, id: Math.floor(rng() * 1e9),
  };
}

/** A random adjacent intersection to drive to next. */
function nextIntersection(city, rng, x, y) {
  const lines = city.lines;
  const near = lines.reduce((best, line) => (Math.abs(line - x) < Math.abs(best - x) ? line : best), lines[0]);
  const nearY = lines.reduce((best, line) => (Math.abs(line - y) < Math.abs(best - y) ? line : best), lines[0]);
  const options = [];
  const ix = lines.indexOf(near);
  const iy = lines.indexOf(nearY);
  if (ix > 0) options.push({ x: lines[ix - 1], y: nearY });
  if (ix < lines.length - 1) options.push({ x: lines[ix + 1], y: nearY });
  if (iy > 0) options.push({ x: near, y: lines[iy - 1] });
  if (iy < lines.length - 1) options.push({ x: near, y: lines[iy + 1] });
  return options.length ? pick(rng, options) : { x: near, y: nearY };
}

export function createEntities(city, rng) {
  const cars = [];
  // Parked cars along roads and in lots.
  for (let i = 0; i < 26; i += 1) {
    const spot = city.spawns[Math.floor(rng() * city.spawns.length)];
    const along = rng() < 0.5;
    const x = along ? spot.x + randRange(rng, -140, 140) : spot.x + (rng() < 0.5 ? -58 : 58);
    const y = along ? spot.y + (rng() < 0.5 ? -58 : 58) : spot.y + randRange(rng, -140, 140);
    const kind = rng() < 0.08 ? 'truck' : rng() < 0.15 ? 'taxi' : 'sedan';
    cars.push(makeCar(rng, x, y, along ? 0 : Math.PI / 2, kind));
  }
  for (const lot of city.parking.slice(0, 8)) {
    cars.push(makeCar(rng, lot.x, lot.y, 0, rng() < 0.1 ? 'sport' : 'sedan'));
  }
  // Moving traffic.
  for (let i = 0; i < 22; i += 1) {
    const spot = city.spawns[Math.floor(rng() * city.spawns.length)];
    const car = makeCar(rng, spot.x, spot.y, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng() < 0.1 ? 'taxi' : 'sedan');
    car.driver = 'traffic';
    car.targetSpeed = randRange(rng, TRAFFIC_SPEED * 0.75, TRAFFIC_SPEED * 1.1);
    car.route = [nextIntersection(city, rng, car.x, car.y)];
    cars.push(car);
  }
  const peds = [];
  for (let i = 0; i < 40; i += 1) {
    const spot = city.spawns[Math.floor(rng() * city.spawns.length)];
    peds.push(makePed(rng, spot.x + randRange(rng, -120, 120), spot.y + randRange(rng, -120, 120)));
  }
  return { cars, peds, police: [], effects: [], pickups: [] };
}

export function makePed(rng, x, y) {
  return {
    x, y, angle: randRange(rng, 0, Math.PI * 2), speed: randRange(rng, 28, 55),
    target: null, state: 'walk', health: 30, panic: 0, dead: false,
    color: pick(rng, ['#e8b04b', '#5fa8a0', '#c96f7a', '#7d8fb3', '#8fae6b', '#d97b4f', '#b08968']),
    shirt: pick(rng, ['#d94f3d', '#3d7bd9', '#e8e8e8', '#2f2f38', '#7ab648', '#c96fd0']),
    timer: randRange(rng, 0, 4),
  };
}

/** Spawn a police car near the player, on a road. */
export function spawnPolice(game, count) {
  const { city, rng, player } = game;
  for (let i = 0; i < count; i += 1) {
    const spot = nearestRoadPoint(city, player.x + randRange(rng, -700, 700), player.y + randRange(rng, -700, 700));
    const car = makeCar(rng, spot.x, spot.y, 0, 'police');
    car.driver = 'police';
    car.targetSpeed = POLICE_SPEED;
    car.chaseOffset = (i % 2 === 0 ? -1 : 1) * (36 + i * 18);
    game.entities.police.push(car);
    game.entities.cars.push(car);
  }
}

/** Spawn a foot cop near the player. */
export function spawnCop(game) {
  const { city, rng, player } = game;
  const spot = nearestRoadPoint(city, player.x + randRange(rng, -300, 300), player.y + randRange(rng, -300, 300));
  const cop = makePed(rng, spot.x, spot.y);
  cop.state = 'cop';
  cop.speed = 200;
  cop.color = '#1c2733';
  cop.shirt = '#243447';
  game.entities.peds.push(cop);
}

function steerToward(car, tx, ty, dt, maxTurn) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  car.angle = angleLerp(car.angle, want, Math.min(1, maxTurn * dt));
}

function moveCar(game, car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const body = { x: car.x, y: car.y, r: 24 };
  if (collideBuildings(game.city, body)) {
    car.x = body.x; car.y = body.y;
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 120) game.audio.crash();
    car.health -= Math.abs(car.speed) * 0.02;
    car.smoke = 1;
  }
  clampWorld(body);
  car.x = body.x; car.y = body.y;
}

function updateTrafficCar(game, car, dt) {
  const target = car.route[0];
  if (!target) return;
  const dx = target.x - car.x; const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) {
    car.route[0] = nextIntersection(game.city, game.rng, car.x, car.y);
    return;
  }
  steerToward(car, target.x, target.y, dt, 3.2);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) < 0.5) car.speed += (car.targetSpeed - car.speed) * Math.min(1, 1.6 * dt);
  else car.speed += (0 - car.speed) * Math.min(1, 2.5 * dt);
  moveCar(game, car, dt);
}

function updatePoliceCar(game, car, dt) {
  const player = game.player;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  // Each unit aims at its own lane offset beside the player, so the pack
  // fans out instead of piling onto one point.
  const perp = (player.inCar && player.car ? player.car.angle : player.angle) + Math.PI / 2;
  const off = car.chaseOffset || 0;
  const tx = px + Math.cos(perp) * off;
  const ty = py + Math.sin(perp) * off;
  const dx = tx - car.x; const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  steerToward(car, tx, ty, dt, 3.8);
  car.speed += (car.targetSpeed - car.speed) * Math.min(1, 1.8 * dt);
  if (dist > 1400) car.targetSpeed = POLICE_SPEED * 1.15;
  moveCar(game, car, dt);
  car.siren += dt;
  if (car.siren > 0.9) { car.siren = 0; game.audio.siren(); }
  // Ram the player: damage their car or knock them down.
  if (dist < 46) {
    if (player.inCar && player.car) {
      player.car.health -= 14 * dt * 10;
      player.car.speed *= 0.96;
      game.audio.crash();
      addEffect(game, car.x, car.y, 'spark');
    } else if (player.bustedTimer <= 0) {
      player.bustedTimer += dt;
      if (player.bustedTimer > 1.2) game.state.busted = true;
    }
  }
}

export function updateEntities(game, dt) {
  const { entities, rng } = game;
  // Traffic and police cars.
  for (const car of entities.cars) {
    if (car.driver === 'traffic') updateTrafficCar(game, car, dt);
    else if (car.driver === 'police') updatePoliceCar(game, car, dt);
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.driver = 'wreck';
      addEffect(game, car.x, car.y, 'explosion');
      game.audio.crash();
    }
    if (car.smoke > 0) car.smoke = Math.max(0, car.smoke - dt * 0.4);
  }
  // Car-car collisions: soft circles, push apart and trade speed.
  for (let i = 0; i < entities.cars.length; i += 1) {
    for (let j = i + 1; j < entities.cars.length; j += 1) {
      const a = entities.cars[i]; const b = entities.cars[j];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 48) {
        const push = (48 - d) / 2;
        const nx = dx / d; const ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.85; b.speed = avg * 0.85;
        if (Math.abs(avg) > 200) game.audio.crash();
      }
    }
  }
  // Pedestrians.
  for (const ped of entities.peds) {
    if (ped.dead) continue;
    ped.timer -= dt;
    if (ped.state === 'cop') {
      const dx = game.player.x - ped.x; const dy = game.player.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (game.player.inCar) {
        ped.state = 'walk';
      } else if (dist < 26) {
        game.player.bustedTimer += dt * 2;
        if (game.player.bustedTimer > 1.2) game.state.busted = true;
      } else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      continue;
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.cos(ped.angle) * ped.speed * 2.6 * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * 2.6 * dt;
    } else if (ped.timer <= 0) {
      ped.timer = randRange(rng, 2, 6);
      const spot = game.city.spawns[Math.floor(rng() * game.city.spawns.length)];
      ped.target = { x: spot.x + randRange(rng, -100, 100), y: spot.y + randRange(rng, -100, 100) };
    }
    if (ped.target && ped.panic <= 0) {
      const dx = ped.target.x - ped.x; const dy = ped.target.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) { ped.target = null; }
      else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    const body = { x: ped.x, y: ped.y, r: 12 };
    collideBuildings(game.city, body);
    ped.x = body.x; ped.y = body.y;
    clampWorld(body);
    ped.x = body.x; ped.y = body.y;
  }
  // Effects decay.
  for (let i = entities.effects.length - 1; i >= 0; i -= 1) {
    const fx = entities.effects[i];
    fx.life -= dt;
    fx.x += fx.vx * dt; fx.y += fx.vy * dt;
    if (fx.life <= 0) entities.effects.splice(i, 1);
  }
  // Pickups (cash, health, ammo) drift and expire.
  for (let i = entities.pickups.length - 1; i >= 0; i -= 1) {
    const pk = entities.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) entities.pickups.splice(i, 1);
  }
}

export function addEffect(game, x, y, kind) {
  const fx = { x, y, kind, life: kind === 'explosion' ? 0.9 : 0.4, vx: 0, vy: 0 };
  if (kind === 'explosion') {
    for (let i = 0; i < 14; i += 1) {
      game.entities.effects.push({
        x, y, kind: 'spark', life: 0.5 + game.rng() * 0.4,
        vx: (game.rng() - 0.5) * 420, vy: (game.rng() - 0.5) * 420,
      });
    }
  }
  game.entities.effects.push(fx);
}

export function addPickup(game, x, y, kind, value) {
  game.entities.pickups.push({ x, y, kind, value, life: 25 });
}

/** Scare nearby pedestrians (gunfire, explosions). */
export function scarePeds(game, x, y, radius) {
  for (const ped of game.entities.peds) {
    if (ped.dead || ped.state === 'cop') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.panic = 3 + game.rng() * 2;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

/** Count of police currently hunting the player. */
export function policeCount(game) {
  return game.entities.police.filter((c) => !c.wrecked).length;
}

/** Remove wrecked police cars that are far away; they stop counting. */
export function cleanupPolice(game) {
  const px = game.player.x; const py = game.player.y;
  for (let i = game.entities.police.length - 1; i >= 0; i -= 1) {
    const car = game.entities.police[i];
    if (car.wrecked && Math.hypot(car.x - px, car.y - py) > 1200) {
      game.entities.police.splice(i, 1);
      const idx = game.entities.cars.indexOf(car);
      if (idx >= 0) game.entities.cars.splice(idx, 1);
    }
  }
}
