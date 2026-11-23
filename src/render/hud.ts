import type { Tuning } from '../config/tuning';
import { showKeyboardHints, STRINGS_ZH } from '../content/strings.zh';
import type { PigeonFountainWorld } from '../game/world';
import { drawFeatherIcon, roundRect, type RenderExtra } from './shared';

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

export function drawHudAndControls(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const { match, combo, stage } = world;
  const hud = t.ui.hud;

  // Top HUD bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  roundRect(ctx, hud.bar.x, hud.bar.y, hud.bar.w, hud.bar.h, hud.bar.r);
  ctx.fill();

  // Countdown
  ctx.fillStyle = match.remainingSec <= 10 ? '#fca5a5' : '#ffffff';
  ctx.font = '800 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(match.remainingSec)}s`, 24, 36);

  // 3 feathers
  for (let i = 0; i < t.scoring.maxFeathers; i++) {
    drawFeatherIcon(ctx, 76 + i * 20, 36, i < match.feathers);
  }

  // Score (+ target in stage mode)
  ctx.fillStyle = '#fde047';
  ctx.font = '800 16px sans-serif';
  ctx.textAlign = 'right';
  const scoreText =
    match.mode === 'stage'
      ? `${Math.floor(match.score)}/${stage.targetScore}`
      : `${Math.floor(match.score)}分`;
  ctx.fillText(scoreText, 294, 36);

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

  // Stage label + Combo pill row under HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  roundRect(ctx, 14, 65, 118, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stage.shortName, 73, 76);

  if (combo > 1) {
    ctx.fillStyle = combo === 3 ? '#f97316' : '#38bdf8';
    roundRect(ctx, width - 86, 65, 72, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px sans-serif';
    ctx.fillText(`舒爽 ×${combo}`, width - 50, 76);
  }

  if (extra.screenMode !== 'playing' && extra.screenMode !== 'paused') return;

  // Dual-thumb controls at bottom!
  const ctrl = t.ui.controls;

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

  const showKeys = showKeyboardHints(extra.lastInputMethod);

  // Subtle center key hint (only when using keyboard)
  if (showKeys) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 10.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS_ZH.hud.keyboardHint, 188, 624);
  }

  // Jump button (小跳)
  const jumpCdRatio = world.player.jumpCooldownSec / t.pigeon.jumpCooldownSec;
  drawCircleSkillButton(ctx, {
    x: ctrl.jumpBtn.x,
    y: ctrl.jumpBtn.y,
    r: ctrl.jumpBtn.r,
    title: STRINGS_ZH.hud.jumpTitle,
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

  // Bump button (肥臀猛顶) -> "回气中..." when cooling!
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
