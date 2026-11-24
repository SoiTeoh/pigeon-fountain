import type { InputMethod } from '../core/input';

export const STRINGS_ZH = {
  title: {
    heading: '坏鸽子抢喷泉 V2.0',
    subtitle: '一屁股坐住，谁也别想抢',
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
  },
} as const;

export function showKeyboardHints(method: InputMethod): boolean {
  return method === 'keyboard';
}
