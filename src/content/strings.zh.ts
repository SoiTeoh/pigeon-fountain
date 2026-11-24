import type { InputMethod } from '../core/input';

export const STRINGS_ZH = {
  title: {
    heading: '坏鸽子抢喷泉 V2.0',
    subtitle: '一屁股坐住，谁也别想抢',
    modeStage: '闯关霸占 (4关)',
    modeEndless: '无尽大乱斗',
    tipsTouch: [
      ['拖动移动', '下半屏按住左右拖动，坐稳涨霸占条'],
      ['动作键 · 顶/跳', '近敌自动肥臀猛顶，空地起跳'],
      ['空中下墩 · 堵泉', '空中再按动作键下墩，堵空泉逼邻泉暴喷！'],
    ] as const,
    tipsKeyboard: [
      ['A / D 移动', '坐稳水柱涨霸占条，最高 ×2 舒爽连击'],
      ['W 小跳 / 空中下墩', '跳越躲红 !，落空泉可堵泉憋大招'],
      ['Space 动作键', '近敌猛顶 / 地面起跳 / 空中下墩'],
    ] as const,
  },
  hud: {
    keyboardHint: 'A/D 移动 · W 跳 · Space 动作',
    dragHint: '◀ 按住下半屏左右拖动 ▶',
    jumpTitle: '小跳',
    jumpReadyKey: '(W)',
    jumpReadyTouch: '跳跃',
    bumpTitle: '肥臀猛顶',
    bumpReadyKey: '(Space)',
    bumpReadyTouch: '冲撞',
    actionJump: '起跳',
    actionBump: '肥臀猛顶',
    actionSlam: '下墩堵泉',
    cooling: '回气中...',
  },
  pause: {
    heading: '⏸ 暂停抢泉',
    resume: '继续抢泉',
    restartKey: '重开本局 (R)',
    restartTouch: '重开本局',
    home: '退出回主页',
    modeDrag: '操作：拖动 + 单动作键',
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
