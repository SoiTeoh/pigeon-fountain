export type PigeonCharacterId = 'black_bad' | 'fat_chonk';

export interface CharacterSpec {
  readonly id: PigeonCharacterId;
  readonly name: string;
  readonly tag: string;
  readonly skillName: string;
  readonly radius: number;
  readonly density: number;
  readonly friction: number;
  readonly frictionStatic: number;
  readonly frictionAir: number;
  readonly restitution: number;
  readonly powerMult: number;
  readonly diveSlamVy: number;
  readonly diveSlamVxDamp: number;
  readonly shockRadiusPx: number;
  readonly shockSpeedPx: number;
}

export const CHARACTERS: Record<PigeonCharacterId, CharacterSpec> = {
  black_bad: {
    id: 'black_bad',
    name: '黑小坏',
    tag: '灵巧均衡',
    skillName: '铁臀速降墩坐',
    radius: 20,
    density: 0.0024,
    friction: 0.78,
    frictionStatic: 1.0,
    frictionAir: 0.0012,
    restitution: 0.24,
    powerMult: 1.0,
    diveSlamVy: 590,
    diveSlamVxDamp: 0.25,
    shockRadiusPx: 74,
    shockSpeedPx: 230,
  },
  fat_chonk: {
    id: 'fat_chonk',
    name: '胖大肥',
    tag: '重磅压棚',
    skillName: '泰山重磅压棚',
    radius: 25,
    density: 0.0056,
    friction: 0.96,
    frictionStatic: 1.25,
    frictionAir: 0.0014,
    restitution: 0.14,
    powerMult: 0.93,
    diveSlamVy: 820,
    diveSlamVxDamp: 0.18,
    shockRadiusPx: 100,
    shockSpeedPx: 345,
  },
};

export const launchTuning = {
  view: {
    width: 390,
    height: 640,
  },
  loop: {
    fixedDtMs: 1000 / 60,
    maxFrameDtMs: 50,
  },
  physics: {
    groundY: 500,
    gravityY: 0.9,
    gravityScale: 0.001,
    gravityPxPerSec2: 900,
    birdRadius: 20,
    birdFrictionAir: 0.0012,
    benchFriction: 0.88,
    cupDensity: 0.00075,
    glassDensity: 0.001,
    glassBreakSpeedPx: 165,
  },
  slingshot: {
    minPullPx: 15,
    maxPullPx: 108,
    grabRadiusPx: 78,
    powerScale: 6.9,
    minLaunchVx: 65,
    minUpwardVy: -195,
    previewFraction: 0.35,
    previewTotalFlightSec: 1.45,
    previewDotCount: 11,
  },
  settle: {
    speedThresholdPxPerSec: 18,
    durationSec: 0.85,
    offSeatStillTimeoutSec: 1.75,
    winSlowMoSec: 0.5,
  },
  match: {
    totalPigeons: 3,
    remainingPigeonBonus: 1000,
  },
  ui: {
    hud: {
      bar: { x: 12, y: 12, w: 366, h: 46, r: 14 },
      retryBtn: { x: 248, y: 20, w: 66, h: 30, r: 9 },
      nextBirdBtn: { x: 246, y: 546, w: 132, h: 42, r: 14 },
      charBlackBtn: { x: 14, y: 546, w: 104, h: 42, r: 12 },
      charFatBtn: { x: 124, y: 546, w: 104, h: 42, r: 12 },
      muteBtn: { x: 326, y: 35, r: 14 },
      homeBtn: { x: 358, y: 35, r: 14 },
    },
    title: {
      card: { x: 18, y: 58, w: 354, h: 524, r: 22 },
      gridStartX: 34,
      gridStartY: 162,
      cardW: 102,
      cardH: 96,
      gapX: 8,
      gapY: 8,
      startBtn: { x: 54, y: 512, w: 282, h: 50, r: 16 },
    },
    result: {
      card: { x: 20, y: 44, w: 350, h: 554, r: 22 },
      savePhotoBtn: { x: 52, y: 368, w: 286, h: 38, r: 12 },
      primaryBtn: { x: 52, y: 484, w: 286, h: 44, r: 14 },
      leftBtn: { x: 52, y: 536, w: 137, h: 42, r: 14 },
      rightBtn: { x: 201, y: 536, w: 137, h: 42, r: 14 },
      soloLeftBtn: { x: 52, y: 518, w: 137, h: 48, r: 14 },
      soloRightBtn: { x: 201, y: 518, w: 137, h: 48, r: 14 },
    },
  },
} as const;

export type LaunchTuning = typeof launchTuning;
