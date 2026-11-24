import { tuning, type Tuning } from '../config/tuning';
import { clamp, type FountainSlotState } from './rules';

export function predictLandingX(
  x: number,
  y: number,
  vx: number,
  vy: number,
  t: Tuning = tuning,
): number {
  const g = t.pigeon.gravity;
  const h = Math.max(0, t.scene.groundY - y);
  const disc = Math.max(0, vy * vy + 2 * g * h);
  const timeSec = (-vy + Math.sqrt(disc)) / g;
  return clamp(x + vx * timeSec, t.scene.stageMinX, t.scene.stageMaxX);
}

export function findPredictedPlugNozzle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  airborne: boolean,
  plugCooldownSec: number,
  nozzles: readonly FountainSlotState[],
  t: Tuning = tuning,
): { landingX: number; nozzle: FountainSlotState | null } {
  const landingX = predictLandingX(x, y, vx, vy, t);
  if (!airborne || plugCooldownSec > 0) {
    return { landingX, nozzle: null };
  }
  for (const nozzle of nozzles) {
    if (
      (nozzle.phase === 'IDLE' || nozzle.phase === 'WARNING') &&
      Math.abs(landingX - nozzle.x) <= t.plug.coreRadiusPx
    ) {
      return { landingX, nozzle };
    }
  }
  return { landingX, nozzle: null };
}

export function findNearbyPluggableNozzles(
  playerX: number,
  airborne: boolean,
  plugCooldownSec: number,
  nozzles: readonly FountainSlotState[],
  t: Tuning = tuning,
): FountainSlotState[] {
  if (airborne || plugCooldownSec > 0) return [];
  return nozzles.filter(
    (n) =>
      (n.phase === 'IDLE' || n.phase === 'WARNING') &&
      Math.abs(playerX - n.x) <= t.plug.hintProximityPx,
  );
}

export interface PlugState {
  readonly activeSlotIndex: number | null;
  readonly holdSec: number;
  readonly cooldownSec: number;
}

export interface PlugStepResult {
  readonly nextPlug: PlugState;
  readonly nextNozzles: FountainSlotState[];
  readonly triggeredSurgeSlots: number[];
  readonly bigUltTriggered: boolean;
  readonly controlBonus: number;
  readonly released: boolean;
}

export function createInitialPlugState(): PlugState {
  return {
    activeSlotIndex: null,
    holdSec: 0,
    cooldownSec: 0,
  };
}

export function findPluggableNozzle(
  playerX: number,
  wasAirborne: boolean,
  vy: number,
  plugCooldownSec: number,
  nozzles: readonly FountainSlotState[],
  t: Tuning = tuning,
): FountainSlotState | null {
  if (!wasAirborne || vy <= 0 || plugCooldownSec > 0) {
    return null;
  }
  for (const nozzle of nozzles) {
    if (
      (nozzle.phase === 'IDLE' || nozzle.phase === 'WARNING') &&
      Math.abs(playerX - nozzle.x) <= t.plug.coreRadiusPx
    ) {
      return nozzle;
    }
  }
  return null;
}

export function startPlugOnNozzle(
  slotIndex: number,
  nozzles: readonly FountainSlotState[],
): { plug: PlugState; nozzles: FountainSlotState[] } {
  const nextNozzles = nozzles.map((n) =>
    n.slotIndex === slotIndex
      ? {
          ...n,
          phase: 'PLUGGED' as const,
          phaseTimerSec: 0,
          lateralDir: 0 as const,
          lateralStrength: 0,
        }
      : n,
  );
  return {
    plug: {
      activeSlotIndex: slotIndex,
      holdSec: 0,
      cooldownSec: 0,
    },
    nozzles: nextNozzles,
  };
}

export function getAdjacentSlotIndices(
  slotIndex: number,
  totalSlots: number,
): number[] {
  const result: number[] = [];
  if (slotIndex - 1 >= 0) result.push(slotIndex - 1);
  if (slotIndex + 1 < totalSlots) result.push(slotIndex + 1);
  return result;
}

export function stepPlugState(
  prevPlug: PlugState,
  nozzles: readonly FountainSlotState[],
  playerX: number,
  playerAirborne: boolean,
  dtSec: number,
  t: Tuning = tuning,
): PlugStepResult {
  if (prevPlug.activeSlotIndex === null) {
    return {
      nextPlug: {
        activeSlotIndex: null,
        holdSec: 0,
        cooldownSec: Math.max(0, prevPlug.cooldownSec - dtSec),
      },
      nextNozzles: nozzles.map((n) => ({ ...n })),
      triggeredSurgeSlots: [],
      bigUltTriggered: false,
      controlBonus: 0,
      released: false,
    };
  }

  const slotIndex = prevPlug.activeSlotIndex;
  const pluggedNozzle = nozzles[slotIndex];
  const nextNozzles = nozzles.map((n) => ({ ...n }));

  if (!pluggedNozzle || pluggedNozzle.phase !== 'PLUGGED') {
    return {
      nextPlug: {
        activeSlotIndex: null,
        holdSec: 0,
        cooldownSec: t.plug.cooldownSec,
      },
      nextNozzles,
      triggeredSurgeSlots: [],
      bigUltTriggered: false,
      controlBonus: 0,
      released: true,
    };
  }

  const nextHold = prevPlug.holdSec + dtSec;
  const leftZone =
    playerAirborne || Math.abs(playerX - pluggedNozzle.x) > t.plug.coreRadiusPx + 4;

  // 1. Reached max duration (2.0s) -> Big Ult!
  if (nextHold >= t.plug.maxDurationSec) {
    const adjacent = getAdjacentSlotIndices(slotIndex, nextNozzles.length);
    for (const adjIdx of adjacent) {
      nextNozzles[adjIdx] = {
        ...nextNozzles[adjIdx],
        phase: 'SURGE',
        phaseTimerSec: t.fountain.surgeDurationSec,
        lateralDir: 0,
        lateralStrength: 0,
      };
    }
    nextNozzles[slotIndex] = {
      ...nextNozzles[slotIndex],
      phase: 'IDLE',
      phaseTimerSec: 0,
      willSurge: false,
    };
    return {
      nextPlug: {
        activeSlotIndex: null,
        holdSec: 0,
        cooldownSec: t.plug.cooldownSec,
      },
      nextNozzles,
      triggeredSurgeSlots: adjacent,
      bigUltTriggered: true,
      controlBonus: t.plug.bigUltControlBonus,
      released: true,
    };
  }

  // 2. Player actively left nozzle before 2.0s
  if (leftZone) {
    const triggeredSurgeSlots =
      nextHold >= t.plug.adjacentSurgeThresholdSec
        ? getAdjacentSlotIndices(slotIndex, nextNozzles.length)
        : [];
    for (const adjIdx of triggeredSurgeSlots) {
      nextNozzles[adjIdx] = {
        ...nextNozzles[adjIdx],
        phase: 'SURGE',
        phaseTimerSec: t.fountain.surgeDurationSec,
        lateralDir: 0,
        lateralStrength: 0,
      };
    }
    nextNozzles[slotIndex] = {
      ...nextNozzles[slotIndex],
      phase: 'IDLE',
      phaseTimerSec: 0,
      willSurge: false,
    };
    return {
      nextPlug: {
        activeSlotIndex: null,
        holdSec: 0,
        cooldownSec: t.plug.cooldownSec,
      },
      nextNozzles,
      triggeredSurgeSlots,
      bigUltTriggered: false,
      controlBonus: 0,
      released: true,
    };
  }

  // 3. Continue holding plug
  return {
    nextPlug: {
      activeSlotIndex: slotIndex,
      holdSec: nextHold,
      cooldownSec: 0,
    },
    nextNozzles,
    triggeredSurgeSlots: [],
    bigUltTriggered: false,
    controlBonus: 0,
    released: false,
  };
}
