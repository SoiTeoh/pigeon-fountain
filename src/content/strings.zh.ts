import type { AiArchetype } from '../config/tuning';
import type { InputMethod } from '../core/input';

export const RIVAL_NAMES: Record<AiArchetype, string> = {
  white_pigeon: '白胖',
  sparrow: '麻雀',
  red_crest: '红冠',
};

export function formatPluggedByRival(archetype: AiArchetype): string {
  return `被${RIVAL_NAMES[archetype]}坑了！`;
}

export function formatPluggedRival(archetype: AiArchetype): string {
  return `坑到${RIVAL_NAMES[archetype]}了！`;
}

export const STRINGS_ZH = {
  title: {
    heading: '坏鸽子抢喷泉',
    subtitle: '一屁股坐住，谁也别想抢',
    ctaPlay: '开抢！',
    navMap: '🗺 关卡',
    navEndless: '⚡ 无尽',
    navTutorial: '🎓 教学',
    mapHeading: '广场抢泉地图',
    back: '← 返回',
    prelevelRivals: '本关抢泉对手',
    prelevelGoals: '坏事清单',
    modeStage: '闯关霸占 (4关)',
    modeEndless: '无尽大乱斗',
    tipsTouch: [
      ['左下摇杆', '按住左下区左右滑动，偏离越大跑越快'],
      ['跳 / 空中再按墩', '跳起后空中再按「跳」下墩堵住空泉眼'],
      ['顶（大按钮）', '撞飞近处对手，送进红 ! 暴喷口！'],
    ] as const,
    tipsKeyboard: [
      ['A / D 移动', '坐稳水柱涨霸占条，最高 ×2 舒爽连击'],
      ['W 跳 / 空中再按墩', '跳起后空中再按 W 下墩堵住空泉眼'],
      ['Space 猛顶', '撞飞近处对手，送进红 ! 暴喷口！'],
    ] as const,
  },
  hud: {
    keyboardHint: 'A/D 移动 · W 跳/墩 · Space 顶',
    dragHint: '◀ 按住此处左右滑 ▶',
    jumpTitle: '跳',
    jumpAirTitle: '墩',
    jumpAirPlugTitle: '墩·堵泉',
    jumpReadyKey: '(W)',
    jumpReadyTouch: '起跳',
    bumpTitle: '顶',
    bumpReadyKey: '(Space)',
    bumpReadyTouch: '猛顶',
    cooling: '回气中...',
    plugGuideFirst: '跳起来，坐住空泉眼！',
    plugSuccessFirst: '学会堵泉！旁边会炸！',
    contested: '抢！',
    fountainAngry: '喷泉生气了！',
    photoFlashActive: '📸 网红拍照！涨条 ×2',
    lowGravityBadge: '🫧 低重力苏打喷泉',
    bossCantPush: '推不动！去堵泉！',
    assistActive: '🐷 胖大肥助阵中！',
  },
  assist: {
    delayNotice: '连败降难：AI 反应已放慢 +0.08s',
    callAssistBtn: '🐷 胖大肥助阵',
    assistOnBadge: '🐷 胖大肥助阵中（顶飞+25%·涨条加速）',
    skipLevelBtn: '⏭ 跳过本关',
  },
  tutorial: {
    tut1Drag: '拖动 → 走过去',
    tut2Bump: '点【顶】挤走它',
    tut2Dodge: '快躲开！',
    tut3Plug: '跳起来堵空泉眼',
  },
  pause: {
    heading: '⏸ 暂停抢泉',
    resume: '继续抢泉',
    restartKey: '重开本局 (R)',
    restartTouch: '重开本局',
    home: '退出回主页',
    modeDrag: '操作：摇杆 + 跳/顶双键',
    modeClassic: '操作：经典四键',
  },
  result: {
    replayKey: '再来一局 (R)',
    replayTouch: '再来一局',
    home: '返回主页',
    snapBadge: '📷 咔嚓！最坏的一刻',
    snapBigUlt: '憋个大招：坏到家了！',
    snapSabotage: '一屁股把对手轰飞上天！',
    snapLaunched: '大意了，自己也被喷飞！',
    snapWin: '稳坐水柱，成功霸占！',
    snapLose: '差一点就抢回来了！',
  },
} as const;

export function showKeyboardHints(method: InputMethod): boolean {
  return method === 'keyboard';
}
