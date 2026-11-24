import {
  ENDLESS_STAGE,
  STAGES,
  tuning,
  type AiArchetype,
  type PropKind,
  type StageConfig,
  type StagePropPlacement,
  type Tuning,
} from '../config/tuning';
import { mulberry32 } from '../core/rng';
import type { GameMode, StageId } from '../platform/storage';

export type ScreenMode = 'title' | 'playing' | 'paused' | 'result';
export type FountainPhase = 'IDLE' | 'WARNING' | 'ACTIVE' | 'SURGE_WARN' | 'SURGE';
export type FountainStyle = 'bubble' | 'angled';
export type Occupant = 'player' | 'ai' | 'none';
export type AiIntent = 'chase' | 'contest' | 'flee' | 'roam' | 'stunned' | 'charge' | 'lunge';
export type RedCrestPhase = 'idle' | 'charging' | 'lunging' | 'whiff_stun';

export interface FountainSlotState {
  readonly slotIndex: number;
  readonly x: number;
  readonly phase: FountainPhase;
  readonly phaseTimerSec: number;
  readonly style: FountainStyle;
  readonly tiltDeg: number;
  readonly lateralDir: -1 | 0 | 1;
  readonly lateralStrength: number;
  readonly lateralTimerSec: number;
  readonly willSurge: boolean;
}

export interface PropState {
  readonly id: string;
  readonly kind: PropKind;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly side: 'left' | 'right';
  readonly elevated: boolean;
  readonly bonus: number;
  readonly intact: boolean;
  readonly respawnTimerSec: number;
}

export interface RivalControlState {
  readonly id: number;
  readonly archetype: AiArchetype;
  readonly control: number;
}

export interface MatchState {
  readonly mode: GameMode;
  readonly stageId: StageId;
  readonly remainingSec: number;
  readonly elapsedSec: number;
  readonly playerControl: number;
  readonly rivalControls: readonly RivalControlState[];
  readonly playerSurgeHits: number;
  readonly score: number;
  readonly soakSec: number;
  readonly playerHoldSec: number;
  readonly maxCombo: 1 | 2 | 3;
  readonly sabotageCount: number;
  readonly propSmashCount: number;
  readonly slamCount: number;
  readonly nozzles: readonly FountainSlotState[];
  readonly lastOpenedSlot: number;
  readonly directorIdleSec: number;
  readonly waveQueue: readonly number[];
  readonly waveStaggerSec: number;
  readonly finished: boolean;
  readonly endReason: 'none' | 'player_full' | 'rival_full' | 'time_up';
}

export interface RivalPositionSample {
  readonly id: number;
  readonly x: number;
  readonly airborne: boolean;
  readonly stunned?: boolean;
}

export interface MatchStepInput {
  readonly dtSec: number;
  readonly playerX: number;
  readonly playerAirborne: boolean;
  readonly rivals: readonly RivalPositionSample[];
}

export interface MatchStepResult {
  readonly state: MatchState;
  readonly occupant: Occupant;
  readonly occupiedSlotIndex: number | null;
  readonly combo: 1 | 2 | 3;
  readonly enteredPhases: readonly FountainPhase[];
  readonly playerHitBySurgeSlot: number | null;
  readonly rivalsHitBySurge: readonly { rivalId: number; slotIndex: number }[];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function shouldAdvanceSimulation(screenMode: ScreenMode): boolean {
  return screenMode === 'playing';
}

export function computeComboMultiplier(holdSec: number, t: Tuning = tuning): 1 | 2 | 3 {
  if (holdSec >= t.scoring.combo3Sec) return 3;
  if (holdSec >= t.scoring.combo2Sec) return 2;
  return 1;
}

export function computeControlRateMultiplier(combo: 1 | 2 | 3, t: Tuning = tuning): number {
  return t.control.comboMultipliers[combo - 1] ?? 1;
}

export function getMaxRivalControl(state: MatchState): number {
  let maxCtrl = 0;
  for (const r of state.rivalControls) {
    if (r.control > maxCtrl) maxCtrl = r.control;
  }
  return maxCtrl;
}

export function didPlayerWinRace(state: MatchState): boolean {
  if (state.endReason === 'player_full') return true;
  if (state.endReason === 'rival_full') return false;
  if (state.endReason === 'time_up') {
    return state.playerControl >= getMaxRivalControl(state);
  }
  return false;
}

export function evaluateStageStars(
  state: MatchState,
  _stage?: StageConfig,
): 0 | 1 | 2 | 3 {
  if (!didPlayerWinRace(state)) return 0;
  const lead = state.playerControl - getMaxRivalControl(state);
  if (lead >= 30 && state.playerSurgeHits === 0) return 3;
  if (lead >= 20 || state.playerSurgeHits === 0) return 2;
  return 1;
}

export function getStageForMatch(mode: GameMode, stageId: StageId): StageConfig {
  return mode === 'endless' ? ENDLESS_STAGE : STAGES[stageId];
}

export function createInitialFountains(stage: StageConfig): FountainSlotState[] {
  return stage.nozzleXs.map((x, slotIndex) => ({
    slotIndex,
    x,
    phase: 'IDLE',
    phaseTimerSec: 0,
    style: 'bubble',
    tiltDeg: 0,
    lateralDir: 0,
    lateralStrength: 0,
    lateralTimerSec: 0,
    willSurge: false,
  }));
}

export function createInitialProps(stage: StageConfig): PropState[] {
  return stage.props.map((p: StagePropPlacement) => ({
    ...p,
    intact: true,
    respawnTimerSec: 0,
  }));
}

export function createInitialMatchState(
  mode: GameMode = 'stage',
  stageId: StageId = 1,
  t: Tuning = tuning,
): MatchState {
  const stage = getStageForMatch(mode, stageId);
  return {
    mode,
    stageId,
    remainingSec: stage.durationSec,
    elapsedSec: 0,
    playerControl: 0,
    rivalControls: stage.rivals.map((archetype, id) => ({
      id,
      archetype,
      control: 0,
    })),
    playerSurgeHits: 0,
    score: 0,
    soakSec: 0,
    playerHoldSec: 0,
    maxCombo: 1,
    sabotageCount: 0,
    propSmashCount: 0,
    slamCount: 0,
    nozzles: createInitialFountains(stage),
    lastOpenedSlot: Math.floor(stage.nozzleXs.length / 2),
    directorIdleSec: t.fountain.idleMinSec * 0.7,
    waveQueue: [],
    waveStaggerSec: 0,
    finished: false,
    endReason: 'none',
  };
}

export function evaluateNozzleOccupant(
  playerX: number,
  rivalXs: readonly number[],
  nozzleX: number,
  playerAirborne: boolean,
  rivalAirbornes: readonly boolean[],
  coreRadiusPx: number,
): Occupant {
  const playerDist = playerAirborne ? Number.POSITIVE_INFINITY : Math.abs(playerX - nozzleX);
  let bestAiDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rivalXs.length; i++) {
    if (rivalAirbornes[i]) continue;
    const d = Math.abs(rivalXs[i] - nozzleX);
    if (d < bestAiDist) bestAiDist = d;
  }

  const playerIn = playerDist <= coreRadiusPx;
  const aiIn = bestAiDist <= coreRadiusPx;

  if (!playerIn && !aiIn) return 'none';
  if (playerIn && !aiIn) return 'player';
  if (!playerIn && aiIn) return 'ai';
  return playerDist <= bestAiDist ? 'player' : 'ai';
}

function randomRange(min: number, max: number, rng: () => number): number {
  return min + clamp(rng(), 0, 1) * (max - min);
}

function pickIdleSlot(
  nozzles: readonly FountainSlotState[],
  avoidSlot: number,
  rng: () => number,
): number | null {
  const idle = nozzles.filter((n) => n.phase === 'IDLE' && n.slotIndex !== avoidSlot);
  const pool = idle.length > 0 ? idle : nozzles.filter((n) => n.phase === 'IDLE');
  if (pool.length === 0) return null;
  const idx = Math.floor(clamp(rng(), 0, 0.9999) * pool.length);
  return pool[idx].slotIndex;
}

function pickTiltDeg(slotX: number, t: Tuning, rng: () => number): number {
  const mag = t.fountain.angledTiltDeg;
  if (slotX < 175) {
    return rng() < 0.78 ? mag : -mag;
  }
  if (slotX > 215) {
    return rng() < 0.78 ? -mag : mag;
  }
  return rng() < 0.5 ? -mag : mag;
}

const defaultRulesRng = mulberry32(0x9e3779b9);

export function stepMatchState(
  prev: MatchState,
  input: MatchStepInput,
  t: Tuning = tuning,
  rng: () => number = defaultRulesRng,
): MatchStepResult {
  if (prev.finished) {
    return {
      state: prev,
      occupant: 'none',
      occupiedSlotIndex: null,
      combo: computeComboMultiplier(prev.playerHoldSec, t),
      enteredPhases: [],
      playerHitBySurgeSlot: null,
      rivalsHitBySurge: [],
    };
  }

  const stage = getStageForMatch(prev.mode, prev.stageId);
  const dtSec = Math.max(0, input.dtSec);
  const nextElapsed = prev.elapsedSec + dtSec;
  const nextRemaining = Math.max(0, prev.remainingSec - dtSec);

  const nozzles = prev.nozzles.map((n) => ({ ...n }));
  const enteredPhases: FountainPhase[] = [];
  let playerHitBySurgeSlot: number | null = null;
  const rivalsHitBySurge: { rivalId: number; slotIndex: number }[] = [];

  let playerControl = prev.playerControl;
  const rivalControls = prev.rivalControls.map((r) => ({ ...r }));
  let playerSurgeHits = prev.playerSurgeHits;
  let score = prev.score;
  let soakSec = prev.soakSec;
  let playerHoldSec = prev.playerHoldSec;
  let maxCombo = prev.maxCombo;
  let sabotageCount = prev.sabotageCount;
  let lastOpenedSlot = prev.lastOpenedSlot;
  let directorIdleSec = prev.directorIdleSec;
  let waveQueue = [...prev.waveQueue];
  let waveStaggerSec = prev.waveStaggerSec;

  const endlessIntensity = prev.mode === 'endless' ? clamp(nextElapsed / 45, 0, 1) : 0;
  const surgeChanceBase =
    nextElapsed >= t.fountain.latePhaseSec ? stage.surgeChanceLate : stage.surgeChanceEarly;
  const surgeChance = clamp(surgeChanceBase + endlessIntensity * 0.12, 0, 0.92);
  const dualChance = clamp(stage.dualActiveChance + endlessIntensity * 0.2, 0, 0.9);
  const angledChance = clamp(stage.angledChance + endlessIntensity * 0.12, 0, 0.75);

  const openSlotToWarning = (slotIdx: number) => {
    const slot = nozzles[slotIdx];
    if (!slot || slot.phase !== 'IDLE') return;
    nozzles[slotIdx] = {
      ...slot,
      phase: 'WARNING',
      phaseTimerSec: t.fountain.warningSec,
      style: 'bubble',
      tiltDeg: 0,
      lateralDir: 0,
      lateralStrength: 0,
      lateralTimerSec: 0,
      willSurge: false,
    };
    lastOpenedSlot = slotIdx;
    enteredPhases.push('WARNING');
  };

  // Step each active/warning/surge nozzle
  for (let i = 0; i < nozzles.length; i++) {
    let slot = nozzles[i];
    if (slot.phase === 'IDLE') continue;

    if (slot.phase === 'ACTIVE') {
      let latTimer = slot.lateralTimerSec - dtSec;
      let latDir = slot.lateralDir;
      let latStrength = slot.lateralStrength;
      if (latTimer <= 0) {
        if (slot.style === 'angled') {
          latDir = slot.tiltDeg >= 0 ? 1 : -1;
          latStrength = t.fountain.angledSlideAccel;
          latTimer = 1.0;
        } else {
          latDir = rng() < 0.5 ? -1 : 1;
          latStrength = randomRange(t.fountain.lateralPushBase, t.fountain.lateralPushMax, rng);
          latTimer = randomRange(t.fountain.lateralSwitchMinSec, t.fountain.lateralSwitchMaxSec, rng);
        }
      }
      slot = {
        ...slot,
        lateralDir: latDir,
        lateralStrength: latStrength,
        lateralTimerSec: latTimer,
      };
    }

    const nextTimer = slot.phaseTimerSec - dtSec;
    if (nextTimer <= 0) {
      switch (slot.phase) {
        case 'WARNING': {
          const willSurge = rng() < surgeChance;
          const isAngled = rng() < angledChance;
          const style: FountainStyle = isAngled ? 'angled' : 'bubble';
          const tiltDeg = isAngled ? pickTiltDeg(slot.x, t, rng) : 0;
          const latDir: -1 | 1 =
            style === 'angled' ? (tiltDeg >= 0 ? 1 : -1) : rng() < 0.5 ? -1 : 1;
          const latStrength =
            style === 'angled'
              ? t.fountain.angledSlideAccel
              : randomRange(t.fountain.lateralPushBase, t.fountain.lateralPushMax, rng);
          slot = {
            ...slot,
            phase: 'ACTIVE',
            phaseTimerSec: randomRange(t.fountain.activeMinSec, t.fountain.activeMaxSec, rng),
            style,
            tiltDeg,
            lateralDir: latDir,
            lateralStrength: latStrength,
            lateralTimerSec: randomRange(
              t.fountain.lateralSwitchMinSec,
              t.fountain.lateralSwitchMaxSec,
              rng,
            ),
            willSurge,
          };
          enteredPhases.push('ACTIVE');
          break;
        }
        case 'ACTIVE': {
          if (slot.willSurge) {
            slot = {
              ...slot,
              phase: 'SURGE_WARN',
              phaseTimerSec: t.fountain.surgeWarnSec,
              lateralDir: 0,
              lateralStrength: 0,
            };
            enteredPhases.push('SURGE_WARN');
          } else {
            slot = {
              ...slot,
              phase: 'IDLE',
              phaseTimerSec: 0,
              style: 'bubble',
              tiltDeg: 0,
              lateralDir: 0,
              lateralStrength: 0,
            };
            enteredPhases.push('IDLE');
          }
          break;
        }
        case 'SURGE_WARN': {
          slot = {
            ...slot,
            phase: 'SURGE',
            phaseTimerSec: t.fountain.surgeDurationSec,
            lateralDir: 0,
            lateralStrength: 0,
          };
          enteredPhases.push('SURGE');

          if (
            !input.playerAirborne &&
            playerHitBySurgeSlot === null &&
            Math.abs(input.playerX - slot.x) <= t.fountain.coreRadiusPx + 4
          ) {
            playerHitBySurgeSlot = slot.slotIndex;
            playerControl = Math.max(0, playerControl - t.control.surgePenalty);
            playerSurgeHits += 1;
            playerHoldSec = 0;
          }
          for (const rival of input.rivals) {
            if (
              !rival.airborne &&
              Math.abs(rival.x - slot.x) <= t.fountain.coreRadiusPx + 6 &&
              !rivalsHitBySurge.some((r) => r.rivalId === rival.id)
            ) {
              rivalsHitBySurge.push({ rivalId: rival.id, slotIndex: slot.slotIndex });
              const rc = rivalControls.find((entry) => entry.id === rival.id);
              if (rc) {
                rc.control = Math.max(0, rc.control - t.control.surgePenalty);
              }
              sabotageCount += 1;
              score += t.scoring.sabotageBonus;
            }
          }
          break;
        }
        case 'SURGE': {
          slot = {
            ...slot,
            phase: 'IDLE',
            phaseTimerSec: 0,
            style: 'bubble',
            tiltDeg: 0,
            lateralDir: 0,
            lateralStrength: 0,
            willSurge: false,
          };
          enteredPhases.push('IDLE');
          break;
        }
      }
    } else {
      slot = {
        ...slot,
        phaseTimerSec: nextTimer,
      };
    }
    nozzles[i] = slot;
  }

  // Handle wave queue staggered launches (Stage 4 & Endless)
  if (waveQueue.length > 0) {
    waveStaggerSec -= dtSec;
    if (waveStaggerSec <= 0) {
      const nextWaveSlot = waveQueue.shift();
      if (nextWaveSlot !== undefined) {
        openSlotToWarning(nextWaveSlot);
      }
      waveStaggerSec = t.fountain.waveStaggerSec;
    }
  }

  // Director: open new nozzle(s) if none are busy
  const busyCount = nozzles.filter((n) => n.phase !== 'IDLE').length;
  if (busyCount === 0 && waveQueue.length === 0) {
    directorIdleSec -= dtSec;
    if (directorIdleSec <= 0) {
      if (stage.waveMode && nozzles.length >= 4 && rng() < 0.55) {
        const leftToRight = rng() < 0.5;
        const order = leftToRight
          ? [0, 2, 4].filter((idx) => idx < nozzles.length)
          : [nozzles.length - 1, Math.max(0, nozzles.length - 3), 0];
        const uniqueOrder = Array.from(new Set(order));
        openSlotToWarning(uniqueOrder[0]);
        waveQueue = uniqueOrder.slice(1);
        waveStaggerSec = t.fountain.waveStaggerSec;
      } else {
        const first = pickIdleSlot(nozzles, lastOpenedSlot, rng);
        if (first !== null) {
          openSlotToWarning(first);
          if (nozzles.length >= 4 && rng() < dualChance) {
            const second = pickIdleSlot(nozzles, first, rng);
            if (second !== null && second !== first) {
              openSlotToWarning(second);
            }
          }
        }
      }
      directorIdleSec = randomRange(t.fountain.idleMinSec, t.fountain.idleMaxSec, rng);
    }
  }

  // Evaluate multi-nozzle occupancy during ACTIVE
  const rivalXs = input.rivals.map((r) => r.x);
  const rivalAirbornes = input.rivals.map((r) => r.airborne || Boolean(r.stunned));
  let occupant: Occupant = 'none';
  let occupiedSlotIndex: number | null = null;
  let bestPlayerDist = Number.POSITIVE_INFINITY;
  const gainingRivalIds = new Set<number>();

  for (const nozzle of nozzles) {
    if (nozzle.phase !== 'ACTIVE') continue;
    const occ = evaluateNozzleOccupant(
      input.playerX,
      rivalXs,
      nozzle.x,
      input.playerAirborne,
      rivalAirbornes,
      t.fountain.coreRadiusPx,
    );
    if (occ === 'player') {
      const dist = Math.abs(input.playerX - nozzle.x);
      if (dist < bestPlayerDist) {
        bestPlayerDist = dist;
        occupant = 'player';
        occupiedSlotIndex = nozzle.slotIndex;
      }
    } else if (occ === 'ai') {
      if (occupant === 'none') occupant = 'ai';
      for (const rival of input.rivals) {
        if (
          !rival.airborne &&
          !rival.stunned &&
          Math.abs(rival.x - nozzle.x) <= t.fountain.coreRadiusPx
        ) {
          gainingRivalIds.add(rival.id);
        }
      }
    }
  }

  if (occupant === 'player') {
    soakSec += dtSec;
    playerHoldSec += dtSec;
    const combo = computeComboMultiplier(playerHoldSec, t);
    if (combo > maxCombo) maxCombo = combo;
    const rateMult = computeControlRateMultiplier(combo, t);
    playerControl = clamp(
      playerControl + t.control.baseGainPerSec * rateMult * dtSec,
      0,
      t.control.maxControl,
    );
    score += t.scoring.basePointsPerSec * combo * dtSec;
  } else {
    const anyActive = nozzles.some((n) => n.phase === 'ACTIVE');
    if (anyActive || nozzles.every((n) => n.phase === 'IDLE' || n.phase === 'SURGE')) {
      playerHoldSec = 0;
    }
  }

  for (const rivalId of gainingRivalIds) {
    const rc = rivalControls.find((entry) => entry.id === rivalId);
    if (rc) {
      rc.control = clamp(
        rc.control + t.control.baseGainPerSec * stage.rivalGainMult * dtSec,
        0,
        t.control.maxControl,
      );
    }
  }

  const combo = computeComboMultiplier(playerHoldSec, t);
  let finished = false;
  let endReason: MatchState['endReason'] = 'none';
  if (playerControl >= t.control.maxControl) {
    finished = true;
    endReason = 'player_full';
  } else if (rivalControls.some((r) => r.control >= t.control.maxControl)) {
    finished = true;
    endReason = 'rival_full';
  } else if (nextRemaining <= 0) {
    finished = true;
    endReason = 'time_up';
  }

  return {
    state: {
      mode: prev.mode,
      stageId: prev.stageId,
      remainingSec: nextRemaining,
      elapsedSec: nextElapsed,
      playerControl,
      rivalControls,
      playerSurgeHits,
      score,
      soakSec,
      playerHoldSec,
      maxCombo,
      sabotageCount,
      propSmashCount: prev.propSmashCount,
      slamCount: prev.slamCount,
      nozzles,
      lastOpenedSlot,
      directorIdleSec,
      waveQueue,
      waveStaggerSec,
      finished,
      endReason,
    },
    occupant,
    occupiedSlotIndex,
    combo,
    enteredPhases,
    playerHitBySurgeSlot,
    rivalsHitBySurge,
  };
}

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

  // 1. Stunned from player's 肥臀猛顶 or 铁臀墩坐 shockwave: freeze AI!
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

  // 2. Red-crest special charge/lunge state machine
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

  // 3. Check if standing near a SURGE_WARN nozzle
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

  // 4. Red-crest triggers charge when near player
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

  // 5. Chase or contest ACTIVE / WARNING nozzles
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

  // 6. Gentle roam during IDLE / SURGE
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
