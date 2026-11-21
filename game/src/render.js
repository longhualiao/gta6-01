// Rendering: the city, the cars and people in it, the effects, and the HUD with
// its minimap. Top-down, sun-soaked, drawn with the 2D canvas only.
import { WORLD, ROAD, BEACH_X, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

function drawBuilding(ctx, b, cam) {
  const h = b.height * 7;
  ctx.save();
  ctx.translate(b.x, b.y);
  // Drop shadow / height offset gives the flat roof a sense of depth.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(h * 0.5, h * 0.5, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(0, 0, b.w, b.h);
  // Roof slab.
  ctx.fillStyle = b.roof;
  ctx.fillRect(6, 6, b.w - 12, b.h - 12);
  // Rooftop detail: AC units and a helipad on tall towers.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const units = Math.max(1, Math.floor(b.w / 70));
  for (let i = 0; i < units; i += 1) ctx.fillRect(14 + i * 60, 14, 26, 18);
  if (b.height >= 5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.w / 2, b.h / 2, Math.min(b.w, b.h) * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', b.w / 2, b.h / 2 + 6);
  }
  // Windows on the wall edge facing the camera.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < b.windows; i += 1) {
    ctx.fillRect(12 + i * ((b.w - 24) / b.windows), b.h - 8, 10, 5);
  }
  if (b.label) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.w / 2, 24);
  }
  ctx.restore();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.kind === 'truck' ? 84 : 64;
  const wid = car.kind === 'truck' ? 34 : 30;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.wrecked ? '#2b2b2b' : car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // Roof / cabin.
  ctx.fillStyle = car.kind === 'police' ? '#e8e8e8' : shade(car.color, -18);
  roundRect(ctx, -len / 2 + 14, -wid / 2 + 5, len - 34, wid - 10, 5);
  ctx.fill();
  // Windshield.
  ctx.fillStyle = 'rgba(180,220,235,0.9)';
  ctx.fillRect(len / 2 - 18, -wid / 2 + 5, 5, wid - 10);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 6);
  ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 6);
  // Police livery and light bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 4);
    const blink = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath(); ctx.arc(-6, -wid / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(6, -wid / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 4);
  }
  // Smoke when damaged.
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-len / 2, 0, 8 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, ped, time) {
  if (ped.dead) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = ped.state === 'walk' || ped.panic > 0 ? Math.sin(time * 10 + ped.x) * 1.5 : 0;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob);
  ctx.rotate(ped.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(5, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  // Cop hat.
  if (ped.state === 'cop') {
    ctx.fillStyle = '#0e1a2b';
    ctx.beginPath(); ctx.arc(5, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  }
  if (ped.state === 'debtor') {
    ctx.fillStyle = '#ff2d2d';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -16);
  }
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  if (player.inCar) return;
  const bob = Math.sin(time * 12) * 1;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 4, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Jacket and head.
  ctx.fillStyle = '#2f6db3';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Gun in hand when armed.
  if (player.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 12, 4);
  }
  // Direction tick.
  ctx.fillStyle = '#fff';
  ctx.fillRect(12, -1, 6, 2);
  ctx.restore();
  // Player ring so the eye finds them fast.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(player.x, player.y, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawWorld(ctx, game, cam) {
  const { city } = game;
  const vw = game.view.w; const vh = game.view.h;
  const x0 = cam.x - vw / 2 - 60; const y0 = cam.y - vh / 2 - 60;
  const x1 = cam.x + vw / 2 + 60; const y1 = cam.y + vh / 2 + 60;
  // Ground: grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Ocean and beach on the east edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, BEACH_X + 170), y0, x1 - Math.max(x0, BEACH_X + 170), y1 - y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, BEACH_X), y0, Math.min(x1, BEACH_X + 170) - Math.max(x0, BEACH_X), y1 - y0);
  // Animated wave line.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = y0; y < y1; y += 24) {
    const wx = BEACH_X + 172 + Math.sin(y / 60 + game.time * 1.5) * 6;
    if (y === y0) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
  }
  ctx.stroke();
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#7fb8c9';
    ctx.beginPath(); ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, 34, 22, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Sidewalks and roads.
  for (const line of city.lines) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(line - ROAD / 2 - 14, y0, ROAD + 28, y1 - y0);
    ctx.fillRect(x0, line - ROAD / 2 - 14, x1 - x0, ROAD + 28);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(line - ROAD / 2, y0, ROAD, y1 - y0);
    ctx.fillRect(x0, line - ROAD / 2, x1 - x0, ROAD);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const line of city.lines) {
    for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) ctx.fillRect(line - 2, y, 4, 30);
    for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x, line - 2, 30, 4);
  }
  // Parking bays.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (const lot of city.parking) {
    ctx.strokeRect(lot.x - 20, lot.y - 34, 40, 68);
  }
  // Trees.
  for (const tree of city.trees) {
    if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(tree.x + 3, tree.y + 4, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (tree.palm) {
      ctx.strokeStyle = '#8a6b3d';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(tree.x, tree.y + 8); ctx.lineTo(tree.x, tree.y - 6); ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(tree.x + Math.cos(a) * 10, tree.y - 8 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#4d8a3f';
      ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5da34e';
      ctx.beginPath(); ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Buildings.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    drawBuilding(ctx, b, cam);
  }
  // Mission marker: pulsing beacon.
  const marker = game.missionMarker;
  if (marker) {
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#ffcf3d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(10, -34); ctx.lineTo(-10, -34); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawEffects(ctx, game) {
  for (const fx of game.entities.effects) {
    if (fx.kind === 'spark') {
      ctx.fillStyle = `rgba(255,200,60,${Math.max(0, fx.life * 2)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + fx.life * 6, 0, Math.PI * 2); ctx.fill();
    } else if (fx.kind === 'explosion') {
      ctx.fillStyle = `rgba(255,120,30,${Math.max(0, fx.life)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 40 * (1 - fx.life) + 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,220,120,${Math.max(0, fx.life)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 22 * (1 - fx.life) + 8, 0, Math.PI * 2); ctx.fill();
    } else if (fx.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,230,120,${Math.max(0, fx.life * 2.5)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 10, 0, Math.PI * 2); ctx.fill();
    } else if (fx.kind === 'hit') {
      ctx.fillStyle = `rgba(220,40,40,${Math.max(0, fx.life * 2)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 7, 0, Math.PI * 2); ctx.fill();
    } else if (fx.kind === 'skid') {
      ctx.fillStyle = 'rgba(20,20,20,0.35)';
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const pk of game.entities.pickups) {
    const bob = Math.sin(game.time * 4 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae5a';
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e33';
      ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    } else if (pk.kind === 'package') {
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#ffcf3d'; ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
    }
    ctx.restore();
  }
}

function drawMinimap(ctx, game) {
  const size = 208;
  const x = game.view.w - size - 16;
  const y = 16;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,28,0.82)';
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, size, size, 6);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#274b2e';
  ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = '#2fb3c9';
  ctx.fillRect(BEACH_X + 170, 0, WORLD - BEACH_X - 170, WORLD);
  ctx.fillStyle = '#ecd9a4';
  ctx.fillRect(BEACH_X, 0, 170, WORLD);
  ctx.fillStyle = '#c8c8c8';
  for (const line of game.city.lines) {
    ctx.fillRect(line - ROAD / 2, 0, ROAD, WORLD);
    ctx.fillRect(0, line - ROAD / 2, WORLD, ROAD);
  }
  ctx.fillStyle = '#6d7a52';
  for (const b of game.city.buildings) ctx.fillRect(b.x, b.y, b.w, b.h);
  // Police blips.
  ctx.fillStyle = '#2d6bff';
  for (const car of game.entities.police) {
    if (car.wrecked) continue;
    ctx.beginPath(); ctx.arc(car.x, car.y, 70, 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker.
  if (game.missionMarker) {
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath(); ctx.arc(game.missionMarker.x, game.missionMarker.y, 90, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(p.inCar && p.car ? p.car.x : p.x, p.inCar && p.car ? p.car.y : p.y);
  ctx.rotate(p.inCar && p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(110, 0); ctx.lineTo(-70, -80); ctx.lineTo(-70, 80); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // North + label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', x, y + size + 22);
  ctx.restore();
}

function drawHud(ctx, game) {
  const p = game.player;
  const vw = game.view.w;
  ctx.save();
  // Health bar.
  ctx.fillStyle = 'rgba(10,16,28,0.8)';
  roundRect(ctx, 14, 14, 220, 54, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`$${p.money.toLocaleString()}`, 26, 38);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 46, 180, 10);
  ctx.fillStyle = p.health > 30 ? '#4caf50' : '#e33';
  ctx.fillRect(26, 46, 180 * Math.max(0, p.health / 100), 10);
  // Wanted stars and clock sit left of the minimap, never under it.
  const mapX = vw - 208 - 16;
  ctx.textAlign = 'right';
  ctx.font = '26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = p.wanted > 0 ? '#ffd23d' : 'rgba(255,255,255,0.45)';
  ctx.fillText(stars, mapX - 14, 44);
  // Clock + day.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(game.clockText, mapX - 14, 70);
  // Weapon / speed.
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(10,16,28,0.8)';
    roundRect(ctx, 14, game.view.h - 64, 170, 50, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`${kmh} km/h`, 26, game.view.h - 42);
    ctx.fillStyle = p.car.health > 30 ? '#9fd6a0' : '#ff8a7a';
    ctx.fillRect(26, game.view.h - 32, 140 * Math.max(0, p.car.health / 100), 8);
  } else {
    ctx.fillStyle = 'rgba(10,16,28,0.8)';
    roundRect(ctx, 14, game.view.h - 64, 200, 50, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    const ammo = p.weapon === 'fists' ? '—' : p.ammo[p.weapon];
    ctx.fillText(`${p.weapon.toUpperCase()}  •  ${ammo}`, 26, game.view.h - 32);
  }
  // Objective banner.
  const obj = game.objectiveText;
  if (obj) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(obj).width + 32;
    ctx.fillStyle = 'rgba(10,16,28,0.82)';
    roundRect(ctx, (vw - w) / 2, 14, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffcf3d';
    ctx.textAlign = 'center';
    ctx.fillText(obj, vw / 2, 37);
  }
  // Toast message.
  if (game.hudMessage && game.hudMessageT > 0) {
    ctx.font = '15px sans-serif';
    const w = ctx.measureText(game.hudMessage).width + 28;
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    roundRect(ctx, (vw - w) / 2, 58, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(game.hudMessage, vw / 2, 78);
  }
  // Mission complete banner.
  if (game.state.missionBanner && game.state.missionBanner.t > 0) {
    ctx.font = 'bold 22px sans-serif';
    const w = ctx.measureText(game.state.missionBanner.text).width + 40;
    ctx.fillStyle = 'rgba(20,80,30,0.9)';
    roundRect(ctx, (vw - w) / 2, game.view.h / 2 - 60, w, 44, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(game.state.missionBanner.text, vw / 2, game.view.h / 2 - 30);
  }
  // Controls hint, bottom right.
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive  •  E enter car  •  Click shoot  •  Q weapon  •  Esc pause', vw - 16, game.view.h - 16);
  drawMinimap(ctx, game);
  ctx.restore();
}

function drawTitle(ctx, game) {
  const vw = game.view.w; const vh = game.view.h;
  ctx.save();
  // Sunset gradient backdrop over a dimmed city glimpse.
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#1c2b4a');
  grad.addColorStop(0.55, '#c96f4a');
  grad.addColorStop(1, '#f2a65a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, vh - 180, vw, 180);
  // Skyline silhouette.
  ctx.fillStyle = '#141c2e';
  let x = 0;
  const rng = game.titleRng;
  while (x < vw) {
    const w = 40 + rng() * 70;
    const h = 60 + rng() * 130;
    ctx.fillRect(x, vh - 180 - h, w, h + 180);
    x += w + 6;
  }
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath(); ctx.arc(vw - 180, 130, 55, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR CITY', vw / 2, 210);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', vw / 2, 258);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '18px sans-serif';
  ctx.fillText('Steal cars. Outrun the law. Run six jobs for Rosa Delgado and own the city.', vw / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.floor(game.time * 2) % 2 === 0;
  if (blink) ctx.fillText('PRESS ENTER TO PLAY', vw / 2, 380);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('WASD move / drive   •   E steal & enter cars   •   Mouse aim, click to shoot   •   Q switch weapon', vw / 2, 430);
  ctx.fillText('Missions pay cash. Wanted stars bring the police. Save progress automatically.', vw / 2, 458);
  if (game.save.best > 0) {
    ctx.fillStyle = '#ffcf3d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Best run: $${game.save.best.toLocaleString()}  •  Missions done: ${game.save.missions}`, vw / 2, 500);
  }
  ctx.restore();
}

function drawOverlay(ctx, game, title, sub, color) {
  const vw = game.view.w; const vh = game.view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(sub, vw / 2, vh / 2 + 30);
  ctx.font = 'bold 18px sans-serif';
  if (Math.floor(game.time * 2) % 2 === 0) ctx.fillText('PRESS ENTER', vw / 2, vh / 2 + 90);
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return {
    resize,
    draw(game, screen) {
      const vw = game.view.w; const vh = game.view.h;
      ctx.clearRect(0, 0, vw, vh);
      if (screen === SCREEN_TITLE) {
        drawTitle(ctx, game);
        return;
      }
      const cam = game.camera;
      ctx.save();
      ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
      drawWorld(ctx, game, cam);
      // Draw order: pickups, cars, peds, player, effects.
      drawEffects(ctx, game);
      for (const car of game.entities.cars) drawCar(ctx, car, game.time);
      for (const ped of game.entities.peds) drawPed(ctx, ped, game.time);
      drawPlayer(ctx, game.player, game.time);
      // Off-screen mission arrow at the screen edge.
      const marker = game.missionMarker;
      if (marker) {
        const dx = marker.x - cam.x; const dy = marker.y - cam.y;
        if (Math.abs(dx) > vw / 2 - 40 || Math.abs(dy) > vh / 2 - 40) {
          const a = Math.atan2(dy, dx);
          const ex = cam.x + Math.cos(a) * (vw / 2 - 60);
          const ey = cam.y + Math.sin(a) * (vh / 2 - 60);
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(a);
          ctx.fillStyle = '#ffcf3d';
          ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
      drawHud(ctx, game);
      if (screen === SCREEN_PAUSED) drawOverlay(ctx, game, 'PAUSED', 'Progress saved. Press Esc to keep playing.', '#fff');
      if (screen === SCREEN_WASTED) drawOverlay(ctx, game, 'WASTED', `You earned $${game.player.money.toLocaleString()} this run. Press Enter to start over.`, '#ff5a4d');
      if (screen === SCREEN_BUSTED) drawOverlay(ctx, game, 'BUSTED', 'The Solmar PD caught up with you. Press Enter to start over.', '#5aa2ff');
    },
  };
}
