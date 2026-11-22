# 坏鸽子抢喷泉（Pigeon Fountain）— 项目状态

## 1. 项目定位

Idea Lab v2 — Project 02：基于 **Vite + TypeScript (strict) + Matter.js + 原生 HTML5 Canvas 2D + Web Audio API** 的竖屏物理弹射喜剧小游戏（全 UI 绘制于单张 `<canvas id="stage">` 内，已合并 V2.0 街机版至 `main` 并打标 `v2.0-arcade`；当前分支 **`prototype/fountain-launch`** 推进全新弹射占座路线）。

## 2. 当前开发阶段

- **`prototype/fountain-launch` 阶段 1（首章完整 6 关 + 第 2 角色「胖大肥」+ 喜剧残局拍立得）开发与本地自动化验收已完成**。
- 暂未合并到 `main` 或推送，待真人试玩首章 6 关手感后决定调参或合并发布。

## 3. 已实现功能（`prototype/fountain-launch` 阶段 1）

- **阶段 0 录屏 3 项细节修复**：
  - 封实第 2 关红砖墙与右侧水泥高台间的窄缝（零缝隙重叠），墙顶增设向左探出小雨棚檐突出「二段喷泉」路线；
  - 仅当当前鸽子真正处于 `inTargetSeatZone` 时才显示 `稳住别滑出长椅…` 与绿色读秒环；
  - 放宽「二段中继喷泉」感应半径至 `±38px`，支持边缘约 1/3 蹭入即触发二段冲天。
- **双角色自由切换（每发前均可切换，每关共 3 发）**：
  - **黑小坏（`black_bad`）**：均衡灵巧，空中点击/`Space` 触发 **「铁臀速降墩坐」**；
  - **胖大肥（`fat_chonk`）**：大体型灰斑圆肚皮、高质量与高静摩擦，空中触发 **「泰山重磅压棚！」**（下落冲击力与震荡波翻倍，可压平弹性斜棚并轰飞重型红冠鸽）。
- **首章「街角到广场」完整 6 关**（`src/config/launchStages.ts`）：
  1. 第 1 关：街角宽长椅（★2：碰翻纸杯堆）
  2. 第 2 关：高墙与二段喷泉（★2：撞飞霸座白鸽）
  3. 第 3 关：纸杯塔保卫战（★2：纸杯一个不倒无损落座）
  4. 第 4 关：翘起的遮阳棚（`Matter.Constraint` 弹性铰链斜棚，需胖大肥压平坐稳 `0.85s`）
  5. 第 5 关：双路分叉（上路撞碎高架脆玻璃 vs 下路连续两口中继喷泉）
  6. 第 6 关：网红奶茶摊招牌 Boss（白鸽 + 重型红冠大鸽双霸座，清场后霸占招牌）
- **喜剧残局拍立得（`src/platform/snapshot.ts`）**：坐稳 `0.85s` 瞬间白光闪烁“咔嚓！”生成带印章与文案的拍立得缩略图，支持点击 **`📷 保存残局照片 (PNG)`** 导出下载。
- **进度持久化（`src/platform/storage.ts`）**：保存首章 6 关解锁、1~3 星评价与最高分。

## 4. 最新自动化验证结果

- `npm.cmd run typecheck`：通过（0 错误）。
- `npm.cmd test`：2 个测试文件共 **61 项 Vitest 单元测试全部通过**（`tests/launchRules.test.ts` 26 项 + `tests/rules.test.ts` 35 项）。
- `npm.cmd run build`：通过（`dist/index.html` 0.67 kB / `dist/assets/index-*.css` 0.49 kB / `dist/assets/index-*.js` ~148.7 kB，gzip ~45.4 kB）。
- Playwright Chromium 三视口端到端验证（`360×640`、`390×844` 含 `?debug=1`、`1280×800`）：
  - 遍历点击 6 张关卡卡片、切换「胖大肥」、验证第 1 关与第 4 关物理运行及 `?debug=1` 叠层，全程 `fitsViewport: true`、`overflow: false`、0 控制台报错、0 页面异常、0 外部网络请求。
