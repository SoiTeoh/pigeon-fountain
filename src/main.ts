import './style.css';
import { STAGES, tuning } from './config/tuning';
import { STRINGS_ZH } from './content/strings.zh';
import { InputController, toWorldStepInput } from './core/input';
import { ReplayRecorder } from './core/replay';
import { generateRandomSeed } from './core/rng';
import { SoundEngine } from './game/audio';
import {
  didPlayerWinRace,
  evaluateStageStars,
  getMaxRivalControl,
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
import { createInitialCameraState, stepCameraState } from './render/camera';
import { drawGameFrame } from './render/painter';
import { computeViewportLayout, HOME_UI, type HomeSubView } from './render/shared';
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

async function main(): Promise<void> {
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
  const tuneMode = import.meta.env.DEV || params.has('tune');
  let activeTuning = tuning;
  if (tuneMode) {
    const { createRuntimeTuning, loadTuneOverrides, mountTunePanel } = await import(
      './platform/tunePanel'
    );
    activeTuning = createRuntimeTuning(loadTuneOverrides());
    mountTunePanel(activeTuning);
  }

  const sound = new SoundEngine();
  let progress = readProgress();
  let gameMode: GameMode = 'stage';
  let selectedStageId: StageId = 1;
  let world = new PigeonFountainWorld(gameMode, selectedStageId, activeTuning, generateRandomSeed());
  let replayRecorder: ReplayRecorder | null = null;
  const sceneManager = new SceneManager('title');
  let animTimeSec = 0;
  let soakAudioAcc = 0;
  let plugAudioAcc = 0;
  let heartbeatAcc = 0;
  let slowMoTimerSec = 0;
  let zoomOverrideTimerSec = 0;
  let plugHintText: string | null = null;
  let plugHintTimerSec = 0;
  let plugGuideShownThisMatch = false;
  let tutContestShown = false;
  let tutSurgeShown = false;
  let showFingerDragHint = false;

  // Unified input controller (touch + keyboard)
  const isTouchOrMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 768 ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
  const inputController = new InputController(
    isTouchOrMobile ? 'touch' : 'keyboard',
    activeTuning,
  );
  let dpr = 1;
  let logicalHeight: number = tuning.view.height;
  let safeTopPx = 0;
  let camera = createInitialCameraState(activeTuning);
  let homeSubView: HomeSubView = 'home';

  function measureSafeTopPx(): number {
    try {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top, 0px);pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
      const px = probe.getBoundingClientRect().height;
      probe.remove();
      return Number.isFinite(px) ? Math.max(0, px) : 0;
    } catch {
      return 0;
    }
  }

  function resizeCanvas(): void {
    const vw = Math.max(240, window.innerWidth);
    const vh = Math.max(320, window.innerHeight);
    safeTopPx = measureSafeTopPx();
    logicalHeight = Math.max(640, Math.min(900, Math.round(tuning.view.width * (vh / vw))));
    const aspect = tuning.view.width / logicalHeight;

    let cssWidth = vw;
    let cssHeight = vh;
    if (vw > vh) {
      cssHeight = vh;
      cssWidth = cssHeight * aspect;
      if (cssWidth > vw) {
        cssWidth = vw;
        cssHeight = cssWidth / aspect;
      }
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(cssWidth)}px`;
    canvas.style.height = `${Math.floor(cssHeight)}px`;
    canvas.width = Math.round(tuning.view.width * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
  }

  function toLogicalCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    return {
      x: Math.max(0, Math.min(tuning.view.width, rx * tuning.view.width)),
      y: Math.max(0, Math.min(logicalHeight, ry * logicalHeight)),
    };
  }

  function clearInputs(): void {
    inputController.clear();
  }

  function syncPreviewWorld(): void {
    world = new PigeonFountainWorld(gameMode, selectedStageId, activeTuning, generateRandomSeed());
    replayRecorder = null;
  }

  function startNewGame(mode: GameMode = gameMode, stageId: StageId = selectedStageId): void {
    sound.unlock();
    gameMode = mode;
    selectedStageId = stageId;
    const matchSeed = generateRandomSeed();
    world = new PigeonFountainWorld(mode, stageId, activeTuning, matchSeed);
    replayRecorder = new ReplayRecorder(mode, stageId, matchSeed);
    soakAudioAcc = 0;
    plugAudioAcc = 0;
    heartbeatAcc = 0;
    slowMoTimerSec = 0;
    zoomOverrideTimerSec = 0;
    plugHintText = null;
    plugHintTimerSec = 0;
    plugGuideShownThisMatch = false;
    tutContestShown = false;
    tutSurgeShown = false;
    showFingerDragHint = mode === 'tutorial' && stageId === 1;
    if (mode === 'tutorial') {
      if (stageId === 1) {
        plugHintText = STRINGS_ZH.tutorial.tut1Drag;
        plugHintTimerSec = 5.5;
      } else if (stageId === 3) {
        plugHintText = STRINGS_ZH.tutorial.tut3Plug;
        plugHintTimerSec = 3.5;
      }
    }
    clearInputs();
    sceneManager.transitionTo('playing');
  }

  function returnToHome(): void {
    clearInputs();
    if (gameMode === 'tutorial') {
      gameMode = 'stage';
      selectedStageId = 1;
    }
    homeSubView = 'home';
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
    const layout = computeViewportLayout(logicalHeight, safeTopPx, activeTuning);

    if (sceneManager.mode === 'title') {
      if (homeSubView === 'home') {
        const botPt = { x: pt.x, y: pt.y - layout.bottomOffsetY };
        if (hitRect(botPt, HOME_UI.ctaBtn)) {
          sound.playUiClick();
          startNewGame('stage', selectedStageId);
          return;
        }
        if (hitRect(botPt, HOME_UI.navMapBtn)) {
          sound.playUiClick();
          homeSubView = 'map';
          return;
        }
        if (hitRect(botPt, HOME_UI.navEndlessBtn)) {
          sound.playUiClick();
          startNewGame('endless', 1);
          return;
        }
        if (hitRect(botPt, HOME_UI.navTutorialBtn)) {
          sound.playUiClick();
          startNewGame('tutorial', 1);
          return;
        }
        return;
      }

      const opt = { x: pt.x, y: pt.y - layout.overlayOffsetY };
      if (homeSubView === 'map') {
        if (hitRect(opt, HOME_UI.mapBackBtn)) {
          sound.playUiClick();
          homeSubView = 'home';
          return;
        }
        for (const node of HOME_UI.mapNodes) {
          if (hitCircle(opt, node, 8) && node.id <= progress.unlockedStage) {
            selectedStageId = node.id;
            gameMode = 'stage';
            syncPreviewWorld();
            homeSubView = 'prelevel';
            sound.playUiClick();
            return;
          }
        }
        return;
      }

      // prelevel
      if (hitRect(opt, HOME_UI.preBackBtn)) {
        sound.playUiClick();
        homeSubView = 'map';
        return;
      }
      if (hitRect(opt, HOME_UI.preStartBtn)) {
        sound.playUiClick();
        startNewGame('stage', selectedStageId);
      }
      return;
    }

    if (sceneManager.mode === 'paused') {
      const ui = tuning.ui.pause;
      const opt = { x: pt.x, y: pt.y - layout.overlayOffsetY };
      if (hitRect(opt, ui.resumeBtn)) {
        togglePause();
      } else if (hitRect(opt, ui.restartBtn)) {
        sound.playUiClick();
        startNewGame(gameMode, selectedStageId);
      } else if (hitRect(opt, ui.homeBtn)) {
        sound.playUiClick();
        returnToHome();
      } else if (hitRect(opt, ui.controlToggleBtn)) {
        sound.playUiClick();
        progress = {
          ...progress,
          classicFourButtons: !progress.classicFourButtons,
        };
        writeProgress(progress);
      }
      return;
    }

    if (sceneManager.mode === 'result') {
      const ui = tuning.ui.result;
      const opt = { x: pt.x, y: pt.y - layout.overlayOffsetY };
      const stageCleared =
        world.match.mode === 'stage' &&
        evaluateStageStars(world.match, STAGES[world.match.stageId]) >= 1;
      const wonTut = world.match.mode === 'tutorial' && didPlayerWinRace(world.match);
      const hasNext = (stageCleared && world.match.stageId < 4) || wonTut;

      if (hasNext && hitRect(opt, ui.primaryBtn)) {
        sound.playUiClick();
        if (world.match.mode === 'tutorial') {
          if (world.match.stageId < 3) {
            startNewGame('tutorial', (world.match.stageId + 1) as StageId);
          } else {
            startNewGame('stage', 1);
          }
        } else {
          startNewGame('stage', (world.match.stageId + 1) as StageId);
        }
        return;
      }

      const leftBtn = hasNext ? ui.secondaryLeftBtn : ui.soloLeftBtn;
      const rightBtn = hasNext ? ui.secondaryRightBtn : ui.soloRightBtn;
      if (hitRect(opt, leftBtn)) {
        sound.playUiClick();
        startNewGame(gameMode, selectedStageId);
      } else if (hitRect(opt, rightBtn)) {
        sound.playUiClick();
        returnToHome();
      }
      return;
    }

    // Playing state: HUD buttons
    const hudPt = { x: pt.x, y: pt.y - layout.hudOffsetY };
    if (hitCircle(hudPt, tuning.ui.hud.muteBtn, 6)) {
      sound.muted = !sound.muted;
      return;
    }
    if (hitCircle(hudPt, tuning.ui.hud.pauseBtn, 6)) {
      togglePause();
      return;
    }

    const ctrl = tuning.ui.controls;
    const hitPad = ctrl.buttonHitPadPx;
    const rightZoneX = tuning.view.width * ctrl.dragZoneMaxXRatio;
    const botPt = { x: pt.x, y: pt.y - layout.bottomOffsetY };

    if (progress.classicFourButtons) {
      // Classic 4-button layout
      if (hitCircle(botPt, ctrl.jumpBtn, hitPad)) {
        inputController.tryTriggerButton(e.pointerId, 'jump', world.player.airborne, e.pointerType);
        return;
      }
      if (hitCircle(botPt, ctrl.bumpBtn, hitPad)) {
        inputController.tryTriggerButton(e.pointerId, 'bump', world.player.airborne, e.pointerType);
        return;
      }
      if (hitCircle(botPt, ctrl.leftBtn, hitPad)) {
        inputController.setMovePointer(e.pointerId, -1, false, pt.x, e.pointerType);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic pointer events
        }
        return;
      }
      if (hitCircle(botPt, ctrl.rightBtn, hitPad)) {
        inputController.setMovePointer(e.pointerId, 1, false, pt.x, e.pointerType);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic pointer events
        }
        return;
      }
    } else {
      // Right 40%: dual buttons only (no drag); Left 60% lower half: relative horizontal joystick
      if (pt.x >= rightZoneX) {
        if (hitCircle(botPt, ctrl.bumpBtn, hitPad)) {
          inputController.tryTriggerButton(e.pointerId, 'bump', world.player.airborne, e.pointerType);
          return;
        }
        if (hitCircle(botPt, ctrl.jumpBtn, hitPad)) {
          inputController.tryTriggerButton(e.pointerId, 'jump', world.player.airborne, e.pointerType);
          return;
        }
        return;
      }

      if (pt.y >= ctrl.dragZoneMinY + layout.bottomOffsetY * 0.5) {
        if (inputController.startJoystick(e.pointerId, pt.x, pt.y, e.pointerType)) {
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            // Ignore synthetic pointer events
          }
        }
        return;
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (sceneManager.mode !== 'playing') return;
    const pt = toLogicalCoords(e.clientX, e.clientY);
    if (inputController.updateJoystick(e.pointerId, pt.x, pt.y)) {
      return;
    }
    const entry = inputController.getMovePointer(e.pointerId);
    if (!entry) return;
    if (hitCircle(pt, tuning.ui.controls.leftBtn, tuning.ui.controls.buttonHitPadPx)) {
      inputController.updateMovePointer(e.pointerId, -1, pt.x);
    } else if (hitCircle(pt, tuning.ui.controls.rightBtn, tuning.ui.controls.buttonHitPadPx)) {
      inputController.updateMovePointer(e.pointerId, 1, pt.x);
    }
  }

  function onPointerEnd(e: PointerEvent): void {
    inputController.endPointer(e.pointerId);
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
          evaluateStageStars(world.match, STAGES[world.match.stageId]) >= 1;
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
    inputController.onKeyDown(e.code, e.repeat, world.player.airborne);
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
  window.addEventListener('contextmenu', (e) => e.preventDefault());
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

  function stepTitleDemo(dtMs: number): void {
    if (world.match.finished) {
      syncPreviewWorld();
    }
    const target =
      world.match.nozzles.find((n) => n.phase === 'ACTIVE') ??
      world.match.nozzles.find((n) => n.phase === 'WARNING') ??
      world.match.nozzles[1] ??
      world.match.nozzles[0];
    const dx = (target?.x ?? 195) - world.player.x;
    const nearRival = world.rivals.some(
      (r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - world.player.x) <= activeTuning.pigeon.bumpReachPx - 8,
    );
    world.step(
      {
        moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
        bumpPressed: nearRival && world.player.bumpCooldownSec <= 0,
        jumpPressed: false,
      },
      dtMs,
    );
  }

  function stepSimulation(dtMs: number): void {
    if (sceneManager.mode === 'title' && homeSubView === 'home') {
      stepTitleDemo(dtMs);
      return;
    }
    if (!shouldAdvanceSimulation(sceneManager.mode)) return;

    const dtSec = dtMs / 1000;
    animTimeSec += dtSec;

    const unifiedInput = inputController.consumeFrameInput();
    replayRecorder?.recordFrame(unifiedInput);
    const events = world.step(toWorldStepInput(unifiedInput), dtMs);

    if (plugHintTimerSec > 0) {
      plugHintTimerSec = Math.max(0, plugHintTimerSec - dtSec);
      if (plugHintTimerSec === 0) plugHintText = null;
    }

    if (
      gameMode === 'tutorial' &&
      selectedStageId === 1 &&
      (world.match.elapsedSec >= 5.5 || Math.abs(world.player.vx) > 40)
    ) {
      showFingerDragHint = false;
    }

    if (gameMode === 'tutorial' && selectedStageId === 2) {
      if (!tutContestShown && events.occupant === 'contested') {
        tutContestShown = true;
        plugHintText = STRINGS_ZH.tutorial.tut2Bump;
        plugHintTimerSec = 3.0;
      }
      if (!tutSurgeShown && events.enteredPhases.includes('SURGE_WARN')) {
        tutSurgeShown = true;
        plugHintText = STRINGS_ZH.tutorial.tut2Dodge;
        plugHintTimerSec = 2.5;
      }
    }

    if (
      !plugGuideShownThisMatch &&
      !(gameMode === 'tutorial' && selectedStageId < 3) &&
      progress.plugSuccessCount < 3 &&
      world.match.nozzles.some((n) => n.phase === 'IDLE' || n.phase === 'WARNING')
    ) {
      plugGuideShownThisMatch = true;
      plugHintText = STRINGS_ZH.hud.plugGuideFirst;
      plugHintTimerSec = 2.5;
    }

    if (events.plugStarted) {
      if (progress.plugSuccessCount === 0) {
        plugHintText = STRINGS_ZH.hud.plugSuccessFirst;
        plugHintTimerSec = 2.5;
      }
      progress = {
        ...progress,
        plugSuccessCount: progress.plugSuccessCount + 1,
      };
      writeProgress(progress);
    }

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

    if (events.enteredActiveWater) {
      sound.playPigeonCoo(Math.floor(Math.random() * 3));
    }
    if (events.plugBigUlt) {
      slowMoTimerSec = 0.3;
      zoomOverrideTimerSec = 0.35;
    }
    if (events.angryWarnTriggered) {
      sound.playFountainAngry();
    }
    if (world.plug.activeSlotIndex !== null) {
      plugAudioAcc += dtSec;
      if (plugAudioAcc >= 0.18) {
        plugAudioAcc = 0;
        sound.playPlugChargeTick(world.plug.holdSec / activeTuning.plug.maxDurationSec);
      }
    } else {
      plugAudioAcc = 0;
    }

    const highTension =
      Math.max(world.match.playerControl, getMaxRivalControl(world.match)) >=
      activeTuning.control.flashThreshold;
    sound.stepBgm(dtSec, highTension);
    if (highTension) {
      heartbeatAcc += dtSec;
      if (heartbeatAcc >= 0.55) {
        heartbeatAcc = 0;
        sound.playHeartbeat();
      }
    } else {
      heartbeatAcc = 0;
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
      replayRecorder?.finalize(world.getStateHash());
      if (!didPlayerWinRace(world.match)) {
        sound.playLoseCloud();
      }
      sceneManager.transitionTo('result');
      clearInputs();
      if (world.match.mode === 'tutorial') {
        if (didPlayerWinRace(world.match)) {
          const nextTut =
            world.match.stageId === 1 ? 2 : world.match.stageId === 2 ? 3 : 'done';
          progress = {
            ...progress,
            tutorialStep: nextTut,
          };
        }
      } else if (world.match.mode === 'stage') {
        const stars = evaluateStageStars(world.match, STAGES[world.match.stageId]);
        progress = applyStageCompletion(
          progress,
          world.match.stageId,
          Math.round(world.match.playerControl),
          stars,
        );
      } else {
        progress = applyEndlessCompletion(progress, world.match.score);
      }
      writeProgress(progress);
    }
  }

  function frame(nowMs: number): void {
    const elapsed = Math.min(tuning.loop.maxFrameDtMs, Math.max(0, nowMs - lastTimeMs));
    lastTimeMs = nowMs;
    const elapsedSec = elapsed / 1000;
    if (slowMoTimerSec > 0) {
      slowMoTimerSec = Math.max(0, slowMoTimerSec - elapsedSec);
      accumulatorMs += elapsed * 0.35;
    } else {
      accumulatorMs += elapsed;
    }
    if (zoomOverrideTimerSec > 0) {
      zoomOverrideTimerSec = Math.max(0, zoomOverrideTimerSec - elapsedSec);
    }

    while (accumulatorMs >= tuning.loop.fixedDtMs) {
      stepSimulation(tuning.loop.fixedDtMs);
      accumulatorMs -= tuning.loop.fixedDtMs;
    }

    if (sceneManager.mode === 'title') {
      animTimeSec += elapsedSec;
    }

    camera = stepCameraState(
      camera,
      world,
      elapsedSec,
      activeTuning,
      zoomOverrideTimerSec > 0 ? 1.45 : null,
    );

    const activeDir = computeMoveDir();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGameFrame(
      ctx,
      world,
      {
        screenMode: sceneManager.mode,
        homeSubView,
        gameMode,
        selectedStageId,
        progress,
        muted: sound.muted,
        debug: debugMode,
        animTimeSec,
        leftPressed: activeDir === -1,
        rightPressed: activeDir === 1,
        lastInputMethod: inputController.getLastInputMethod(),
        classicFourButtons: progress.classicFourButtons,
        joystick: inputController.getJoystickVisual(),
        plugHintText,
        showFingerDragHint,
        logicalHeight,
        safeTopPx,
        camera,
      },
      activeTuning,
    );
    ctx.restore();

    window.requestAnimationFrame(frame);
  }

  if (progress.tutorialStep !== 'done') {
    startNewGame('tutorial', progress.tutorialStep);
  }

  window.requestAnimationFrame(frame);
}

void main();
