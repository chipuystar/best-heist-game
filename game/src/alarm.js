// alarm.js — the alarm meter. It rises while any guard or camera sees the
// thief, decays while nobody does, and trips at 100: guards stop patrolling
// and hunt the thief. A tripped alarm never resets — the only way out is the
// exit door, which is what makes the getaway pay off the planning.

import { TUNING } from './world.js';

export class AlarmMeter {
  constructor() {
    this.value = 0; // 0..100
    this.tripped = false;
    this.everTripped = false;
    this.seenNow = false; // at least one observer sees the thief this frame
    this.rising = false; // the meter rose this frame (for the HUD flash)
  }

  reset() {
    this.value = 0;
    this.tripped = false;
    this.everTripped = false;
    this.seenNow = false;
    this.rising = false;
  }

  // `detection` is alarm points per second from all observers combined.
  update(detection, dt) {
    this.rising = false;
    if (this.tripped) {
      this.value = 100;
      this.seenNow = detection > 0;
      return;
    }
    if (detection > 0) {
      this.value += detection * dt;
      this.rising = true;
      this.seenNow = true;
    } else {
      this.value -= TUNING.alarmDecay * dt;
      this.seenNow = false;
    }
    if (this.value >= 100) {
      this.value = 100;
      this.tripped = true;
      this.everTripped = true;
    }
    if (this.value < 0) this.value = 0;
  }

  // 0 = calm, 1 = warm, 2 = hot. The HUD and the cones read this.
  level() {
    if (this.tripped || this.value >= 70) return 2;
    if (this.value >= 30) return 1;
    return 0;
  }

  label() {
    if (this.tripped) return 'ALARM TRIPPED';
    if (this.value >= 70) return 'ALMOST SPOTTED';
    if (this.value >= 30) return 'SUSPICIOUS';
    return 'UNDETECTED';
  }
}
