import type { AiArchetype, AiTier, StageThemeId } from '../../config/tuning';

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
  readonly kind: 'delayed_rival_spawn' | 'center_occupied_start';
  readonly delaySec?: number;
}

export type RuleModifier = 'low_gravity' | 'rain';

export interface LevelDef {
  readonly id: 'tut-1' | 'tut-2' | 'tut-3';
  readonly title: string;
  readonly shortName: string;
  readonly plaza: StageThemeId;
  readonly nozzles: readonly NozzleDef[];
  readonly pattern: 'tutorial_calm' | 'tutorial_standard' | 'tutorial_plug';
  readonly rivals: readonly { readonly kind: AiArchetype; readonly tier: AiTier }[];
  readonly rivalGainMult: number;
  readonly events: readonly EventDef[];
  readonly rules: readonly RuleModifier[];
  readonly durationSec: number;
  readonly goals: readonly [string, string];
  readonly teach: readonly TutorialStep[];
}
