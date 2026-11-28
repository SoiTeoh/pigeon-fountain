import { STAGES, type Tuning } from '../config/tuning';
import { RIVAL_NAMES, showKeyboardHints, STRINGS_ZH } from '../content/strings.zh';
import {
  didPlayerWinRace,
  evaluateStageStars,
  getMaxRivalControl,
} from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import { drawMiniBirdAvatar } from '../render/hud';
import {
  COMIC_PALETTE,
  computeViewportLayout,
  HOME_UI,
  roundRect,
  type RenderExtra,
} from '../render/shared';

function drawStickerButton(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number; r: number },
  fill: string,
  fg: string,
  label: string,
  font = '900 16px "PingFang SC", "Microsoft YaHei", sans-serif',
): void {
  ctx.save();
  ctx.fillStyle = COMIC_PALETTE.outline;
  roundRect(ctx, rect.x, rect.y + 4, rect.w, rect.h, rect.r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

export function drawTitleOverlay(
  ctx: CanvasRenderingContext2D,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const layout = computeViewportLayout(
    extra.logicalHeight ?? t.view.height,
    extra.safeTopPx ?? 0,
    t,
  );
  const sub = extra.homeSubView ?? 'home';
  const stage = STAGES[extra.selectedStageId];

  if (sub === 'home') {
    // Upper half: bold comic sticker Logo over live AI fountain battle (no instruction paragraphs!)
    ctx.save();
    ctx.translate(width / 2, 74 + layout.hudOffsetY);
    ctx.rotate(-0.035);
    ctx.fillStyle = COMIC_PALETTE.outline;
    roundRect(ctx, -148, -32, 296, 68, 20);
    ctx.fill();
    ctx.fillStyle = COMIC_PALETTE.accentBright;
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 3.5;
    roundRect(ctx, -152, -36, 296, 68, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COMIC_PALETTE.outline;
    ctx.font = '900 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STRINGS_ZH.title.heading, -4, -1);

    // Cute mini sticker badge
    drawMiniBirdAvatar(ctx, 118, -2, 16, 'player');
    ctx.restore();

    // Lower half anchored to bottom: big CTA "开抢！" + 3 bottom icon buttons
    ctx.save();
    ctx.translate(0, layout.bottomOffsetY);
    const pulse = 1 + Math.sin(extra.animTimeSec * 4.5) * 0.025;
    ctx.save();
    ctx.translate(HOME_UI.ctaBtn.x + HOME_UI.ctaBtn.w / 2, HOME_UI.ctaBtn.y + HOME_UI.ctaBtn.h / 2);
    ctx.scale(pulse, pulse);
    drawStickerButton(
      ctx,
      {
        x: -HOME_UI.ctaBtn.w / 2,
        y: -HOME_UI.ctaBtn.h / 2,
        w: HOME_UI.ctaBtn.w,
        h: HOME_UI.ctaBtn.h,
        r: HOME_UI.ctaBtn.r,
      },
      COMIC_PALETTE.accentMustard,
      COMIC_PALETTE.outline,
      STRINGS_ZH.title.ctaPlay,
      '900 24px "PingFang SC", "Microsoft YaHei", sans-serif',
    );
    ctx.restore();

    drawStickerButton(ctx, HOME_UI.navMapBtn, COMIC_PALETTE.surfaceWhite, COMIC_PALETTE.outline, STRINGS_ZH.title.navMap, '800 13.5px sans-serif');
    drawStickerButton(ctx, HOME_UI.navEndlessBtn, COMIC_PALETTE.fountainBright, COMIC_PALETTE.outline, STRINGS_ZH.title.navEndless, '800 13.5px sans-serif');
    drawStickerButton(ctx, HOME_UI.navTutorialBtn, '#FEF3C7', COMIC_PALETTE.outline, STRINGS_ZH.title.navTutorial, '800 13.5px sans-serif');
    ctx.restore();
    return;
  }

  // Dimmed backdrop for Map / Pre-level cards
  ctx.fillStyle = 'rgba(43, 43, 58, 0.56)';
  ctx.fillRect(0, 0, width, layout.logicalHeight);
  ctx.save();
  ctx.translate(0, layout.overlayOffsetY);

  if (sub === 'map') {
    const card = HOME_UI.mapCard;
    ctx.fillStyle = COMIC_PALETTE.outline;
    roundRect(ctx, card.x, card.y + 5, card.w, card.h, card.r);
    ctx.fill();
    ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = COMIC_PALETTE.outlineWidth;
    roundRect(ctx, card.x, card.y, card.w, card.h, card.r);
    ctx.fill();
    ctx.stroke();

    drawStickerButton(ctx, HOME_UI.mapBackBtn, '#F1F5F9', COMIC_PALETTE.outline, STRINGS_ZH.title.back, '800 12px sans-serif');

    ctx.fillStyle = COMIC_PALETTE.outline;
    ctx.font = '900 21px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STRINGS_ZH.title.mapHeading, width / 2 + 22, 90);

    // Winding dashed street path connecting Stage 1 -> 4
    ctx.save();
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    HOME_UI.mapNodes.forEach((node, idx) => {
      if (idx === 0) ctx.moveTo(node.x, node.y);
      else ctx.lineTo(node.x, node.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (const node of HOME_UI.mapNodes) {
      const unlocked = node.id <= extra.progress.unlockedStage;
      const selected = node.id === extra.selectedStageId;
      const stars = extra.progress.stars[node.id];

      ctx.save();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.beginPath();
      ctx.arc(node.x, node.y + 4, node.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = selected
        ? COMIC_PALETTE.accentBright
        : unlocked
          ? COMIC_PALETTE.fountainBright
          : '#E2E8F0';
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = unlocked ? COMIC_PALETTE.outline : '#64748B';
      ctx.font = '900 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unlocked ? `${node.id}` : '🔒', node.x, node.y - 4);

      const starStr = unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '未解锁';
      ctx.fillStyle = unlocked && stars > 0 ? '#D97706' : '#475569';
      ctx.font = '800 10px sans-serif';
      ctx.fillText(starStr, node.x, node.y + 14);

      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.font = '800 12px sans-serif';
      ctx.fillText(STAGES[node.id].shortName, node.x, node.y + node.r + 16);
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // Pre-level card ('prelevel'): stage banner + rival avatars + bad-deeds goal checklist + CTA
  const card = HOME_UI.preCard;
  ctx.fillStyle = COMIC_PALETTE.outline;
  roundRect(ctx, card.x, card.y + 5, card.w, card.h, card.r);
  ctx.fill();
  ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  roundRect(ctx, card.x, card.y, card.w, card.h, card.r);
  ctx.fill();
  ctx.stroke();

  drawStickerButton(ctx, HOME_UI.preBackBtn, '#F1F5F9', COMIC_PALETTE.outline, STRINGS_ZH.title.back, '800 12px sans-serif');

  ctx.fillStyle = COMIC_PALETTE.outline;
  ctx.font = '900 19px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stage.title, width / 2, 166, card.w - 32);

  // Rivals showcase box
  ctx.fillStyle = '#FFF6EB';
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2.5;
  roundRect(ctx, 44, 196, width - 88, 94, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '800 11px sans-serif';
  ctx.fillText(STRINGS_ZH.title.prelevelRivals, width / 2, 214);

  const rivalCount = stage.rivals.length;
  stage.rivals.forEach((rk, i) => {
    const rx = width / 2 + (i - (rivalCount - 1) / 2) * 66;
    drawMiniBirdAvatar(ctx, rx, 248, 16, rk);
    ctx.fillStyle = COMIC_PALETTE.outline;
    ctx.font = '800 11px sans-serif';
    ctx.fillText(RIVAL_NAMES[rk], rx, 274);
  });

  // Bad-deeds star checklist
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2.5;
  roundRect(ctx, 44, 304, width - 88, 142, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '800 11px sans-serif';
  ctx.fillText(STRINGS_ZH.title.prelevelGoals, width / 2, 322);

  const goals = [
    '★  抢先霸占到 100 获胜',
    `★★ 中暴喷不超过 1 次（高分 ${stage.starThresholds[1]}+）`,
    `★★★ 全程压制对手（极速制霸）`,
  ];
  goals.forEach((g, idx) => {
    ctx.fillStyle = COMIC_PALETTE.outline;
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(g, 60, 352 + idx * 30, card.w - 64);
  });

  drawStickerButton(
    ctx,
    HOME_UI.preStartBtn,
    COMIC_PALETTE.accentMustard,
    COMIC_PALETTE.outline,
    STRINGS_ZH.title.ctaPlay,
    '900 22px "PingFang SC", "Microsoft YaHei", sans-serif',
  );
  ctx.restore();
}

export function drawPauseOverlay(
  ctx: CanvasRenderingContext2D,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const layout = computeViewportLayout(
    extra.logicalHeight ?? t.view.height,
    extra.safeTopPx ?? 0,
    t,
  );
  const ui = t.ui.pause;
  const restartLabel = showKeyboardHints(extra.lastInputMethod)
    ? STRINGS_ZH.pause.restartKey
    : STRINGS_ZH.pause.restartTouch;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, layout.logicalHeight);

  ctx.save();
  ctx.translate(0, layout.overlayOffsetY);

  ctx.fillStyle = COMIC_PALETTE.outline;
  roundRect(ctx, ui.card.x, ui.card.y + 5, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();
  ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COMIC_PALETTE.outline;
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STRINGS_ZH.pause.heading, width / 2, 190);

  const modeLabel = extra.classicFourButtons
    ? STRINGS_ZH.pause.modeClassic
    : STRINGS_ZH.pause.modeDrag;

  for (const [btn, label, bg, fg] of [
    [ui.resumeBtn, STRINGS_ZH.pause.resume, COMIC_PALETTE.accentMustard, COMIC_PALETTE.outline],
    [ui.restartBtn, restartLabel, COMIC_PALETTE.fountainBright, COMIC_PALETTE.outline],
    [ui.homeBtn, STRINGS_ZH.pause.home, '#F1F5F9', COMIC_PALETTE.outline],
    [ui.controlToggleBtn, modeLabel, '#FFF6EB', COMIC_PALETTE.outline],
  ] as const) {
    drawStickerButton(
      ctx,
      btn,
      bg,
      fg,
      label,
      btn === ui.controlToggleBtn ? '800 13.5px sans-serif' : '900 16px sans-serif',
    );
  }
  ctx.restore();
}

export function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const layout = computeViewportLayout(
    extra.logicalHeight ?? t.view.height,
    extra.safeTopPx ?? 0,
    t,
  );
  const { match, stage } = world;
  const ui = t.ui.result;
  const stars = match.mode === 'stage' ? evaluateStageStars(match, stage) : 0;
  const stageCleared = match.mode === 'stage' && stars >= 1;
  const wonRace = didPlayerWinRace(match);
  const hasNextStage =
    (stageCleared && match.stageId < 4) ||
    (match.mode === 'tutorial' && wonRace);
  const maxRivalCtrl = getMaxRivalControl(match);

  const resultAnimSec = extra.resultAnimSec ?? 2.0;

  ctx.fillStyle = 'rgba(43, 43, 58, 0.68)';
  ctx.fillRect(0, 0, width, layout.logicalHeight);

  ctx.save();
  ctx.translate(0, layout.overlayOffsetY);

  // Comic sticker card with solid shadow + 3px #2B2B3A border
  ctx.fillStyle = COMIC_PALETTE.outline;
  roundRect(ctx, ui.card.x, ui.card.y + 5, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();
  ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COMIC_PALETTE.outline;
  ctx.font = '900 20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const headline =
    match.mode === 'endless'
      ? '无尽乱斗账单'
      : match.mode === 'tutorial'
        ? wonRace
          ? `教学 ${match.stageId} 通关！`
          : '再试一次吧！'
        : wonRace
          ? `第 ${match.stageId} 关制霸成功！`
          : match.endReason === 'rival_full'
            ? '被对手抢先满 100！'
            : '时间到，惜败！';
  ctx.fillText(headline, width / 2, 108);

  // Sequential popping stars + score/race comparison
  if (match.mode === 'stage' || match.mode === 'tutorial') {
    const starCount = match.mode === 'tutorial' ? (wonRace ? 3 : 0) : stars;
    for (let i = 0; i < 3; i++) {
      const sx = width / 2 + (i - 1) * 34;
      const sy = 136;
      const revealAt = 0.2 + i * 0.25;
      const lit = i < starCount && resultAnimSec >= revealAt;
      const tProg = lit ? Math.min(1, (resultAnimSec - revealAt) / 0.16) : 1;
      const starScale = lit ? 0.6 + 0.4 * Math.sin(tProg * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(starScale, starScale);
      ctx.fillStyle = lit ? COMIC_PALETTE.accentMustard : '#CBD5E1';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lit ? '★' : '☆', 0, 0);
      ctx.restore();
    }
  }

  ctx.fillStyle = match.mode !== 'endless' ? (wonRace ? '#0284C7' : COMIC_PALETTE.warningTomato) : '#EA580C';
  ctx.font = '900 24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(
    match.mode !== 'endless'
      ? `我方 ${Math.round(match.playerControl)}% vs ${Math.round(maxRivalCtrl)}%`
      : `${Math.floor(match.score)} 分`,
    width / 2,
    168,
  );

  // Polaroid highlight photo ("本局最坏的一刻")
  ctx.save();
  ctx.translate(width / 2, 256);
  ctx.rotate(-0.032);
  ctx.fillStyle = COMIC_PALETTE.outline;
  roundRect(ctx, -118, -61, 236, 128, 10);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2.8;
  roundRect(ctx, -120, -64, 236, 128, 10);
  ctx.fill();
  ctx.stroke();

  if (extra.snapshot?.canvas) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-110, -56, 216, 86, 6);
    ctx.clip();
    ctx.drawImage(extra.snapshot.canvas, -110, -56, 216, 86);
    ctx.restore();
  } else {
    ctx.fillStyle = COMIC_PALETTE.skyApricotTop;
    roundRect(ctx, -110, -56, 216, 86, 6);
    ctx.fill();
    drawMiniBirdAvatar(ctx, -18, -14, 16, 'player');
    drawMiniBirdAvatar(ctx, 22, -14, 15, match.rivalControls[0]?.archetype ?? 'white_pigeon');
  }
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2;
  roundRect(ctx, -110, -56, 216, 86, 6);
  ctx.stroke();

  // Sticker tag on corner of Polaroid
  ctx.fillStyle = COMIC_PALETTE.accentBright;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2;
  roundRect(ctx, -114, -64, 132, 20, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COMIC_PALETTE.outline;
  ctx.font = '900 10px sans-serif';
  ctx.fillText(STRINGS_ZH.result.snapBadge, -48, -53);

  // Caption on white bottom strip
  const cap =
    extra.snapshot?.caption ??
    (wonRace ? STRINGS_ZH.result.snapWin : STRINGS_ZH.result.snapLose);
  ctx.fillStyle = COMIC_PALETTE.outline;
  ctx.font = '800 11.5px sans-serif';
  ctx.fillText(cap, -2, 46, 214);
  ctx.restore();

  const rows =
    match.mode !== 'endless'
      ? [
          ['占泉 / 用时', `${match.soakSec.toFixed(1)}s / ${match.elapsedSec.toFixed(1)}s`],
          ['堵泉次数 / 坑飞对手', `${match.plugCount} 次 / ${match.sabotageCount} 次`],
          ['被暴喷轰飞', `${match.playerSurgeHits} 次`],
        ]
      : [
          ['占泉时长 / 连击', `${match.soakSec.toFixed(1)}s / ×${match.maxCombo}`],
          ['使坏轰飞 / 砸道具', `${match.sabotageCount} 次 / ${match.propSmashCount} 次`],
          ['本局最高纪录', `${Math.max(extra.progress.endlessBestScore, Math.floor(match.score))} 分`],
        ];
  rows.forEach(([label, val], idx) => {
    const ry = 338 + idx * 27;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 48, ry - 11, width - 96, 23, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '700 11.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 56, ry);
    ctx.fillStyle = COMIC_PALETTE.outline;
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, width - 56, ry);
  });

  // Primary button only when there is a next stage; otherwise keep two non-duplicate buttons!
  if (hasNextStage) {
    drawStickerButton(
      ctx,
      ui.primaryBtn,
      COMIC_PALETTE.fountainBright,
      COMIC_PALETTE.outline,
      match.mode === 'tutorial'
        ? match.stageId < 3
          ? `进入教学 ${match.stageId + 1} ▶`
          : '进入第 1 关 ▶'
        : `下一关：第 ${match.stageId + 1} 关 ▶`,
      '900 16px sans-serif',
    );
  }

  const leftBtn = hasNextStage ? ui.secondaryLeftBtn : ui.soloLeftBtn;
  const rightBtn = hasNextStage ? ui.secondaryRightBtn : ui.soloRightBtn;

  const replayLabel = showKeyboardHints(extra.lastInputMethod)
    ? STRINGS_ZH.result.replayKey
    : STRINGS_ZH.result.replayTouch;

  drawStickerButton(
    ctx,
    leftBtn,
    hasNextStage ? '#F1F5F9' : COMIC_PALETTE.accentMustard,
    COMIC_PALETTE.outline,
    replayLabel,
    hasNextStage ? '800 14px sans-serif' : '900 15px sans-serif',
  );
  drawStickerButton(
    ctx,
    rightBtn,
    '#E2E8F0',
    COMIC_PALETTE.outline,
    STRINGS_ZH.result.home,
    hasNextStage ? '800 14px sans-serif' : '900 15px sans-serif',
  );

  ctx.restore();

  // Brief Polaroid shutter flash ("咔嚓") at start of result screen
  if (resultAnimSec < 0.18) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - resultAnimSec / 0.18) * 0.72})`;
    ctx.fillRect(0, 0, width, layout.logicalHeight);
    ctx.restore();
  }
}
