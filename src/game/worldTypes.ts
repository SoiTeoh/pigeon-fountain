import type { AiArchetype, AiTier, StageConfig, Tuning } from '../config/tuning';
import { clamp, type AiIntent, type FountainPhase, type Occupant, type RedCrestPhase } from './rules';

export type PlayerExpression = 'smug' | 'bliss' | 'panic' | 'bump' | 'launched' | 'jump';

export interface PigeonBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  airborne: boolean;
  spinRad: number;
  waddlePhase: number;
  squashX: number;
  squashY: number;
  knockbackTimerSec?: number;
}

export interface PlugCallout {
  readonly text: string;
  readonly avatarKind: 'player' | AiArchetype;
  timerSec: number;
}

export interface RivalBird extends PigeonBody {
  id: number;
  archetype: AiArchetype;
  tier: AiTier;
  radius: number;
  stunTimerSec: number;
  respawnTimerSec: number;
  surgeReactElapsedSec: number;
  contestTimerSec: number;
  bumpCooldownSec: number;
  plugCooldownSec: number;
  plugSlotIndex: number | null;
  plugHoldSec: number;
  isJumpingToPlug: boolean;
  smugTimerSec: number;
  intent: AiIntent;
  launchedByFountain: boolean;
  redCrestState: RedCrestPhase;
  redCrestTimerSec: number;
  redCrestCooldownSec: number;
  redCrestDir: -1 | 1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind:
    | 'water'
    | 'feather_white'
    | 'feather_dark'
    | 'feather_sparrow'
    | 'feather_red'
    | 'heart'
    | 'spark'
    | 'cup'
    | 'seed'
    | 'balloon'
    | 'coffee';
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface BonusPickup {
  id: number;
  kind: 'corn' | 'melon_spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  ttlSec: number;
}

export interface WorldStepInput {
  readonly moveDir: -1 | 0 | 1;
  readonly moveScale?: number;
  readonly stopOnRelease?: boolean;
  readonly directControl?: boolean;
  readonly bumpPressed: boolean;
  readonly jumpPressed: boolean;
  readonly slamPressed?: boolean;
  readonly moveTargetX?: number | null;
}

export interface WorldStepEvents {
  readonly bumpedHit: boolean;
  readonly bumpedWhiff: boolean;
  readonly jumped: boolean;
  readonly slammed: boolean;
  readonly propSmashed: boolean;
  readonly cornPickedUp: boolean;
  readonly redCrestCharged: boolean;
  readonly enteredPhases: readonly FountainPhase[];
  readonly playerHitBySurge: boolean;
  readonly aiHitBySurge: boolean;
  readonly angledCannonLaunch: boolean;
  readonly plugStarted: boolean;
  readonly plugBigUlt: boolean;
  readonly enteredActiveWater: boolean;
  readonly angryWarnTriggered: boolean;
  readonly occupant: Occupant;
  readonly combo: 1 | 2 | 3;
}

export function createEmptyWorldEvents(
  occupant: Occupant,
  combo: 1 | 2 | 3,
): WorldStepEvents {
  return {
    bumpedHit: false,
    bumpedWhiff: false,
    jumped: false,
    slammed: false,
    propSmashed: false,
    cornPickedUp: false,
    redCrestCharged: false,
    enteredPhases: [],
    playerHitBySurge: false,
    aiHitBySurge: false,
    angledCannonLaunch: false,
    plugStarted: false,
    plugBigUlt: false,
    enteredActiveWater: false,
    angryWarnTriggered: false,
    occupant,
    combo,
  };
}

export function createRivalBirds(stage: StageConfig, t: Tuning): RivalBird[] {
  const count = stage.rivals.length;
  return stage.rivals.map((archetype, idx) => {
    const spreadStart = 215;
    const spreadStep = count > 1 ? 105 / (count - 1) : 0;
    const x = clamp(spreadStart + idx * spreadStep, t.scene.stageMinX + 10, t.scene.stageMaxX - 10);
    return {
      id: idx,
      archetype,
      tier: stage.aiTiers[idx] ?? 1,
      radius: archetype === 'sparrow' ? t.pigeon.sparrowRadius : t.pigeon.radius,
      x,
      y: t.scene.groundY,
      vx: 0,
      vy: 0,
      facing: -1,
      airborne: false,
      spinRad: 0,
      waddlePhase: idx * 0.9,
      squashX: 1,
      squashY: 1,
      stunTimerSec: 0,
      respawnTimerSec: 0,
      surgeReactElapsedSec: 0,
      contestTimerSec: 0,
      bumpCooldownSec: 0.8 + idx * 0.3,
      plugCooldownSec: 0,
      plugSlotIndex: null,
      plugHoldSec: 0,
      isJumpingToPlug: false,
      smugTimerSec: 0,
      intent: 'roam',
      launchedByFountain: false,
      redCrestState: 'idle',
      redCrestTimerSec: 0,
      redCrestCooldownSec: 1.5 + idx * 0.6,
      redCrestDir: -1,
    };
  });
}
