// The player: on foot and behind the wheel, combat, stealing cars, the wanted
// system, and the busted / wasted endings.
import { PLAYER, CAR, WANTED_MAX, WANTED_DECAY } from './config.js';
import { ACTION } from './input.js';
import { collideBuildings, clampWorld, inOcean } from './city.js';
import { spawnPolice, spawnCop, policeCount, addEffect, scarePeds, addPickup } from './entities.js';

export function createPlayer(city) {
  return {
    x: city.safehouse.x, y: city.safehouse.y, angle: -Math.PI / 2,
    health: PLAYER.health, money: 250, inCar: false, car: null,
    weapon: 'fists', ammo: { pistol: PLAYER.pistolAmmo, rifle: PLAYER.rifleAmmo },
    fireTimer: 0, punchTimer: 0, wanted: 0, wantedFloat: 0,
    bustedTimer: 0, lastCrime: -999, spawnTimer: 0, copTimer: 0,
    kills: 0, carsStolen: 0, missionsDone: 0,
  };
}

/** Raise the wanted level by whole stars, clamped to the max. */
export function addWanted(game, stars) {
  const p = game.player;
  p.wantedFloat = Math.min(WANTED_MAX, p.wantedFloat + stars);
  p.wanted = Math.floor(p.wantedFloat);
  p.lastCrime = game.time;
}

function nearestCar(game, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of game.entities.cars) {
    if (car.driver === 'police' || car.wrecked) continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(game, car) {
  const p = game.player;
  p.inCar = true;
  p.car = car;
  car.driver = 'player';
  if (!car.wasStolen) {
    car.wasStolen = true;
    p.carsStolen += 1;
    addWanted(game, 1);
    game.hudMessage = 'Car stolen! The cops are on their way.';
  }
  game.audio.horn();
}

function exitCar(game) {
  const p = game.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = 'parked';
  car.speed *= 0.3;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.inCar = false;
  p.car = null;
}

function driveCar(game, car, dt) {
  const input = game.input;
  const move = input.moveVector();
  const forward = move.y < 0 ? 1 : move.y > 0 ? -0.55 : 0;
  const steering = move.x;
  if (forward !== 0) {
    const accel = forward > 0 ? CAR.accel : CAR.reverseAccel;
    car.speed += forward * accel * dt * (forward > 0 ? 1 : 1);
    if (input.isDown(ACTION.BRAKE)) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
  } else {
    car.speed -= car.speed * Math.min(1, 1.2 * dt);
    if (input.isDown(ACTION.BRAKE)) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
  }
  const max = car.kind === 'truck' ? CAR.maxSpeed * 0.7 : car.kind === 'sport' ? CAR.maxSpeed * 1.15 : CAR.maxSpeed;
  car.speed = Math.max(-CAR.maxReverse, Math.min(max, car.speed));
  const turn = steering * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25) * Math.sign(car.speed || 1);
  car.angle += turn;
  // Skid marks at speed with hard steering.
  if (Math.abs(car.speed) > 300 && Math.abs(steering) > 0.5 && game.rng() < 0.5) {
    addEffect(game, car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26, 'skid');
  }
  // Move with building collision.
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const body = { x: nx, y: ny, r: 24 };
  if (collideBuildings(game.city, body)) {
    if (Math.abs(car.speed) > 200) {
      game.audio.crash();
      addEffect(game, nx, ny, 'spark');
      car.health -= Math.abs(car.speed) * 0.03;
    }
    car.speed *= 0.35;
  }
  car.x = body.x; car.y = body.y;
  clampWorld(body);
  car.x = body.x; car.y = body.y;
  if (inOcean(car.x)) { car.x = 4700; car.speed = 0; }
  if (car.health <= 20) car.smoke = 1;
  game.audio.engine(true, Math.abs(car.speed) / CAR.maxSpeed);
}

function shoot(game, dt) {
  const p = game.player;
  p.fireTimer -= dt;
  const mouse = game.input.mouse;
  const aimX = mouse.x - game.view.w / 2 + (game.camera.x);
  const aimY = mouse.y - game.view.h / 2 + (game.camera.y);
  p.angle = Math.atan2(aimY - p.y, aimX - p.x);
  if (!game.input.mouse.down || p.fireTimer > 0) return;
  if (p.weapon === 'fists') {
    if (p.punchTimer > 0) return;
    p.punchTimer = 0.35;
    game.audio.punch();
    const range = PLAYER.punchRange;
    for (const ped of game.entities.peds) {
      if (ped.dead) continue;
      const dx = ped.x - p.x; const dy = ped.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < range) {
        let diff = Math.atan2(dy, dx) - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < PLAYER.punchArc) hurtPed(game, ped, PLAYER.punchDamage, p);
      }
    }
    return;
  }
  const stats = p.weapon === 'pistol'
    ? { dmg: PLAYER.pistolDamage, range: PLAYER.pistolRange, rate: PLAYER.pistolRate }
    : { dmg: PLAYER.rifleDamage, range: PLAYER.rifleRange, rate: PLAYER.rifleRate };
  if (p.ammo[p.weapon] <= 0) { game.hudMessage = 'Out of ammo — find an ammo pickup.'; p.fireTimer = 0.3; return; }
  p.ammo[p.weapon] -= 1;
  p.fireTimer = stats.rate;
  game.audio.gunshot();
  addWanted(game, 0.4);
  scarePeds(game, p.x, p.y, 500);
  const hx = p.x + Math.cos(p.angle) * stats.range;
  const hy = p.y + Math.sin(p.angle) * stats.range;
  addEffect(game, p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, 'muzzle');
  // Hit the first ped or car along the shot line.
  let bestD = stats.range; let hitPed = null; let hitCar = null;
  for (const ped of game.entities.peds) {
    if (ped.dead) continue;
    const t = ((ped.x - p.x) * Math.cos(p.angle) + (ped.y - p.y) * Math.sin(p.angle));
    if (t < 0 || t > bestD) continue;
    const perp = Math.abs((ped.x - p.x) * Math.sin(p.angle) - (ped.y - p.y) * Math.cos(p.angle));
    if (perp < 16) { bestD = t; hitPed = ped; hitCar = null; }
  }
  for (const car of game.entities.cars) {
    if (car.wrecked || car === p.car) continue;
    const t = ((car.x - p.x) * Math.cos(p.angle) + (car.y - p.y) * Math.sin(p.angle));
    if (t < 0 || t > bestD) continue;
    const perp = Math.abs((car.x - p.x) * Math.sin(p.angle) - (car.y - p.y) * Math.cos(p.angle));
    if (perp < 26) { bestD = t; hitCar = car; hitPed = null; }
  }
  if (hitPed) hurtPed(game, hitPed, stats.dmg, p);
  if (hitCar) {
    hitCar.health -= stats.dmg;
    addEffect(game, hitCar.x, hitCar.y, 'spark');
    if (hitCar.driver === 'traffic') { hitCar.driver = 'parked'; hitCar.speed = 0; addWanted(game, 0.5); }
  }
}

function hurtPed(game, ped, dmg, p) {
  ped.health -= dmg;
  addEffect(game, ped.x, ped.y, 'hit');
  if (ped.health <= 0 && !ped.dead) {
    ped.dead = true;
    p.kills += 1;
    if (ped.state === 'cop') addWanted(game, 2);
    else addWanted(game, 1);
    const roll = game.rng();
    if (roll < 0.35) addPickup(game, ped.x, ped.y, 'cash', 40 + Math.floor(game.rng() * 80));
    else if (roll < 0.55) addPickup(game, ped.x, ped.y, 'health', 25);
    else if (roll < 0.7) addPickup(game, ped.x, ped.y, 'ammo', 24);
  } else {
    ped.panic = 4;
    ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
  }
}

function updateOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const move = input.moveVector();
  const speed = input.isDown(ACTION.RUN) ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.x += move.x * speed * dt;
  p.y += move.y * speed * dt;
  if (move.x !== 0 || move.y !== 0) p.angle = Math.atan2(move.y, move.x);
  const body = { x: p.x, y: p.y, r: PLAYER.radius };
  collideBuildings(game.city, body);
  p.x = body.x; p.y = body.y;
  clampWorld(body);
  p.x = body.x; p.y = body.y;
  if (inOcean(p.x)) p.x = 4860;
  // Enter a nearby car. The press is consumed here so the same press cannot
  // also exit the car in a later step of this frame.
  if (input.wasPressed(ACTION.ENTER)) {
    input.consume(ACTION.ENTER);
    const car = nearestCar(game, 70);
    if (car) enterCar(game, car);
  }
  // Swap weapon (consume: several steps run per frame).
  if (input.wasPressed(ACTION.WEAPON)) {
    input.consume(ACTION.WEAPON);
    p.weapon = p.weapon === 'fists' ? 'pistol' : p.weapon === 'pistol' ? 'rifle' : 'fists';
    game.hudMessage = `Weapon: ${p.weapon}`;
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
  shoot(game, dt);
  // Pickups.
  for (let i = game.entities.pickups.length - 1; i >= 0; i -= 1) {
    const pk = game.entities.pickups[i];
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      if (pk.kind === 'cash') { p.money += pk.value; game.hudMessage = `+$${pk.value}`; }
      if (pk.kind === 'health') { p.health = Math.min(PLAYER.health, p.health + pk.value); game.hudMessage = `+${pk.value} health`; }
      if (pk.kind === 'ammo') { p.ammo.pistol += pk.value; p.ammo.rifle += pk.value; game.hudMessage = `+${pk.value} ammo`; }
      game.audio.pickup();
      game.entities.pickups.splice(i, 1);
    }
  }
  // Run over pedestrians while on foot? No — but cars do (handled in main loop).
}

export function updatePlayer(game, dt) {
  const p = game.player;
  // Wanted decays when quiet and unseen.
  if (game.time - p.lastCrime > 8 && p.wantedFloat > 0) {
    const policeNear = policeCount(game) > 0 && game.entities.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500);
    if (!policeNear) {
      p.wantedFloat = Math.max(0, p.wantedFloat - WANTED_DECAY * dt);
      p.wanted = Math.floor(p.wantedFloat);
    }
  }
  // Police response scales with stars.
  p.spawnTimer -= dt;
  const want = Math.min(5, Math.floor(p.wantedFloat) + 1);
  if (p.wantedFloat >= 1 && p.spawnTimer <= 0 && policeCount(game) < want + 1) {
    spawnPolice(game, 1);
    p.spawnTimer = 4;
  }
  p.copTimer -= dt;
  if (p.wantedFloat >= 2 && !p.inCar && p.copTimer <= 0) {
    const cops = game.entities.peds.filter((q) => q.state === 'cop' && !q.dead).length;
    if (cops < Math.min(3, Math.floor(p.wantedFloat))) { spawnCop(game); p.copTimer = 5; }
  }
  // Busted timer only counts while a cop is touching the player.
  if (p.bustedTimer > 0 && policeCount(game) === 0) p.bustedTimer = 0;

  if (p.inCar && p.car) {
    const car = p.car;
    driveCar(game, car, dt);
    if (game.input.wasPressed(ACTION.ENTER)) {
      // Consume so the same press cannot re-enter in a later step this frame.
      game.input.consume(ACTION.ENTER);
      exitCar(game);
    } else if (car.health <= 0) {
      addEffect(game, car.x, car.y, 'explosion');
      p.health -= 40;
      exitCar(game);
      addWanted(game, 0);
    } else {
      // Run over pedestrians.
      for (const ped of game.entities.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 120) {
          hurtPed(game, ped, 100, p);
          game.audio.crash();
        }
      }
      // Drive over pickups (packages, cash) to collect them.
      for (let i = game.entities.pickups.length - 1; i >= 0; i -= 1) {
        const pk = game.entities.pickups[i];
        if (Math.hypot(pk.x - car.x, pk.y - car.y) < 40) {
          if (pk.kind === 'cash') { p.money += pk.value; game.hudMessage = `+$${pk.value}`; }
          if (pk.kind === 'package') { game.hudMessage = 'Package collected'; }
          game.audio.pickup();
          game.entities.pickups.splice(i, 1);
        }
      }
    }
  } else {
    updateOnFoot(game, dt);
    game.audio.engine(false, 0);
  }
  // Slow health regen out of combat.
  if (game.time - p.lastCrime > 12 && p.health < PLAYER.health) p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  if (p.health <= 0) game.state.wasted = true;
}
