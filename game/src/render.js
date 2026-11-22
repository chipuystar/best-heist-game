// render.js — everything the player sees, drawn on one 2D canvas: the room,
// the vision cones, the actors, the loot, the HUD bar and the title, win and
// busted screens. The look is a dark gallery at night with neon signals:
// cyan for the thief, pink for guards, amber for cameras, gold for loot and
// green for the exit, so safe cover, danger and loot read at a glance.

import {
  COLORS,
  COVER,
  EXIT,
  HUD_HEIGHT,
  LOOT,
  ROOM,
  TOTAL_LOOT_VALUE,
  TUNING,
  VAULT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './world.js';

const TITLE_FONT = '"Bungee", sans-serif';
const HUD_FONT = '"Chakra Petch", sans-serif';

function text(ctx, value, x, y, { font = HUD_FONT, size = 16, weight = 600, color = COLORS.text, align = 'left', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, VIEW_WIDTH);
  ctx.restore();
}

function pill(ctx, x, y, w, h, fill, stroke = null) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// A vision cone: a wedge with a radial gradient that fades with distance and
// a bright edge on both sides. The gradient, not a shadow blur, carries the
// glow, so a dozen cones stay cheap to draw every frame.
function drawCone(ctx, x, y, angle, range, halfAngle, inner, edge) {
  ctx.save();
  const gradient = ctx.createRadialGradient(x, y, 10, x, y, range);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
  ctx.stroke();
  ctx.restore();
}

function drawFloor(ctx) {
  ctx.fillStyle = COLORS.floorA;
  ctx.fillRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top);
  // Large checker tiles, subtle enough to stay in the background.
  const tile = 64;
  ctx.fillStyle = COLORS.floorB;
  for (let y = ROOM.top; y < ROOM.bottom; y += tile) {
    for (let x = ROOM.left; x < ROOM.right; x += tile) {
      const odd = (Math.floor((x - ROOM.left) / tile) + Math.floor((y - ROOM.top) / tile)) % 2 === 1;
      if (odd) ctx.fillRect(x, y, tile, tile);
    }
  }
  // A faint centre carpet runner from the door to the vault.
  ctx.fillStyle = 'rgba(120, 30, 60, 0.15)';
  ctx.fillRect(596, ROOM.top + 86, 88, ROOM.bottom - ROOM.top - 116);
  ctx.strokeStyle = 'rgba(255, 120, 150, 0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(596, ROOM.top + 86, 88, ROOM.bottom - ROOM.top - 116);
}

function drawWalls(ctx) {
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, WALL_TOP());
  ctx.fillRect(0, HUD_HEIGHT, 14, VIEW_HEIGHT - HUD_HEIGHT);
  ctx.fillRect(VIEW_WIDTH - 14, HUD_HEIGHT, 14, VIEW_HEIGHT - HUD_HEIGHT);
  ctx.fillRect(0, VIEW_HEIGHT - 14, VIEW_WIDTH, 14);
  ctx.strokeStyle = COLORS.wallEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(7, HUD_HEIGHT + 7, VIEW_WIDTH - 14, VIEW_HEIGHT - HUD_HEIGHT - 14);
  function WALL_TOP() {
    return ROOM.top - HUD_HEIGHT;
  }
}

function drawVault(ctx, vaultOpen, time) {
  const { x, y, w, h } = VAULT.rect;
  ctx.fillStyle = COLORS.vault;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.vaultEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  // Rivets along the door frame.
  ctx.fillStyle = COLORS.vaultEdge;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + 14 + i * 44, y + 10, 3, 0, Math.PI * 2);
    ctx.arc(x + 14 + i * 44, y + h - 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The dial.
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + 8);
  ctx.fillStyle = '#14100a';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.vaultEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.rotate(vaultOpen ? 2.2 : Math.sin(time * 0.5) * 0.1);
  ctx.strokeStyle = COLORS.lootGold;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -16);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'VAULT', x + w / 2, y + 16, { size: 13, color: COLORS.lootGold, align: 'center' });

  if (!vaultOpen) {
    // The diamond glints behind the vault's viewing slit.
    const pulse = 0.6 + Math.sin(time * 3) * 0.4;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.lootGem;
    ctx.beginPath();
    ctx.moveTo(VAULT.diamond.x, VAULT.diamond.y - 12);
    ctx.lineTo(VAULT.diamond.x + 9, VAULT.diamond.y);
    ctx.lineTo(VAULT.diamond.x, VAULT.diamond.y + 12);
    ctx.lineTo(VAULT.diamond.x - 9, VAULT.diamond.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(ctx, '$10,000', VAULT.diamond.x, VAULT.diamond.y + 30, { size: 12, color: COLORS.lootGem, align: 'center' });
  } else {
    text(ctx, 'OPEN', x + w / 2, y + h + 14, { size: 12, color: COLORS.exitGlow, align: 'center' });
  }
}

function drawExit(ctx, hasDiamond, time) {
  const { x, y, w, h } = EXIT.rect;
  const glow = hasDiamond ? 0.55 + Math.sin(time * 5) * 0.35 : 0.3;
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = COLORS.exitGlow;
  ctx.fillRect(x - 6, y - 34, w + 12, h + 34);
  ctx.restore();
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.exitGlow;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  text(ctx, 'EXIT', x + w / 2, y + h / 2 + 1, { size: 15, color: COLORS.exitGlow, align: 'center' });
  // Chevrons pointing at the door.
  ctx.strokeStyle = COLORS.exitGlow;
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const cy = y - 12 - i * 12 + Math.sin(time * 4 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 10, cy);
    ctx.lineTo(x + w / 2, cy + 7);
    ctx.lineTo(x + w / 2 + 10, cy);
    ctx.stroke();
  }
  text(ctx, 'GETAWAY VAN', x + w / 2, y - 40, { size: 11, color: COLORS.exitGlow, align: 'center', alpha: 0.9 });
}

function drawCover(ctx) {
  for (const rect of COVER) {
    ctx.fillStyle = COLORS.cover;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = COLORS.coverTop;
    ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, 12);
    ctx.strokeStyle = COLORS.coverEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  }
}

function drawLoot(ctx, game, time) {
  for (const item of LOOT) {
    if (game.thief.lootTaken.has(item.id)) continue;
    const bob = Math.sin(time * 2.5 + item.x) * 2;
    const y = item.y + bob;
    // Halo so the loot reads at a glance, even shrunk.
    const halo = ctx.createRadialGradient(item.x, y, 2, item.x, y, 34);
    halo.addColorStop(0, item.color + '55');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(item.x, y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = item.color;
    if (item.kind === 'bars') {
      ctx.fillRect(item.x - 14, y - 2, 28, 9);
      ctx.fillRect(item.x - 10, y - 10, 20, 9);
      ctx.fillRect(item.x - 5, y - 17, 10, 8);
    } else if (item.kind === 'idol') {
      ctx.beginPath();
      ctx.moveTo(item.x, y - 16);
      ctx.lineTo(item.x + 11, y);
      ctx.lineTo(item.x, y + 16);
      ctx.lineTo(item.x - 11, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(item.x - 13, y - 6, 26, 12);
      ctx.fillStyle = '#0c1220';
      ctx.font = `700 10px ${HUD_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', item.x, y + 1);
    }
    text(ctx, `$${item.value.toLocaleString('en-US')}`, item.x, y + 30, {
      size: 12, color: item.color, align: 'center',
    });
  }
}

function drawCoins(ctx, coins, time) {
  for (const coin of coins) {
    if (coin.state === 'flying') {
      const lift = Math.sin(coin.progress * Math.PI) * 26;
      ctx.fillStyle = COLORS.lootGold;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y - lift, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6d1a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Landed: a coin with an expanding ring so the guard's target is clear.
      const age = time - coin.landedAt;
      const ring = 8 + age * 26;
      ctx.strokeStyle = `rgba(255, 217, 77, ${Math.max(0, 0.8 - age * 0.5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.lootGold;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGuard(ctx, guard, time) {
  // The patrol path, faintly dotted, so the route reads before the move.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 93, 115, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  guard.waypoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  if (!guard.pingPong) ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const hot = guard.seesThief;
  drawCone(
    ctx, guard.x, guard.y, guard.facing,
    TUNING.guardConeRange, TUNING.guardConeHalfAngle,
    hot ? COLORS.guardConeHot : COLORS.guardCone,
    hot ? 'rgba(255,45,85,0.7)' : 'rgba(255,93,115,0.35)',
  );

  // Body: a uniformed guard, facing tick showing the look direction.
  const bob = Math.sin(guard.walkPhase) * 1.5;
  ctx.fillStyle = '#1a2233';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y + bob, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hot ? '#ff2d55' : COLORS.guard;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = hot ? '#ff2d55' : COLORS.guard;
  ctx.beginPath();
  ctx.arc(
    guard.x + Math.cos(guard.facing) * 8,
    guard.y + bob + Math.sin(guard.facing) * 8,
    4.5, 0, Math.PI * 2,
  );
  ctx.fill();
  text(ctx, guard.name, guard.x, guard.y + bob - 24, { size: 11, color: COLORS.guard, align: 'center' });

  if (hot) {
    text(ctx, '!', guard.x, guard.y + bob - 40, {
      font: TITLE_FONT, size: 22, weight: 400, color: '#ff2d55', align: 'center',
    });
  } else if (guard.state === 'investigate' || guard.state === 'look') {
    text(ctx, '?', guard.x, guard.y + bob - 40, {
      font: TITLE_FONT, size: 20, weight: 400, color: COLORS.lootGold, align: 'center',
    });
  }
}

function drawCamera(ctx, camera) {
  const hot = camera.seesThief;
  drawCone(
    ctx, camera.x, camera.y, camera.angle,
    TUNING.cameraRange, TUNING.cameraConeHalfAngle,
    hot ? COLORS.cameraConeHot : COLORS.cameraCone,
    hot ? 'rgba(255,120,40,0.7)' : 'rgba(255,159,67,0.35)',
  );
  // Wall mount and lens.
  ctx.fillStyle = '#1a2233';
  ctx.fillRect(camera.x - 12, camera.y - 8, 24, 16);
  ctx.strokeStyle = COLORS.camera;
  ctx.lineWidth = 2;
  ctx.strokeRect(camera.x - 12, camera.y - 8, 24, 16);
  ctx.fillStyle = hot ? '#ff2d55' : COLORS.camera;
  ctx.beginPath();
  ctx.arc(camera.x + Math.cos(camera.angle) * 10, camera.y + Math.sin(camera.angle) * 10, 4, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, camera.name, camera.x, camera.y + 22, { size: 10, color: COLORS.camera, align: 'center' });
}

function drawThief(ctx, thief, time) {
  const bob = thief.moving ? Math.abs(Math.sin(thief.stepPhase)) * 2 : Math.sin(time * 2) * 1;
  // Soft cyan halo.
  const halo = ctx.createRadialGradient(thief.x, thief.y, 2, thief.x, thief.y, 30);
  halo.addColorStop(0, 'rgba(53,224,255,0.30)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, 30, 0, Math.PI * 2);
  ctx.fill();
  // Hooded figure: dark body, cyan rim, mask slit.
  ctx.fillStyle = COLORS.thiefDark;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y - bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.thief;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(
    thief.x + Math.cos(thief.facing) * 6,
    thief.y - bob + Math.sin(thief.facing) * 6,
    4, 0, Math.PI * 2,
  );
  ctx.fill();
  // The stolen diamond rides above the thief's head.
  if (thief.hasDiamond) {
    ctx.fillStyle = COLORS.lootGem;
    ctx.beginPath();
    ctx.moveTo(thief.x, thief.y - bob - 30);
    ctx.lineTo(thief.x + 6, thief.y - bob - 22);
    ctx.lineTo(thief.x, thief.y - bob - 14);
    ctx.lineTo(thief.x - 6, thief.y - bob - 22);
    ctx.closePath();
    ctx.fill();
  }
  // Vault-cracking progress ring.
  if (thief.cracking || thief.crackProgress > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,217,77,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y - bob, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.lootGold;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y - bob, 22, -Math.PI / 2, -Math.PI / 2 + thief.crackProgress * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'CRACKING…', thief.x, thief.y - bob + 38, { size: 12, color: COLORS.lootGold, align: 'center' });
  }
}

function drawObjective(ctx, game) {
  const label = game.vaultOpen
    ? 'OBJECTIVE: REACH THE EXIT — THE DIAMOND IS YOURS'
    : 'OBJECTIVE: CRACK THE VAULT (HOLD E) — THEN REACH THE EXIT';
  pill(ctx, 24, ROOM.top + 8, 560, 26, 'rgba(6, 10, 20, 0.72)', 'rgba(143,163,200,0.35)');
  text(ctx, label, 40, ROOM.top + 22, { size: 13, color: COLORS.text });
}

function drawToasts(ctx, game, time) {
  let y = ROOM.top + 52;
  for (const toast of game.toasts) {
    const age = time - toast.at;
    if (age > 3.2) continue;
    const alpha = age < 2.6 ? 1 : 1 - (age - 2.6) / 0.6;
    pill(ctx, VIEW_WIDTH / 2 - 210, y, 420, 28, 'rgba(6, 10, 20, 0.8)', toast.color);
    text(ctx, toast.text, VIEW_WIDTH / 2, y + 15, { size: 14, color: toast.color, align: 'center', alpha });
    y += 34;
  }
}

function drawHud(ctx, game) {
  // Bar.
  ctx.fillStyle = '#080d18';
  ctx.fillRect(0, 0, VIEW_WIDTH, HUD_HEIGHT);
  ctx.fillStyle = COLORS.thief;
  ctx.fillRect(0, HUD_HEIGHT - 2, VIEW_WIDTH, 2);

  // Loot, left: the value in the display font, the total right behind it.
  text(ctx, 'LOOT', 24, 24, { size: 12, color: COLORS.muted });
  const lootText = `$${game.thief.lootValue.toLocaleString('en-US')}`;
  text(ctx, lootText, 24, 52, {
    font: TITLE_FONT, size: 26, weight: 400, color: COLORS.lootGold,
  });
  ctx.font = `400 26px ${TITLE_FONT}`;
  const lootWidth = ctx.measureText(lootText).width;
  text(ctx, `/ $${TOTAL_LOOT_VALUE.toLocaleString('en-US')}`, 24 + lootWidth + 10, 54, {
    size: 13, color: COLORS.muted,
  });

  // Alarm meter, centre.
  const meterX = 470;
  const meterW = 340;
  const meterY = 34;
  text(ctx, 'ALARM', meterX, 22, { size: 12, color: COLORS.muted });
  const alarm = game.alarm;
  const level = alarm.level();
  const barColor = level === 2 ? COLORS.alarmHigh : level === 1 ? COLORS.alarmMid : COLORS.alarmLow;
  ctx.fillStyle = '#1a2438';
  ctx.fillRect(meterX, meterY, meterW, 16);
  ctx.fillStyle = barColor;
  ctx.fillRect(meterX, meterY, (meterW * alarm.value) / 100, 16);
  ctx.strokeStyle = 'rgba(143,163,200,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(meterX, meterY, meterW, 16);
  // Segment ticks every 25 points.
  ctx.strokeStyle = 'rgba(8,13,24,0.9)';
  for (let i = 1; i < 4; i++) {
    const sx = meterX + (meterW * i) / 4;
    ctx.beginPath();
    ctx.moveTo(sx, meterY);
    ctx.lineTo(sx, meterY + 16);
    ctx.stroke();
  }
  const flash = alarm.tripped && Math.sin(game.time * 8) > 0;
  text(ctx, alarm.label(), meterX + meterW / 2, 62, {
    size: 12, color: flash ? '#ffffff' : barColor, align: 'center',
  });

  // Coins, time and sound, right.
  text(ctx, 'COINS', 880, 22, { size: 12, color: COLORS.muted });
  for (let i = 0; i < TUNING.coinsStart; i++) {
    ctx.fillStyle = i < game.thief.coins ? COLORS.lootGold : '#2a3550';
    ctx.beginPath();
    ctx.arc(894 + i * 24, 46, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = i < game.thief.coins ? '#8a6d1a' : '#3a4a6b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const minutes = Math.floor(game.time / 60);
  const seconds = Math.floor(game.time % 60);
  text(ctx, 'TIME', 1000, 22, { size: 12, color: COLORS.muted });
  text(ctx, `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, 1000, 50, {
    font: TITLE_FONT, size: 22, weight: 400, color: COLORS.text,
  });
  text(ctx, game.muted ? 'SND OFF (M)' : 'SND ON (M)', 1180, 40, {
    size: 12, color: COLORS.muted, align: 'center',
  });
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, 'THE MERIDIAN JOB', VIEW_WIDTH / 2, 168, {
    size: 18, color: COLORS.muted, align: 'center',
  });
  ctx.save();
  ctx.shadowColor = 'rgba(53,224,255,0.8)';
  ctx.shadowBlur = 26;
  text(ctx, 'NEON VAULT', VIEW_WIDTH / 2, 240, {
    font: TITLE_FONT, size: 84, weight: 400, color: COLORS.thief, align: 'center',
  });
  ctx.restore();
  text(ctx, 'ONE ROOM. ONE THIEF. ONE WAY OUT.', VIEW_WIDTH / 2, 300, {
    size: 17, color: COLORS.text, align: 'center',
  });

  const lines = [
    ['Crack the vault', 'hold E at the safe — then run for the exit.'],
    ['Read the cones', 'guards and cameras fill the alarm meter when they see you.'],
    ['Use the room', 'cover blocks vision. Coins (click) pull a guard away.'],
    ['Getaway pays', 'escape clean for the bonus — or loud, if you must.'],
  ];
  let y = 360;
  for (const [head, body] of lines) {
    text(ctx, head.toUpperCase(), VIEW_WIDTH / 2 - 260, y, { size: 14, color: COLORS.lootGold });
    text(ctx, body, VIEW_WIDTH / 2 - 60, y, { size: 14, color: COLORS.text });
    y += 30;
  }
  text(ctx, 'WASD MOVE · SHIFT SPRINT · CLICK COIN · E CRACK · M SOUND', VIEW_WIDTH / 2, 520, {
    size: 13, color: COLORS.muted, align: 'center',
  });
  const blink = Math.sin(game.time * 4) > -0.2;
  if (blink) {
    pill(ctx, VIEW_WIDTH / 2 - 190, 556, 380, 44, 'rgba(53,224,255,0.12)', COLORS.thief);
    text(ctx, 'CLICK OR PRESS ENTER TO START', VIEW_WIDTH / 2, 579, {
      size: 16, color: COLORS.thief, align: 'center',
    });
  }
}

function drawEndPanel(ctx, game) {
  ctx.fillStyle = 'rgba(4, 7, 14, 0.78)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const won = game.state === 'won';
  const clean = won && !game.alarm.everTripped;
  ctx.save();
  ctx.shadowColor = won ? 'rgba(46,255,176,0.8)' : 'rgba(255,45,85,0.8)';
  ctx.shadowBlur = 26;
  text(ctx, won ? (clean ? 'CLEAN GETAWAY' : 'LOUD GETAWAY') : 'BUSTED!', VIEW_WIDTH / 2, 190, {
    font: TITLE_FONT, size: 64, weight: 400,
    color: won ? COLORS.exitGlow : COLORS.alarmHigh, align: 'center',
  });
  ctx.restore();
  text(
    ctx,
    won
      ? clean
        ? 'Nobody saw a thing. The Meridian Diamond is yours.'
        : 'Sirens, shouting — but the diamond is yours.'
      : `Caught by ${game.caughtBy || 'a guard'} with the alarm screaming.`,
    VIEW_WIDTH / 2, 250, { size: 16, color: COLORS.text, align: 'center' },
  );

  const rows = [
    ['TIME', game.formatTime(game.finalTime)],
    ['LOOT TAKEN', `$${game.thief.lootValue.toLocaleString('en-US')}`],
    ['TIME BONUS', `$${game.scoreBreakdown.timeBonus.toLocaleString('en-US')}`],
    ['CLEAN BONUS', `$${game.scoreBreakdown.cleanBonus.toLocaleString('en-US')}`],
    ['COINS KEPT', `$${game.scoreBreakdown.coinBonus.toLocaleString('en-US')}`],
  ];
  let y = 310;
  for (const [label, value] of rows) {
    text(ctx, label, VIEW_WIDTH / 2 - 160, y, { size: 15, color: COLORS.muted });
    text(ctx, value, VIEW_WIDTH / 2 + 160, y, { size: 15, color: COLORS.text, align: 'right' });
    y += 34;
  }
  ctx.strokeStyle = 'rgba(143,163,200,0.4)';
  ctx.beginPath();
  ctx.moveTo(VIEW_WIDTH / 2 - 160, y);
  ctx.lineTo(VIEW_WIDTH / 2 + 160, y);
  ctx.stroke();
  text(ctx, 'SCORE', VIEW_WIDTH / 2 - 160, y + 32, { size: 18, color: COLORS.lootGold });
  text(ctx, `$${game.finalScore.toLocaleString('en-US')}`, VIEW_WIDTH / 2 + 160, y + 32, {
    font: TITLE_FONT, size: 30, weight: 400, color: COLORS.lootGold, align: 'right',
  });
  if (won) {
    text(ctx, `RANK ${game.rank}`, VIEW_WIDTH / 2, y + 92, {
      font: TITLE_FONT, size: 44, weight: 400, color: COLORS.thief, align: 'center',
    });
  }
  const blink = Math.sin(game.time * 4) > -0.2;
  if (blink) {
    text(ctx, 'PRESS R TO PLAY AGAIN', VIEW_WIDTH / 2, VIEW_HEIGHT - 90, {
      size: 16, color: COLORS.text, align: 'center',
    });
  }
}

// ---- The frame -------------------------------------------------------------
export function drawFrame(ctx, game) {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  drawFloor(ctx);
  drawWalls(ctx);
  drawVault(ctx, game.vaultOpen, game.time);
  drawExit(ctx, game.thief.hasDiamond, game.time);
  drawCover(ctx);
  drawLoot(ctx, game, game.time);
  // Cones first (under the actors), then the observers, then the thief.
  for (const camera of game.cameras) drawCamera(ctx, camera);
  for (const guard of game.guards) drawGuard(ctx, guard, game.time);
  drawCoins(ctx, game.coins, game.time);
  drawThief(ctx, game.thief, game.time);
  if (game.state === 'playing') {
    drawObjective(ctx, game);
    drawToasts(ctx, game, game.time);
  }
  drawHud(ctx, game);
  if (game.state === 'title') drawTitle(ctx, game);
  if (game.state === 'won' || game.state === 'busted') drawEndPanel(ctx, game);
}
