import { describe, expect, it } from 'vitest';
import { STAGES, tuning } from '../src/config/tuning';
import {
  checkPropHit,
  computeComboMultiplier,
  computeParabolicLaunchVelocity,
  createInitialMatchState,
  createInitialProps,
  decideAiMove,
  evaluateButtSlam,
  evaluateNozzleOccupant,
  evaluateStageStars,
  shouldAdvanceSimulation,
  stepMatchState,
  type FountainSlotState,
} from '../src/game/rules';
import { PigeonFountainWorld } from '../src/game/world';
import {
  applyEndlessCompletion,
  applyStageCompletion,
  createInitialProgress,
  readProgress,
  writeProgress,
  type StorageBackend,
} from '../src/platform/storage';

describe('computeComboMultiplier', () => {
  it('returns 1, 2, 3 according to combo hold thresholds', () => {
    expect(computeComboMultiplier(0, tuning)).toBe(1);
    expect(computeComboMultiplier(tuning.scoring.combo2Sec - 0.1, tuning)).toBe(1);
    expect(computeComboMultiplier(tuning.scoring.combo2Sec, tuning)).toBe(2);
    expect(computeComboMultiplier(tuning.scoring.combo3Sec, tuning)).toBe(3);
  });
});

describe('evaluateNozzleOccupant', () => {
  const nozzleX = STAGES[1].nozzleXs[1];
  const r = tuning.fountain.coreRadiusPx;

  it('returns none when both player and rivals are outside core radius', () => {
    expect(
      evaluateNozzleOccupant(nozzleX - 40, [nozzleX + 40], nozzleX, false, [false], r),
    ).toBe('none');
  });

  it('returns player or ai when only one is inside core radius', () => {
    expect(
      evaluateNozzleOccupant(nozzleX + 10, [nozzleX + 60], nozzleX, false, [false], r),
    ).toBe('player');
    expect(
      evaluateNozzleOccupant(nozzleX - 60, [nozzleX - 8], nozzleX, false, [false], r),
    ).toBe('ai');
  });

  it('awards occupant to whichever bird is closer to nozzle center', () => {
    expect(
      evaluateNozzleOccupant(nozzleX + 5, [nozzleX - 18, nozzleX + 22], nozzleX, false, [false, false], r),
    ).toBe('player');
    expect(
      evaluateNozzleOccupant(nozzleX + 20, [nozzleX - 4, nozzleX + 25], nozzleX, false, [false, false], r),
    ).toBe('ai');
  });

  it('ignores airborne birds', () => {
    expect(
      evaluateNozzleOccupant(nozzleX, [nozzleX + 15], nozzleX, true, [false], r),
    ).toBe('ai');
    expect(
      evaluateNozzleOccupant(nozzleX, [nozzleX], nozzleX, true, [true], r),
    ).toBe('none');
  });
});

describe('stepMatchState', () => {
  it('transitions IDLE -> WARNING from director idle timer', () => {
    const init = createInitialMatchState('stage', 1, tuning);
    const res = stepMatchState(
      init,
      {
        dtSec: init.directorIdleSec + 0.02,
        playerX: 100,
        playerAirborne: false,
        rivals: [{ id: 0, x: 250, airborne: false }],
      },
      tuning,
      () => 0,
    );
    expect(res.enteredPhases).toContain('WARNING');
    expect(res.state.nozzles.some((n) => n.phase === 'WARNING')).toBe(true);
  });

  it('transitions WARNING -> ACTIVE with willSurge when rng < surgeChance', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'WARNING' as const, phaseTimerSec: 0.05 } : n,
    );
    const res = stepMatchState(
      { ...base, nozzles },
      {
        dtSec: 0.06,
        playerX: 195,
        playerAirborne: false,
        rivals: [{ id: 0, x: 260, airborne: false }],
      },
      tuning,
      () => 0.1,
    );
    expect(res.enteredPhases).toContain('ACTIVE');
    expect(res.state.nozzles[1].phase).toBe('ACTIVE');
    expect(res.state.nozzles[1].willSurge).toBe(true);
  });

  it('opens dual nozzles simultaneously on Stage 2 when rng < dualActiveChance', () => {
    const init = createInitialMatchState('stage', 2, tuning);
    const res = stepMatchState(
      init,
      {
        dtSec: init.directorIdleSec + 0.02,
        playerX: 120,
        playerAirborne: false,
        rivals: [{ id: 0, x: 260, airborne: false }],
      },
      tuning,
      () => 0.05,
    );
    const warningCount = res.state.nozzles.filter((n) => n.phase === 'WARNING').length;
    expect(warningCount).toBe(2);
  });

  it('queues staggered wave eruptions in Stage 4 waveMode', () => {
    const init = createInitialMatchState('stage', 4, tuning);
    const r1 = stepMatchState(
      init,
      {
        dtSec: init.directorIdleSec + 0.02,
        playerX: 120,
        playerAirborne: false,
        rivals: [{ id: 0, x: 260, airborne: false }],
      },
      tuning,
      () => 0.1,
    );
    expect(r1.state.waveQueue.length).toBeGreaterThan(0);

    const r2 = stepMatchState(
      r1.state,
      {
        dtSec: tuning.fountain.waveStaggerSec + 0.02,
        playerX: 120,
        playerAirborne: false,
        rivals: [{ id: 0, x: 260, airborne: false }],
      },
      tuning,
      () => 0.5,
    );
    expect(r2.state.nozzles.filter((n) => n.phase !== 'IDLE').length).toBeGreaterThanOrEqual(2);
  });

  it('creates 32 degree angled fountains on Stage 2+', () => {
    const base = createInitialMatchState('stage', 2, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 0 ? { ...n, phase: 'WARNING' as const, phaseTimerSec: 0.05 } : n,
    );
    const res = stepMatchState(
      { ...base, nozzles },
      {
        dtSec: 0.06,
        playerX: 100,
        playerAirborne: false,
        rivals: [{ id: 0, x: 260, airborne: false }],
      },
      tuning,
      () => 0.1,
    );
    expect(res.state.nozzles[0].style).toBe('angled');
    expect(Math.abs(res.state.nozzles[0].tiltDeg)).toBe(tuning.fountain.angledTiltDeg);
  });

  it('accumulates soakSec, score, and combo multiplier while player occupies ACTIVE nozzle', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 4.0 } : n,
    );
    const res = stepMatchState(
      { ...base, nozzles },
      {
        dtSec: 1.5,
        playerX: 195,
        playerAirborne: false,
        rivals: [{ id: 0, x: 280, airborne: false }],
      },
      tuning,
      () => 0.5,
    );
    expect(res.occupant).toBe('player');
    expect(res.combo).toBe(2);
    expect(res.state.maxCombo).toBe(2);
    expect(res.state.soakSec).toBeCloseTo(1.5, 4);
    expect(res.state.score).toBeGreaterThan(tuning.scoring.basePointsPerSec * 1.5);
  });

  it('resets playerHoldSec when AI steals the ACTIVE nozzle', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 3.0 } : n,
    );
    const res = stepMatchState(
      { ...base, playerHoldSec: 2.0, nozzles },
      {
        dtSec: 0.1,
        playerX: 120,
        playerAirborne: false,
        rivals: [{ id: 0, x: 195, airborne: false }],
      },
      tuning,
      () => 0.5,
    );
    expect(res.occupant).toBe('ai');
    expect(res.state.playerHoldSec).toBe(0);
  });

  it('transitions ACTIVE -> SURGE_WARN when willSurge is true, otherwise IDLE', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const surgeNozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 0.05, willSurge: true } : n,
    );
    const r1 = stepMatchState(
      { ...base, nozzles: surgeNozzles },
      { dtSec: 0.06, playerX: 100, playerAirborne: false, rivals: [{ id: 0, x: 280, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(r1.state.nozzles[1].phase).toBe('SURGE_WARN');

    const calmNozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 0.05, willSurge: false } : n,
    );
    const r2 = stepMatchState(
      { ...base, nozzles: calmNozzles },
      { dtSec: 0.06, playerX: 100, playerAirborne: false, rivals: [{ id: 0, x: 280, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(r2.state.nozzles[1].phase).toBe('IDLE');
  });

  it('blasts grounded player and subtracts 10 control on SURGE, but airborne jump dodges it', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'SURGE_WARN' as const, phaseTimerSec: 0.05 } : n,
    );
    const hitRes = stepMatchState(
      { ...base, playerControl: 42, playerHoldSec: 2.0, nozzles },
      { dtSec: 0.06, playerX: 195, playerAirborne: false, rivals: [{ id: 0, x: 100, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(hitRes.playerHitBySurgeSlot).toBe(1);
    expect(hitRes.state.playerControl).toBe(42 - tuning.control.surgePenalty);
    expect(hitRes.state.playerSurgeHits).toBe(1);

    const dodgeRes = stepMatchState(
      { ...base, playerControl: 42, playerHoldSec: 2.0, nozzles },
      { dtSec: 0.06, playerX: 195, playerAirborne: true, rivals: [{ id: 0, x: 100, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(dodgeRes.playerHitBySurgeSlot).toBeNull();
    expect(dodgeRes.state.playerControl).toBe(42);
  });

  it('awards sabotage bonus (+150) and deducts 10 control for each rival blasted by SURGE', () => {
    const base = createInitialMatchState('stage', 2, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'SURGE_WARN' as const, phaseTimerSec: 0.05 } : n,
    );
    const nx = nozzles[1].x;
    const res = stepMatchState(
      {
        ...base,
        rivalControls: [
          { id: 0, archetype: 'white_pigeon', control: 30 },
          { id: 1, archetype: 'sparrow', control: 5 },
        ],
        nozzles,
      },
      {
        dtSec: 0.06,
        playerX: 60,
        playerAirborne: false,
        rivals: [
          { id: 0, x: nx, airborne: false },
          { id: 1, x: nx + 8, airborne: false },
        ],
      },
      tuning,
      () => 0.5,
    );
    expect(res.rivalsHitBySurge.length).toBe(2);
    expect(res.state.sabotageCount).toBe(2);
    expect(res.state.score).toBe(tuning.scoring.sabotageBonus * 2);
    expect(res.state.rivalControls[0].control).toBe(20);
    expect(res.state.rivalControls[1].control).toBe(0);
  });

  it('ends match immediately when player or rival reaches 100 control', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 2.0 } : n,
    );
    const winRes = stepMatchState(
      { ...base, playerControl: 99.8, nozzles },
      { dtSec: 0.1, playerX: 195, playerAirborne: false, rivals: [{ id: 0, x: 100, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(winRes.state.playerControl).toBe(100);
    expect(winRes.state.finished).toBe(true);
    expect(winRes.state.endReason).toBe('player_full');

    const loseRes = stepMatchState(
      {
        ...base,
        rivalControls: [{ id: 0, archetype: 'white_pigeon', control: 99.9 }],
        nozzles,
      },
      { dtSec: 0.1, playerX: 60, playerAirborne: false, rivals: [{ id: 0, x: 195, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(loseRes.state.rivalControls[0].control).toBe(100);
    expect(loseRes.state.finished).toBe(true);
    expect(loseRes.state.endReason).toBe('rival_full');
  });

  it('gains control at 4/s * 1/1.5/2 combo, rivalGainMult 0.7 on Stage 1, and pauses gain while stunned', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 1 ? { ...n, phase: 'ACTIVE' as const, phaseTimerSec: 5.0 } : n,
    );

    const p1 = stepMatchState(
      { ...base, playerHoldSec: 0, nozzles },
      { dtSec: 1.0, playerX: 195, playerAirborne: false, rivals: [{ id: 0, x: 60, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(p1.state.playerControl).toBeCloseTo(4, 4);

    const p3 = stepMatchState(
      { ...base, playerHoldSec: 3.0, nozzles },
      { dtSec: 1.0, playerX: 195, playerAirborne: false, rivals: [{ id: 0, x: 60, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(p3.state.playerControl).toBeCloseTo(8, 4); // 4/s * 2x

    const rivalActive = stepMatchState(
      { ...base, nozzles },
      { dtSec: 1.0, playerX: 60, playerAirborne: false, rivals: [{ id: 0, x: 195, airborne: false, stunned: false }] },
      tuning,
      () => 0.5,
    );
    expect(rivalActive.state.rivalControls[0].control).toBeCloseTo(4 * 0.7, 4);

    const rivalStunned = stepMatchState(
      { ...base, nozzles },
      { dtSec: 1.0, playerX: 60, playerAirborne: false, rivals: [{ id: 0, x: 195, airborne: false, stunned: true }] },
      tuning,
      () => 0.5,
    );
    expect(rivalStunned.state.rivalControls[0].control).toBe(0);
  });

  it('ends match with time_up at 60s in stage mode and freezes afterward', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    expect(base.remainingSec).toBe(60);
    const res = stepMatchState(
      { ...base, remainingSec: 0.05 },
      { dtSec: 0.1, playerX: 100, playerAirborne: false, rivals: [{ id: 0, x: 250, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(res.state.finished).toBe(true);
    expect(res.state.endReason).toBe('time_up');
    expect(res.state.remainingSec).toBe(0);

    const after = stepMatchState(
      res.state,
      { dtSec: 1.0, playerX: 195, playerAirborne: false, rivals: [{ id: 0, x: 195, airborne: false }] },
      tuning,
      () => 0.5,
    );
    expect(after.state).toEqual(res.state);
  });
});

describe('decideAiMove & archetypes', () => {
  const makeNozzles = (phase: FountainSlotState['phase'], slotIdx = 1): FountainSlotState[] =>
    STAGES[1].nozzleXs.map((x, idx) => ({
      slotIndex: idx,
      x,
      phase: idx === slotIdx ? phase : 'IDLE',
      phaseTimerSec: 1.0,
      style: 'bubble',
      tiltDeg: 0,
      lateralDir: 0,
      lateralStrength: 0,
      lateralTimerSec: 0,
      willSurge: false,
    }));

  it('freezes AI movement and surge fleeing while stunned (> 0.55s hit-stun)', () => {
    const decision = decideAiMove(
      {
        archetype: 'white_pigeon',
        birdIndex: 0,
        aiX: 195,
        playerX: 130,
        nozzles: makeNozzles('SURGE_WARN', 1),
        stunTimerSec: 0.55,
        surgeReactElapsedSec: 0.5,
        redCrestState: 'idle',
        redCrestTimerSec: 0,
        redCrestCooldownSec: 0,
        redCrestDir: 1,
        elapsedSec: 5,
      },
      tuning,
    );
    expect(decision.intent).toBe('stunned');
    expect(decision.moveDir).toBe(0);
    expect(decision.nextSurgeReactElapsedSec).toBe(0.5);
  });

  it('delays fleeing during SURGE_WARN until ~0.36s reaction delay elapses', () => {
    const nozzles = makeNozzles('SURGE_WARN', 1);
    const early = decideAiMove(
      {
        archetype: 'white_pigeon',
        birdIndex: 0,
        aiX: 195,
        playerX: 130,
        nozzles,
        stunTimerSec: 0,
        surgeReactElapsedSec: 0.1,
        redCrestState: 'idle',
        redCrestTimerSec: 0,
        redCrestCooldownSec: 0,
        redCrestDir: 1,
        elapsedSec: 5,
      },
      tuning,
    );
    expect(early.intent).toBe('contest');

    const late = decideAiMove(
      {
        archetype: 'white_pigeon',
        birdIndex: 0,
        aiX: 205,
        playerX: 130,
        nozzles,
        stunTimerSec: 0,
        surgeReactElapsedSec: tuning.pigeon.aiReactionDelaySec,
        redCrestState: 'idle',
        redCrestTimerSec: 0,
        redCrestCooldownSec: 0,
        redCrestDir: 1,
        elapsedSec: 5,
      },
      tuning,
    );
    expect(late.intent).toBe('flee');
    expect(late.moveDir).toBe(1);
  });

  it('triggers red_crest 0.6s charge -> lunge -> whiff_stun when missing player', () => {
    const nozzles = makeNozzles('IDLE');
    const startCharge = decideAiMove(
      {
        archetype: 'red_crest',
        birdIndex: 1,
        aiX: 250,
        playerX: 170,
        nozzles,
        stunTimerSec: 0,
        surgeReactElapsedSec: 0,
        redCrestState: 'idle',
        redCrestTimerSec: 0,
        redCrestCooldownSec: 0,
        redCrestDir: -1,
        elapsedSec: 4,
      },
      tuning,
    );
    expect(startCharge.nextRedCrestState).toBe('charging');
    expect(startCharge.startedCharge).toBe(true);
    expect(startCharge.nextRedCrestDir).toBe(-1);

    const startLunge = decideAiMove(
      {
        archetype: 'red_crest',
        birdIndex: 1,
        aiX: 250,
        playerX: 170,
        nozzles,
        stunTimerSec: 0,
        surgeReactElapsedSec: 0,
        redCrestState: 'charging',
        redCrestTimerSec: 0.01,
        redCrestCooldownSec: 2,
        redCrestDir: -1,
        elapsedSec: 4.6,
        dtSec: 0.02,
      },
      tuning,
    );
    expect(startLunge.nextRedCrestState).toBe('lunging');
    expect(startLunge.moveDir).toBe(-1);

    // Player jumped away to x = 80 -> red_crest whiffs and enters whiff_stun!
    const whiff = decideAiMove(
      {
        archetype: 'red_crest',
        birdIndex: 1,
        aiX: 170,
        playerX: 80,
        nozzles,
        stunTimerSec: 0,
        surgeReactElapsedSec: 0,
        redCrestState: 'lunging',
        redCrestTimerSec: 0.01,
        redCrestCooldownSec: 2,
        redCrestDir: -1,
        elapsedSec: 5.0,
        dtSec: 0.02,
      },
      tuning,
    );
    expect(whiff.nextRedCrestState).toBe('whiff_stun');
    expect(whiff.intent).toBe('stunned');
    expect(whiff.nextRedCrestTimerSec).toBe(tuning.pigeon.redCrestWhiffStunSec);
  });
});

describe('Parabolic launch, props, and butt-slam helpers', () => {
  it('computes angled 32° cannon velocity toward jet direction', () => {
    const rightShot = computeParabolicLaunchVelocity(
      { birdX: 162, nozzleX: 162, tiltDeg: 32, fallbackDir: -1 },
      tuning,
    );
    expect(rightShot.vx).toBeGreaterThan(280);
    expect(rightShot.vy).toBeLessThan(-450);

    const leftShot = computeParabolicLaunchVelocity(
      { birdX: 228, nozzleX: 228, tiltDeg: -32, fallbackDir: 1 },
      tuning,
    );
    expect(leftShot.vx).toBeLessThan(-280);
  });

  it('computes parabolic surge velocity biased by impact offset left vs right', () => {
    const leftBias = computeParabolicLaunchVelocity(
      { birdX: 185, nozzleX: 195, tiltDeg: 0, fallbackDir: 1 },
      tuning,
    );
    const rightBias = computeParabolicLaunchVelocity(
      { birdX: 210, nozzleX: 195, tiltDeg: 0, fallbackDir: -1 },
      tuning,
    );
    expect(leftBias.vx).toBeLessThan(0);
    expect(rightBias.vx).toBeGreaterThan(0);
  });

  it('detects prop hit when airborne bird enters prop bounds', () => {
    const props = createInitialProps(STAGES[1]);
    const leftProp = props[0];
    expect(checkPropHit(leftProp.x, leftProp.y + 10, 22, leftProp)).toBe(true);
    expect(checkPropHit(195, 200, 22, leftProp)).toBe(false);
  });

  it('evaluates butt-slam when landing from jump onto an ACTIVE nozzle', () => {
    const nozzles: FountainSlotState[] = STAGES[1].nozzleXs.map((x, idx) => ({
      slotIndex: idx,
      x,
      phase: idx === 1 ? 'ACTIVE' : 'IDLE',
      phaseTimerSec: 2.0,
      style: 'bubble',
      tiltDeg: 0,
      lateralDir: 0,
      lateralStrength: 0,
      lateralTimerSec: 0,
      willSurge: false,
    }));

    const slam = evaluateButtSlam(true, 180, 195, nozzles, tuning);
    expect(slam.triggered).toBe(true);
    expect(slam.bonusScore).toBe(30);

    const noSlam = evaluateButtSlam(false, 180, 195, nozzles, tuning);
    expect(noSlam.triggered).toBe(false);
  });
});

describe('PigeonFountainWorld integration mechanics', () => {
  it('applies 0.60s stun and knockback on 肥臀猛顶 hit and bowls multiple sparrows', () => {
    const world = new PigeonFountainWorld('stage', 2, tuning);
    world.player.x = 180;
    world.rivals[0].x = 220; // white pigeon
    world.rivals[1].x = 232; // sparrow 1
    world.rivals[2].x = 240; // sparrow 2

    const ev = world.step({ moveDir: 0, bumpPressed: true, jumpPressed: false }, 16.67);
    expect(ev.bumpedHit).toBe(true);
    expect(world.player.bumpCooldownSec).toBeCloseTo(tuning.pigeon.bumpCooldownSec, 3);
    expect(world.rivals[0].stunTimerSec).toBeGreaterThan(0.55);
    expect(world.rivals[1].stunTimerSec).toBeGreaterThan(0.55);
    expect(world.rivals[2].stunTimerSec).toBeGreaterThan(0.55);
  });

  it('triggers 小跳 (0.9s cooldown) and 铁臀墩坐 (+30) on active nozzle landing', () => {
    const world = new PigeonFountainWorld('stage', 1, tuning);
    world.match = {
      ...world.match,
      nozzles: world.match.nozzles.map((n, i) =>
        i === 1 ? { ...n, phase: 'ACTIVE', phaseTimerSec: 3.5 } : n,
      ),
    };
    world.player.x = 195;
    world.rivals[0].x = 225;

    const jumpEv = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: true }, 16.67);
    expect(jumpEv.jumped).toBe(true);
    expect(world.player.airborne).toBe(true);
    expect(world.player.jumpCooldownSec).toBeCloseTo(tuning.pigeon.jumpCooldownSec, 3);

    // Step until player lands back onto active nozzle 1
    let slammed = false;
    for (let i = 0; i < 60; i++) {
      const ev = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, 16.67);
      if (ev.slammed) {
        slammed = true;
        break;
      }
    }
    expect(slammed).toBe(true);
    expect(world.match.slamCount).toBe(1);
    expect(world.match.score).toBeGreaterThanOrEqual(30);
    expect(world.rivals[0].stunTimerSec).toBeGreaterThan(0);
  });

  it('cannon-launches stunned rival from angled jet into prop with 0.07s hit-stop and +120 chain bonus', () => {
    const world = new PigeonFountainWorld('stage', 2, tuning);
    world.match = {
      ...world.match,
      nozzles: world.match.nozzles.map((n, i) =>
        i === 0
          ? {
              ...n,
              phase: 'ACTIVE',
              phaseTimerSec: 3.5,
              style: 'angled',
              tiltDeg: 32,
              lateralDir: 1,
              lateralStrength: tuning.fountain.angledSlideAccel,
            }
          : n,
      ),
    };
    world.player.x = 200;
    world.rivals[0].x = world.match.nozzles[0].x;
    world.rivals[0].stunTimerSec = 0.5;

    const cannonEv = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, 16.67);
    expect(cannonEv.angledCannonLaunch).toBe(true);
    expect(world.rivals[0].airborne).toBe(true);
    expect(world.rivals[0].launchedByFountain).toBe(true);

    // Step flight until it smashes a right-side prop!
    let smashed = false;
    for (let i = 0; i < 80; i++) {
      const ev = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, 16.67);
      if (ev.propSmashed) {
        smashed = true;
        break;
      }
    }
    expect(smashed).toBe(true);
    expect(world.hitStopTimerSec).toBeGreaterThan(0.04);
    expect(world.match.propSmashCount).toBe(1);
    expect(world.match.score).toBeGreaterThanOrEqual(200); // 80 cannon + 120 prop
  });

  it('spawns golden seed sparks when melon_stall is smashed and respawns props after 8s in Endless', () => {
    const world = new PigeonFountainWorld('endless', 1, tuning);
    world.player.x = 52; // Stay clear of nozzles during 8s wait
    const melonProp = world.props.find((p) => p.kind === 'melon_stall')!;
    world.rivals[0].airborne = true;
    world.rivals[0].launchedByFountain = true;
    world.rivals[0].x = melonProp.x;
    world.rivals[0].y = melonProp.y;
    world.rivals[0].vx = -150;
    world.rivals[0].vy = -80;

    const ev = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, 16.67);
    expect(ev.propSmashed).toBe(true);
    expect(world.pickups.some((p) => p.kind === 'melon_spark')).toBe(true);

    // Clear hitstop + advance 8.5 seconds to verify Endless prop respawn
    world.hitStopTimerSec = 0;
    for (let i = 0; i < 510; i++) {
      world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, tuning.loop.fixedDtMs);
    }
    const refreshed = world.props.find((p) => p.id === melonProp.id)!;
    expect(refreshed.intact).toBe(true);
  });

  it('freezes simulation completely when screenMode is paused', () => {
    expect(shouldAdvanceSimulation('playing')).toBe(true);
    expect(shouldAdvanceSimulation('paused')).toBe(false);
    expect(shouldAdvanceSimulation('title')).toBe(false);
    expect(shouldAdvanceSimulation('result')).toBe(false);
  });
});

describe('Stage progression, stars, and storage adapter', () => {
  it('evaluates 0..3 stars accurately from control race outcome', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    expect(
      evaluateStageStars(
        {
          ...base,
          endReason: 'rival_full',
          playerControl: 80,
          rivalControls: [{ id: 0, archetype: 'white_pigeon', control: 100 }],
        },
        STAGES[1],
      ),
    ).toBe(0);
    expect(
      evaluateStageStars(
        {
          ...base,
          endReason: 'time_up',
          playerControl: 60,
          playerSurgeHits: 1,
          rivalControls: [{ id: 0, archetype: 'white_pigeon', control: 55 }],
        },
        STAGES[1],
      ),
    ).toBe(1);
    expect(
      evaluateStageStars(
        {
          ...base,
          endReason: 'player_full',
          playerControl: 100,
          playerSurgeHits: 1,
          rivalControls: [{ id: 0, archetype: 'white_pigeon', control: 70 }],
        },
        STAGES[1],
      ),
    ).toBe(2);
    expect(
      evaluateStageStars(
        {
          ...base,
          endReason: 'player_full',
          playerControl: 100,
          playerSurgeHits: 0,
          rivalControls: [{ id: 0, archetype: 'white_pigeon', control: 60 }],
        },
        STAGES[1],
      ),
    ).toBe(3);
  });

  it('unlocks subsequent stages and persists stars/high scores via storage interface', () => {
    const mem = new Map<string, string>();
    const backend: StorageBackend = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
    };

    let prog = createInitialProgress();
    prog = applyStageCompletion(prog, 1, 560, 2);
    expect(prog.unlockedStage).toBe(2);
    expect(prog.stars[1]).toBe(2);
    expect(prog.stageBestScores[1]).toBe(560);

    prog = applyEndlessCompletion(prog, 1420);
    writeProgress(prog, backend);

    const loaded = readProgress(backend);
    expect(loaded).toEqual(prog);
  });

  it('migrates legacy v1 best score into endlessBestScore cleanly', () => {
    const backend: StorageBackend = {
      getItem: (k) => (k === 'pigeon_fountain_best_score_v1' ? '777' : null),
      setItem: () => {},
    };
    const loaded = readProgress(backend);
    expect(loaded.endlessBestScore).toBe(777);
    expect(loaded.unlockedStage).toBe(1);
  });

  it('awards +45 score when player picks up shiny corn kernel', () => {
    const world = new PigeonFountainWorld('stage', 2, tuning);
    world.player.x = 160;
    world.pickups.push({
      id: 99,
      kind: 'corn',
      x: 168,
      y: tuning.scene.groundY - 8,
      vx: 0,
      vy: 0,
      value: tuning.corn.scoreValue,
      ttlSec: 5,
    });
    const ev = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, 16.67);
    expect(ev.cornPickedUp).toBe(true);
    expect(world.match.score).toBeGreaterThanOrEqual(45);
    expect(world.pickups.length).toBe(0);
  });

  it('allows jumping player to pass cleanly over grounded rival without horizontal blocking', () => {
    const world = new PigeonFountainWorld('stage', 1, tuning);
    world.player.x = 180;
    world.rivals[0].x = 205;
    world.step({ moveDir: 1, bumpPressed: false, jumpPressed: true }, 16.67);
    for (let i = 0; i < 14; i++) {
      world.step({ moveDir: 1, bumpPressed: false, jumpPressed: false }, 16.67);
    }
    expect(world.player.x).toBeGreaterThan(215);
  });

  it('sets 60s duration for Endless mode and verifies 4 distinct stage configs', () => {
    const endless = createInitialMatchState('endless', 1, tuning);
    expect(endless.remainingSec).toBe(60);
    expect(endless.nozzles.length).toBe(5);
    expect(STAGES[1].nozzleXs.length).toBe(3);
    expect(STAGES[2].nozzleXs.length).toBe(4);
    expect(STAGES[3].rivals).toContain('red_crest');
    expect(STAGES[4].waveMode).toBe(true);
  });
});
