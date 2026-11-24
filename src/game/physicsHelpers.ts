import { tuning, type Tuning } from '../config/tuning';
import { clamp, type FountainSlotState, type PropState } from './rules';

export interface ParabolicLaunchInput {
  readonly birdX: number;
  readonly nozzleX: number;
  readonly tiltDeg: number;
  readonly fallbackDir: -1 | 1;
}

export function computeParabolicLaunchVelocity(
  input: ParabolicLaunchInput,
  t: Tuning = tuning,
): { readonly vx: number; readonly vy: number } {
  if (Math.abs(input.tiltDeg) >= 5) {
    const rad = (input.tiltDeg * Math.PI) / 180;
    const speed = t.fountain.angledCannonSpeed;
    const offsetNudge = clamp((input.birdX - input.nozzleX) * 2.4, -55, 55);
    return {
      vx: Math.sin(rad) * speed + offsetNudge,
      vy: -Math.cos(rad) * speed,
    };
  }

  const dx = input.birdX - input.nozzleX;
  const dir: -1 | 1 = Math.abs(dx) >= 3 ? (dx > 0 ? 1 : -1) : input.fallbackDir;
  const offsetRatio = clamp(Math.abs(dx) / t.fountain.coreRadiusPx, 0.28, 1.15);
  return {
    vx: dir * (175 + offsetRatio * 145),
    vy: -615,
  };
}

export function checkPropHit(
  birdX: number,
  birdY: number,
  birdRadius: number,
  prop: PropState,
): boolean {
  if (!prop.intact) return false;
  const pad = 6;
  const left = prop.x - prop.w / 2 - pad;
  const right = prop.x + prop.w / 2 + pad;
  const top = prop.y - prop.h / 2 - pad;
  const bottom = prop.y + prop.h / 2 + pad;
  const cx = clamp(birdX, left, right);
  const cy = clamp(birdY - 16, top, bottom);
  const dx = birdX - cx;
  const dy = birdY - 16 - cy;
  return dx * dx + dy * dy <= birdRadius * birdRadius;
}

export interface ButtSlamEval {
  readonly triggered: boolean;
  readonly slotIndex: number | null;
  readonly bonusScore: number;
}

export function evaluateButtSlam(
  wasJumping: boolean,
  vy: number,
  playerX: number,
  nozzles: readonly FountainSlotState[],
  t: Tuning = tuning,
): ButtSlamEval {
  if (!wasJumping || vy <= 0) {
    return { triggered: false, slotIndex: null, bonusScore: 0 };
  }
  for (const nozzle of nozzles) {
    if (
      nozzle.phase === 'ACTIVE' &&
      Math.abs(playerX - nozzle.x) <= t.fountain.coreRadiusPx + 6
    ) {
      return {
        triggered: true,
        slotIndex: nozzle.slotIndex,
        bonusScore: t.pigeon.slamScoreBonus,
      };
    }
  }
  return { triggered: false, slotIndex: null, bonusScore: 0 };
}
