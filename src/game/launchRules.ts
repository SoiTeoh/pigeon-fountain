import type {
  AwningSpec,
  LaunchStageConfig,
  RelayFountainSpec,
  SeatZoneSpec,
} from '../config/launchStages';
import {
  CHARACTERS,
  launchTuning,
  type LaunchTuning,
  type PigeonCharacterId,
} from '../config/launchTuning';

export type LaunchScreenMode = 'title' | 'playing' | 'result';
export type FlightPhase = 'aiming' | 'flying' | 'settling_win' | 'round_over';

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface SlingshotResult {
  readonly valid: boolean;
  readonly pullDistPx: number;
  readonly powerRatio: number;
  readonly vx: number;
  readonly vy: number;
  readonly clampedPullPoint: Point2D;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes reverse-drag slingshot velocity vector from anchor & pointer.
 * Scales by selected character power multiplier; pulls < 15px cancel cleanly.
 */
export function computeSlingshotLaunch(
  anchor: Point2D,
  pointer: Point2D,
  t: LaunchTuning = launchTuning,
  characterId: PigeonCharacterId = 'black_bad',
): SlingshotResult {
  const rawDx = anchor.x - pointer.x;
  const rawDy = anchor.y - pointer.y;
  const rawDist = Math.hypot(rawDx, rawDy);

  if (rawDist < t.slingshot.minPullPx) {
    return {
      valid: false,
      pullDistPx: rawDist,
      powerRatio: 0,
      vx: 0,
      vy: 0,
      clampedPullPoint: { x: pointer.x, y: pointer.y },
    };
  }

  const charSpec = CHARACTERS[characterId];
  const clampedPullDist = Math.min(rawDist, t.slingshot.maxPullPx);
  const scale = clampedPullDist / rawDist;
  const pullBackX = Math.max(8, rawDx);
  const pullDownY = Math.min(-22, rawDy);
  const norm = Math.hypot(pullBackX, pullDownY);
  const dirX = pullBackX / norm;
  const dirY = pullDownY / norm;

  const speed = clampedPullDist * t.slingshot.powerScale * charSpec.powerMult;
  const vx = Math.max(t.slingshot.minLaunchVx * charSpec.powerMult, dirX * speed);
  const vy = Math.min(t.slingshot.minUpwardVy * charSpec.powerMult, dirY * speed);

  const clampedPullPoint: Point2D = {
    x: anchor.x - (anchor.x - pointer.x) * scale,
    y: anchor.y - (anchor.y - pointer.y) * scale,
  };

  return {
    valid: true,
    pullDistPx: clampedPullDist,
    powerRatio: clamp(
      (clampedPullDist - t.slingshot.minPullPx) /
        (t.slingshot.maxPullPx - t.slingshot.minPullPx),
      0,
      1,
    ),
    vx,
    vy,
    clampedPullPoint,
  };
}

/**
 * Predicts only the first ~35% of the parabolic trajectory (matching Matter.js 60Hz drag & gravity).
 */
export function predictTrajectoryPoints(
  startX: number,
  startY: number,
  vxPxPerSec: number,
  vyPxPerSec: number,
  t: LaunchTuning = launchTuning,
  characterId: PigeonCharacterId = 'black_bad',
): Point2D[] {
  const dots: Point2D[] = [];
  const stepSec = 1 / 60;
  const previewSec = t.slingshot.previewTotalFlightSec * t.slingshot.previewFraction;
  const totalSteps = Math.max(4, Math.round(previewSec / stepSec));
  const dotInterval = Math.max(1, Math.floor(totalSteps / t.slingshot.previewDotCount));

  let x = startX;
  let y = startY;
  let vxStep = vxPxPerSec / 60;
  let vyStep = vyPxPerSec / 60;
  const dtMs = t.loop.fixedDtMs;
  const gStep = t.physics.gravityY * t.physics.gravityScale * dtMs * dtMs;
  const drag = 1 - CHARACTERS[characterId].frictionAir;

  for (let s = 1; s <= totalSteps; s++) {
    vxStep = vxStep * drag;
    vyStep = vyStep * drag + gStep;
    x += vxStep;
    y += vyStep;
    if (s % dotInterval === 0) {
      dots.push({ x, y });
    }
  }

  return dots;
}

export function canTriggerDiveSlam(phase: FlightPhase, diveSlamUsed: boolean): boolean {
  return phase === 'flying' && !diveSlamUsed;
}

export function canTriggerRelayFountain(
  birdX: number,
  birdY: number,
  relay: RelayFountainSpec | null,
  relayCooldownSec: number,
): boolean {
  if (!relay || relayCooldownSec > 0) return false;
  return (
    Math.abs(birdX - relay.x) <= relay.triggerRadiusPx &&
    Math.abs(birdY - relay.y) <= relay.triggerHeightPx
  );
}

export function findTriggeredRelayFountain(
  birdX: number,
  birdY: number,
  relays: readonly RelayFountainSpec[],
  cooldowns: Readonly<Record<string, number>>,
): RelayFountainSpec | null {
  for (const r of relays) {
    if (canTriggerRelayFountain(birdX, birdY, r, cooldowns[r.id] ?? 0)) {
      return r;
    }
  }
  return null;
}

export function isAwningFlattened(
  awningAngleRad: number,
  awning: AwningSpec | null,
): boolean {
  if (!awning) return true;
  return Math.abs(awningAngleRad) <= awning.flatThresholdRad;
}

export function areAllCupsIntact(cupDisturbedFlags: readonly boolean[]): boolean {
  return cupDisturbedFlags.every((disturbed) => !disturbed);
}

export interface SeatSettleEval {
  readonly inZone: boolean;
  readonly nextSettleSec: number;
  readonly progressRatio: number;
  readonly settled: boolean;
}

export function evaluateSeatSettle(
  birdX: number,
  birdY: number,
  speedPxPerSec: number,
  isSupported: boolean,
  seat: SeatZoneSpec,
  prevSettleSec: number,
  dtSec: number,
  t: LaunchTuning = launchTuning,
  awningAngleRad = 0,
  awning: AwningSpec | null = null,
): SeatSettleEval {
  const inX = Math.abs(birdX - seat.x) <= seat.halfW;
  const inY = birdY >= seat.minY && birdY <= seat.maxY;
  const awningOk = isAwningFlattened(awningAngleRad, awning);
  const inZone = inX && inY && isSupported;

  if (!inZone || !awningOk || speedPxPerSec >= t.settle.speedThresholdPxPerSec) {
    return {
      inZone,
      nextSettleSec: 0,
      progressRatio: 0,
      settled: false,
    };
  }

  const nextSettleSec = prevSettleSec + Math.max(0, dtSec);
  const progressRatio = clamp(nextSettleSec / t.settle.durationSec, 0, 1);
  return {
    inZone: true,
    nextSettleSec,
    progressRatio,
    settled: nextSettleSec >= t.settle.durationSec,
  };
}

export function isRivalKnockedOffSeat(
  rivalX: number,
  rivalY: number,
  seat: SeatZoneSpec,
): boolean {
  return Math.abs(rivalX - seat.x) > seat.halfW + 16 || rivalY > seat.maxY + 20;
}

export function isBirdOutOfBounds(birdX: number, birdY: number, t: LaunchTuning = launchTuning): boolean {
  return birdX < -30 || birdX > t.view.width + 30 || birdY > t.view.height + 40;
}

export interface LaunchScoreResult {
  readonly stars: 0 | 1 | 2 | 3;
  readonly bonusScore: number;
  readonly totalScore: number;
}

export function evaluateLaunchStars(
  settled: boolean,
  subGoalCompleted: boolean,
  remainingPigeons: number,
  t: LaunchTuning = launchTuning,
): LaunchScoreResult {
  if (!settled) {
    return { stars: 0, bonusScore: 0, totalScore: 0 };
  }
  const safeRemaining = Math.max(0, Math.floor(remainingPigeons));
  const stars = clamp(
    1 + (subGoalCompleted ? 1 : 0) + (safeRemaining >= 1 ? 1 : 0),
    1,
    3,
  ) as 1 | 2 | 3;
  const bonusScore = safeRemaining * t.match.remainingPigeonBonus;
  const totalScore = 500 + (subGoalCompleted ? 300 : 0) + bonusScore;
  return {
    stars,
    bonusScore,
    totalScore,
  };
}

export function evaluatePolaroidCaptions(
  stage: LaunchStageConfig,
  stars: 0 | 1 | 2 | 3,
  subGoalCompleted: boolean,
): { readonly mainCaption: string; readonly subCaption: string } {
  const mainCaption = `“我就想坐这儿 · 第${stage.id}关 ${stars}★”`;
  const subCaption = subGoalCompleted
    ? stage.winSubCaption
    : `好位置抢到手，下次顺便冲 ${stage.subGoalText}！`;
  return { mainCaption, subCaption };
}
