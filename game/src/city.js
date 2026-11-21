// The city of Solmar: a seeded grid of roads and blocks, a beach and ocean on the
// east edge, a park, a marina and a downtown of taller towers. Generation is pure:
// the same seed always builds the same city, so screenshots are reproducible.
import { WORLD, ROAD, BLOCK, BEACH_X, PALETTE } from './config.js';
import { randInt, randRange, pick, shuffle } from './random.js';

const ROAD_COUNT = Math.floor((WORLD - 200) / BLOCK); // roads at 200, 600, ... 4600
export function roadLines() {
  const lines = [];
  for (let i = 0; i < ROAD_COUNT; i += 1) lines.push(200 + i * BLOCK);
  return lines;
}

function buildingAt(rng, bx, by, bw, bh, downtown) {
  const palette = PALETTE.building;
  const height = downtown ? randInt(rng, 3, 7) : randInt(rng, 1, 3);
  return {
    x: bx, y: by, w: bw, h: bh,
    height,
    color: pick(rng, palette),
    roof: pick(rng, PALETTE.roof),
    windows: randInt(rng, 2, 5),
    label: downtown && rng() < 0.25 ? pick(rng, ['HOTEL', 'BANK', 'MALL', 'TOWER', 'CLUB', 'PIER']) : '',
  };
}

export function generateCity(rng) {
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const parking = [];
  const sidewalk = ROAD / 2 + 14;

  // Blocks between roads: each block is one parcel with a building, a park or a lot.
  for (let gx = 0; gx < lines.length - 1; gx += 1) {
    for (let gy = 0; gy < lines.length - 1; gy += 1) {
      const x0 = lines[gx] + ROAD / 2 + 22;
      const y0 = lines[gy] + ROAD / 2 + 22;
      const x1 = lines[gx + 1] - ROAD / 2 - 22;
      const y1 = lines[gy + 1] - ROAD / 2 - 22;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = Math.abs(cx - 2200) < 900 && Math.abs(cy - 2200) < 900;
      const roll = rng();
      if (roll < 0.08) {
        // Park: grass, trees, a pond.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = randInt(rng, 5, 9);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: randRange(rng, x0 + 20, x1 - 20), y: randRange(rng, y0 + 20, y1 - 20), r: randRange(rng, 9, 15) });
        }
        continue;
      }
      if (roll < 0.16) {
        // Open parking lot with marked bays.
        for (let i = 0; i < 6; i += 1) {
          parking.push({ x: x0 + 30 + (i % 3) * 90, y: y0 + 30 + Math.floor(i / 3) * 110, angle: 0 });
        }
        continue;
      }
      // One building per block, centred, with a margin for the sidewalk.
      const bw = randRange(rng, 150, x1 - x0 - 30);
      const bh = randRange(rng, 130, y1 - y0 - 30);
      buildings.push(buildingAt(rng, cx - bw / 2, cy - bh / 2, bw, bh, downtown));
      // Corner trees and a lamp on the block edge.
      if (rng() < 0.7) trees.push({ x: x0 + 12, y: y0 + 12, r: randRange(rng, 8, 12) });
      if (rng() < 0.5) trees.push({ x: x1 - 12, y: y1 - 12, r: randRange(rng, 8, 12) });
      lamps.push({ x: x0 + 6, y: cy });
    }
  }

  // Beach palms along the sand strip.
  for (let y = 200; y < WORLD; y += 130) {
    trees.push({ x: randRange(rng, BEACH_X + 30, BEACH_X + 130), y: y + randRange(rng, -30, 30), r: randRange(rng, 10, 15), palm: true });
  }
  // Shuffled list of street spawn points (road intersections) for traffic and peds.
  const spawns = [];
  for (const lx of lines) for (const ly of lines) spawns.push({ x: lx, y: ly });
  shuffle(rng, spawns);

  return {
    lines, buildings, trees, lamps, parks, parking, spawns,
    sidewalk,
    // Safehouse / mission anchor points, all on roads.
    safehouse: { x: 1000, y: 1000 },
    club: { x: 2200, y: 2200 },
    marina: { x: 4600, y: 3400 },
    airport: { x: 600, y: 4200 },
    docks: { x: 4200, y: 4600 },
  };
}

/** True when the point is on a road surface (not sidewalk or block). */
export function isOnRoad(city, x, y) {
  if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
  for (const line of city.lines) {
    if (Math.abs(x - line) < ROAD / 2) return true;
    if (Math.abs(y - line) < ROAD / 2) return true;
  }
  return false;
}

/** Nearest point on the road network, used to snap traffic and missions. */
export function nearestRoadPoint(city, x, y) {
  let best = null; let bestD = Infinity;
  for (const lx of city.lines) {
    const d = Math.abs(x - lx);
    if (d < bestD) { bestD = d; best = { x: lx, y }; }
  }
  for (const ly of city.lines) {
    const d = Math.abs(y - ly);
    if (d < bestD) { bestD = d; best = { x, y: ly }; }
  }
  return best;
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nx; const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * body.r;
        body.y = ny + (dy / d) * body.r;
      } else {
        body.x += body.r;
      }
    }
  }
  return hit;
}

/** Keep a body inside the world (ocean edge is a wall, not a swim). */
export function clampWorld(body) {
  body.x = Math.max(30, Math.min(WORLD - 30, body.x));
  body.y = Math.max(30, Math.min(WORLD - 30, body.y));
}

/** True when the point is in the ocean (east of the sand). */
export function inOcean(x) {
  return x > BEACH_X + 170;
}
