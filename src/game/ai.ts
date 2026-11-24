import { tuning, type AiArchetype, type Tuning } from '../config/tuning';
import type { FountainPhase, FountainSlotState } from './rules';

export type AiIntent = 'chase' | 'contest' | 'flee' | 'roam' | 'stunned' | 'charge' | 'lunge';
export type RedCrestPhase = 'idle' | 'charging' | 'lunging' | 'whiff_stun';

export interface AiDecisionInput {
  readonly archetype: AiArchetype;
  readonly birdIndex: number;
  readonly aiX: number;
  readonly playerX: number;
  readonly nozzles: readonly FountainSlotState[];
  readonly stunTimerSec: number;
  readonly surgeReactElapsedSec: number;
  readonly redCrestState: RedCrestPhase;
  readonly redCrestTimerSec: number;
  readonly redCrestCooldownSec: number;
  readonly redCrestDir: -1 | 1;
  readonly elapsedSec: number;
  readonly dtSec?: number;
}

export interface AiDecision {
  readonly moveDir: -1 | 0 | 1;
  readonly intent: AiIntent;
  readonly nextSurgeReactElapsedSec: number;
  readonly nextRedCrestState: RedCrestPhase;
  readonly nextRedCrestTimerSec: number;
  readonly nextRedCrestCooldownSec: number;
  readonly nextRedCrestDir: -1 | 1;
  readonly speedMultiplier: number;
  readonly startedCharge: boolean;
}

function findNearestNozzleByPhases(
  aiX: number,
  nozzles: readonly FountainSlotState[],
  phases: readonly FountainPhase[],
): FountainSlotState | null {
  let best: FountainSlotState | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const n of nozzles) {
    if (!phases.includes(n.phase)) continue;
    const d = Math.abs(n.x - aiX);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

/**
 * Pure AI decision logic for all 3 bird archetypes:
 * - Hit-stun (`stunTimerSec > 0`) freezes active AI movement and surge fleeing.
 * - `SURGE_WARN` keeps ~0.36s derpy reaction delay before fleeing.
 * - `red_crest` charges for 0.60s and lunges; whiffing triggers 0.75s recovery stun.
 */
export function decideAiMove(input: AiDecisionInput, t: Tuning = tuning): AiDecision {
  const dt = input.dtSec ?? t.loop.fixedDtMs / 1000;
  const nextCooldown = Math.max(0, input.redCrestCooldownSec - dt);

  if (input.stunTimerSec > 0) {
    return {
      moveDir: 0,
      intent: 'stunned',
      nextSurgeReactElapsedSec: input.surgeReactElapsedSec,
      nextRedCrestState: 'idle',
      nextRedCrestTimerSec: 0,
      nextRedCrestCooldownSec: nextCooldown,
      nextRedCrestDir: input.redCrestDir,
      speedMultiplier: 1,
      startedCharge: false,
    };
  }

  if (input.archetype === 'red_crest') {
    if (input.redCrestState === 'whiff_stun') {
      const rem = Math.max(0, input.redCrestTimerSec - dt);
      return {
        moveDir: 0,
        intent: 'stunned',
        nextSurgeReactElapsedSec: input.surgeReactElapsedSec,
        nextRedCrestState: rem > 0 ? 'whiff_stun' : 'idle',
        nextRedCrestTimerSec: rem,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: 1,
        startedCharge: false,
      };
    }

    if (input.redCrestState === 'charging') {
      const rem = input.redCrestTimerSec - dt;
      if (rem <= 0) {
        return {
          moveDir: input.redCrestDir,
          intent: 'lunge',
          nextSurgeReactElapsedSec: 0,
          nextRedCrestState: 'lunging',
          nextRedCrestTimerSec: t.pigeon.redCrestLungeSec,
          nextRedCrestCooldownSec: t.pigeon.redCrestCooldownSec,
          nextRedCrestDir: input.redCrestDir,
          speedMultiplier: t.pigeon.redCrestLungeSpeed / t.pigeon.redCrestMaxSpeed,
          startedCharge: false,
        };
      }
      return {
        moveDir: 0,
        intent: 'charge',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'charging',
        nextRedCrestTimerSec: rem,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: 0,
        startedCharge: false,
      };
    }

    if (input.redCrestState === 'lunging') {
      const rem = input.redCrestTimerSec - dt;
      if (rem <= 0) {
        const hitPlayer = Math.abs(input.playerX - input.aiX) <= 44;
        return {
          moveDir: 0,
          intent: hitPlayer ? 'contest' : 'stunned',
          nextSurgeReactElapsedSec: 0,
          nextRedCrestState: hitPlayer ? 'idle' : 'whiff_stun',
          nextRedCrestTimerSec: hitPlayer ? 0 : t.pigeon.redCrestWhiffStunSec,
          nextRedCrestCooldownSec: t.pigeon.redCrestCooldownSec,
          nextRedCrestDir: input.redCrestDir,
          speedMultiplier: 1,
          startedCharge: false,
        };
      }
      return {
        moveDir: input.redCrestDir,
        intent: 'lunge',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'lunging',
        nextRedCrestTimerSec: rem,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: t.pigeon.redCrestLungeSpeed / t.pigeon.redCrestMaxSpeed,
        startedCharge: false,
      };
    }
  }

  const dangerNozzle = findNearestNozzleByPhases(input.aiX, input.nozzles, ['SURGE_WARN']);
  if (dangerNozzle && Math.abs(input.aiX - dangerNozzle.x) <= t.fountain.coreRadiusPx + 16) {
    const nextReact = input.surgeReactElapsedSec + dt;
    if (nextReact >= t.pigeon.aiReactionDelaySec) {
      const fleeDir: -1 | 1 =
        input.aiX < dangerNozzle.x
          ? -1
          : input.aiX > dangerNozzle.x
            ? 1
            : dangerNozzle.x >= 195
              ? -1
              : 1;
      return {
        moveDir: fleeDir,
        intent: 'flee',
        nextSurgeReactElapsedSec: nextReact,
        nextRedCrestState: 'idle',
        nextRedCrestTimerSec: 0,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: 1,
        startedCharge: false,
      };
    }
    const dx = dangerNozzle.x - input.aiX;
    return {
      moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
      intent: 'contest',
      nextSurgeReactElapsedSec: nextReact,
      nextRedCrestState: 'idle',
      nextRedCrestTimerSec: 0,
      nextRedCrestCooldownSec: nextCooldown,
      nextRedCrestDir: input.redCrestDir,
      speedMultiplier: 1,
      startedCharge: false,
    };
  }

  if (
    input.archetype === 'red_crest' &&
    nextCooldown <= 0 &&
    Math.abs(input.playerX - input.aiX) <= t.pigeon.redCrestTriggerDist &&
    Math.abs(input.playerX - input.aiX) >= 34
  ) {
    const dir: -1 | 1 = input.playerX >= input.aiX ? 1 : -1;
    return {
      moveDir: 0,
      intent: 'charge',
      nextSurgeReactElapsedSec: 0,
      nextRedCrestState: 'charging',
      nextRedCrestTimerSec: t.pigeon.redCrestChargeSec,
      nextRedCrestCooldownSec: t.pigeon.redCrestCooldownSec,
      nextRedCrestDir: dir,
      speedMultiplier: 0,
      startedCharge: true,
    };
  }

  const targetNozzle = findNearestNozzleByPhases(input.aiX, input.nozzles, [
    'ACTIVE',
    'WARNING',
  ]);
  if (targetNozzle) {
    const flockOffset = input.archetype === 'sparrow' ? (input.birdIndex % 2 === 0 ? -10 : 10) : 0;
    const dxToNozzle = targetNozzle.x + flockOffset - input.aiX;
    if (Math.abs(dxToNozzle) > 8) {
      return {
        moveDir: dxToNozzle > 0 ? 1 : -1,
        intent: 'chase',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'idle',
        nextRedCrestTimerSec: 0,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: 1,
        startedCharge: false,
      };
    }

    const playerNear = Math.abs(input.playerX - targetNozzle.x) < t.fountain.coreRadiusPx + 14;
    if (playerNear) {
      const pushDir: -1 | 1 = input.playerX > input.aiX ? 1 : -1;
      return {
        moveDir: pushDir,
        intent: 'contest',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'idle',
        nextRedCrestTimerSec: 0,
        nextRedCrestCooldownSec: nextCooldown,
        nextRedCrestDir: input.redCrestDir,
        speedMultiplier: 1,
        startedCharge: false,
      };
    }

    return {
      moveDir: 0,
      intent: 'contest',
      nextSurgeReactElapsedSec: 0,
      nextRedCrestState: 'idle',
      nextRedCrestTimerSec: 0,
      nextRedCrestCooldownSec: nextCooldown,
      nextRedCrestDir: input.redCrestDir,
      speedMultiplier: 1,
      startedCharge: false,
    };
  }

  const patrolTarget = 195 + Math.sin(input.elapsedSec * 1.4 + input.birdIndex * 1.9) * 60;
  const dx = patrolTarget - input.aiX;
  return {
    moveDir: Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : 0,
    intent: 'roam',
    nextSurgeReactElapsedSec: 0,
    nextRedCrestState: 'idle',
    nextRedCrestTimerSec: 0,
    nextRedCrestCooldownSec: nextCooldown,
    nextRedCrestDir: input.redCrestDir,
    speedMultiplier: 1,
    startedCharge: false,
  };
}
