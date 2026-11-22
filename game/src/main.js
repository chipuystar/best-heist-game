// main.js — Neon Vault Heist: the game loop, the state machine and the wiring.
//
// States: title -> playing -> won | busted. The loop runs at the display's
// refresh rate with a clamped delta so a slow frame never teleports anyone.
// Input is keyboard (WASD/arrows, Shift, E, M, R, Enter) plus the mouse: a
// click throws a coin at the clicked point.
//
// The ?shot= URL parameter stages a scene for the maker's screenshots
// (cover, vault, alarm, win). It only sets starting positions and the alarm
// value; every pixel is still the game's own live render.

import { AlarmMeter } from './alarm.js';
import { SecurityCamera } from './cameras.js';
import { Guard } from './guards.js';
import { SoundBank } from './audio.js';
import { Thief } from './thief.js';
import { drawFrame } from './render.js';
import {
  CAMERAS,
  COLORS,
  EXIT,
  GUARDS,
  LOOT,
  TUNING,
  VAULT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  distance,
} from './world.js';

const START = { x: 640, y: 665 }; // the thief slips in through the south door
const OFFSTAGE = { x: -9999, y: -9999 }; // where the title screen hides the thief

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.time = 0; // seconds since the run started (title time runs too)
    this.thief = new Thief(START.x, START.y);
    this.guards = GUARDS.map((definition) => new Guard(definition));
    this.cameras = CAMERAS.map((definition) => new SecurityCamera(definition));
    this.alarm = new AlarmMeter();
    this.sound = new SoundBank();
    this.coins = []; // thrown coins, flying or landed
    this.toasts = [];
    this.keys = new Set();
    this.vaultOpen = false;
    this.caughtBy = null;
    this.finalTime = 0;
    this.finalScore = 0;
    this.rank = 'C';
    this.scoreBreakdown = { timeBonus: 0, cleanBonus: 0, coinBonus: 0 };
    this.muted = false;
    this.lastTick = performance.now();
    this.boundLoop = this.loop.bind(this);
    this.attachInput();
    this.stageShot(new URLSearchParams(window.location.search).get('shot'));
  }

  // ---- Staged scenes for screenshots ---------------------------------------
  stageShot(shot) {
    if (!shot) return;
    if (shot === 'cover') {
      // The money frame: thief mid-room, cones sweeping, alarm half-warm.
      // The value starts high because the meter decays while the shot sets up.
      this.state = 'playing';
      this.thief.x = 640;
      this.thief.y = 380;
      this.thief.facing = -Math.PI / 2;
      this.alarm.value = 60;
      this.advancePatrol(4.5);
    } else if (shot === 'vault') {
      // Mid-crack at the safe, a guard's cone closing in.
      this.state = 'playing';
      this.thief.x = VAULT.crackPoint.x;
      this.thief.y = VAULT.crackPoint.y + 6;
      this.thief.facing = -Math.PI / 2;
      this.thief.crackProgress = 0.85;
      this.thief.cracking = true;
      this.alarm.value = 80;
      this.advancePatrol(9.0);
    } else if (shot === 'alarm') {
      // Tripped: guards converging on the thief, sirens up.
      this.state = 'playing';
      this.thief.x = 640;
      this.thief.y = 510;
      this.thief.hasDiamond = true;
      this.thief.lootValue = VAULT.diamond.value + 2500;
      this.thief.lootTaken.add('gold');
      this.vaultOpen = true;
      this.alarm.value = 100;
      this.alarm.tripped = true;
      this.alarm.everTripped = true;
      this.advancePatrol(2.0);
    } else if (shot === 'win') {
      this.state = 'won';
      this.thief.hasDiamond = true;
      this.thief.lootValue = 17000;
      this.thief.lootTaken.add('gold');
      this.thief.lootTaken.add('emerald');
      this.thief.lootTaken.add('cash');
      this.vaultOpen = true;
      this.finalTime = 142;
      this.scoreBreakdown = { timeBonus: 1580, cleanBonus: 2000, coinBonus: 500 };
      this.finalScore = 17000 + 1580 + 2000 + 500;
      this.rank = 'S';
    }
  }

  // Run the patrols forward so a staged shot catches them mid-route.
  advancePatrol(seconds) {
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) {
      for (const guard of this.guards) guard.update(step, OFFSTAGE, false);
      for (const camera of this.cameras) camera.update(step, OFFSTAGE);
    }
    // Re-evaluate vision once from the staged positions.
    for (const guard of this.guards) guard.detectRate = guard.detectionAt(this.thief.x, this.thief.y);
    for (const camera of this.cameras) camera.detectRate = camera.detectionAt(this.thief.x, this.thief.y);
  }

  // ---- Input ---------------------------------------------------------------
  attachInput() {
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) return;
      this.keys.add(event.code);
      this.sound.unlock();
      if (event.code === 'KeyM') {
        this.muted = !this.muted;
        this.sound.setMuted(this.muted);
      }
      if (event.code === 'Enter' && this.state === 'title') this.start();
      if (event.code === 'KeyR' && this.state !== 'title') this.reset();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    this.canvas.addEventListener('click', (event) => {
      this.sound.unlock();
      if (this.state === 'title') {
        this.start();
        return;
      }
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
      this.throwCoin(x, y);
    });
    // A click anywhere on the title also starts (the canvas fills the page).
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ---- Flow ------------------------------------------------------------------
  start() {
    this.reset();
    this.state = 'playing';
    this.toast('CRACK THE VAULT — THEN REACH THE EXIT', COLORS.lootGold);
  }

  reset() {
    this.state = this.state === 'title' ? 'title' : 'playing';
    this.time = 0;
    this.thief.reset(START.x, START.y);
    for (const guard of this.guards) guard.reset();
    for (const camera of this.cameras) camera.reset();
    this.alarm.reset();
    this.coins = [];
    this.toasts = [];
    this.vaultOpen = false;
    this.caughtBy = null;
    this.finalScore = 0;
    this.rank = 'C';
    this.scoreBreakdown = { timeBonus: 0, cleanBonus: 0, coinBonus: 0 };
    this.sound.stopSiren();
  }

  toast(textValue, color) {
    this.toasts.push({ text: textValue, color, at: this.time });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  throwCoin(x, y) {
    const landing = this.thief.spendCoin(x, y);
    if (!landing) {
      this.toast('NO COINS LEFT', COLORS.alarmHigh);
      return;
    }
    this.sound.coinThrow();
    this.coins.push({
      state: 'flying',
      fromX: this.thief.x,
      fromY: this.thief.y,
      x: landing.x,
      y: landing.y,
      progress: 0,
      landedAt: 0,
    });
  }

  // ---- Update ---------------------------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.state === 'title') {
      // Attract mode: the room lives behind the title, nobody hunting.
      for (const guard of this.guards) guard.update(dt, OFFSTAGE, false);
      for (const camera of this.cameras) camera.update(dt, OFFSTAGE);
      return;
    }
    if (this.state !== 'playing') return;

    const wasTripped = this.alarm.tripped;
    this.thief.update(this.keys, dt, this.vaultOpen);
    for (const guard of this.guards) guard.update(dt, this.thief, this.alarm.tripped);
    for (const camera of this.cameras) camera.update(dt, this.thief);

    // Every observer's detection adds up into the alarm meter.
    let detection = 0;
    for (const guard of this.guards) detection += guard.detectRate;
    for (const camera of this.cameras) detection += camera.detectRate;
    this.alarm.update(detection, dt);
    if (this.alarm.tripped && !wasTripped) {
      this.toast('ALARM TRIPPED — RUN FOR THE EXIT!', COLORS.alarmHigh);
      this.sound.spotted();
      this.sound.startSiren();
    }

    // Coins in flight land, clink, and pull the nearest idle guard over.
    for (const coin of this.coins) {
      if (coin.state !== 'flying') continue;
      coin.progress += dt / TUNING.coinFlight;
      if (coin.progress >= 1) {
        coin.state = 'landed';
        coin.landedAt = this.time;
        this.sound.coinLand();
        this.distractGuards(coin.x, coin.y);
      }
    }
    this.coins = this.coins.filter(
      (coin) => coin.state === 'flying' || this.time - coin.landedAt < 3.5,
    );

    // Walk-over loot. The thief tracks what it already took.
    const taken = this.thief.collectLoot(LOOT);
    for (const item of taken) {
      this.toast(`+$${item.value.toLocaleString('en-US')} — ${item.name}`, item.color);
      this.sound.pickup();
    }

    // The vault: a finished crack secures the diamond.
    if (!this.vaultOpen && this.thief.crackProgress >= 1) {
      this.vaultOpen = true;
      this.thief.secureDiamond();
      this.toast('DIAMOND SECURED — REACH THE EXIT!', COLORS.lootGem);
      this.sound.vaultOpen();
    }
    if (this.thief.cracking && Math.random() < dt * 6) this.sound.vaultTick();

    // Caught: any guard close enough to grab the thief.
    for (const guard of this.guards) {
      if (distance(guard.x, guard.y, this.thief.x, this.thief.y) <= TUNING.catchRadius) {
        this.bust(guard.name);
        return;
      }
    }

    // Win: the diamond plus the exit door.
    if (this.thief.hasDiamond && this.inExit()) this.win();
  }

  inExit() {
    return (
      this.thief.x >= EXIT.rect.x - 6 &&
      this.thief.x <= EXIT.rect.x + EXIT.rect.w + 6 &&
      this.thief.y >= EXIT.rect.y - 10
    );
  }

  distractGuards(x, y) {
    if (this.alarm.tripped) return; // a hunting guard ignores coins
    let nearest = null;
    let nearestDistance = TUNING.coinHearRadius;
    for (const guard of this.guards) {
      if (guard.state === 'chase') continue;
      const d = distance(guard.x, guard.y, x, y);
      if (d < nearestDistance) {
        nearest = guard;
        nearestDistance = d;
      }
    }
    if (nearest) nearest.sendToInvestigate(x, y);
  }

  win() {
    this.state = 'won';
    this.finalTime = this.time;
    this.sound.stopSiren();
    this.sound.win();
    const timeBonus = Math.max(0, 3000 - Math.floor(this.time) * 10);
    const cleanBonus = this.alarm.everTripped ? 0 : TUNING.winBonusClean;
    const coinBonus = this.thief.coins * TUNING.coinBonus;
    this.scoreBreakdown = { timeBonus, cleanBonus, coinBonus };
    this.finalScore = this.thief.lootValue + timeBonus + cleanBonus + coinBonus;
    this.rank =
      this.finalScore >= 20000 ? 'S' : this.finalScore >= 17000 ? 'A' : this.finalScore >= 13000 ? 'B' : 'C';
  }

  bust(guardName) {
    this.state = 'busted';
    this.finalTime = this.time;
    this.caughtBy = guardName;
    this.sound.stopSiren();
    this.sound.busted();
    this.scoreBreakdown = { timeBonus: 0, cleanBonus: 0, coinBonus: 0 };
    this.finalScore = this.thief.lootValue;
  }

  formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ---- Loop ------------------------------------------------------------------
  loop(now) {
    const dt = Math.min((now - this.lastTick) / 1000, 0.05);
    this.lastTick = now;
    this.update(dt);
    drawFrame(this.ctx, this);
    requestAnimationFrame(this.boundLoop);
  }

  run() {
    // Wait for the display fonts so the first frame is already set in them.
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => requestAnimationFrame(this.boundLoop));
    } else {
      requestAnimationFrame(this.boundLoop);
    }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.run();

// Test hook for the maker's own play-tests (CDP): the live game object.
window.__heist = game;
