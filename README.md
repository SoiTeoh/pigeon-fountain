# 坏鸽子抢喷泉（Pigeon Fountain）

一款基于 **Vite + TypeScript + HTML5 Canvas 2D + Web Audio API** 的竖屏街机物理喜剧小游戏（Idea Lab v2 — Project 02）。  
玩家扮演一只圆滚滚的坏黑鸽，在 45 秒内与白胖鸽 AI 抢占广场铁箅子上的 3 个喷泉水柱，抗住侧向水压稳住屁股获取最高 `×3` 舒爽连击，并在红色 `!` 高压暴走前摇时闪开、顺便一记「肥臀猛顶」把白胖鸽撞进暴喷口！

## 核心玩法

- **3 槽位广场喷泉**：铁箅子（`x = 55..335`）均匀分布 3 个喷水口（`105 / 195 / 285`），按 `IDLE -> WARNING (1.1s) -> ACTIVE (3.6~4.4s) -> SURGE_WARN (0.9s) -> SURGE (0.45s)` 轮换。
- **水疗霸占与侧向水压**：坐在水柱核心区（`±26px`）即可浮起加分，连续霸占叠加 `×1 -> ×2 -> ×3` 舒爽连击；喷射过程中水柱带有随机侧向推力与倾斜前兆，需持续微调稳住屁股。
- **高压暴走喜剧博弈**：出现红 `!` 警告时贪分会被顶飞并掉 1 根尾羽（共 3 根）；算准时机闪开并用「肥臀猛顶」把白胖鸽撞进/留在暴喷口，可触发 `太坏了！+150` 并看白鸽满屏掉毛升天。

## 操作方式

- **触屏 / 鼠标**：按住画面左/右半区控制黑鸽左右移动与抗水压；点击底部中央「肥臀猛顶」胶囊按钮触发冲撞；右上角可切换静音。
- **键盘**：`A` / `←` 向左，`D` / `→` 向右，`Space` 肥臀猛顶，结算页按 `R` 或 `Enter` 一键重开。
- **调试视图**：URL 后追加 `?debug=1` 可查看 3 个喷口核心区间、两只鸽子碰撞半径、水压侧推向量、状态机倒计时与白鸽 AI 意图。

## 本地开发与验证

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## 目录结构

- `src/config/tuning.ts`：视口、固定步长、鸽子手感、喷泉状态机与得分倍率参数
- `src/game/rules.ts`：纯 TypeScript 状态机、占领与使坏判定、白鸽 AI 决策逻辑
- `src/game/world.ts`：确定性 2D 街机物理步进器、碰撞冲量与羽毛/水花粒子
- `src/game/audio.ts`：Web Audio API 合成音效与静音开关
- `src/render/painter.ts`：Canvas 2D 广场、拟人化鸽子表情、HUD、封面/结算卡片与 `?debug=1` 叠层
- `src/main.ts`：DPR 自适应、指针/键盘操控、`localStorage` 最高分记录
- `tests/rules.test.ts`：Vitest 单元测试
