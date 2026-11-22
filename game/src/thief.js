// thief.js — the player. WASD or arrows to move, Shift to sprint, click to
// throw a coin, hold E at the vault to crack it. Loot is picked up by walking
// over it; the vault diamond is the one prize that takes time, which is the
// moment the patrols punish.
//
// Movement collides against the room walls and every solid rectangle, one
// axis at a time, so the thief slides along cover instead of sticking to it.

import {
  ROOM,
  TUNING,
  VAULT,
  circleHitsRect,
  clamp,
  distance,
  solidRects,
} from './world.js';

export class Thief {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = TUNING.thiefRadius;
    this.facing = -Math.PI / 2; // starts looking up the room
    this.moving = false;
    this.sprinting = false;
    this.coins = TUNING.coinsStart;
    this.crackProgress = 0; // 0..1 while cracking the vault
    this.cracking = false;
    this.hasDiamond = false;
    this.lootValue = 0;
    this.lootTaken = new Set();
    this.stepPhase = 0; // drives the little run bob
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.facing = -Math.PI / 2;
    this.moving = false;
    this.sprinting = false;
    this.coins = TUNING.coinsStart;
    this.crackProgress = 0;
    this.cracking = false;
    this.hasDiamond = false;
    this.lootValue = 0;
    this.lootTaken = new Set();
    this.stepPhase = 0;
  }

  // `keys` is a Set of currently held key codes; `vaultOpen` tells us whether
  // the diamond is already secured. Returns nothing; the game reads the
  // thief's fields after the update.
  update(keys, dt, vaultOpen) {
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;

    this.sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = this.sprinting ? TUNING.thiefSprint : TUNING.thiefWalk;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      this.facing = Math.atan2(dy, dx);
      this.stepPhase += dt * (this.sprinting ? 14 : 9);
      this.moveBy(dx * speed * dt, 0);
      this.moveBy(0, dy * speed * dt);
    }

    // Cracking the vault: hold E, stand still-ish near the vault front. The
    // progress holds when the key is released and decays slowly, so a guard
    // sweeping past costs time rather than the whole crack.
    const nearVault = distance(this.x, this.y, VAULT.crackPoint.x, VAULT.crackPoint.y) <= TUNING.vaultCrackRadius;
    const holdingE = keys.has('KeyE');
    this.cracking = !vaultOpen && nearVault && holdingE && !this.moving;
    if (this.cracking) {
      this.crackProgress += dt / TUNING.vaultCrackTime;
      if (this.crackProgress > 1) this.crackProgress = 1;
    } else if (!vaultOpen) {
      this.crackProgress = Math.max(0, this.crackProgress - dt * 0.25);
    }
  }

  // Move one axis, then undo it if a wall or a solid rect is in the way.
  moveBy(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.x = clamp(this.x, ROOM.left + this.radius, ROOM.right - this.radius);
    this.y = clamp(this.y, ROOM.top + this.radius, ROOM.bottom - this.radius);
    for (const rect of solidRects()) {
      if (circleHitsRect(this.x, this.y, this.radius, rect)) {
        this.x -= dx;
        this.y -= dy;
        return;
      }
    }
  }

  canThrowCoin() {
    return this.coins > 0;
  }

  // The game turns a click into a coin with this: it spends the coin and
  // returns the clamped landing point, or null when no coin is left.
  spendCoin(targetX, targetY) {
    if (this.coins <= 0) return null;
    this.coins -= 1;
    const d = distance(this.x, this.y, targetX, targetY);
    const range = Math.min(d, TUNING.coinRange);
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    return {
      x: clamp(this.x + Math.cos(angle) * range, ROOM.left + 8, ROOM.right - 8),
      y: clamp(this.y + Math.sin(angle) * range, ROOM.top + 8, ROOM.bottom - 8),
    };
  }

  // Walk-over pickup for the side loot. Returns the items collected.
  collectLoot(lootItems) {
    const taken = [];
    for (const item of lootItems) {
      if (this.lootTaken.has(item.id)) continue;
      if (distance(this.x, this.y, item.x, item.y) <= TUNING.lootPickupRadius) {
        this.lootTaken.add(item.id);
        this.lootValue += item.value;
        taken.push(item);
      }
    }
    return taken;
  }

  secureDiamond() {
    if (this.hasDiamond) return false;
    this.hasDiamond = true;
    this.lootValue += VAULT.diamond.value;
    return true;
  }

  nearVaultFront() {
    return distance(this.x, this.y, VAULT.crackPoint.x, VAULT.crackPoint.y) <= TUNING.vaultCrackRadius;
  }
}
