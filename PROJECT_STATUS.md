# 坏鸽子抢喷泉（Pigeon Fountain）— 项目状态

## 1. 项目定位

Idea Lab v2 — Project 02：基于 **Vite + TypeScript (strict) + 原生 HTML5 Canvas 2D + Web Audio API** 的轻量级竖屏街机物理喜剧小游戏。

## 2. 当前开发阶段

- **MVP 核心开发与自动化验收已完成**（Task 1～5 对应工程搭建、纯逻辑状态机与 AI、确定性 2D 街机物理、拟人化矢量渲染与合成音效、单元测试及三视口 Playwright 检查）。
- **已进入 v1 封存归档阶段**：完成本地 Git 初始化、首次提交并推送至 GitHub 仓库 `SoiTeoh/pigeon-fountain`。

## 3. 已实现功能

- `src/config/tuning.ts`：集中配置 `390×640` 逻辑视口、`1000/60 ms` 固定步长、3 个喷口坐标（`105 / 195 / 285`）、`±26px` 核心判定半径、`0.65s` 猛顶冷却与 `45s` / `3 尾羽` 规则参数。
- `src/game/rules.ts`：纯 TypeScript 规则引擎（`IDLE -> WARNING -> ACTIVE -> SURGE_WARN -> SURGE` 状态机、水柱霸占与 `×1/×2/×3` 连击、使坏顶飞 `+150` 判定、含反应延迟的白胖鸽 AI 决策）。
- `src/game/world.ts`：确定性 2D 街机物理步进器（左右惯性移动、抗侧向水压、软体挤压碰撞、肥臀猛顶冲撞击退、暴喷旋转抛物线与羽毛/水花/爱心粒子）。
- `src/game/audio.ts`：零依赖 Web Audio API 合成音效（冒泡、喷水白噪声、舒爽连击叮咚、屁股撞击、红 `!` 预警、暴喷轰鸣与惨叫滑音）。
- `src/render/painter.ts`：Canvas 2D 广场与铁箅子背景、5 种黑鸽表情与 `Ò _ Ó` 白胖鸽、底部「肥臀猛顶」带冷却进度按钮、标题/账单结算卡片及 `?debug=1` 调试叠层。
- `src/main.ts`：DPR 自适应、触屏左右半区+底部按钮独立指针管理（防卡键）、键盘 `A/D/←/→/Space/R`、`localStorage` 最高分安全读写。

## 4. 最新自动化验证结果

- `npm.cmd --prefix D:\Codex\idea-lab\pigeon-fountain run typecheck`：通过（0 错误）。
- `npm.cmd --prefix D:\Codex\idea-lab\pigeon-fountain test`：1 个测试文件、18 项 Vitest 单元测试全部通过（`tests/rules.test.ts`）。
- `npm.cmd --prefix D:\Codex\idea-lab\pigeon-fountain run build`：通过（`dist/assets/index-*.js` 33.85 kB / gzip 10.83 kB）。
- Playwright Chromium 三视口端到端验证（`360×640`、`390×844` 含 `?debug=1`、`1280×800`）：
  - 均满足 `fitsViewport: true`、`overflow: false`。
  - 模拟点击开局、左右移动、点击底部「肥臀猛顶」及键盘 `Space` 全程 0 控制台报错、0 页面异常、0 外部网络请求。

## 5. 待真人试玩验证项

- 触屏与桌面端左右移动抗水压的阻尼手感、「肥臀猛顶」击退距离与白鸽 AI 呆萌反应延迟的喜剧节奏。

## Future Polish / v2 Backlog

1. **按钮冷却文案优化**：将「肥臀猛顶」冷却时的按钮文案从“蓄力中...”改为“回气中...”或“冷却中...”，避免玩家误以为需要长按蓄力。
2. **“坑飞白鸽 +150”触发调优**：后续真机试玩时进一步调优白鸽 AI 在红 `!` 警告期的反应迟钝度，并增加白鸽被“肥臀猛顶”撞中后的短暂硬直时间，让“坑飞白鸽 +150”更容易爽快触发。
