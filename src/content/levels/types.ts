import type { AiArchetype, AiTier, BossKind, StageThemeId } from '../../config/tuning';

export interface NozzleDef {
  readonly x: number;
  readonly kind: 'normal' | 'angled' | 'moving';
}

export interface TutorialStep {
  readonly trigger: 'start' | 'contest' | 'surge_warn' | 'plug_ready';
  readonly textKey: 'tut1Drag' | 'tut2Bump' | 'tut2Dodge' | 'tut3Plug';
  readonly durationSec: number;
  readonly showFingerDrag?: boolean;
}

export interface EventDef {
  readonly kind: 'delayed_rival_spawn' | 'center_occupied_start' | 'corn_rain' | 'photo_flash';
  readonly delaySec?: number;
}

export interface GoalDef {
  readonly kind: 'sabotage' | 'max_surge_hits' | 'plug_count' | 'big_ult' | 'fast_win' | 'lead_margin';
  readonly threshold: number;
  readonly label: string;
}

export type RuleModifier = 'low_gravity' | 'rain' | 'moving_nozzle' | 'photo_flash';

export interface LevelDef {
  readonly id: string;
  readonly campaignIndex?: number;
  readonly chapter?: 1 | 2 | 3;
  readonly indexInChapter?: number;
  readonly title: string;
  readonly shortName: string;
  readonly plaza: StageThemeId;
  readonly nozzles: readonly NozzleDef[];
  readonly pattern: string;
  readonly rivals: readonly { readonly kind: AiArchetype; readonly tier: AiTier }[];
  readonly rivalGainMult: number;
  readonly dualActiveChance?: number;
  readonly angledChance?: number;
  readonly surgeChanceEarly?: number;
  readonly surgeChanceLate?: number;
  readonly waveMode?: boolean;
  readonly cornEnabled?: boolean;
  readonly bossKind?: BossKind;
  readonly events: readonly EventDef[];
  readonly rules: readonly RuleModifier[];
  readonly durationSec: number;
  readonly goals: readonly [string, string];
  readonly goalDefs?: readonly [GoalDef, GoalDef];
  readonly teach: readonly TutorialStep[];
}
