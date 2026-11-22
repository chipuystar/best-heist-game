// world.js — the Meridian Gallery vault room: layout, tuning and geometry.
//
// One room, drawn top-down. The canvas is 1280x720; a 76px HUD bar sits at
// the top and the room fills the rest. Every coordinate in this file is an
// absolute canvas coordinate. Cover blocks both movement and vision, which is
// what makes the room a stealth puzzle instead of an open floor.

// ---- Canvas and room -------------------------------------------------------
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const HUD_HEIGHT = 76;
export const WALL = 14; // wall thickness around the room

export const ROOM = {
  left: WALL,
  top: HUD_HEIGHT + WALL,
  right: VIEW_WIDTH - WALL,
  bottom: VIEW_HEIGHT - WALL,
};

// ---- Palette (dark room, neon signals) -------------------------------------
export const COLORS = {
  floorA: '#101827',
  floorB: '#0c1220',
  wall: '#1d2942',
  wallEdge: '#31456e',
  cover: '#232f4d',
  coverTop: '#2c3c60',
  coverEdge: '#46598a',
  vault: '#3a2f16',
  vaultEdge: '#c9a227',
  exit: '#0e3b2e',
  exitGlow: '#2effb0',
  lootGold: '#ffd94d',
  lootGem: '#4dffd2',
  lootCash: '#7ee787',
  thief: '#35e0ff',
  thiefDark: '#0b3542',
  guard: '#ff5d73',
  guardCone: 'rgba(255, 93, 115, 0.24)',
  guardConeHot: 'rgba(255, 45, 85, 0.38)',
  camera: '#ff9f43',
  cameraCone: 'rgba(255, 159, 67, 0.20)',
  cameraConeHot: 'rgba(255, 120, 40, 0.34)',
  alarmLow: '#2effb0',
  alarmMid: '#ffd94d',
  alarmHigh: '#ff2d55',
  text: '#e8f1ff',
  muted: '#8fa3c8',
};

// ---- Tuning ----------------------------------------------------------------
export const TUNING = {
  thiefWalk: 168,
  thiefSprint: 248,
  thiefRadius: 13,
  guardSpeed: 72,
  guardChaseSpeed: 134,
  guardInvestigateSpeed: 152,
  guardConeRange: 215,
  guardConeHalfAngle: 0.56, // ~32 degrees
  guardPause: 1.15, // seconds a guard waits (and sweeps) at each waypoint
  guardSweep: 0.7, // radians of sweep while paused
  cameraRange: 265,
  cameraConeHalfAngle: 0.45, // ~26 degrees
  cameraSweepSpeed: 0.55, // radians per second
  detectGuard: 62, // alarm points per second at point-blank range
  detectCamera: 48,
  alarmDecay: 16, // points per second while unseen
  catchRadius: 26,
  coinRange: 320, // how far the thief can throw a coin
  coinFlight: 0.45, // seconds a thrown coin spends in the air
  coinHearRadius: 470, // a guard this close to the landing spot investigates
  coinInvestigate: 2.4, // seconds a guard looks around the landing spot
  coinsStart: 3,
  vaultCrackTime: 2.2, // seconds holding E at the vault
  vaultCrackRadius: 82,
  lootPickupRadius: 36,
  winBonusClean: 2000,
  coinBonus: 250,
};

// ---- The vault (north wall, centre) ----------------------------------------
export const VAULT = {
  rect: { x: 540, y: ROOM.top, w: 200, h: 86 },
  // The diamond sits on a pedestal inside the vault alcove.
  diamond: { x: 640, y: 140, value: 10000, name: 'MERIDIAN DIAMOND' },
  // Stand near this point and hold E to crack it.
  crackPoint: { x: 640, y: 198 },
};

// ---- The exit (south wall, centre) -----------------------------------------
export const EXIT = {
  rect: { x: 596, y: VIEW_HEIGHT - 30, w: 88, h: 30 },
  center: { x: 640, y: VIEW_HEIGHT - 14 },
};

// ---- Cover: blocks movement and line of sight ------------------------------
export const COVER = [
  // Display cases (the side loot sits on the two big ones).
  { x: 170, y: 250, w: 130, h: 74, label: 'CASE' },
  { x: 980, y: 250, w: 130, h: 74, label: 'CASE' },
  // Crate clusters mid-room: the left, centre and right routes.
  { x: 400, y: 320, w: 96, h: 72, label: 'CRATES' },
  { x: 784, y: 320, w: 96, h: 72, label: 'CRATES' },
  // The long central table.
  { x: 540, y: 430, w: 200, h: 56, label: 'TABLE' },
  // Low cabinet holding the cash stack.
  { x: 300, y: 520, w: 110, h: 56, label: 'CABINET' },
  // Pillars.
  { x: 330, y: 170, w: 46, h: 46, label: 'PILLAR' },
  { x: 904, y: 170, w: 46, h: 46, label: 'PILLAR' },
  { x: 330, y: 600, w: 46, h: 46, label: 'PILLAR' },
  { x: 904, y: 600, w: 46, h: 46, label: 'PILLAR' },
  // Sofas along the side walls.
  { x: 140, y: 470, w: 120, h: 58, label: 'SOFA' },
  { x: 1020, y: 470, w: 120, h: 58, label: 'SOFA' },
  // Planters under the cameras.
  { x: 60, y: 150, w: 70, h: 46, label: 'PLANTER' },
  { x: 1150, y: 150, w: 70, h: 46, label: 'PLANTER' },
];

// ---- Side loot (auto-pickup on touch) --------------------------------------
export const LOOT = [
  { id: 'gold', x: 235, y: 287, value: 2500, name: 'GOLD BARS', color: COLORS.lootGold, kind: 'bars' },
  { id: 'emerald', x: 1045, y: 287, value: 3000, name: 'EMERALD IDOL', color: COLORS.lootGem, kind: 'idol' },
  { id: 'cash', x: 355, y: 548, value: 1500, name: 'CASH STACK', color: COLORS.lootCash, kind: 'cash' },
];

export const TOTAL_LOOT_VALUE =
  VAULT.diamond.value + LOOT.reduce((sum, item) => sum + item.value, 0);

// ---- Guards ----------------------------------------------------------------
export const GUARDS = [
  {
    name: 'MARA',
    // A rectangular loop around the middle of the room.
    waypoints: [
      { x: 280, y: 220 },
      { x: 1000, y: 220 },
      { x: 1000, y: 520 },
      { x: 280, y: 520 },
    ],
    speed: TUNING.guardSpeed,
  },
  {
    name: 'REX',
    // A slow beat along the south of the room, watching the exit.
    waypoints: [
      { x: 220, y: 620 },
      { x: 1060, y: 620 },
    ],
    speed: 62,
    pingPong: true,
  },
];

// ---- Cameras ---------------------------------------------------------------
export const CAMERAS = [
  {
    name: 'CAM 1',
    x: 48,
    y: 116,
    baseAngle: 0.9, // looking down-right into the room
    sweep: 0.55, // radians either side of the base angle
    phase: 0,
  },
  {
    name: 'CAM 2',
    x: 1232,
    y: 116,
    baseAngle: Math.PI - 0.9, // looking down-left into the room
    sweep: 0.55,
    phase: Math.PI, // sweeps out of phase with CAM 1
  },
];

// ---- Geometry helpers ------------------------------------------------------
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Smallest absolute difference between two angles, in [0, PI].
export function angleDifference(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Does the segment (x1,y1)-(x2,y2) cross the rectangle? Used for vision:
// a guard sees the thief only when no cover stands between them.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < rect.x || minX > rect.x + rect.w || maxY < rect.y || minY > rect.y + rect.h) {
    return false;
  }
  // Either endpoint inside the rectangle counts as a hit.
  if (x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h) return true;
  // Otherwise test the four edges.
  const edges = [
    [rect.x, rect.y, rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
    [rect.x, rect.y + rect.h, rect.x, rect.y],
  ];
  return edges.some(([ex1, ey1, ex2, ey2]) => segmentsCross(x1, y1, x2, y2, ex1, ey1, ex2, ey2));
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// True when nothing between the two points blocks vision. Cover and the vault
// block; the exit doorway and the floor never do.
export function lineOfSight(x1, y1, x2, y2) {
  const blockers = [...COVER, VAULT.rect];
  return !blockers.some((rect) => segmentHitsRect(x1, y1, x2, y2, rect));
}

// Circle-versus-rectangle test for movement collision.
export function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

// Every solid rectangle the thief and the guards collide with: cover plus the
// vault block (the diamond is reached from its front, never from inside).
export function solidRects() {
  return [...COVER, VAULT.rect];
}
