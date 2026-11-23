import { STAGES, type Tuning } from '../config/tuning';
import { evaluateStageStars } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import type { StageId } from '../platform/storage';
import { roundRect, type RenderExtra } from '../render/shared';

export function drawTitleOverlay(
  ctx: CanvasRenderingContext2D,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width, height } = t.view;
  const ui = t.ui.title;
  const stage = STAGES[extra.selectedStageId];

  ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('坏鸽子抢喷泉 V2.0', width / 2, 92);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px sans-serif';
  ctx.fillText('怒鸟式弹射破坏 · 双拇指抢泉大乱斗', width / 2, 118);

  // Mode toggle tabs
  for (const [btn, label, active] of [
    [ui.modeStageBtn, '闯关霸占 (4关)', extra.gameMode === 'stage'],
    [ui.modeEndlessBtn, '无尽大乱斗', extra.gameMode === 'endless'],
  ] as const) {
    ctx.fillStyle = active ? '#0ea5e9' : '#f1f5f9';
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = active ? '#ffffff' : '#475569';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  if (extra.gameMode === 'stage') {
    // 4 stage cards
    const ids: StageId[] = [1, 2, 3, 4];
    ids.forEach((sid, idx) => {
      const sx = ui.stageCardStartX + idx * (ui.stageCardW + ui.stageCardGap);
      const sy = ui.stageCardY;
      const unlocked = sid <= extra.progress.unlockedStage;
      const selected = sid === extra.selectedStageId;
      const stars = extra.progress.stars[sid];

      ctx.fillStyle = selected ? '#e0f2fe' : unlocked ? '#f8fafc' : '#e2e8f0';
      roundRect(ctx, sx, sy, ui.stageCardW, ui.stageCardH, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#0284c7' : unlocked ? '#cbd5e1' : '#94a3b8';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = unlocked ? '#0f172a' : '#64748b';
      ctx.font = '800 12.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`第 ${sid} 关`, sx + ui.stageCardW / 2, sy + 18);

      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(
        STAGES[sid].shortName.replace(/^\d+\.\s*/, ''),
        sx + ui.stageCardW / 2,
        sy + 36,
        ui.stageCardW - 8,
      );

      if (unlocked) {
        const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        ctx.fillStyle = stars > 0 ? '#f59e0b' : '#94a3b8';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(starStr, sx + ui.stageCardW / 2, sy + 56, ui.stageCardW - 10);

        const best = extra.progress.stageBestScores[sid];
        ctx.fillStyle = '#64748b';
        ctx.font = '700 9.5px sans-serif';
        ctx.fillText(
          best > 0 ? `最高 ${best}` : `目标 ${STAGES[sid].targetScore}`,
          sx + ui.stageCardW / 2,
          sy + 77,
          ui.stageCardW - 10,
        );
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '700 11.5px sans-serif';
        ctx.fillText('🔒 未解锁', sx + ui.stageCardW / 2, sy + 64, ui.stageCardW - 8);
      }
    });

    // Selected stage info box
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 38, 308, width - 76, 58, 12);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${stage.title}（目标 ${stage.targetScore} 分）`, 50, 328);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11.5px sans-serif';
    ctx.fillText(stage.subtitle, 50, 348);
  } else {
    // Endless info box
    ctx.fillStyle = '#fef3c7';
    roundRect(ctx, 38, 204, width - 76, 152, 16);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60s 无尽广场大乱斗', width / 2, 240);
    ctx.fillStyle = '#78350f';
    ctx.font = '600 12px sans-serif';
    ctx.fillText('5 喷口狂飙 · 道具摧毁 8 秒自动补新', width / 2, 268);
    ctx.fillText('白胖鸽 + 麻雀群 + 红冠鸽同台混战', width / 2, 290);
    ctx.fillStyle = '#d97706';
    ctx.font = '800 15px sans-serif';
    ctx.fillText(`本机最高纪录：${extra.progress.endlessBestScore} 分`, width / 2, 328);
  }

  // Controls guide
  const tips = [
    ['◀ / ▶ 或 A/D', '抗住水压稳住屁股，最高 ×3 舒爽连击'],
    ['小跳 (W)', '跳越对手躲红 !，落喷口触发「铁臀墩坐 +30」'],
    ['肥臀猛顶 (Space)', '顶晕送进红 !/斜喷口，砸塌道具 +120！'],
  ];
  tips.forEach(([title, desc], idx) => {
    const ty = 376 + idx * 38;
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, 38, ty, width - 76, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 10.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 46, ty + 16);
    ctx.fillStyle = '#475569';
    ctx.font = '500 10px sans-serif';
    ctx.fillText(desc, 138, ty + 16, width - 182);
  });

  // Start button
  ctx.fillStyle = '#0ea5e9';
  roundRect(ctx, ui.startBtn.x, ui.startBtn.y, ui.startBtn.w, ui.startBtn.h, ui.startBtn.r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    extra.gameMode === 'stage' ? `开始第 ${extra.selectedStageId} 关！` : '进入无尽大乱斗！',
    ui.startBtn.x + ui.startBtn.w / 2,
    ui.startBtn.y + ui.startBtn.h / 2 + 1,
  );
}

export function drawPauseOverlay(ctx: CanvasRenderingContext2D, t: Tuning): void {
  const { width, height } = t.view;
  const ui = t.ui.pause;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏸ 暂停抢泉', width / 2, 212);

  for (const [btn, label, bg, fg] of [
    [ui.resumeBtn, '继续抢泉', '#10b981', '#ffffff'],
    [ui.restartBtn, '重开本局 (R)', '#f59e0b', '#0f172a'],
    [ui.homeBtn, '退出回主页', '#e2e8f0', '#334155'],
  ] as const) {
    ctx.fillStyle = bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = '800 16px sans-serif';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
}

export function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width, height } = t.view;
  const { match, stage } = world;
  const ui = t.ui.result;
  const stars =
    match.mode === 'stage' ? evaluateStageStars(match.score, match.endReason, stage) : 0;
  const stageCleared = match.mode === 'stage' && stars >= 1;
  const hasNextStage = stageCleared && match.stageId < 4;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const headline =
    match.endReason === 'feathers_zero'
      ? '尾羽掉光啦！'
      : match.mode === 'endless'
        ? '无尽乱斗账单'
        : stageCleared
          ? `第 ${match.stageId} 关制霸成功！`
          : `差一点达到 ${stage.targetScore} 分`;
  ctx.fillText(headline, width / 2, 124);

  if (match.mode === 'stage') {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ctx.fillStyle = stars > 0 ? '#f59e0b' : '#94a3b8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(starStr, width / 2, 162);
  }

  ctx.fillStyle = '#ea580c';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(`${Math.floor(match.score)} 分`, width / 2, match.mode === 'stage' ? 204 : 182);

  const bestScore =
    match.mode === 'stage'
      ? Math.max(extra.progress.stageBestScores[match.stageId], Math.floor(match.score))
      : Math.max(extra.progress.endlessBestScore, Math.floor(match.score));

  const rows = [
    ['占领喷泉时长', `${match.soakSec.toFixed(1)} 秒`],
    ['使坏轰飞对手', `${match.sabotageCount} 次`],
    ['道具连锁爆破', `${match.propSmashCount} 次`],
    ['铁臀墩坐 / 最高连击', `${match.slamCount} 次 / ×${match.maxCombo}`],
    ['本关最高纪录', `${bestScore} 分`],
  ];
  rows.forEach(([label, val], idx) => {
    const ry = 246 + idx * 32;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 48, ry - 13, width - 96, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '600 12.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 58, ry);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, width - 58, ry);
  });

  // Primary button only when there is a next stage; otherwise keep two non-duplicate buttons!
  if (hasNextStage) {
    ctx.fillStyle = '#0ea5e9';
    roundRect(
      ctx,
      ui.primaryBtn.x,
      ui.primaryBtn.y,
      ui.primaryBtn.w,
      ui.primaryBtn.h,
      ui.primaryBtn.r,
    );
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `下一关：第 ${match.stageId + 1} 关 ▶`,
      ui.primaryBtn.x + ui.primaryBtn.w / 2,
      ui.primaryBtn.y + ui.primaryBtn.h / 2 + 1,
    );
  }

  const leftBtn = hasNextStage ? ui.secondaryLeftBtn : ui.soloLeftBtn;
  const rightBtn = hasNextStage ? ui.secondaryRightBtn : ui.soloRightBtn;

  for (const [btn, label, bg, fg] of [
    [leftBtn, '再来一局 (R)', hasNextStage ? '#f1f5f9' : '#10b981', hasNextStage ? '#0f172a' : '#ffffff'],
    [rightBtn, '返回主页', '#e2e8f0', '#334155'],
  ] as const) {
    ctx.fillStyle = bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = hasNextStage ? '800 14px sans-serif' : '900 15px sans-serif';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
}
