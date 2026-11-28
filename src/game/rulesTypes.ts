import type { AiArchetype, PropKind } from '../config/tuning';
import type { GameMode, StageId } from '../platform/storage';

export type ScreenMode = 'title' | 'playing' | 'paused' | 'result';
export type FountainPhase = 'IDLE' | 'WARNING' | 'ACTIVE' | 'SURGE_WARN' | 'SURGE' | 'PLUGGED';
export type FountainStyle = 'bubble' | 'angled';
export type Occupant = 'player' | 'ai' | 'contested' | 'none';

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
  readonly plugRewardOwner?: 'player' | number | null;
  readonly plugRewardTimerSec?: number;
  readonly contestDurationSec?: number;
  readonly angryWarnTimerSec?: number;
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
  readonly plugCount: number;
  readonly bigUltCount: number;
  readonly photoFlashSec?: number;
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
  readonly playerGainMult?: number;
  readonly rivals: readonly RivalPositionSample[];
}

export interface MatchStepResult {
  readonly state: MatchState;
  readonly occupant: Occupant;
  readonly occupiedSlotIndex: number | null;
  readonly contestedSlots: readonly number[];
  readonly combo: 1 | 2 | 3;
  readonly enteredPhases: readonly FountainPhase[];
  readonly playerHitBySurgeSlot: number | null;
  readonly rivalsHitBySurge: readonly { rivalId: number; slotIndex: number }[];
  readonly angryWarnSlots: readonly number[];
  readonly angryPlayerLaunchSlot: number | null;
  readonly angryRivalLaunches: readonly { rivalId: number; slotIndex: number }[];
}
