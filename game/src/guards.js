// guards.js — the patrol. Each guard walks a waypoint loop, pauses at every
// waypoint to sweep the room with its vision cone, investigates a coin that
// lands nearby, and hunts the thief once the alarm trips. A guard only sees
// the thief inside its cone, within range, with a clear line of sight —
// cover is the thief's friend.
//
// The guard also reports how strongly it sees the thief this frame, which the
// game turns into alarm points. Detection grows as the thief gets closer, so
// a distant brush with a cone is a warning and a close one is a crisis.

import {
  ROOM,
  TUNING,
  angleDifference,
  circleHitsRect,
  clamp,
  distance,
  lineOfSight,
  solidRects,
} from './world.js';

export class Guard {
  constructor(definition) {
    this.name = definition.name;
    this.waypoints = definition.waypoints;
    this.speed = definition.speed;
    this.pingPong = Boolean(definition.pingPong);
    this.x = definition.waypoints[0].x;
    this.y = definition.waypoints[0].y;
    this.waypointIndex = 1 % definition.waypoints.length;
    this.direction = 1;
    this.facing = Math.atan2(
      definition.waypoints[this.waypointIndex].y - this.y,
      definition.waypoints[this.waypointIndex].x - this.x,
    );
    this.state = 'patrol'; // patrol | pause | investigate | chase | look
    this.pauseTimer = 0;
    this.sweepPhase = 0;
    this.pauseBaseAngle = this.facing;
    this.investigateTarget = null;
    this.lookTimer = 0;
    this.seesThief = false; // this frame
    this.detectRate = 0; // alarm points per second this frame
    this.walkPhase = 0;
  }

  reset() {
    const first = this.waypoints[0];
    this.x = first.x;
    this.y = first.y;
    this.waypointIndex = 1 % this.waypoints.length;
    this.direction = 1;
    this.facing = Math.atan2(
      this.waypoints[this.waypointIndex].y - this.y,
      this.waypoints[this.waypointIndex].x - this.x,
    );
    this.state = 'patrol';
    this.pauseTimer = 0;
    this.investigateTarget = null;
    this.lookTimer = 0;
    this.seesThief = false;
    this.detectRate = 0;
  }

  // How strongly this guard sees a point: 0 when out of the cone, out of
  // range, or behind cover; up to full rate at point-blank range.
  detectionAt(x, y) {
    const d = distance(this.x, this.y, x, y);
    if (d > TUNING.guardConeRange) return 0;
    const angleTo = Math.atan2(y - this.y, x - this.x);
    if (angleDifference(angleTo, this.facing) > TUNING.guardConeHalfAngle) return 0;
    if (!lineOfSight(this.x, this.y, x, y)) return 0;
    return TUNING.detectGuard * (1.25 - (d / TUNING.guardConeRange) * 0.75);
  }

  update(dt, thief, alarmTripped) {
    // Vision is evaluated before movement, from the current facing.
    this.detectRate = this.detectionAt(thief.x, thief.y);
    this.seesThief = this.detectRate > 0;

    if (alarmTripped) {
      this.state = 'chase';
      this.chase(dt, thief);
      return;
    }
    if (this.state === 'chase') this.state = 'patrol';

    if (this.state === 'investigate' && this.investigateTarget) {
      const arrived = this.walkToward(this.investigateTarget.x, this.investigateTarget.y, TUNING.guardInvestigateSpeed, dt);
      if (arrived) {
        this.state = 'look';
        this.lookTimer = TUNING.coinInvestigate;
        this.pauseBaseAngle = this.facing;
        this.sweepPhase = 0;
      }
      return;
    }
    if (this.state === 'look') {
      this.lookTimer -= dt;
      this.sweepPhase += dt * 1.6;
      this.facing = this.pauseBaseAngle + Math.sin(this.sweepPhase) * TUNING.guardSweep;
      if (this.lookTimer <= 0) {
        this.state = 'patrol';
        this.investigateTarget = null;
      }
      return;
    }
    if (this.state === 'pause') {
      this.pauseTimer -= dt;
      this.sweepPhase += dt * 1.4;
      this.facing = this.pauseBaseAngle + Math.sin(this.sweepPhase) * TUNING.guardSweep;
      if (this.pauseTimer <= 0) this.state = 'patrol';
      return;
    }

    // Patrol: walk to the current waypoint, pause and sweep on arrival.
    const target = this.waypoints[this.waypointIndex];
    const arrived = this.walkToward(target.x, target.y, this.speed, dt);
    if (arrived) {
      this.advanceWaypoint();
      this.state = 'pause';
      this.pauseTimer = TUNING.guardPause;
      this.pauseBaseAngle = this.facing;
      this.sweepPhase = 0;
    }
  }

  chase(dt, thief) {
    // The chase is slower than the thief's sprint and about as fast as the
    // walk, so a caught moment is the thief's mistake, not a scripted loss.
    this.walkToward(thief.x, thief.y, TUNING.guardChaseSpeed, dt);
  }

  // A coin landing nearby pulls the nearest idle guard off patrol.
  sendToInvestigate(x, y) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.investigateTarget = { x, y };
  }

  advanceWaypoint() {
    if (!this.pingPong) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      return;
    }
    const next = this.waypointIndex + this.direction;
    if (next >= this.waypoints.length || next < 0) {
      this.direction *= -1;
      this.waypointIndex += this.direction;
    } else {
      this.waypointIndex = next;
    }
  }

  // Walk toward a point with wall and cover collision, one axis at a time.
  // Returns true when the point is reached.
  walkToward(targetX, targetY, speed, dt) {
    const d = distance(this.x, this.y, targetX, targetY);
    if (d < 6) return true;
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.facing = angle;
    const step = Math.min(speed * dt, d);
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    this.walkPhase += dt * 8;
    this.x = clamp(this.x + dx, ROOM.left + 14, ROOM.right - 14);
    this.y = clamp(this.y + dy, ROOM.top + 14, ROOM.bottom - 14);
    for (const rect of solidRects()) {
      if (circleHitsRect(this.x, this.y, 14, rect)) {
        // Slide: keep the axis that did not collide.
        this.x -= dx;
        this.y -= dy;
        const tryX = this.x + dx;
        if (!solidRects().some((r) => circleHitsRect(tryX, this.y, 14, r))) this.x = tryX;
        const tryY = this.y + dy;
        if (!solidRects().some((r) => circleHitsRect(this.x, tryY, 14, r))) this.y = tryY;
        return false;
      }
    }
    return distance(this.x, this.y, targetX, targetY) < 6;
  }
}
