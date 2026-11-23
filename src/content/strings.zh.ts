import type { InputMethod } from '../core/input';

export const STRINGS_ZH = {
  title: {
    heading: '坏鸽子抢喷泉 V2.0',
    subtitle: '一屁股坐住，谁也别想抢',
    modeStage: '闯关霸占 (4关)',
    modeEndless: '无尽大乱斗',
    tipsTouch: [
      ['◀ / ▶ 移动', '抗住水压稳住屁股，最高 ×3 舒爽连击'],
      ['小跳', '跳越对手躲红 !，落喷口触发「铁臀墩坐 +30」'],
      ['肥臀猛顶', '顶晕送进红 !/斜喷口，砸塌道具 +120！'],
    ] as const,
    tipsKeyboard: [
      ['◀ / ▶ 或 A/D', '抗住水压稳住屁股，最高 ×3 舒爽连击'],
      ['小跳 (W)', '跳越对手躲红 !，落喷口触发「铁臀墩坐 +30」'],
      ['肥臀猛顶 (Space)', '顶晕送进红 !/斜喷口，砸塌道具 +120！'],
    ] as const,
  },
  hud: {
    keyboardHint: 'A/D 移动 · W 小跳 · Space 猛顶',
    jumpTitle: '小跳',
    jumpReadyKey: '(W)',
    jumpReadyTouch: '跳跃',
    bumpTitle: '肥臀猛顶',
    bumpReadyKey: '(Space)',
    bumpReadyTouch: '冲撞',
    cooling: '回气中...',
  },
  pause: {
    heading: '⏸ 暂停抢泉',
    resume: '继续抢泉',
    restartKey: '重开本局 (R)',
    restartTouch: '重开本局',
    home: '退出回主页',
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
