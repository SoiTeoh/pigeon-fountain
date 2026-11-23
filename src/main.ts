import './style.css';
import { STAGES, tuning } from './config/tuning';
import { InputController, toWorldStepInput } from './core/input';
import { SoundEngine } from './game/audio';
import {
  evaluateStageStars,
  shouldAdvanceSimulation,
} from './game/rules';
import { PigeonFountainWorld } from './game/world';
import {
  applyEndlessCompletion,
  applyStageCompletion,
  readProgress,
  writeProgress,
  type GameMode,
  type StageId,
} from './platform/storage';
import { drawGameFrame } from './render/painter';
import { SceneManager } from './scenes/manager';

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
  let progress = readProgress();
  let gameMode: GameMode = 'stage';
  let selectedStageId: StageId = 1;
  let world = new PigeonFountainWorld(gameMode, selectedStageId, tuning);
  const sceneManager = new SceneManager('title');
  let animTimeSec = 0;
  let soakAudioAcc = 0;

  // Unified input controller (touch + keyboard)
  const isTouchOrMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 768 ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
  const inputController = new InputController(isTouchOrMobile ? 'touch' : 'keyboard');
  let dpr = 1;

  function resizeCanvas(): void {
    const vw = Math.max(240, window.innerWidth);
    const vh = Math.max(320, window.innerHeight);
    const aspect = tuning.view.width / tuning.view.height;

    let cssWidth = vw;
    let cssHeight = cssWidth / aspect;
    if (cssHeight > vh) {
      cssHeight = vh;
      cssWidth = cssHeight * aspect;
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(cssWidth)}px`;
    canvas.style.height = `${Math.floor(cssHeight)}px`;
    canvas.width = Math.round(tuning.view.width * dpr);
    canvas.height = Math.round(tuning.view.height * dpr);
  }

  function toLogicalCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    return {
      x: Math.max(0, Math.min(tuning.view.width, rx * tuning.view.width)),
      y: Math.max(0, Math.min(tuning.view.height, ry * tuning.view.height)),
    };
  }

  function clearInputs(): void {
    inputController.clear();
  }

  function syncPreviewWorld(): void {
    world = new PigeonFountainWorld(gameMode, selectedStageId, tuning);
  }

  function startNewGame(mode: GameMode = gameMode, stageId: StageId = selectedStageId): void {
    sound.unlock();
    gameMode = mode;
    selectedStageId = stageId;
    world = new PigeonFountainWorld(mode, stageId, tuning);
    soakAudioAcc = 0;
    clearInputs();
    sceneManager.transitionTo('playing');
  }

  function returnToHome(): void {
    clearInputs();
    syncPreviewWorld();
    sceneManager.transitionTo('title');
  }

  function togglePause(): void {
    if (sceneManager.mode === 'playing') {
      clearInputs();
      sceneManager.transitionTo('paused');
      sound.playUiClick();
    } else if (sceneManager.mode === 'paused') {
      clearInputs();
      sceneManager.transitionTo('playing');
      sound.playUiClick();
    }
  }

  function computeMoveDir(): -1 | 0 | 1 {
    return inputController.peekMoveAxis();
  }

  function onPointerDown(e: PointerEvent): void {
    sound.unlock();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      inputController.setInputMethod('touch');
    }
    const pt = toLogicalCoords(e.clientX, e.clientY);

    if (sceneManager.mode === 'title') {
      const ui = tuning.ui.title;
      if (hitRect(pt, ui.modeStageBtn)) {
        gameMode = 'stage';
        syncPreviewWorld();
        sound.playUiClick();
        return;
      }
      if (hitRect(pt, ui.modeEndlessBtn)) {
        gameMode = 'endless';
        syncPreviewWorld();
        sound.playUiClick();
        return;
      }
      if (gameMode === 'stage') {
        const ids: StageId[] = [1, 2, 3, 4];
        for (let i = 0; i < ids.length; i++) {
          const sx = ui.stageCardStartX + i * (ui.stageCardW + ui.stageCardGap);
          const cardRect = { x: sx, y: ui.stageCardY, w: ui.stageCardW, h: ui.stageCardH };
          if (hitRect(pt, cardRect) && ids[i] <= progress.unlockedStage) {
            selectedStageId = ids[i];
            syncPreviewWorld();
            sound.playUiClick();
            return;
          }
        }
      }
      if (hitRect(pt, ui.startBtn)) {
        sound.playUiClick();
        startNewGame(gameMode, selectedStageId);
      }
      return;
    }

    if (sceneManager.mode === 'paused') {
      const ui = tuning.ui.pause;
      if (hitRect(pt, ui.resumeBtn)) {
        togglePause();
      } else if (hitRect(pt, ui.restartBtn)) {
        sound.playUiClick();
        startNewGame(gameMode, selectedStageId);
      } else if (hitRect(pt, ui.homeBtn)) {
        sound.playUiClick();
        returnToHome();
      }
      return;
    }

    if (sceneManager.mode === 'result') {
      const ui = tuning.ui.result;
      const stageCleared =
        world.match.mode === 'stage' &&
        evaluateStageStars(world.match.score, world.match.endReason, STAGES[world.match.stageId]) >= 1;
      const hasNext = stageCleared && world.match.stageId < 4;

      if (hasNext && hitRect(pt, ui.primaryBtn)) {
        sound.playUiClick();
        startNewGame('stage', (world.match.stageId + 1) as StageId);
        return;
      }

      const leftBtn = hasNext ? ui.secondaryLeftBtn : ui.soloLeftBtn;
      const rightBtn = hasNext ? ui.secondaryRightBtn : ui.soloRightBtn;
      if (hitRect(pt, leftBtn)) {
        sound.playUiClick();
        startNewGame(gameMode, selectedStageId);
      } else if (hitRect(pt, rightBtn)) {
        sound.playUiClick();
        returnToHome();
      }
      return;
    }

    // Playing state: HUD buttons
    if (hitCircle(pt, tuning.ui.hud.muteBtn, 6)) {
      sound.muted = !sound.muted;
      return;
    }
    if (hitCircle(pt, tuning.ui.hud.pauseBtn, 6)) {
      togglePause();
      return;
    }

    // Right-thumb skill buttons (do NOT overwrite left-thumb movement!)
    if (hitCircle(pt, tuning.ui.controls.jumpBtn, 8)) {
      inputController.queueJump(e.pointerType);
      return;
    }
    if (hitCircle(pt, tuning.ui.controls.bumpBtn, 8)) {
      inputController.queueAction(e.pointerType);
      return;
    }

    // Left-thumb directional buttons
    if (hitCircle(pt, tuning.ui.controls.leftBtn, 8)) {
      inputController.setMovePointer(e.pointerId, -1, false, pt.x, e.pointerType);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events
      }
      return;
    }
    if (hitCircle(pt, tuning.ui.controls.rightBtn, 8)) {
      inputController.setMovePointer(e.pointerId, 1, false, pt.x, e.pointerType);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events
      }
      return;
    }

    // Fallback: mid/upper-canvas left/right hold
    if (pt.y < 516) {
      inputController.setMovePointer(
        e.pointerId,
        pt.x < tuning.view.width / 2 ? -1 : 1,
        true,
        pt.x,
        e.pointerType,
      );
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (sceneManager.mode !== 'playing') return;
    const entry = inputController.getMovePointer(e.pointerId);
    if (!entry) return;
    const pt = toLogicalCoords(e.clientX, e.clientY);
    if (entry.zoneOnly) {
      inputController.updateMovePointer(
        e.pointerId,
        pt.x < tuning.view.width / 2 ? -1 : 1,
        pt.x,
      );
    } else if (hitCircle(pt, tuning.ui.controls.leftBtn, 14)) {
      inputController.updateMovePointer(e.pointerId, -1, pt.x);
    } else if (hitCircle(pt, tuning.ui.controls.rightBtn, 14)) {
      inputController.updateMovePointer(e.pointerId, 1, pt.x);
    }
  }

  function onPointerEnd(e: PointerEvent): void {
    inputController.removeMovePointer(e.pointerId);
  }

  function onKeyDown(e: KeyboardEvent): void {
    inputController.setInputMethod('keyboard');
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (sceneManager.mode === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
      startNewGame(gameMode, selectedStageId);
      return;
    }

    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
      if (sceneManager.mode === 'playing' || sceneManager.mode === 'paused') {
        togglePause();
        return;
      }
    }

    if (sceneManager.mode === 'paused') {
      if (e.code === 'KeyR' && !e.repeat) {
        startNewGame(gameMode, selectedStageId);
      } else if (e.code === 'Enter' && !e.repeat) {
        togglePause();
      }
      return;
    }

    if (sceneManager.mode === 'result') {
      if (e.code === 'KeyR' && !e.repeat) {
        startNewGame(gameMode, selectedStageId);
      } else if (e.code === 'Enter' && !e.repeat) {
        const stageCleared =
          world.match.mode === 'stage' &&
          evaluateStageStars(world.match.score, world.match.endReason, STAGES[world.match.stageId]) >= 1;
        if (stageCleared && world.match.stageId < 4) {
          startNewGame('stage', (world.match.stageId + 1) as StageId);
        } else {
          startNewGame(gameMode, selectedStageId);
        }
      }
      return;
    }

    if (sceneManager.mode !== 'playing') return;

    sound.unlock();
    inputController.onKeyDown(e.code, e.repeat);
  }

  function onKeyUp(e: KeyboardEvent): void {
    inputController.onKeyUp(e.code);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearInputs);
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInputs();
      if (sceneManager.mode === 'playing') {
        sceneManager.transitionTo('paused');
      }
    }
  });

  resizeCanvas();

  let lastTimeMs = performance.now();
  let accumulatorMs = 0;

  function stepSimulation(dtMs: number): void {
    if (!shouldAdvanceSimulation(sceneManager.mode)) return;

    const dtSec = dtMs / 1000;
    animTimeSec += dtSec;

    const unifiedInput = inputController.consumeFrameInput();
    const events = world.step(toWorldStepInput(unifiedInput), dtMs);

    if (events.bumpedHit || events.bumpedWhiff) {
      sound.playBump(events.bumpedHit);
    }
    if (events.jumped) {
      sound.playJump();
    }
    if (events.slammed) {
      sound.playButtSlam();
    }
    if (events.propSmashed) {
      sound.playPropSmash();
    }
    if (events.cornPickedUp) {
      sound.playCornPickup();
    }
    if (events.redCrestCharged) {
      sound.playRedCrestCharge();
    }
    for (const phase of events.enteredPhases) {
      if (phase === 'WARNING') sound.playBubble();
      else if (phase === 'ACTIVE') sound.playFountainStart();
      else if (phase === 'SURGE_WARN') sound.playSurgeWarn();
      else if (phase === 'SURGE') sound.playSurgeBlast();
    }
    if (events.playerHitBySurge) {
      sound.playLaunchSquawk(false);
    }
    if (events.aiHitBySurge || events.angledCannonLaunch) {
      sound.playLaunchSquawk(true);
    }

    if (events.occupant === 'player') {
      soakAudioAcc += dtSec;
      if (soakAudioAcc >= 0.42) {
        soakAudioAcc = 0;
        sound.playSoakTick(events.combo);
      }
    } else {
      soakAudioAcc = 0;
    }

    if (world.match.finished) {
      sceneManager.transitionTo('result');
      clearInputs();
      if (world.match.mode === 'stage') {
        const stars = evaluateStageStars(
          world.match.score,
          world.match.endReason,
          STAGES[world.match.stageId],
        );
        progress = applyStageCompletion(progress, world.match.stageId, world.match.score, stars);
      } else {
        progress = applyEndlessCompletion(progress, world.match.score);
      }
      writeProgress(progress);
    }
  }

  function frame(nowMs: number): void {
    const elapsed = Math.min(tuning.loop.maxFrameDtMs, Math.max(0, nowMs - lastTimeMs));
    lastTimeMs = nowMs;
    accumulatorMs += elapsed;

    while (accumulatorMs >= tuning.loop.fixedDtMs) {
      stepSimulation(tuning.loop.fixedDtMs);
      accumulatorMs -= tuning.loop.fixedDtMs;
    }

    if (sceneManager.mode === 'title') {
      animTimeSec += elapsed / 1000;
    }

    const activeDir = computeMoveDir();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGameFrame(
      ctx,
      world,
      {
        screenMode: sceneManager.mode,
        gameMode,
        selectedStageId,
        progress,
        muted: sound.muted,
        debug: debugMode,
        animTimeSec,
        leftPressed: activeDir === -1,
        rightPressed: activeDir === 1,
        lastInputMethod: inputController.getLastInputMethod(),
      },
      tuning,
    );
    ctx.restore();

    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

main();
