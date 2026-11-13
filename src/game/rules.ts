import { tuning, type Tuning } from '../config/tuning';

export type FountainPhase = 'IDLE' | 'WARNING' | 'ACTIVE' | 'SURGE_WARN' | 'SURGE';
export type Occupant = 'player' | 'ai' | 'none';
export type AiIntent = 'chase' | 'contest' | 'flee' | 'roam';

export interface FountainState {
  readonly phase: FountainPhase;
  readonly slotIndex: 0 | 1 | 2;
  readonly phaseTimerSec: number;
  readonly lateralDir: -1 | 0 | 1;
  readonly lateralStrength: number;
  readonly lateralTimerSec: number;
  readonly willSurge: boolean;
}

export interface MatchState {
  readonly remainingSec: number;
  readonly elapsedSec: number;
  readonly feathers: number;
  readonly score: number;
  readonly soakSec: number;
  readonly playerHoldSec: number;
  readonly maxCombo: 1 | 2 | 3;
  readonly sabotageCount: number;
  readonly fountain: FountainState;
  readonly finished: boolean;
  readonly endReason: 'none' | 'feathers_zero' | 'time_up';
}

export interface MatchStepInput {
  readonly dtSec: number;
  readonly playerX: number;
  readonly aiX: number;
  readonly playerAirborne: boolean;
  readonly aiAirborne: boolean;
}

export interface MatchStepResult {
  readonly state: MatchState;
  readonly occupant: Occupant;
  readonly combo: 1 | 2 | 3;
  readonly enteredPhase: FountainPhase | null;
  readonly playerHitBySurge: boolean;
  readonly aiHitBySurge: boolean;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeComboMultiplier(holdSec: number, t: Tuning = tuning): 1 | 2 | 3 {
  if (holdSec >= t.scoring.combo3Sec) return 3;
  if (holdSec >= t.scoring.combo2Sec) return 2;
  return 1;
}

export function evaluateNozzleOccupant(
  playerX: number,
  aiX: number,
  nozzleX: number,
  playerAirborne: boolean,
  aiAirborne: boolean,
  coreRadiusPx: number,
): Occupant {
  const playerDist = playerAirborne ? Number.POSITIVE_INFINITY : Math.abs(playerX - nozzleX);
  const aiDist = aiAirborne ? Number.POSITIVE_INFINITY : Math.abs(aiX - nozzleX);

  const playerIn = playerDist <= coreRadiusPx;
  const aiIn = aiDist <= coreRadiusPx;

  if (!playerIn && !aiIn) return 'none';
  if (playerIn && !aiIn) return 'player';
  if (!playerIn && aiIn) return 'ai';
  return playerDist <= aiDist ? 'player' : 'ai';
}

export function createInitialMatchState(
  t: Tuning = tuning,
  initialSlot: 0 | 1 | 2 = 1,
): MatchState {
  return {
    remainingSec: t.scoring.roundDurationSec,
    elapsedSec: 0,
    feathers: t.scoring.maxFeathers,
    score: 0,
    soakSec: 0,
    playerHoldSec: 0,
    maxCombo: 1,
    sabotageCount: 0,
    fountain: {
      phase: 'IDLE',
      slotIndex: initialSlot,
      phaseTimerSec: t.fountain.idleMinSec,
      lateralDir: 0,
      lateralStrength: 0,
      lateralTimerSec: 0,
      willSurge: false,
    },
    finished: false,
    endReason: 'none',
  };
}

function pickNextSlot(current: 0 | 1 | 2, rng: () => number): 0 | 1 | 2 {
  const candidates = ([0, 1, 2] as const).filter((s) => s !== current);
  const idx = Math.floor(clamp(rng(), 0, 0.9999) * candidates.length);
  return candidates[idx];
}

function randomRange(min: number, max: number, rng: () => number): number {
  return min + clamp(rng(), 0, 1) * (max - min);
}

export function stepMatchState(
  prev: MatchState,
  input: MatchStepInput,
  t: Tuning = tuning,
  rng: () => number = Math.random,
): MatchStepResult {
  if (prev.finished) {
    return {
      state: prev,
      occupant: 'none',
      combo: computeComboMultiplier(prev.playerHoldSec, t),
      enteredPhase: null,
      playerHitBySurge: false,
      aiHitBySurge: false,
    };
  }

  const dtSec = Math.max(0, input.dtSec);
  const nextElapsed = prev.elapsedSec + dtSec;
  const nextRemaining = Math.max(0, prev.remainingSec - dtSec);

  let fountain = prev.fountain;
  let timer = fountain.phaseTimerSec - dtSec;
  let enteredPhase: FountainPhase | null = null;
  let playerHitBySurge = false;
  let aiHitBySurge = false;
  let feathers = prev.feathers;
  let score = prev.score;
  let soakSec = prev.soakSec;
  let playerHoldSec = prev.playerHoldSec;
  let maxCombo = prev.maxCombo;
  let sabotageCount = prev.sabotageCount;

  // Step lateral water pressure during ACTIVE
  if (fountain.phase === 'ACTIVE') {
    let latTimer = fountain.lateralTimerSec - dtSec;
    let latDir = fountain.lateralDir;
    let latStrength = fountain.lateralStrength;
    if (latTimer <= 0) {
      latDir = rng() < 0.5 ? -1 : 1;
      latStrength = randomRange(t.fountain.lateralPushBase, t.fountain.lateralPushMax, rng);
      latTimer = randomRange(t.fountain.lateralSwitchMinSec, t.fountain.lateralSwitchMaxSec, rng);
    }
    fountain = {
      ...fountain,
      lateralDir: latDir,
      lateralStrength: latStrength,
      lateralTimerSec: latTimer,
    };
  }

  // Advance fountain state machine when phase timer expires
  if (timer <= 0) {
    switch (fountain.phase) {
      case 'IDLE': {
        const nextSlot = pickNextSlot(fountain.slotIndex, rng);
        fountain = {
          phase: 'WARNING',
          slotIndex: nextSlot,
          phaseTimerSec: t.fountain.warningSec,
          lateralDir: 0,
          lateralStrength: 0,
          lateralTimerSec: 0,
          willSurge: false,
        };
        enteredPhase = 'WARNING';
        break;
      }
      case 'WARNING': {
        const surgeChance =
          nextElapsed >= t.fountain.latePhaseSec
            ? t.fountain.lateSurgeChance
            : t.fountain.earlySurgeChance;
        const willSurge = rng() < surgeChance;
        const latDir: -1 | 1 = rng() < 0.5 ? -1 : 1;
        fountain = {
          ...fountain,
          phase: 'ACTIVE',
          phaseTimerSec: randomRange(t.fountain.activeMinSec, t.fountain.activeMaxSec, rng),
          lateralDir: latDir,
          lateralStrength: randomRange(t.fountain.lateralPushBase, t.fountain.lateralPushMax, rng),
          lateralTimerSec: randomRange(
            t.fountain.lateralSwitchMinSec,
            t.fountain.lateralSwitchMaxSec,
            rng,
          ),
          willSurge,
        };
        enteredPhase = 'ACTIVE';
        break;
      }
      case 'ACTIVE': {
        if (fountain.willSurge) {
          fountain = {
            ...fountain,
            phase: 'SURGE_WARN',
            phaseTimerSec: t.fountain.surgeWarnSec,
            lateralDir: 0,
            lateralStrength: 0,
          };
          enteredPhase = 'SURGE_WARN';
        } else {
          fountain = {
            ...fountain,
            phase: 'IDLE',
            phaseTimerSec: randomRange(t.fountain.idleMinSec, t.fountain.idleMaxSec, rng),
            lateralDir: 0,
            lateralStrength: 0,
          };
          enteredPhase = 'IDLE';
        }
        break;
      }
      case 'SURGE_WARN': {
        fountain = {
          ...fountain,
          phase: 'SURGE',
          phaseTimerSec: t.fountain.surgeDurationSec,
          lateralDir: 0,
          lateralStrength: 0,
        };
        enteredPhase = 'SURGE';

        // Check who gets blasted by the super surge!
        const nozzleX = t.scene.nozzles[fountain.slotIndex];
        if (
          !input.playerAirborne &&
          Math.abs(input.playerX - nozzleX) <= t.fountain.coreRadiusPx + 4
        ) {
          playerHitBySurge = true;
          feathers = Math.max(0, feathers - 1);
          playerHoldSec = 0;
        }
        if (!input.aiAirborne && Math.abs(input.aiX - nozzleX) <= t.fountain.coreRadiusPx + 6) {
          aiHitBySurge = true;
          sabotageCount += 1;
          score += t.scoring.sabotageBonus;
        }
        break;
      }
      case 'SURGE': {
        fountain = {
          ...fountain,
          phase: 'IDLE',
          phaseTimerSec: randomRange(t.fountain.idleMinSec, t.fountain.idleMaxSec, rng),
          lateralDir: 0,
          lateralStrength: 0,
          willSurge: false,
        };
        enteredPhase = 'IDLE';
        break;
      }
    }
  } else {
    fountain = {
      ...fountain,
      phaseTimerSec: timer,
    };
  }

  // Evaluate occupancy & soaking score during ACTIVE
  const nozzleX = t.scene.nozzles[fountain.slotIndex];
  let occupant: Occupant = 'none';
  if (fountain.phase === 'ACTIVE') {
    occupant = evaluateNozzleOccupant(
      input.playerX,
      input.aiX,
      nozzleX,
      input.playerAirborne,
      input.aiAirborne,
      t.fountain.coreRadiusPx,
    );
    if (occupant === 'player') {
      soakSec += dtSec;
      playerHoldSec += dtSec;
      const combo = computeComboMultiplier(playerHoldSec, t);
      if (combo > maxCombo) maxCombo = combo;
      score += t.scoring.basePointsPerSec * combo * dtSec;
    } else {
      playerHoldSec = 0;
    }
  } else if (fountain.phase === 'IDLE' || fountain.phase === 'SURGE') {
    playerHoldSec = 0;
  }

  const combo = computeComboMultiplier(playerHoldSec, t);
  let finished = false;
  let endReason: MatchState['endReason'] = 'none';
  if (feathers <= 0) {
    finished = true;
    endReason = 'feathers_zero';
  } else if (nextRemaining <= 0) {
    finished = true;
    endReason = 'time_up';
  }

  return {
    state: {
      remainingSec: nextRemaining,
      elapsedSec: nextElapsed,
      feathers,
      score,
      soakSec,
      playerHoldSec,
      maxCombo,
      sabotageCount,
      fountain,
      finished,
      endReason,
    },
    occupant,
    combo,
    enteredPhase,
    playerHitBySurge,
    aiHitBySurge,
  };
}

export interface AiDecisionInput {
  readonly aiX: number;
  readonly playerX: number;
  readonly fountain: FountainState;
  readonly surgeReactElapsedSec: number;
  readonly elapsedSec: number;
}

export interface AiDecision {
  readonly moveDir: -1 | 0 | 1;
  readonly intent: AiIntent;
  readonly nextSurgeReactElapsedSec: number;
}

/**
 * 白胖鸽 AI 纯决策逻辑：
 * - WARNING / ACTIVE 时积极抢占或挤开黑鸽；
 * - SURGE_WARN 时存在反应延迟（aiReactionDelaySec），保留玩家"肥臀猛顶"把白鸽留进喷口的喜剧窗口。
 */
export function decideAiMove(input: AiDecisionInput, t: Tuning = tuning): AiDecision {
  const nozzleX = t.scene.nozzles[input.fountain.slotIndex];

  if (input.fountain.phase === 'SURGE_WARN') {
    const nextReact = input.surgeReactElapsedSec + t.loop.fixedDtMs / 1000;
    if (nextReact >= t.pigeon.aiReactionDelaySec) {
      // Flee away from the dangerous nozzle toward the center/opposite side
      const fleeDir: -1 | 1 =
        input.aiX < nozzleX ? -1 : input.aiX > nozzleX ? 1 : nozzleX >= 195 ? -1 : 1;
      return {
        moveDir: fleeDir,
        intent: 'flee',
        nextSurgeReactElapsedSec: nextReact,
      };
    }
    // Still oblivious during reaction delay: keeps holding near nozzle!
    const dx = nozzleX - input.aiX;
    return {
      moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
      intent: 'contest',
      nextSurgeReactElapsedSec: nextReact,
    };
  }

  if (input.fountain.phase === 'WARNING' || input.fountain.phase === 'ACTIVE') {
    const dxToNozzle = nozzleX - input.aiX;
    if (Math.abs(dxToNozzle) > 8) {
      return {
        moveDir: dxToNozzle > 0 ? 1 : -1,
        intent: 'chase',
        nextSurgeReactElapsedSec: 0,
      };
    }
    // Near the nozzle: nudge slightly toward center or against player if contesting
    const playerNear = Math.abs(input.playerX - nozzleX) < t.fountain.coreRadiusPx + 14;
    if (playerNear) {
      const pushDir: -1 | 1 = input.playerX > input.aiX ? 1 : -1;
      return {
        moveDir: pushDir,
        intent: 'contest',
        nextSurgeReactElapsedSec: 0,
      };
    }
    return {
      moveDir: 0,
      intent: 'contest',
      nextSurgeReactElapsedSec: 0,
    };
  }

  // IDLE / SURGE: roam gently near center grate
  const patrolTarget = 195 + Math.sin(input.elapsedSec * 1.4) * 55;
  const dx = patrolTarget - input.aiX;
  return {
    moveDir: Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : 0,
    intent: 'roam',
    nextSurgeReactElapsedSec: 0,
  };
}
