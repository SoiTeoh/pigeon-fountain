import type { AiArchetype, Tuning } from '../config/tuning';
import { showKeyboardHints, STRINGS_ZH } from '../content/strings.zh';
import { findPredictedPlugNozzle } from '../game/plug';
import { computeControlRateMultiplier } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import { COMIC_PALETTE, computeViewportLayout, roundRect, type RenderExtra } from './shared';

export function drawCircleSkillButton(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    r: number;
    title: string;
    subtitle: string;
    cooldownRatio: number;
    readyFill: string;
    readyStroke: string;
    textColor: string;
  },
): void {
  const ready = opts.cooldownRatio <= 0.001;
  ctx.save();
  ctx.beginPath();
  ctx.arc(opts.x, opts.y, opts.r, 0, Math.PI * 2);
  ctx.fillStyle = ready ? opts.readyFill : '#334155';
  ctx.fill();
  ctx.strokeStyle = ready ? opts.readyStroke : '#64748b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (!ready) {
    // Sector recovery animation
    const progress = 1 - Math.min(1, Math.max(0, opts.cooldownRatio));
    ctx.save();
    ctx.beginPath();
    ctx.arc(opts.x, opts.y, opts.r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.36)';
    ctx.beginPath();
    ctx.moveTo(opts.x, opts.y);
    ctx.arc(
      opts.x,
      opts.y,
      opts.r,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Outer recovery arc
    ctx.strokeStyle = opts.readyFill;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      opts.x,
      opts.y,
      opts.r,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.fillStyle = ready ? opts.textColor : '#f8fafc';
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title, opts.x, opts.y - 6);
  ctx.font = '700 10px sans-serif';
  ctx.fillText(opts.subtitle, opts.x, opts.y + 10);
  ctx.restore();
}

export function drawMiniBirdAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  kind: 'player' | AiArchetype,
): void {
  ctx.save();
  ctx.translate(x, y);
  const bg =
    kind === 'player'
      ? '#334155'
      : kind === 'sparrow'
        ? '#b45309'
        : kind === 'red_crest'
          ? '#fee2e2'
          : '#f8fafc';
  const border =
    kind === 'player'
      ? '#38bdf8'
      : kind === 'red_crest'
        ? '#ef4444'
        : kind === 'sparrow'
          ? '#fbbf24'
          : '#cbd5e1';

  ctx.fillStyle = bg;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = border;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, r - 2), 0, Math.PI * 2);
  ctx.stroke();

  if (kind === 'red_crest') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-2, -r + 2);
    ctx.lineTo(2, -r - 4);
    ctx.lineTo(5, -r + 2);
    ctx.closePath();
    ctx.fill();
  }

  // Eye & beak
  ctx.fillStyle = kind === 'player' ? '#f8fafc' : '#0f172a';
  ctx.beginPath();
  ctx.arc(kind === 'player' ? 2.5 : -2.5, -1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  if (kind === 'player') {
    ctx.moveTo(6, -1);
    ctx.lineTo(11, 1);
    ctx.lineTo(6, 3);
  } else {
    ctx.moveTo(-6, -1);
    ctx.lineTo(-11, 1);
    ctx.lineTo(-6, 3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawControlBar(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    value: number;
    max: number;
    fill: string;
    flashing: boolean;
    animTimeSec: number;
    alignRight?: boolean;
  },
): void {
  const ratio = Math.max(0, Math.min(1, opts.value / Math.max(1, opts.max)));
  const pulse = opts.flashing ? 0.5 + 0.5 * Math.sin(opts.animTimeSec * 14) : 0;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, opts.x, opts.y, opts.w, opts.h, opts.h / 2);
  ctx.fill();

  if (ratio > 0) {
    const fillW = Math.max(opts.h * 0.6, opts.w * ratio);
    const fx = opts.alignRight ? opts.x + opts.w - fillW : opts.x;
    ctx.fillStyle = opts.flashing && pulse > 0.5 ? '#fde047' : opts.fill;
    roundRect(ctx, fx, opts.y, fillW, opts.h, opts.h / 2);
    ctx.fill();
  }

  if (opts.flashing) {
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.45 + pulse * 0.55})`;
    ctx.lineWidth = 2;
    roundRect(ctx, opts.x, opts.y, opts.w, opts.h, opts.h / 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHudAndControls(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const { match, combo, stage } = world;
  const hud = t.ui.hud;
  const layout = computeViewportLayout(
    extra.logicalHeight ?? t.view.height,
    extra.safeTopPx ?? 0,
    t,
  );

  ctx.save();
  ctx.translate(0, layout.hudOffsetY);

  // Top HUD bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  roundRect(ctx, hud.bar.x, hud.bar.y, hud.bar.w, hud.bar.h, hud.bar.r);
  ctx.fill();

  const maxControl = t.control.maxControl;
  const maxRivalControl = match.rivalControls.reduce((m, r) => Math.max(m, r.control), 0);
  const playerLeads = match.playerControl >= maxRivalControl;

  // Left: Player avatar + control bar (0-100)
  drawMiniBirdAvatar(ctx, 32, 36, 13, 'player');
  drawControlBar(ctx, {
    x: 50,
    y: 28,
    w: 84,
    h: 16,
    value: match.playerControl,
    max: maxControl,
    fill: '#38bdf8',
    flashing: playerLeads && match.playerControl >= t.control.flashThreshold,
    animTimeSec: extra.animTimeSec,
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.floor(match.playerControl)}`, 92, 36);

  // Center: Countdown
  ctx.fillStyle = match.remainingSec <= 10 ? '#fca5a5' : '#ffffff';
  ctx.font = '900 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(match.remainingSec)}s`, 164, 36);

  // Right: Rivals avatars & control bars (up to 3 compact rows)
  const visibleRivals = match.rivalControls.slice(0, 3);
  if (visibleRivals.length === 1) {
    const r = visibleRivals[0];
    const rFlashes = !playerLeads && r.control >= t.control.flashThreshold && r.control >= maxRivalControl;
    drawControlBar(ctx, {
      x: 194,
      y: 28,
      w: 76,
      h: 16,
      value: r.control,
      max: maxControl,
      fill: '#fb7185',
      flashing: rFlashes,
      animTimeSec: extra.animTimeSec,
      alignRight: true,
    });
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 10px sans-serif';
    ctx.fillText(`${Math.floor(r.control)}`, 232, 36);
    drawMiniBirdAvatar(ctx, 286, 36, 13, r.archetype);
  } else {
    const rowH = 10;
    const gap = 3;
    const totalH = visibleRivals.length * rowH + (visibleRivals.length - 1) * gap;
    const startY = 36 - totalH / 2;
    visibleRivals.forEach((r, idx) => {
      const ry = startY + idx * (rowH + gap);
      const rFlashes = !playerLeads && r.control >= t.control.flashThreshold && r.control >= maxRivalControl;
      drawControlBar(ctx, {
        x: 194,
        y: ry + 1,
        w: 78,
        h: 8,
        value: r.control,
        max: maxControl,
        fill: r.archetype === 'red_crest' ? '#ef4444' : r.archetype === 'sparrow' ? '#f59e0b' : '#fb7185',
        flashing: rFlashes,
        animTimeSec: extra.animTimeSec,
        alignRight: true,
      });
      drawMiniBirdAvatar(ctx, 286, ry + rowH / 2, 6.5, r.archetype);
    });
  }

  // Mute button
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(hud.muteBtn.x, hud.muteBtn.y, hud.muteBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(extra.muted ? '🔇' : '🔊', hud.muteBtn.x, hud.muteBtn.y + 1);

  // Pause button
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(hud.pauseBtn.x, hud.pauseBtn.y, hud.pauseBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(hud.pauseBtn.x - 4.5, hud.pauseBtn.y - 5.5, 3, 11);
  ctx.fillRect(hud.pauseBtn.x + 1.5, hud.pauseBtn.y - 5.5, 3, 11);

  // Stage label + Endless score / Combo pill row under HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  roundRect(ctx, 14, 65, 118, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stage.shortName, 73, 76);

  if (match.mode === 'endless') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    roundRect(ctx, 140, 65, 84, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = '800 11.5px sans-serif';
    ctx.fillText(`${Math.floor(match.score)}分`, 182, 76);
  }

  if (combo > 1) {
    const mult = computeControlRateMultiplier(combo, t);
    ctx.fillStyle = combo === 3 ? '#f97316' : '#38bdf8';
    roundRect(ctx, width - 86, 65, 72, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px sans-serif';
    ctx.fillText(`舒爽 ×${mult}`, width - 50, 76);
  }

  if (extra.plugHintText) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#2B2B3A';
    ctx.lineWidth = 3;
    roundRect(ctx, width / 2 - 118, 96, 236, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(extra.plugHintText, width / 2, 111);
    ctx.restore();
  }

  if (world.plugCallout && world.plugCallout.timerSec > 0) {
    ctx.save();
    const bannerW = 216;
    const bannerH = 38;
    const bx = width / 2 - bannerW / 2;
    const by = 132;
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#2B2B3A';
    ctx.lineWidth = 3;
    roundRect(ctx, bx, by, bannerW, bannerH, 19);
    ctx.fill();
    ctx.stroke();

    drawMiniBirdAvatar(ctx, bx + 22, by + bannerH / 2, 13, world.plugCallout.avatarKind);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(world.plugCallout.text, bx + bannerW / 2 + 12, by + bannerH / 2 + 1);
    ctx.restore();
  }

  ctx.restore();

  if (extra.screenMode !== 'playing' && extra.screenMode !== 'paused') return;

  // Controls at bottom: classic 4-button vs default relative joystick + dual buttons
  const ctrl = t.ui.controls;
  const showKeys = showKeyboardHints(extra.lastInputMethod);

  if (!extra.classicFourButtons && extra.joystick?.active) {
    const joy = extra.joystick;
    const maxR = ctrl.joystickMaxRadiusPx;
    const clampedDx = Math.max(-maxR, Math.min(maxR, joy.currentX - joy.originX));
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, maxR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Deadzone ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, ctrl.joystickDeadzonePx, 0, Math.PI * 2);
    ctx.stroke();

    // Knob
    ctx.fillStyle = joy.axis === 0 ? 'rgba(255, 255, 255, 0.72)' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(joy.originX + clampedDx, joy.originY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, layout.bottomOffsetY);

  if (extra.classicFourButtons) {
    // Left / Right buttons
    for (const [btn, label, active] of [
      [ctrl.leftBtn, '◀', extra.leftPressed],
      [ctrl.rightBtn, '▶', extra.rightPressed],
    ] as const) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#38bdf8' : 'rgba(15, 23, 42, 0.56)';
      ctx.fill();
      ctx.strokeStyle = active ? '#e0f2fe' : 'rgba(255,255,255,0.42)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, btn.x, btn.y + 1);
      ctx.restore();
    }

    if (showKeys) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '600 10.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(STRINGS_ZH.hud.keyboardHint, 188, 624);
    }

    const jumpCdRatio = world.player.jumpCooldownSec / t.pigeon.jumpCooldownSec;
    drawCircleSkillButton(ctx, {
      x: ctrl.jumpBtn.x,
      y: ctrl.jumpBtn.y,
      r: ctrl.jumpBtn.r,
      title: world.player.airborne ? STRINGS_ZH.hud.jumpAirTitle : STRINGS_ZH.hud.jumpTitle,
      subtitle:
        jumpCdRatio <= 0.001
          ? showKeys
            ? STRINGS_ZH.hud.jumpReadyKey
            : STRINGS_ZH.hud.jumpReadyTouch
          : STRINGS_ZH.hud.cooling,
      cooldownRatio: jumpCdRatio,
      readyFill: '#38bdf8',
      readyStroke: '#bae6fd',
      textColor: '#0f172a',
    });

    const bumpCdRatio = world.player.bumpCooldownSec / t.pigeon.bumpCooldownSec;
    drawCircleSkillButton(ctx, {
      x: ctrl.bumpBtn.x,
      y: ctrl.bumpBtn.y,
      r: ctrl.bumpBtn.r,
      title: bumpCdRatio <= 0.001 ? STRINGS_ZH.hud.bumpTitle : STRINGS_ZH.hud.cooling,
      subtitle:
        bumpCdRatio <= 0.001
          ? showKeys
            ? STRINGS_ZH.hud.bumpReadyKey
            : STRINGS_ZH.hud.bumpReadyTouch
          : `${world.player.bumpCooldownSec.toFixed(1)}s`,
      cooldownRatio: bumpCdRatio,
      readyFill: '#f59e0b',
      readyStroke: '#fef08a',
      textColor: '#0f172a',
    });
  } else {
    // Relative horizontal joystick (left 60%) + dual buttons: Jump/Slam (medium) & Bump (large)
    if (!extra.joystick?.active) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      roundRect(ctx, 18, 554, 198, 36, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(showKeys ? STRINGS_ZH.hud.keyboardHint : STRINGS_ZH.hud.dragHint, 117, 572);
      ctx.restore();
    }

    if (extra.showFingerDragHint) {
      const slide = Math.sin(extra.animTimeSec * 4.2) * 32;
      const fx = 112 + slide;
      const fy = 524;
      ctx.save();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(76, fy);
      ctx.lineTo(148, fy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#2B2B3A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👆', fx, fy + 1);
      ctx.restore();
    }

    const airPred = world.player.airborne
      ? findPredictedPlugNozzle(
          world.player.x,
          world.player.y,
          world.player.vx,
          world.player.vy,
          world.player.airborne,
          world.plug.cooldownSec,
          world.match.nozzles,
          t,
        )
      : null;
    const airCanPlug = airPred?.nozzle !== null && world.player.airborne;
    const jumpCdRatio = world.player.airborne ? 0 : world.player.jumpCooldownSec / t.pigeon.jumpCooldownSec;
    drawCircleSkillButton(ctx, {
      x: ctrl.jumpBtn.x,
      y: ctrl.jumpBtn.y,
      r: ctrl.jumpBtn.r,
      title: world.player.airborne
        ? airCanPlug
          ? STRINGS_ZH.hud.jumpAirPlugTitle
          : STRINGS_ZH.hud.jumpAirTitle
        : STRINGS_ZH.hud.jumpTitle,
      subtitle:
        jumpCdRatio <= 0.001
          ? world.player.airborne
            ? airCanPlug
              ? '快坐住!'
              : '下墩'
            : showKeys
              ? STRINGS_ZH.hud.jumpReadyKey
              : STRINGS_ZH.hud.jumpReadyTouch
          : STRINGS_ZH.hud.cooling,
      cooldownRatio: jumpCdRatio,
      readyFill: world.player.airborne ? '#fde047' : '#38bdf8',
      readyStroke: '#bae6fd',
      textColor: '#0f172a',
    });

    const bumpCdRatio = world.player.bumpCooldownSec / t.pigeon.bumpCooldownSec;
    drawCircleSkillButton(ctx, {
      x: ctrl.bumpBtn.x,
      y: ctrl.bumpBtn.y,
      r: ctrl.bumpBtn.r,
      title: bumpCdRatio <= 0.001 ? STRINGS_ZH.hud.bumpTitle : STRINGS_ZH.hud.cooling,
      subtitle:
        bumpCdRatio <= 0.001
          ? showKeys
            ? STRINGS_ZH.hud.bumpReadyKey
            : STRINGS_ZH.hud.bumpReadyTouch
          : `${world.player.bumpCooldownSec.toFixed(1)}s`,
      cooldownRatio: bumpCdRatio,
      readyFill: '#f59e0b',
      readyStroke: '#fef08a',
      textColor: '#0f172a',
    });
  }
  ctx.restore();
}

export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
): void {
  const { groundY } = t.scene;

  // Nozzle core zones & jet vector arrows
  for (const n of world.match.nozzles) {
    ctx.strokeStyle = n.phase !== 'IDLE' ? '#22d3ee' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      n.x - t.fountain.coreRadiusPx,
      groundY - 58,
      t.fountain.coreRadiusPx * 2,
      62,
    );
    ctx.setLineDash([]);

    // Jet direction vector arrow
    if (n.phase === 'ACTIVE' || n.phase === 'SURGE_WARN' || n.phase === 'SURGE') {
      const rad = (n.tiltDeg * Math.PI) / 180;
      const vx = Math.sin(rad) * 58;
      const vy = -Math.cos(rad) * 58;
      ctx.strokeStyle = n.style === 'angled' ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(n.x, groundY - 12);
      ctx.lineTo(n.x + vx, groundY - 12 + vy);
      ctx.stroke();
    }
  }

  // Destructible prop collision boxes
  for (const prop of world.props) {
    ctx.strokeStyle = prop.intact ? '#4ade80' : 'rgba(248,113,113,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(prop.x - prop.w / 2 - 6, prop.y - prop.h / 2 - 6, prop.w + 12, prop.h + 12);
  }

  // Player collision circle
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y - 20, t.pigeon.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Rivals collision circles, stun timer, & red-crest charge telegraph lines
  for (const r of world.rivals) {
    if (r.respawnTimerSec > 0) continue;
    ctx.strokeStyle = r.stunTimerSec > 0 ? '#facc15' : '#f472b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y - 20, r.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (r.stunTimerSec > 0) {
      ctx.fillStyle = '#facc15';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`stun:${r.stunTimerSec.toFixed(2)}s`, r.x, r.y - 54);
    }

    if (r.archetype === 'red_crest' && (r.redCrestState === 'charging' || r.redCrestState === 'lunging')) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - 18);
      ctx.lineTo(r.x + r.redCrestDir * 90, r.y - 18);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Info box
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(10, 92, 260, 44);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '10.5px monospace';
  ctx.textAlign = 'left';
  const activeSummary = world.match.nozzles
    .filter((n) => n.phase !== 'IDLE')
    .map((n) => `#${n.slotIndex}:${n.phase}${n.tiltDeg ? `(${n.tiltDeg}°)` : ''}`)
    .join(' ');
  ctx.fillText(activeSummary || 'all IDLE', 16, 108);
  ctx.fillText(
    `pX=${world.player.x.toFixed(1)} occ=${world.occupant} rivals=${world.rivals.length}`,
    16,
    126,
  );
}
