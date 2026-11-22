import './style.css';
import { launchTuning } from './config/launchTuning';
import { SoundEngine } from './game/audio';
import {
  evaluatePolaroidCaptions,
  type LaunchScreenMode,
} from './game/launchRules';
import { LaunchPrototypeWorld } from './game/launchWorld';
import { buildPolaroidCanvas, downloadPolaroidPng } from './platform/snapshot';
import {
  applyLaunchStageCompletion,
  readLaunchProgress,
  writeLaunchProgress,
  type LaunchChapterStageId,
} from './platform/storage';
import { drawLaunchFrame } from './render/launchPainter';

function hitRect(
  pt: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h;
}

function hitCircle(
  pt: { x: number; y: number },
  circle: { x: number; y: number; r: number },
  pad = 6,
): boolean {
  return Math.hypot(pt.x - circle.x, pt.y - circle.y) <= circle.r + pad;
}

function main(): void {
  const canvasEl = document.getElementById('stage');
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element #stage not found');
  }
  const maybeCtx = canvasEl.getContext('2d');
  if (!maybeCtx) {
    throw new Error('2D rendering context unavailable');
  }
  const canvas: HTMLCanvasElement = canvasEl;
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get('debug') === '1';

  const sound = new SoundEngine();
  let progress = readLaunchProgress();
  let selectedStageId: LaunchChapterStageId = 1;
  let world = new LaunchPrototypeWorld(selectedStageId, launchTuning);
  let screenMode: LaunchScreenMode = 'title';
  let polaroidCanvas: HTMLCanvasElement | null = null;
  let animTimeSec = 0;
  let activeAimPointerId: number | null = null;
  let dpr = 1;

  function resizeCanvas(): void {
    const vw = Math.max(240, window.innerWidth);
    const vh = Math.max(320, window.innerHeight);
    const aspect = launchTuning.view.width / launchTuning.view.height;

    let cssWidth = vw;
    let cssHeight = cssWidth / aspect;
    if (cssHeight > vh) {
      cssHeight = vh;
      cssWidth = cssHeight * aspect;
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(cssWidth)}px`;
    canvas.style.height = `${Math.floor(cssHeight)}px`;
    canvas.width = Math.round(launchTuning.view.width * dpr);
    canvas.height = Math.round(launchTuning.view.height * dpr);
  }

  function toLogicalCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    return {
      x: Math.max(0, Math.min(launchTuning.view.width, rx * launchTuning.view.width)),
      y: Math.max(0, Math.min(launchTuning.view.height, ry * launchTuning.view.height)),
    };
  }

  function startStage(stageId: LaunchChapterStageId): void {
    sound.unlock();
    selectedStageId = stageId;
    activeAimPointerId = null;
    polaroidCanvas = null;
    world = new LaunchPrototypeWorld(stageId, launchTuning);
    screenMode = 'playing';
  }

  function returnToTitle(): void {
    activeAimPointerId = null;
    polaroidCanvas = null;
    world = new LaunchPrototypeWorld(selectedStageId, launchTuning);
    screenMode = 'title';
  }

  function captureEndingPolaroid(): void {
    // Draw a clean freeze-frame without flash or debug lines, then snapshot into Polaroid frame
    const savedFlash = world.flashAlpha;
    world.flashAlpha = 0;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLaunchFrame(
      ctx,
      world,
      {
        screenMode: 'playing',
        selectedStageId,
        progress,
        polaroidCanvas: null,
        muted: sound.muted,
        debug: false,
        animTimeSec,
      },
      launchTuning,
    );
    ctx.restore();
    world.flashAlpha = savedFlash;

    const captions = evaluatePolaroidCaptions(
      world.stage,
      world.scoreResult.stars,
      world.subGoalCompleted,
    );
    polaroidCanvas = buildPolaroidCanvas(canvas, {
      stageTitle: `${world.stage.id}关`,
      stars: world.scoreResult.stars,
      mainCaption: captions.mainCaption,
      subCaption: captions.subCaption,
    });
  }

  function onPointerDown(e: PointerEvent): void {
    sound.unlock();
    const pt = toLogicalCoords(e.clientX, e.clientY);

    if (screenMode === 'title') {
      const ui = launchTuning.ui.title;
      const ids: LaunchChapterStageId[] = [1, 2, 3, 4, 5, 6];
      for (let idx = 0; idx < ids.length; idx++) {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const rect = {
          x: ui.gridStartX + col * (ui.cardW + ui.gapX),
          y: ui.gridStartY + row * (ui.cardH + ui.gapY),
          w: ui.cardW,
          h: ui.cardH,
        };
        if (hitRect(pt, rect)) {
          selectedStageId = ids[idx];
          world = new LaunchPrototypeWorld(selectedStageId, launchTuning);
          sound.playUiClick();
          return;
        }
      }
      if (hitRect(pt, ui.startBtn)) {
        sound.playUiClick();
        startStage(selectedStageId);
      }
      return;
    }

    if (screenMode === 'result') {
      const ui = launchTuning.ui.result;
      const hasNext = world.won && world.stage.id < 6;

      if (world.won && polaroidCanvas && hitRect(pt, ui.savePhotoBtn)) {
        sound.playUiClick();
        downloadPolaroidPng(polaroidCanvas, `pigeon-fountain-stage-${world.stage.id}.png`);
        return;
      }

      if (hasNext && hitRect(pt, ui.primaryBtn)) {
        sound.playUiClick();
        startStage((world.stage.id + 1) as LaunchChapterStageId);
        return;
      }

      const leftRect = hasNext ? ui.leftBtn : ui.soloLeftBtn;
      const rightRect = hasNext ? ui.rightBtn : ui.soloRightBtn;

      if (hitRect(pt, leftRect)) {
        sound.playUiClick();
        startStage(selectedStageId);
      } else if (hitRect(pt, rightRect)) {
        sound.playUiClick();
        returnToTitle();
      }
      return;
    }

    // Playing state HUD buttons
    const hud = launchTuning.ui.hud;
    if (hitRect(pt, hud.retryBtn)) {
      sound.playUiClick();
      startStage(selectedStageId);
      return;
    }
    if (hitCircle(pt, hud.muteBtn, 6)) {
      sound.muted = !sound.muted;
      return;
    }
    if (hitCircle(pt, hud.homeBtn, 6)) {
      sound.playUiClick();
      returnToTitle();
      return;
    }

    // Character switcher (allowed while aiming)
    if (hitRect(pt, hud.charBlackBtn)) {
      if (world.selectCharacter('black_bad')) sound.playUiClick();
      return;
    }
    if (hitRect(pt, hud.charFatBtn)) {
      if (world.selectCharacter('fat_chonk')) sound.playUiClick();
      return;
    }

    if (world.canAdvanceNextBird() && hitRect(pt, hud.nextBirdBtn)) {
      sound.playUiClick();
      world.advanceNextBird();
      return;
    }

    if (world.phase === 'aiming') {
      if (world.beginAim(pt)) {
        activeAimPointerId = e.pointerId;
        sound.playBubble();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events
        }
      }
      return;
    }

    if (world.phase === 'flying') {
      if (world.triggerDiveSlam()) {
        sound.playButtSlam();
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (screenMode !== 'playing' || activeAimPointerId !== e.pointerId) return;
    world.updateAim(toLogicalCoords(e.clientX, e.clientY));
  }

  function onPointerEnd(e: PointerEvent): void {
    if (activeAimPointerId !== e.pointerId) return;
    activeAimPointerId = null;
    if (screenMode !== 'playing') return;
    if (world.releaseAim()) {
      sound.playSurgeBlast();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault();
    }

    if (screenMode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      startStage(selectedStageId);
      return;
    }

    if (screenMode === 'result') {
      if (e.code === 'KeyR' && !e.repeat) {
        startStage(selectedStageId);
      } else if (e.code === 'Enter' && !e.repeat) {
        if (world.won && world.stage.id < 6) {
          startStage((world.stage.id + 1) as LaunchChapterStageId);
        } else {
          startStage(selectedStageId);
        }
      } else if (e.code === 'Escape') {
        returnToTitle();
      }
      return;
    }

    if (screenMode !== 'playing') return;

    sound.unlock();
    if (e.code === 'KeyR' && !e.repeat) {
      startStage(selectedStageId);
      return;
    }
    if (e.code === 'Escape') {
      returnToTitle();
      return;
    }
    if (e.code === 'Digit1' && !e.repeat) {
      if (world.selectCharacter('black_bad')) sound.playUiClick();
      return;
    }
    if (e.code === 'Digit2' && !e.repeat) {
      if (world.selectCharacter('fat_chonk')) sound.playUiClick();
      return;
    }
    if (e.code === 'Space' && !e.repeat && world.phase === 'flying') {
      if (world.triggerDiveSlam()) {
        sound.playButtSlam();
      } else if (world.canAdvanceNextBird()) {
        sound.playUiClick();
        world.advanceNextBird();
      }
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', resizeCanvas);

  resizeCanvas();

  let lastTimeMs = performance.now();
  let accumulatorMs = 0;

  function stepSimulation(dtMs: number): void {
    animTimeSec += dtMs / 1000;
    if (screenMode !== 'playing') return;

    const ev = world.step(dtMs);
    if (ev.relayTriggered) {
      sound.playRelayBlast();
    }
    if (ev.glassBroken) {
      sound.playPropSmash();
    }
    if (ev.subGoalNewlyCompleted) {
      if (world.stage.subGoalKind === 'knock_rivals' || world.stage.subGoalKind === 'clear_boss_rivals') {
        sound.playLaunchSquawk(true);
      } else {
        sound.playPropSmash();
      }
    }
    if (ev.settledWinStarted) {
      sound.playCameraShutter();
      sound.playSettleWin();
      captureEndingPolaroid();
    }
    if (ev.roundFinished) {
      screenMode = 'result';
      if (world.won) {
        progress = applyLaunchStageCompletion(
          progress,
          world.stage.id,
          world.scoreResult.totalScore,
          world.scoreResult.stars,
        );
        writeLaunchProgress(progress);
      }
    }
  }

  function frame(nowMs: number): void {
    const elapsed = Math.min(launchTuning.loop.maxFrameDtMs, Math.max(0, nowMs - lastTimeMs));
    lastTimeMs = nowMs;
    accumulatorMs += elapsed;

    while (accumulatorMs >= launchTuning.loop.fixedDtMs) {
      stepSimulation(launchTuning.loop.fixedDtMs);
      accumulatorMs -= launchTuning.loop.fixedDtMs;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLaunchFrame(
      ctx,
      world,
      {
        screenMode,
        selectedStageId,
        progress,
        polaroidCanvas,
        muted: sound.muted,
        debug: debugMode,
        animTimeSec,
      },
      launchTuning,
    );
    ctx.restore();

    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

main();
