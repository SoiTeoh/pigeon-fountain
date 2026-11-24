import type { StageConfig } from '../../config/tuning';
import type { LevelDef } from './types';

export const TUTORIAL_LEVELS: readonly LevelDef[] = [
  {
    id: 'tut-1',
    title: '教学 1 · 坐住喷泉',
    shortName: '教学1 · 坐',
    plaza: 'neighborhood',
    nozzles: [
      { x: 105, kind: 'normal' },
      { x: 195, kind: 'normal' },
      { x: 285, kind: 'normal' },
    ],
    pattern: 'tutorial_calm',
    rivals: [{ kind: 'white_pigeon', tier: 1 }],
    rivalGainMult: 0.5,
    events: [{ kind: 'delayed_rival_spawn', delaySec: 6.0 }],
    rules: [],
    durationSec: 60,
    goals: ['抢先霸占到 100', '坐稳水柱连击 ×2'],
    teach: [
      {
        trigger: 'start',
        textKey: 'tut1Drag',
        durationSec: 5.5,
        showFingerDrag: true,
      },
    ],
  },
  {
    id: 'tut-2',
    title: '教学 2 · 顶飞与躲避',
    shortName: '教学2 · 顶躲',
    plaza: 'neighborhood',
    nozzles: [
      { x: 105, kind: 'normal' },
      { x: 195, kind: 'normal' },
      { x: 285, kind: 'normal' },
    ],
    pattern: 'tutorial_standard',
    rivals: [{ kind: 'white_pigeon', tier: 1 }],
    rivalGainMult: 0.65,
    events: [],
    rules: [],
    durationSec: 60,
    goals: ['用【顶】抢回水柱', '躲开红 ! 暴喷'],
    teach: [
      {
        trigger: 'contest',
        textKey: 'tut2Bump',
        durationSec: 3.0,
      },
      {
        trigger: 'surge_warn',
        textKey: 'tut2Dodge',
        durationSec: 2.5,
      },
    ],
  },
  {
    id: 'tut-3',
    title: '教学 3 · 堵泉憋压',
    shortName: '教学3 · 堵泉',
    plaza: 'neighborhood',
    nozzles: [
      { x: 105, kind: 'normal' },
      { x: 195, kind: 'normal' },
      { x: 285, kind: 'normal' },
    ],
    pattern: 'tutorial_plug',
    rivals: [{ kind: 'white_pigeon', tier: 1 }],
    rivalGainMult: 0.65,
    events: [{ kind: 'center_occupied_start' }],
    rules: [],
    durationSec: 60,
    goals: ['跳起下墩堵住空泉眼', '憋压坑飞中间白胖'],
    teach: [
      {
        trigger: 'plug_ready',
        textKey: 'tut3Plug',
        durationSec: 3.5,
      },
    ],
  },
] as const;

export function getTutorialLevel(id: 'tut-1' | 'tut-2' | 'tut-3'): LevelDef {
  return TUTORIAL_LEVELS.find((l) => l.id === id) ?? TUTORIAL_LEVELS[0];
}

export function tutorialLevelToStageConfig(level: LevelDef): StageConfig {
  return {
    id: 1,
    title: level.title,
    shortName: level.shortName,
    subtitle: level.goals.join(' · '),
    theme: level.plaza,
    durationSec: level.durationSec,
    targetScore: 350,
    starThresholds: [350, 550, 800],
    rivalGainMult: level.rivalGainMult,
    nozzleXs: level.nozzles.map((n) => n.x),
    grateLeftX: 62,
    grateRightX: 328,
    dualActiveChance: 0,
    angledChance: 0,
    surgeChanceEarly: level.pattern === 'tutorial_calm' ? 0.25 : 0.45,
    surgeChanceLate: level.pattern === 'tutorial_calm' ? 0.4 : 0.65,
    waveMode: false,
    cornEnabled: false,
    propRespawnSec: null,
    rivals: level.rivals.map((r) => r.kind),
    aiTiers: level.rivals.map((r) => r.tier),
    props: [],
  };
}
