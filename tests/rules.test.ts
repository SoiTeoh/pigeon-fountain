import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import {
  computeComboMultiplier,
  createInitialMatchState,
  decideAiMove,
  evaluateNozzleOccupant,
  stepMatchState,
} from '../src/game/rules';

describe('computeComboMultiplier', () => {
  it('returns 1, 2, 3 according to combo hold thresholds', () => {
    expect(computeComboMultiplier(0, tuning)).toBe(1);
    expect(computeComboMultiplier(tuning.scoring.combo2Sec - 0.1, tuning)).toBe(1);
    expect(computeComboMultiplier(tuning.scoring.combo2Sec, tuning)).toBe(2);
    expect(computeComboMultiplier(tuning.scoring.combo3Sec, tuning)).toBe(3);
  });
});

describe('evaluateNozzleOccupant', () => {
  const nozzleX = tuning.scene.nozzles[1];
  const r = tuning.fountain.coreRadiusPx;

  it('returns none when both pigeons are outside core radius', () => {
    expect(evaluateNozzleOccupant(nozzleX - 40, nozzleX + 40, nozzleX, false, false, r)).toBe(
      'none',
    );
  });

  it('returns player or ai when only one is inside core radius', () => {
    expect(evaluateNozzleOccupant(nozzleX + 10, nozzleX + 60, nozzleX, false, false, r)).toBe(
      'player',
    );
    expect(evaluateNozzleOccupant(nozzleX - 60, nozzleX - 8, nozzleX, false, false, r)).toBe('ai');
  });

  it('awards occupant to whichever pigeon is closer to nozzle center', () => {
    expect(evaluateNozzleOccupant(nozzleX + 5, nozzleX - 18, nozzleX, false, false, r)).toBe(
      'player',
    );
    expect(evaluateNozzleOccupant(nozzleX + 20, nozzleX - 4, nozzleX, false, false, r)).toBe('ai');
  });

  it('ignores airborne pigeons', () => {
    expect(evaluateNozzleOccupant(nozzleX, nozzleX + 15, nozzleX, true, false, r)).toBe('ai');
    expect(evaluateNozzleOccupant(nozzleX, nozzleX, nozzleX, true, true, r)).toBe('none');
  });
});

describe('stepMatchState', () => {
  it('transitions IDLE -> WARNING and rotates away from previous slot', () => {
    const init = createInitialMatchState(tuning, 1);
    const res = stepMatchState(
      init,
      {
        dtSec: tuning.fountain.idleMinSec + 0.02,
        playerX: 100,
        aiX: 250,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0,
    );
    expect(res.enteredPhase).toBe('WARNING');
    expect(res.state.fountain.phase).toBe('WARNING');
    expect(res.state.fountain.slotIndex).not.toBe(1);
  });

  it('transitions WARNING -> ACTIVE with willSurge when rng < surgeChance', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      fountain: { ...s.fountain, phase: 'WARNING', phaseTimerSec: 0.05 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.06,
        playerX: 195,
        aiX: 260,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.1,
    );
    expect(res.enteredPhase).toBe('ACTIVE');
    expect(res.state.fountain.willSurge).toBe(true);
  });

  it('accumulates soakSec, score, and combo multiplier while player occupies ACTIVE nozzle', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      fountain: { ...s.fountain, phase: 'ACTIVE', phaseTimerSec: 4.0 },
    };
    const res1 = stepMatchState(
      s,
      {
        dtSec: 1.5,
        playerX: 195,
        aiX: 280,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res1.occupant).toBe('player');
    expect(res1.combo).toBe(2);
    expect(res1.state.maxCombo).toBe(2);
    expect(res1.state.soakSec).toBeCloseTo(1.5, 4);
    expect(res1.state.score).toBeGreaterThan(tuning.scoring.basePointsPerSec * 1.5);
  });

  it('resets playerHoldSec when AI steals the ACTIVE nozzle', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      playerHoldSec: 2.0,
      fountain: { ...s.fountain, phase: 'ACTIVE', phaseTimerSec: 3.0 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.1,
        playerX: 120,
        aiX: 195,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res.occupant).toBe('ai');
    expect(res.state.playerHoldSec).toBe(0);
  });

  it('transitions ACTIVE -> SURGE_WARN when willSurge is true, otherwise ACTIVE -> IDLE', () => {
    const base = createInitialMatchState(tuning, 1);
    const surgeState = {
      ...base,
      fountain: { ...base.fountain, phase: 'ACTIVE' as const, phaseTimerSec: 0.05, willSurge: true },
    };
    const r1 = stepMatchState(
      surgeState,
      { dtSec: 0.06, playerX: 100, aiX: 280, playerAirborne: false, aiAirborne: false },
      tuning,
      () => 0.5,
    );
    expect(r1.enteredPhase).toBe('SURGE_WARN');

    const calmState = {
      ...base,
      fountain: {
        ...base.fountain,
        phase: 'ACTIVE' as const,
        phaseTimerSec: 0.05,
        willSurge: false,
      },
    };
    const r2 = stepMatchState(
      calmState,
      { dtSec: 0.06, playerX: 100, aiX: 280, playerAirborne: false, aiAirborne: false },
      tuning,
      () => 0.5,
    );
    expect(r2.enteredPhase).toBe('IDLE');
  });

  it('blasts player and removes 1 feather if player stays in nozzle on SURGE', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      playerHoldSec: 2.0,
      fountain: { ...s.fountain, phase: 'SURGE_WARN', phaseTimerSec: 0.05 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.06,
        playerX: 195,
        aiX: 100,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res.enteredPhase).toBe('SURGE');
    expect(res.playerHitBySurge).toBe(true);
    expect(res.state.feathers).toBe(tuning.scoring.maxFeathers - 1);
    expect(res.state.playerHoldSec).toBe(0);
  });

  it('lets player dodge SURGE cleanly when outside nozzle core', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      fountain: { ...s.fountain, phase: 'SURGE_WARN', phaseTimerSec: 0.05 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.06,
        playerX: 120,
        aiX: 300,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res.playerHitBySurge).toBe(false);
    expect(res.aiHitBySurge).toBe(false);
    expect(res.state.feathers).toBe(tuning.scoring.maxFeathers);
  });

  it('awards sabotage bonus (+150) when AI gets blasted by SURGE', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      fountain: { ...s.fountain, phase: 'SURGE_WARN', phaseTimerSec: 0.05 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.06,
        playerX: 120,
        aiX: 195,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res.aiHitBySurge).toBe(true);
    expect(res.state.sabotageCount).toBe(1);
    expect(res.state.score).toBe(tuning.scoring.sabotageBonus);
  });

  it('ends match with feathers_zero when last feather is lost', () => {
    let s = createInitialMatchState(tuning, 1);
    s = {
      ...s,
      feathers: 1,
      fountain: { ...s.fountain, phase: 'SURGE_WARN', phaseTimerSec: 0.05 },
    };
    const res = stepMatchState(
      s,
      {
        dtSec: 0.06,
        playerX: 195,
        aiX: 100,
        playerAirborne: false,
        aiAirborne: false,
      },
      tuning,
      () => 0.5,
    );
    expect(res.state.feathers).toBe(0);
    expect(res.state.finished).toBe(true);
    expect(res.state.endReason).toBe('feathers_zero');
  });

  it('ends match with time_up at 45s and stops advancing afterward', () => {
    let s = createInitialMatchState(tuning, 1);
    s = { ...s, remainingSec: 0.05 };
    const res = stepMatchState(
      s,
      { dtSec: 0.1, playerX: 100, aiX: 250, playerAirborne: false, aiAirborne: false },
      tuning,
      () => 0.5,
    );
    expect(res.state.finished).toBe(true);
    expect(res.state.endReason).toBe('time_up');
    expect(res.state.remainingSec).toBe(0);

    const after = stepMatchState(
      res.state,
      { dtSec: 1.0, playerX: 195, aiX: 195, playerAirborne: false, aiAirborne: false },
      tuning,
      () => 0.5,
    );
    expect(after.state).toEqual(res.state);
  });
});

describe('decideAiMove', () => {
  it('chases active/warning nozzle when far away', () => {
    const base = createInitialMatchState(tuning, 2); // nozzle 285
    const decision = decideAiMove(
      {
        aiX: 120,
        playerX: 200,
        fountain: { ...base.fountain, phase: 'WARNING' },
        surgeReactElapsedSec: 0,
        elapsedSec: 2,
      },
      tuning,
    );
    expect(decision.moveDir).toBe(1);
    expect(decision.intent).toBe('chase');
  });

  it('delays fleeing during SURGE_WARN until aiReactionDelaySec elapses', () => {
    const base = createInitialMatchState(tuning, 1); // nozzle 195
    const surgeWarnFountain = { ...base.fountain, phase: 'SURGE_WARN' as const };

    const early = decideAiMove(
      {
        aiX: 195,
        playerX: 130,
        fountain: surgeWarnFountain,
        surgeReactElapsedSec: 0.1,
        elapsedSec: 5,
      },
      tuning,
    );
    expect(early.intent).toBe('contest');

    const late = decideAiMove(
      {
        aiX: 205,
        playerX: 130,
        fountain: surgeWarnFountain,
        surgeReactElapsedSec: tuning.pigeon.aiReactionDelaySec,
        elapsedSec: 5,
      },
      tuning,
    );
    expect(late.intent).toBe('flee');
    expect(late.moveDir).toBe(1);
  });

  it('roams gently during IDLE', () => {
    const base = createInitialMatchState(tuning, 1);
    const decision = decideAiMove(
      {
        aiX: 100,
        playerX: 195,
        fountain: { ...base.fountain, phase: 'IDLE' },
        surgeReactElapsedSec: 0,
        elapsedSec: 0,
      },
      tuning,
    );
    expect(decision.intent).toBe('roam');
  });
});
