// cameras.js — the wall-mounted security cameras. Each one sweeps its cone
// back and forth across the room on a fixed rhythm, out of phase with the
// other, so the thief reads the sweep and times the crossing. A camera never
// moves and never chases; it only watches, and its cone turns hot red while
// it sees the thief.

import {
  TUNING,
  angleDifference,
  distance,
  lineOfSight,
} from './world.js';

export class SecurityCamera {
  constructor(definition) {
    this.name = definition.name;
    this.x = definition.x;
    this.y = definition.y;
    this.baseAngle = definition.baseAngle;
    this.sweep = definition.sweep;
    this.phase = definition.phase;
    this.angle = definition.baseAngle;
    this.time = 0;
    this.seesThief = false;
    this.detectRate = 0;
  }

  reset() {
    this.time = 0;
    this.angle = this.baseAngle;
    this.seesThief = false;
    this.detectRate = 0;
  }

  detectionAt(x, y) {
    const d = distance(this.x, this.y, x, y);
    if (d > TUNING.cameraRange) return 0;
    const angleTo = Math.atan2(y - this.y, x - this.x);
    if (angleDifference(angleTo, this.angle) > TUNING.cameraConeHalfAngle) return 0;
    if (!lineOfSight(this.x, this.y, x, y)) return 0;
    return TUNING.detectCamera * (1.25 - (d / TUNING.cameraRange) * 0.75);
  }

  update(dt, thief) {
    this.time += dt;
    this.angle =
      this.baseAngle +
      Math.sin(this.time * TUNING.cameraSweepSpeed + this.phase) * this.sweep;
    this.detectRate = this.detectionAt(thief.x, thief.y);
    this.seesThief = this.detectRate > 0;
  }
}
