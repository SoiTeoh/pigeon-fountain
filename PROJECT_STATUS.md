# 坏鸽子抢喷泉（Pigeon Fountain）— 项目状态

## 1. 项目定位

Idea Lab v2 — Project 02：基于 **Vite + TypeScript (strict) + 原生 HTML5 Canvas 2D + Web Audio API** 的轻量级竖屏街机物理喜剧小游戏（全 UI 绘制于单张 `<canvas id="stage">` 内，面向后续微信小游戏移植保持零外部依赖与接口解耦）。

## 2. 当前开发阶段

- **M0 打地基（纯重构阶段，进行中）**
  - [x] M0-1：新建 `src/core/rng.ts`（Mulberry32 + 状态哈希），替换 `rules.ts` 与 `world.ts` 中的全部 `Math.random()`，新增 `tests/rng.test.ts` 确定性测试。
  - [x] M0-2：新建 `src/core/input.ts`（统一触屏/键盘为 `{ moveTargetX, moveAxis, action, jump }` 并记录最近输入方式 `lastInputMethod`），接入 `main.ts` 并新增 `tests/input.test.ts`。
  - [x] M0-3：新建 `src/core/replay.ts`（增量关键帧输入录制与回放校验），新增 `tests/replay.test.ts` 验证同种子回放哈希一致及 50s 对局体积 `< 2KB`。
  - [x] M0-4：将 `painter.ts` 拆分为 `render/shared.ts`、`render/camera.ts`、`render/plaza.ts`、`render/actors/birds.ts`、`render/fx/particles.ts`、`render/hud.ts` 与 `scenes/overlays.ts`、`scenes/manager.ts`（单文件均 `< 400` 行），画面与行为保持完全一致。
  - [x] M0-5：新建 `src/content/strings.zh.ts` 集中界面文案，首页副标题改为“一屁股坐住，谁也别想抢”，手机/触屏端隐藏所有键盘提示（仅在检测到键盘输入时显示）。
  - [x] M0-6：修复 `main.ts` 每次开局生成独立随机 `uint32` 种子传入 `PigeonFountainWorld` 并记录至回放头，新增未指定种子差异性与同种子一致性测试。
- **M0 打地基全部完成**，进入 M1 前半段开发：
  - [x] M1-1：胜负规则改为 0–100 霸占条赛跑（基础 4/s、连击 ×1/×1.5/×2、暴喷 -10、对手独立倍率 `rivalGainMult`、60s 上限），去掉羽毛与 `0/350` 分数显示；HUD 左上显示玩家头像与霸占条、右上显示对手头像与霸占条，领先方 >80 闪烁。
  - [x] M1-2：新增 `src/game/plug.ts` 实现堵泉憋压（`PLUGGED` 状态、±20px、0.6s 相邻暴喷、2.0s 憋大招弹高 +8、3.0s 冷却）与抖动/冒泡表现；拆分 `rules.ts`、`world.ts` 至全部文件 `< 600` 行，新增 `tests/plug.test.ts`。
  - [x] M1-3：操作改为“下半屏拖动 + 右下角单情境动作键”（70px 内有对手猛顶、地面起跳、空中下墩堵泉），键盘保留 A/D/W/Space，暂停菜单新增“经典四键”开关并持久化至 `storage.ts`。
- **M1 修正包（R1～R4，进行中）**：
  - [x] R1：触屏操作修正为“左下 60% 相对横向摇杆（±10px 死区、±45px 满速、松手即停）+ 右侧 40% 顶/跳双键（+14px 判定、多指隔离）”，新增 `overscroll-behavior: none` 与 `contextmenu` 禁用，补全 `tests/input.test.ts`。
  - [x] R2：新增空中预测落点标记（可堵泉眼时变“屁股”图标闪烁 + 按钮切换“墩·堵泉”）、地面 120px 内可堵泉眼跳动屁股图标，以及 `plugSuccessCount < 3` 新手提示（持久化至 `storage.ts`）。
- **V2.0 Phase 1（`v2.0-arcade`）实机录屏体验与全量自动化验收均已完成**。
- 已完成 4 关闯关霸占 + 60s 无尽广场大乱斗全部实测，并修复实机录屏发现的第 4 关结算页重复「再来一局 (R)」按钮与封面 4 位数高分与星星行距过近问题。
- 已打标 `v2.0-arcade` 并准备接入个人博客 `IDEA LAB / 003` 上线部署。

## 3. 已实现功能（V2.0 Phase 1）

- `src/platform/storage.ts`：独立轻量存储接口层（`StorageBackend` 默认封装 `localStorage`，支持关卡解锁、1~3 星通关评价、无尽模式最高分及 v1 历史最高分迁移，方便后续直接替换为微信 `wx` 存储 API）。
- `src/config/tuning.ts`：集中配置 `390×640` 逻辑视口、`1000/60 ms` 固定步长、4 大主题关卡（`350 / 650 / 950 / 1300` 分，50s）与无尽模式（60s，道具 8s 补新）、3 种 AI 竞争鸟类参数、32° 斜喷与波浪连环喷发参数、双拇指按钮热区与喜剧道具配置。
- `src/game/rules.ts`：纯 TypeScript 状态机与规则引擎：
  - 多喷口调度（单喷、双喷、32° 偏心斜喷、Stage 4 波浪式连环喷发、`SURGE_WARN` -> `SURGE`）。
  - 冷却文案改为 `"回气中..."`，猛顶命中赋予对手 `0.60s` 眩晕硬直并保留约 `0.36s` 暴走反应延迟。
  - 「小跳墩坐 (`W`)」（冷却 `0.9s`）与空中落入喷水核心区触发「铁臀墩坐！+30」判定。
  - 抛物线炮弹发射矢量计算、道具碰撞检测、3 种 AI（`white_pigeon`、`sparrow`、`red_crest` 蓄力冲撞与扑空硬直）纯决策与暂停冻结检查。
- `src/game/world.ts`：确定性 2D 街机物理步进器（双技能、多目标保龄球击退、跳越地面对手、斜喷炮弹发射、砸中道具 `0.07s` Hit-stop + 碎片爆破 + 瓜子摊火花、大妈闪亮玉米粒 `+45`、无尽模式 8s 道具补新）。
- `src/game/audio.ts`：零依赖 Web Audio API 合成音效（小跳、铁臀墩坐砸水、木箱/纸杯/气球碎裂、玉米拾取与红冠鸽蓄力音效）。
- `src/render/painter.ts`：全 Canvas 2D 绘制（4 大主题广场背景、32° 斜喷水柱、4 类喜剧道具、3 种竞争鸟类与 `> □ <` 眩晕星环、左下 `◀`/`▶` + 右下 `小跳`/`肥臀猛顶` 双拇指布局、顶部 HUD 含 `🔊`/`⏸`、封面模式/选关卡片、暂停弹窗、星级结算卡片与 `?debug=1` 叠层）。
- `src/main.ts`：DPR 自适应、双拇指独立多指针管理（零冲突）、键盘 `A/D/←/→/W/↑/Space/Esc/P/R/Enter` 支持及暂停完全冻结控制。

## 4. 最新自动化验证结果

- `npm.cmd run typecheck`：通过（0 错误）。
- `npm.cmd test`：1 个测试文件、35 项 Vitest 单元测试全部通过（`tests/rules.test.ts`）。
- `npm.cmd run build`：通过（生成最新 `dist/`）。
- Playwright Chromium 三视口端到端验证（`360×640`、`390×844` 含 `?debug=1`、`1280×800`）：
  - 均满足 `fitsViewport: true`、`overflow: false`、`pauseFrozen: true`。
  - 覆盖封面 4 位数高分选关卡片排版、模式切换、开局移动、`小跳 (W)`、`肥臀猛顶 (Space)`、点击 `⏸` 暂停冻结并退出回主页，全程 0 控制台报错、0 页面异常、0 外部网络请求。
