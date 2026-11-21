// Story missions: six jobs from Rosa Delgado that take the player across Solmar.
// Each mission is a chain of small steps (go somewhere, get a car, collect, lose
// the cops, take someone out, deliver). Finishing one pays cash and unlocks the next.
import { addPickup, makePed } from './entities.js';
import { addWanted } from './player.js';

const MISSIONS = [
  {
    id: 1, title: 'First Wheels', giver: 'Rosa Delgado', reward: 300,
    briefing: 'You need wheels before you can work. Take any car on the street, then bring it to the club downtown.',
    steps: [
      { kind: 'getcar', label: 'Steal a car (walk up and press E)' },
      { kind: 'goto', x: 2200, y: 2200, radius: 90, label: 'Drive to the Neon Palms club', inCar: true },
    ],
  },
  {
    id: 2, title: 'The Pickup', giver: 'Rosa Delgado', reward: 500,
    briefing: 'Three packages are waiting at the docks. Grab them all and bring them back to the safehouse. No cops.',
    steps: [
      { kind: 'collect', x: 4200, y: 4600, count: 3, radius: 130, label: 'Collect the packages at the docks (0/3)' },
      { kind: 'goto', x: 1000, y: 1000, radius: 90, label: 'Return to the safehouse' },
    ],
  },
  {
    id: 3, title: 'Heat', giver: 'Rosa Delgado', reward: 400,
    briefing: 'You tripped an alarm at the marina. The cops are coming — lose them. Break line of sight and stay quiet.',
    steps: [
      { kind: 'heat', stars: 2, label: 'Lose the cops — wanted level must drop to zero' },
    ],
  },
  {
    id: 4, title: 'The Courier', giver: 'Marco Venn', reward: 600,
    briefing: 'A buyer is waiting at the airport with cash. Get there in 90 seconds and the money is yours.',
    steps: [
      { kind: 'goto', x: 600, y: 4200, radius: 100, label: 'Reach the airport — 90 seconds!', timer: 90 },
    ],
  },
  {
    id: 5, title: 'Settling Debts', giver: 'Rosa Delgado', reward: 800,
    briefing: 'Three debtors are drinking at the marina. Make them pay — then get out before the cops arrive.',
    steps: [
      { kind: 'kill', x: 4600, y: 3400, count: 3, radius: 160, label: 'Deal with the debtors at the marina (0/3)' },
      { kind: 'goto', x: 1000, y: 1000, radius: 90, label: 'Get back to the safehouse' },
    ],
  },
  {
    id: 6, title: 'The Big One', giver: 'Marco Venn', reward: 2000,
    briefing: 'The downtown bank vault, one fast car, and the whole city after you. Grab the cash, lose a four-star wanted level, and come home rich.',
    steps: [
      { kind: 'goto', x: 2200, y: 2200, radius: 100, label: 'Reach the downtown bank' },
      { kind: 'collect', x: 2200, y: 2200, count: 1, radius: 130, label: 'Grab the cash' },
      { kind: 'heat', stars: 4, label: 'Lose the four-star wanted level' },
      { kind: 'goto', x: 1000, y: 1000, radius: 90, label: 'Bring it home to the safehouse' },
    ],
  },
];

export function createMissions() {
  return { index: 0, active: null, stepIndex: 0, stepState: null, done: [], failed: false };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function missionObjective(missions) {
  if (!missions.active) {
    const next = currentMission(missions);
    if (!next) return 'All missions complete — Solmar is yours.';
    return `Next job: ${next.title} — press Enter to start`;
  }
  const step = missions.active.steps[missions.stepIndex];
  return step ? step.label : '';
}

function setupStep(game, step) {
  const st = { remaining: step.count || 0, spawned: false, targets: [] };
  if (step.kind === 'collect') {
    for (let i = 0; i < step.count; i += 1) {
      const a = (i / step.count) * Math.PI * 2;
      addPickup(game, step.x + Math.cos(a) * 60, step.y + Math.sin(a) * 60, 'package', 0);
    }
    st.spawned = true;
  }
  if (step.kind === 'kill') {
    for (let i = 0; i < step.count; i += 1) {
      const ped = makePed(game.rng, step.x + (game.rng() - 0.5) * 160, step.y + (game.rng() - 0.5) * 160);
      ped.state = 'debtor';
      ped.health = 60;
      ped.shirt = '#7a1f1f';
      game.entities.peds.push(ped);
      st.targets.push(ped);
    }
    st.spawned = true;
  }
  if (step.kind === 'heat') {
    game.player.wantedFloat = step.stars;
    game.player.wanted = step.stars;
    game.player.lastCrime = game.time;
    st.spawned = true;
  }
  return st;
}

export function startMission(game) {
  const m = game.missions;
  const def = currentMission(m);
  if (!def) return;
  m.active = def;
  m.stepIndex = 0;
  m.stepState = setupStep(game, def.steps[0]);
  game.hudMessage = `${def.title}: ${def.briefing}`;
  game.audio.mission();
}

function advanceStep(game) {
  const m = game.missions;
  m.stepIndex += 1;
  if (m.stepIndex >= m.active.steps.length) {
    completeMission(game);
    return;
  }
  m.stepState = setupStep(game, m.active.steps[m.stepIndex]);
  game.audio.mission();
}

function completeMission(game) {
  const m = game.missions;
  const def = m.active;
  game.player.money += def.reward;
  game.player.missionsDone += 1;
  m.done.push(def.id);
  m.active = null;
  m.stepIndex = 0;
  m.index += 1;
  game.hudMessage = `Mission complete: ${def.title} — +$${def.reward}`;
  game.audio.mission();
  game.state.missionBanner = { text: `MISSION COMPLETE — ${def.title}  +$${def.reward}`, t: 4 };
}

function failMission(game, reason) {
  const m = game.missions;
  m.active = null;
  m.stepIndex = 0;
  game.hudMessage = `Mission failed: ${reason}. Press Enter to retry.`;
  game.audio.busted();
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (!m.active) return;
  const step = m.active.steps[m.stepIndex];
  const st = m.stepState;
  const p = game.player;
  // Effective position: the car when driving, the player on foot. Mission
  // markers are reached in the car as well as on foot.
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  if (step.timer !== undefined) {
    st.timeLeft = st.timeLeft === undefined ? step.timer : st.timeLeft - dt;
    step.label = step.label.replace(/— \d+s.*$/, '').replace(/ — \d+$/, '');
    if (st.timeLeft <= 0) { failMission(game, 'Out of time'); return; }
  }
  if (step.kind === 'getcar') {
    if (p.inCar) advanceStep(game);
  } else if (step.kind === 'goto') {
    const d = Math.hypot(px - step.x, py - step.y);
    if (d < step.radius && (!step.inCar || p.inCar)) advanceStep(game);
  } else if (step.kind === 'collect') {
    const left = game.entities.pickups.filter((pk) => pk.kind === 'package').length;
    const got = (step.count || 0) - left;
    step.label = step.label.replace(/\(\d+\/\d+\)/, `(${got}/${step.count})`);
    if (left === 0) advanceStep(game);
  } else if (step.kind === 'kill') {
    const left = st.targets.filter((t) => !t.dead).length;
    step.label = step.label.replace(/\(\d+\/\d+\)/, `(${(step.count || 0) - left}/${step.count})`);
    if (left === 0) advanceStep(game);
  } else if (step.kind === 'heat') {
    if (p.wantedFloat < 0.5) advanceStep(game);
  }
}

/** Marker position for the HUD arrow and minimap, or null. */
export function missionMarker(game) {
  const m = game.missions;
  if (!m.active) return null;
  const step = m.active.steps[m.stepIndex];
  if (!step) return null;
  if (step.kind === 'kill' && m.stepState) {
    const alive = m.stepState.targets.find((t) => !t.dead);
    if (alive) return { x: alive.x, y: alive.y };
  }
  if (step.x !== undefined) return { x: step.x, y: step.y };
  return null;
}
