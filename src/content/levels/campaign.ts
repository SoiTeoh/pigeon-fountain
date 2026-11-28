import { STAGES, type StageConfig } from '../../config/tuning';
import type { StageId } from '../../platform/storage';
import type { GoalDef, LevelDef, RuleModifier } from './types';

interface ChapterBlueprint {
  readonly chapter: 1 | 2 | 3;
  readonly name: string;
  readonly theme: 'neighborhood' | 'park' | 'commercial';
  readonly nozzles: readonly number[];
  readonly grateLeftX: number;
  readonly grateRightX: number;
}

const CHAPTERS: readonly ChapterBlueprint[] = [
  { chapter: 1, name: '小区街角', theme: 'neighborhood', nozzles: [105, 195, 285], grateLeftX: 62, grateRightX: 328 },
  { chapter: 2, name: '公园音乐喷泉', theme: 'park', nozzles: [96, 162, 228, 294], grateLeftX: 58, grateRightX: 332 },
  { chapter: 3, name: '商业街网红地泉', theme: 'commercial', nozzles: [82, 138, 195, 252, 308], grateLeftX: 54, grateRightX: 336 },
];

const GOAL_PAIRS: readonly (readonly [GoalDef, GoalDef])[] = [
  [
    { kind: 'max_surge_hits', threshold: 1, label: '被暴喷 ≤ 1 次' },
    { kind: 'fast_win', threshold: 45, label: '45 秒内抢满 100' },
  ],
  [
    { kind: 'sabotage', threshold: 2, label: '使坏轰飞对手 2 次' },
    { kind: 'lead_margin', threshold: 25, label: '领先 ≥ 25 点获胜' },
  ],
  [
    { kind: 'plug_count', threshold: 2, label: '成功堵泉 2 次' },
    { kind: 'big_ult', threshold: 1, label: '憋出 1 次大招' },
  ],
];

function buildCampaignLevels(): readonly LevelDef[] {
  const levels: LevelDef[] = [];

  for (const ch of CHAPTERS) {
    for (let i = 1; i <= 8; i++) {
      const campaignIndex = (ch.chapter - 1) * 8 + i;
      const isBoss = i === 8;
      // Sawtooth difficulty curve per chapter: dips at L1, climbs to mid-peak, dips slightly at L6, spikes at L8 Boss
      const sawOffset = i === 1 ? -0.15 : i === 5 ? -0.05 : i === 8 ? 0.35 : (i - 1) * 0.06;
      const baseMult = ch.chapter === 1 ? 1.45 : ch.chapter === 2 ? 1.6 : 1.72;
      const rivalGainMult = Number(
        (isBoss && ch.chapter === 1 ? 1.05 : isBoss && ch.chapter === 2 ? 3.25 : baseMult + sawOffset).toFixed(2),
      );

      const rules: RuleModifier[] = [];
      if (ch.chapter === 2 && i >= 5 && i <= 7) rules.push('low_gravity');
      if (ch.chapter === 3 && i >= 2) rules.push('moving_nozzle');
      if (ch.chapter === 3 && i >= 5 && i <= 7) rules.push('photo_flash');

      let rivals: LevelDef['rivals'];
      let bossKind: LevelDef['bossKind'];
      let titleSuffix = `第 ${i} 关`;

      if (ch.chapter === 1) {
        if (isBoss) {
          bossKind = 'big_white';
          titleSuffix = 'Boss · 白胖老大';
          rivals = [{ kind: 'white_pigeon', tier: 3 }];
        } else {
          const tier = i <= 3 ? 1 : 2;
          rivals = i >= 6 ? [{ kind: 'white_pigeon', tier: 2 }, { kind: 'sparrow', tier: 1 }] : [{ kind: 'white_pigeon', tier }];
          if (i === 5) titleSuffix = '大爷撒米';
        }
      } else if (ch.chapter === 2) {
        if (isBoss) {
          bossKind = 'sparrow_gang';
          titleSuffix = 'Boss · 麻雀帮';
          rivals = [
            { kind: 'sparrow', tier: 2 },
            { kind: 'sparrow', tier: 3 },
            { kind: 'sparrow', tier: 2 },
            { kind: 'sparrow', tier: 3 },
            { kind: 'sparrow', tier: 2 },
          ];
        } else {
          const tier = i <= 2 ? 2 : 3;
          rivals = i >= 5
            ? [{ kind: 'sparrow', tier }, { kind: 'sparrow', tier: 2 }, { kind: 'white_pigeon', tier }]
            : [{ kind: 'sparrow', tier }, { kind: 'white_pigeon', tier: 2 }];
          if (i >= 5 && i <= 7) titleSuffix = '汽水低重力';
        }
      } else {
        if (isBoss) {
          bossKind = 'pigeon_king';
          titleSuffix = 'Boss · 广场鸽王';
          rivals = [
            { kind: 'red_crest', tier: 5 },
            { kind: 'white_pigeon', tier: 4 },
            { kind: 'sparrow', tier: 3 },
          ];
        } else {
          const tier = i <= 3 ? 3 : 4;
          rivals = i >= 5
            ? [{ kind: 'red_crest', tier }, { kind: 'white_pigeon', tier: 3 }]
            : [{ kind: 'red_crest', tier }, { kind: 'sparrow', tier: 3 }];
          if (i >= 5 && i <= 7) titleSuffix = '网红拍照双倍';
        }
      }

      const goalPair = GOAL_PAIRS[(campaignIndex - 1) % GOAL_PAIRS.length];
      levels.push({
        id: `c${ch.chapter}-l${i}`,
        campaignIndex,
        chapter: ch.chapter,
        indexInChapter: i,
        title: `${ch.chapter}-${i} · ${ch.name}${isBoss || titleSuffix !== `第 ${i} 关` ? `（${titleSuffix}）` : ''}`,
        shortName: isBoss ? `${ch.chapter}-8 Boss` : `${ch.chapter}-${i}`,
        plaza: isBoss && ch.chapter === 3 ? 'carnival' : ch.theme,
        nozzles: ch.nozzles.map((x, idx) => ({
          x,
          kind:
            rules.includes('moving_nozzle') && idx === Math.floor(ch.nozzles.length / 2)
              ? 'moving'
              : ch.chapter >= 2 && idx % 2 === 1
                ? 'angled'
                : 'normal',
        })),
        pattern: ch.chapter === 3 ? 'wave' : 'standard',
        rivals,
        rivalGainMult,
        dualActiveChance:
          ch.chapter === 1 ? (isBoss ? 0.26 : i >= 5 ? 0.3 : 0) : ch.chapter === 2 ? (isBoss ? 0.86 : 0.52) : 0.72,
        angledChance: ch.chapter === 1 ? 0 : ch.chapter === 2 ? 0.4 : 0.5,
        surgeChanceEarly: 0.35 + ch.chapter * 0.08,
        surgeChanceLate: 0.62 + ch.chapter * 0.08,
        waveMode: ch.chapter === 3 && i >= 4,
        cornEnabled: (ch.chapter === 1 && i >= 4) || ch.chapter >= 2,
        bossKind,
        events: [],
        rules,
        durationSec: 60,
        goals: [goalPair[0].label, goalPair[1].label],
        goalDefs: goalPair,
        teach: [],
      });
    }
  }

  return levels;
}

export const CAMPAIGN_LEVELS: readonly LevelDef[] = buildCampaignLevels();

export function getCampaignLevel(index: number): LevelDef {
  const clamped = Math.max(1, Math.min(CAMPAIGN_LEVELS.length, Math.round(index)));
  return CAMPAIGN_LEVELS[clamped - 1] ?? CAMPAIGN_LEVELS[0];
}

export function campaignLevelToStageConfig(level: LevelDef): StageConfig {
  const baseStageId: StageId =
    level.chapter === 1 ? 1 : level.chapter === 2 ? 2 : level.bossKind === 'pigeon_king' ? 4 : 3;
  const propsStage = STAGES[baseStageId];
  const movingIdx = level.nozzles.findIndex((n) => n.kind === 'moving');

  return {
    id: baseStageId,
    campaignIndex: level.campaignIndex,
    title: level.title,
    shortName: level.shortName,
    subtitle: level.goals.join(' · '),
    theme: level.plaza,
    durationSec: level.durationSec,
    targetScore: propsStage.targetScore,
    starThresholds: propsStage.starThresholds,
    rivalGainMult: level.rivalGainMult,
    nozzleXs: level.nozzles.map((n) => n.x),
    grateLeftX: level.chapter === 1 ? 62 : level.chapter === 2 ? 58 : 54,
    grateRightX: level.chapter === 1 ? 328 : level.chapter === 2 ? 332 : 336,
    dualActiveChance: level.dualActiveChance ?? 0,
    angledChance: level.angledChance ?? 0,
    surgeChanceEarly: level.surgeChanceEarly ?? 0.42,
    surgeChanceLate: level.surgeChanceLate ?? 0.68,
    waveMode: level.waveMode ?? false,
    cornEnabled: level.cornEnabled ?? false,
    propRespawnSec: null,
    lowGravity: level.rules.includes('low_gravity'),
    movingNozzleSlot: movingIdx >= 0 ? movingIdx : null,
    photoFlashEnabled: level.rules.includes('photo_flash'),
    bossKind: level.bossKind,
    rivals: level.rivals.map((r) => r.kind),
    aiTiers: level.rivals.map((r) => r.tier),
    props: propsStage.props,
  };
}
