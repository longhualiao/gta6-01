// Tunables for Solmar City: world size, road grid, physics and game balance.
// One file holds every magic number so tuning never means hunting through logic.
export const WORLD = 5200; // world is WORLD x WORLD pixels, origin at top-left
export const ROAD = 96; // road width in pixels
export const BLOCK = 400; // distance between road centrelines
export const BEACH_X = 4720; // east of this line is sand, then ocean
export const STEP = 1 / 60; // fixed simulation step

export const PLAYER = {
  radius: 14,
  walkSpeed: 185,
  runSpeed: 295,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 460,
  pistolRate: 0.22,
  pistolAmmo: 48,
  rifleDamage: 22,
  rifleRange: 560,
  rifleRate: 0.09,
  rifleAmmo: 120,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 6.5,
  health: 100,
};

export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 620;
export const WANTED_DECAY = 0.045; // stars per second while unseen and quiet
export const WANTED_MAX = 5;

// Sun-soaked coastal palette: warm sand, turquoise water, pastel towers.
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  sidewalk: '#cbbd9a',
  asphalt: '#3b4048',
  asphaltDark: '#33373f',
  lane: '#e8d44d',
  sand: '#ecd9a4',
  water: '#2fb3c9',
  waterDeep: '#1e8fa8',
  building: ['#e8b04b', '#d97b4f', '#5fa8a0', '#7d8fb3', '#c96f7a', '#8fae6b', '#b08968', '#6b7fa3'],
  roof: ['#f2e3c0', '#e5d3a8', '#d9c48f'],
};
