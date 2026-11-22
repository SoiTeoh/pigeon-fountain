import type { LaunchChapterStageId } from '../platform/storage';

export type SubGoalKind =
  | 'knock_cups'
  | 'knock_rivals'
  | 'preserve_cups'
  | 'flatten_awning'
  | 'dual_route_bonus'
  | 'clear_boss_rivals';

export interface BenchSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SeatZoneSpec {
  readonly x: number;
  readonly y: number;
  readonly halfW: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface CupSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RelayFountainSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly triggerRadiusPx: number;
  readonly triggerHeightPx: number;
  readonly cooldownSec: number;
  readonly launchVx: number;
  readonly launchVy: number;
}

export interface WallSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind?: 'brick' | 'eave' | 'post';
}

export interface PlatformSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind?: 'concrete' | 'wood';
}

export interface GlassSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AwningSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly restAngleRad: number;
  readonly flatThresholdRad: number;
  readonly springStiffness: number;
}

export interface RivalHogSpec {
  readonly id: string;
  readonly archetype: 'white' | 'red_crest';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly density: number;
}

export interface LaunchStageConfig {
  readonly id: LaunchChapterStageId;
  readonly shortName: string;
  readonly title: string;
  readonly subtitle: string;
  readonly subGoalKind: SubGoalKind;
  readonly subGoalText: string;
  readonly winSubCaption: string;
  readonly fountainX: number;
  readonly fountainY: number;
  readonly bench: BenchSpec | null;
  readonly awning: AwningSpec | null;
  readonly seat: SeatZoneSpec;
  readonly platforms: readonly PlatformSpec[];
  readonly walls: readonly WallSpec[];
  readonly relays: readonly RelayFountainSpec[];
  readonly glasses: readonly GlassSpec[];
  readonly cups: readonly CupSpec[];
  readonly rivals: readonly RivalHogSpec[];
}

export const LAUNCH_STAGES: Record<LaunchChapterStageId, LaunchStageConfig> = {
  1: {
    id: 1,
    shortName: '1. 街角长椅',
    title: '第 1 关 · 街角宽长椅',
    subtitle: '拖拉蓄压发射 · 空中速降精准落座',
    subGoalKind: 'knock_cups',
    subGoalText: '碰落或撞飞长椅旁的纸杯堆',
    winSubCaption: '街角抢座首战告捷，顺手拍倒杯子！',
    fountainX: 70,
    fountainY: 478,
    bench: { x: 286, y: 468, w: 124, h: 14 },
    awning: null,
    seat: { x: 286, y: 442, halfW: 58, minY: 404, maxY: 468 },
    platforms: [],
    walls: [],
    relays: [],
    glasses: [],
    cups: [
      { id: 'c1-a', x: 234, y: 451, w: 14, h: 20 },
      { id: 'c1-b', x: 250, y: 451, w: 14, h: 20 },
      { id: 'c1-c', x: 242, y: 431, w: 14, h: 20 },
      { id: 'c1-d', x: 332, y: 451, w: 14, h: 20 },
    ],
    rivals: [],
  },
  2: {
    id: 2,
    shortName: '2. 高墙中继',
    title: '第 2 关 · 高墙与二段喷泉',
    subtitle: '踩中继小喷泉二段冲天 · 撞走霸座白鸽！',
    subGoalKind: 'knock_rivals',
    subGoalText: '把高台长椅上的白鸽一屁股撞飞',
    winSubCaption: '借二段水柱翻墙空降，白鸽连毛带人飞！',
    fountainX: 68,
    fountainY: 478,
    bench: { x: 308, y: 374, w: 104, h: 14 },
    awning: null,
    seat: { x: 308, y: 348, halfW: 50, minY: 310, maxY: 374 },
    // Platform seamlessly overlaps wall right edge (299 - 89 = 210 <= 211) -> zero gap!
    platforms: [{ x: 299, y: 442, w: 178, h: 116, kind: 'concrete' }],
    walls: [
      { x: 200, y: 400, w: 22, h: 200, kind: 'brick' },
      { x: 194, y: 296, w: 36, h: 12, kind: 'eave' },
    ],
    relays: [
      {
        id: 's2-r1',
        x: 122,
        y: 492,
        triggerRadiusPx: 38,
        triggerHeightPx: 44,
        cooldownSec: 0.85,
        launchVx: 118,
        launchVy: -805,
      },
    ],
    glasses: [],
    cups: [],
    rivals: [
      {
        id: 's2-white',
        archetype: 'white',
        x: 316,
        y: 347,
        radius: 20,
        density: 0.0021,
      },
    ],
  },
  3: {
    id: 3,
    shortName: '3. 纸杯保卫',
    title: '第 3 关 · 纸杯塔保卫战',
    subtitle: '逆向微操：绕过高高垒起的纸杯塔无损落座！',
    subGoalKind: 'preserve_cups',
    subGoalText: '纸杯一个不倒，优雅无损落座',
    winSubCaption: '杯子一杯没倒，优雅！',
    fountainX: 68,
    fountainY: 478,
    bench: { x: 292, y: 468, w: 138, h: 14 },
    awning: null,
    seat: { x: 318, y: 442, halfW: 42, minY: 404, maxY: 468 },
    platforms: [],
    walls: [],
    relays: [],
    glasses: [],
    cups: [
      { id: 'c3-1', x: 234, y: 451, w: 14, h: 20 },
      { id: 'c3-2', x: 252, y: 451, w: 14, h: 20 },
      { id: 'c3-3', x: 234, y: 431, w: 14, h: 20 },
      { id: 'c3-4', x: 252, y: 431, w: 14, h: 20 },
      { id: 'c3-5', x: 243, y: 411, w: 14, h: 20 },
    ],
    rivals: [],
  },
  4: {
    id: 4,
    shortName: '4. 胖鸽压棚',
    title: '第 4 关 · 翘起的遮阳棚',
    subtitle: '切换「胖大肥」按 Space 泰山重磅压平弹性棚！',
    subGoalKind: 'flatten_awning',
    subGoalText: '用胖大肥将翘起遮阳棚压平坐稳',
    winSubCaption: '泰山重磅压棚，弹性遮阳棚瞬间服帖！',
    fountainX: 70,
    fountainY: 478,
    bench: null,
    awning: {
      x: 288,
      y: 408,
      w: 122,
      h: 14,
      restAngleRad: -0.46,
      flatThresholdRad: 0.18,
      springStiffness: 0.044,
    },
    seat: { x: 288, y: 382, halfW: 56, minY: 340, maxY: 424 },
    platforms: [],
    walls: [{ x: 288, y: 462, w: 18, h: 76, kind: 'post' }],
    relays: [],
    glasses: [],
    cups: [],
    rivals: [],
  },
  5: {
    id: 5,
    shortName: '5. 双路分叉',
    title: '第 5 关 · 高架木梁 vs 连环泉',
    subtitle: '上路撞碎高架脆玻璃，或下路连踩两口中继泉！',
    subGoalKind: 'dual_route_bonus',
    subGoalText: '撞碎玻璃捷径 或 连踩两口中继泉',
    winSubCaption: '条条大路通宝座，空中接力秀翻广场！',
    fountainX: 66,
    fountainY: 478,
    bench: { x: 326, y: 378, w: 94, h: 14 },
    awning: null,
    seat: { x: 326, y: 352, halfW: 44, minY: 310, maxY: 378 },
    platforms: [
      { x: 184, y: 274, w: 112, h: 14, kind: 'wood' },
      { x: 326, y: 444, w: 100, h: 112, kind: 'concrete' },
    ],
    walls: [{ x: 268, y: 446, w: 20, h: 108, kind: 'brick' }],
    relays: [
      {
        id: 's5-r1',
        x: 126,
        y: 492,
        triggerRadiusPx: 36,
        triggerHeightPx: 42,
        cooldownSec: 0.75,
        launchVx: 148,
        launchVy: -475,
      },
      {
        id: 's5-r2',
        x: 214,
        y: 492,
        triggerRadiusPx: 36,
        triggerHeightPx: 42,
        cooldownSec: 0.75,
        launchVx: 124,
        launchVy: -690,
      },
    ],
    glasses: [{ id: 'g5-1', x: 226, y: 232, w: 12, h: 70 }],
    cups: [],
    rivals: [],
  },
  6: {
    id: 6,
    shortName: '6. 奶茶 Boss',
    title: '第 6 关 · 网红奶茶摊招牌',
    subtitle: '首章 Boss：胖鸽重砸清场，把白鸽+红冠大鸽全轰飞！',
    subGoalKind: 'clear_boss_rivals',
    subGoalText: '把白鸽和红冠大鸽全部轰下招牌',
    winSubCaption: '奶茶摊招牌归我啦！首章全破！',
    fountainX: 66,
    fountainY: 478,
    bench: { x: 306, y: 354, w: 120, h: 14 },
    awning: null,
    seat: { x: 306, y: 328, halfW: 54, minY: 282, maxY: 354 },
    platforms: [{ x: 306, y: 432, w: 126, h: 136, kind: 'wood' }],
    walls: [{ x: 212, y: 434, w: 20, h: 132, kind: 'brick' }],
    relays: [
      {
        id: 's6-r1',
        x: 134,
        y: 492,
        triggerRadiusPx: 38,
        triggerHeightPx: 44,
        cooldownSec: 0.85,
        launchVx: 132,
        launchVy: -790,
      },
    ],
    glasses: [],
    cups: [
      { id: 'c6-a', x: 256, y: 337, w: 13, h: 18 },
      { id: 'c6-b', x: 256, y: 319, w: 13, h: 18 },
    ],
    rivals: [
      {
        id: 's6-white',
        archetype: 'white',
        x: 286,
        y: 327,
        radius: 19,
        density: 0.0020,
      },
      {
        id: 's6-boss',
        archetype: 'red_crest',
        x: 328,
        y: 323,
        radius: 23,
        density: 0.0046,
      },
    ],
  },
};
