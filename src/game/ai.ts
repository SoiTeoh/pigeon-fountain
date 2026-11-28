import { tuning, type AiArchetype, type AiTier, type Tuning } from '../config/tuning';
import type { FountainPhase, FountainSlotState } from './rules';

export type AiIntent = 'chase' | 'contest' | 'flee' | 'roam' | 'stunned' | 'charge' | 'lunge' | 'plug';
export type RedCrestPhase = 'idle' | 'charging' | 'lunging' | 'whiff_stun';

export interface AiDecisionInput {
  readonly archetype: AiArchetype;
  readonly tier?: AiTier;
  readonly birdIndex: number;
  readonly aiX: number;
  readonly playerX: number;
  readonly nozzles: readonly FountainSlotState[];
  readonly stunTimerSec: number;
  readonly surgeReactElapsedSec: number;
  readonly contestTimerSec?: number;
  readonly bumpCooldownSec?: number;
  readonly plugCooldownSec?: number;
  readonly playerPlugSlotIndex?: number | null;
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
  readonly nextContestTimerSec: number;
  readonly nextRedCrestState: RedCrestPhase;
  readonly nextRedCrestTimerSec: number;
  readonly nextRedCrestCooldownSec: number;
  readonly nextRedCrestDir: -1 | 1;
  readonly speedMultiplier: number;
  readonly startedCharge: boolean;
  readonly shouldBump: boolean;
  readonly shouldJumpToPlug: boolean;
}

function findBestNozzle(
  input: AiDecisionInput,
  phases: readonly FountainPhase[],
  avoidPlugSlot: number | null,
  preferSteal: boolean,
): FountainSlotState | null {
  let best: FountainSlotState | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const n of input.nozzles) {
    if (!phases.includes(n.phase)) continue;
    if (avoidPlugSlot !== null && Math.abs(n.slotIndex - avoidPlugSlot) === 1) continue;
    let score = Math.abs(n.x - input.aiX);
    if (preferSteal && Math.abs(input.playerX - n.x) < 52) {
      score += 120; // Sparrows prefer sneaking into unguarded nozzles
    }
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

/**
 * Tiered AI decision logic (T1 / T2 / T3) + archetype personalities:
 * - T1: chases ACTIVE, bumps after >1.2s contention (2.5s CD), 0.55s delay, doesn't flee SURGE_WARN.
 * - T2: + flees SURGE_WARN (0.42s delay) & seeks WARNING nozzles early.
 * - T3: + avoids nozzles adjacent to player's PLUGGED nozzle, & plugs adjacent empty nozzles when player sits on ACTIVE.
 */
export function decideAiMove(input: AiDecisionInput, t: Tuning = tuning): AiDecision {
  const dt = input.dtSec ?? t.loop.fixedDtMs / 1000;
  const tier: AiTier = input.tier ?? 2;
  const tierSpec = t.aiTiers[tier];
  const nextCooldown = Math.max(0, input.redCrestCooldownSec - dt);
  const bumpCd = Math.max(0, (input.bumpCooldownSec ?? 0) - dt);
  const plugCd = Math.max(0, (input.plugCooldownSec ?? 0) - dt);
  const prevContest = input.contestTimerSec ?? 0;
  const playerPlugSlot = tierSpec.avoidPlayerPlug ? (input.playerPlugSlotIndex ?? null) : null;

  const baseIdle = {
    nextSurgeReactElapsedSec: input.surgeReactElapsedSec,
    nextContestTimerSec: 0,
    nextRedCrestState: 'idle' as RedCrestPhase,
    nextRedCrestTimerSec: 0,
    nextRedCrestCooldownSec: nextCooldown,
    nextRedCrestDir: input.redCrestDir,
    speedMultiplier: 1,
    startedCharge: false,
    shouldBump: false,
    shouldJumpToPlug: false,
  };

  if (input.stunTimerSec > 0) {
    return { ...baseIdle, moveDir: 0, intent: 'stunned' };
  }

  // Red-crest charge/lunge state machine
  if (input.archetype === 'red_crest') {
    if (input.redCrestState === 'whiff_stun') {
      const rem = Math.max(0, input.redCrestTimerSec - dt);
      return {
        ...baseIdle,
        moveDir: 0,
        intent: 'stunned',
        nextRedCrestState: rem > 0 ? 'whiff_stun' : 'idle',
        nextRedCrestTimerSec: rem,
      };
    }

    if (input.redCrestState === 'charging') {
      const rem = input.redCrestTimerSec - dt;
      if (rem <= 0) {
        return {
          ...baseIdle,
          moveDir: input.redCrestDir,
          intent: 'lunge',
          nextSurgeReactElapsedSec: 0,
          nextRedCrestState: 'lunging',
          nextRedCrestTimerSec: t.pigeon.redCrestLungeSec,
          nextRedCrestCooldownSec: t.pigeon.redCrestCooldownSec,
          speedMultiplier: t.pigeon.redCrestLungeSpeed / t.pigeon.redCrestMaxSpeed,
        };
      }
      return {
        ...baseIdle,
        moveDir: 0,
        intent: 'charge',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'charging',
        nextRedCrestTimerSec: rem,
        speedMultiplier: 0,
      };
    }

    if (input.redCrestState === 'lunging') {
      const rem = input.redCrestTimerSec - dt;
      if (rem <= 0) {
        const hitPlayer = Math.abs(input.playerX - input.aiX) <= 44;
        return {
          ...baseIdle,
          moveDir: 0,
          intent: hitPlayer ? 'contest' : 'stunned',
          nextSurgeReactElapsedSec: 0,
          nextRedCrestState: hitPlayer ? 'idle' : 'whiff_stun',
          nextRedCrestTimerSec: hitPlayer ? 0 : t.pigeon.redCrestWhiffStunSec,
          nextRedCrestCooldownSec: t.pigeon.redCrestCooldownSec,
        };
      }
      return {
        ...baseIdle,
        moveDir: input.redCrestDir,
        intent: 'lunge',
        nextSurgeReactElapsedSec: 0,
        nextRedCrestState: 'lunging',
        nextRedCrestTimerSec: rem,
        speedMultiplier: t.pigeon.redCrestLungeSpeed / t.pigeon.redCrestMaxSpeed,
      };
    }
  }

  // T3: Avoid standing on nozzle adjacent to player's PLUGGED nozzle
  if (playerPlugSlot !== null) {
    const pluggedNozzle = input.nozzles[playerPlugSlot];
    const dangerAdj = input.nozzles.find(
      (n) => Math.abs(n.slotIndex - playerPlugSlot) === 1 && Math.abs(input.aiX - n.x) <= t.fountain.coreRadiusPx + 14,
    );
    if (dangerAdj && pluggedNozzle) {
      const fleeDir: -1 | 1 = dangerAdj.x >= pluggedNozzle.x ? 1 : -1;
      return {
        ...baseIdle,
        moveDir: fleeDir,
        intent: 'flee',
        nextSurgeReactElapsedSec: 0,
      };
    }
  }

  // T2+: Flee SURGE_WARN after tier reaction delay
  if (tierSpec.fleeSurgeWarn) {
    const dangerNozzle = findBestNozzle(input, ['SURGE_WARN'], null, false);
    if (dangerNozzle && Math.abs(input.aiX - dangerNozzle.x) <= t.fountain.coreRadiusPx + 16) {
      const nextReact = input.surgeReactElapsedSec + dt;
      if (nextReact >= tierSpec.reactionDelaySec) {
        const fleeDir: -1 | 1 =
          input.aiX < dangerNozzle.x
            ? -1
            : input.aiX > dangerNozzle.x
              ? 1
              : dangerNozzle.x >= 195
                ? -1
                : 1;
        return {
          ...baseIdle,
          moveDir: fleeDir,
          intent: 'flee',
          nextSurgeReactElapsedSec: nextReact,
        };
      }
      const dx = dangerNozzle.x - input.aiX;
      return {
        ...baseIdle,
        moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
        intent: 'contest',
        nextSurgeReactElapsedSec: nextReact,
      };
    }
  }

  // Red-crest charge trigger
  if (
    input.archetype === 'red_crest' &&
    nextCooldown <= 0 &&
    Math.abs(input.playerX - input.aiX) <= t.pigeon.redCrestTriggerDist &&
    Math.abs(input.playerX - input.aiX) >= 34
  ) {
    const dir: -1 | 1 = input.playerX >= input.aiX ? 1 : -1;
    return {
      ...baseIdle,
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

  // T3–T5: Plug an IDLE/WARNING nozzle if player is sitting on an adjacent ACTIVE nozzle
  // T5: also flanks adjacent to player's occupied nozzle even if not yet ACTIVE, ready to counter-plug
  if (tierSpec.canPlug && plugCd <= 0) {
    const playerTarget = input.nozzles.find(
      (n) =>
        (n.phase === 'ACTIVE' || (tier >= 5 && n.phase === 'WARNING')) &&
        Math.abs(input.playerX - n.x) <= t.fountain.coreRadiusPx + 4,
    );
    if (playerTarget) {
      const plugCandidate = input.nozzles.find(
        (n) =>
          (n.phase === 'IDLE' || n.phase === 'WARNING') &&
          Math.abs(n.slotIndex - playerTarget.slotIndex) === 1,
      );
      if (plugCandidate) {
        const dx = plugCandidate.x - input.aiX;
        if (Math.abs(dx) <= t.plug.coreRadiusPx - 4) {
          return {
            ...baseIdle,
            moveDir: 0,
            intent: 'plug',
            nextSurgeReactElapsedSec: 0,
            shouldJumpToPlug: true,
          };
        }
        return {
          ...baseIdle,
          moveDir: dx > 0 ? 1 : -1,
          intent: 'plug',
          nextSurgeReactElapsedSec: 0,
        };
      }
    }
  }

  // Chase ACTIVE (or WARNING for T2+)
  const seekPhases: FountainPhase[] = tierSpec.seekWarning ? ['ACTIVE', 'WARNING'] : ['ACTIVE'];
  const targetNozzle =
    findBestNozzle(input, seekPhases, playerPlugSlot, input.archetype === 'sparrow') ??
    findBestNozzle(input, seekPhases, null, false);

  // T4+: Preemptively claim next likely IDLE nozzle before director opens it
  if (!targetNozzle && tier >= 4) {
    const midIdx = Math.floor(input.nozzles.length / 2);
    const predNozzle =
      input.nozzles.find((n, idx) => n.phase === 'IDLE' && idx !== midIdx && Math.abs(n.x - input.playerX) > 65) ??
      input.nozzles[midIdx];
    if (predNozzle) {
      const dx = predNozzle.x - input.aiX;
      if (Math.abs(dx) > 8) {
        return {
          ...baseIdle,
          moveDir: dx > 0 ? 1 : -1,
          intent: 'chase',
          nextSurgeReactElapsedSec: 0,
        };
      }
    }
  }

  if (targetNozzle) {
    const flockOffset = input.archetype === 'sparrow' ? (input.birdIndex % 2 === 0 ? -10 : 10) : 0;
    const dxToNozzle = targetNozzle.x + flockOffset - input.aiX;
    const inCore = Math.abs(input.aiX - targetNozzle.x) <= t.fountain.coreRadiusPx + 6;
    const playerInSameCore = Math.abs(input.playerX - targetNozzle.x) <= t.fountain.coreRadiusPx + 8;

    if (inCore && playerInSameCore && targetNozzle.phase === 'ACTIVE') {
      const nextContest = prevContest + dt;
      const shouldBump = nextContest >= tierSpec.contestBumpThresholdSec && bumpCd <= 0;
      const pushDir: -1 | 1 = input.playerX > input.aiX ? 1 : -1;
      return {
        ...baseIdle,
        moveDir: pushDir,
        intent: 'contest',
        nextSurgeReactElapsedSec: 0,
        nextContestTimerSec: shouldBump ? 0 : nextContest,
        shouldBump,
      };
    }

    if (Math.abs(dxToNozzle) > 8) {
      return {
        ...baseIdle,
        moveDir: dxToNozzle > 0 ? 1 : -1,
        intent: 'chase',
        nextSurgeReactElapsedSec: 0,
      };
    }

    return {
      ...baseIdle,
      moveDir: 0,
      intent: 'contest',
      nextSurgeReactElapsedSec: 0,
    };
  }

  // Gentle roam during IDLE / SURGE
  const patrolTarget = 195 + Math.sin(input.elapsedSec * 1.4 + input.birdIndex * 1.9) * 60;
  const dx = patrolTarget - input.aiX;
  return {
    ...baseIdle,
    moveDir: Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : 0,
    intent: 'roam',
    nextSurgeReactElapsedSec: 0,
  };
}
