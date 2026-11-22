import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { LAUNCH_STAGES } from '../src/config/launchStages';
import { CHARACTERS, launchTuning } from '../src/config/launchTuning';
import {
  areAllCupsIntact,
  canTriggerDiveSlam,
  canTriggerRelayFountain,
  computeSlingshotLaunch,
  evaluateLaunchStars,
  evaluatePolaroidCaptions,
  evaluateSeatSettle,
  findTriggeredRelayFountain,
  isAwningFlattened,
  isBirdOutOfBounds,
  isRivalKnockedOffSeat,
  predictTrajectoryPoints,
} from '../src/game/launchRules';
import { LaunchPrototypeWorld } from '../src/game/launchWorld';
import {
  applyLaunchStageCompletion,
  createInitialLaunchProgress,
  readLaunchProgress,
  writeLaunchProgress,
  type LaunchChapterStageId,
  type StorageBackend,
} from '../src/platform/storage';

describe('Chapter 1 stage configs validation', () => {
  it('defines all 6 distinct stages with valid seats and sub-goals', () => {
    const ids: LaunchChapterStageId[] = [1, 2, 3, 4, 5, 6];
    expect(Object.keys(LAUNCH_STAGES)).toHaveLength(6);
    for (const id of ids) {
      const s = LAUNCH_STAGES[id];
      expect(s.id).toBe(id);
      expect(s.seat.halfW).toBeGreaterThan(20);
      expect(s.subGoalText.length).toBeGreaterThan(4);
    }
    expect(LAUNCH_STAGES[2].walls.some((w) => w.kind === 'eave')).toBe(true);
    expect(LAUNCH_STAGES[4].awning).not.toBeNull();
    expect(LAUNCH_STAGES[5].relays).toHaveLength(2);
    expect(LAUNCH_STAGES[5].glasses).toHaveLength(1);
    expect(LAUNCH_STAGES[6].rivals).toHaveLength(2);
  });

  it('seals the wall-to-platform gap in Stage 2 cleanly', () => {
    const wall = LAUNCH_STAGES[2].walls.find((w) => w.kind === 'brick')!;
    const platform = LAUNCH_STAGES[2].platforms[0];
    const wallRight = wall.x + wall.w / 2;
    const platformLeft = platform.x - platform.w / 2;
    expect(platformLeft).toBeLessThanOrEqual(wallRight);
  });
});

describe('computeSlingshotLaunch & character scaling', () => {
  const anchor = { x: 70, y: 478 };

  it('cancels launch when drag distance is below 15px threshold', () => {
    const res = computeSlingshotLaunch(anchor, { x: 62, y: 484 }, launchTuning, 'black_bad');
    expect(res.valid).toBe(false);
    expect(res.powerRatio).toBe(0);
    expect(res.vx).toBe(0);
  });

  it('computes forward-up velocity when dragging backward and downward', () => {
    const res = computeSlingshotLaunch(anchor, { x: 24, y: 536 }, launchTuning, 'black_bad');
    expect(res.valid).toBe(true);
    expect(res.vx).toBeGreaterThan(150);
    expect(res.vy).toBeLessThan(-250);
  });

  it('scales launch speed by fat_chonk heavier powerMult and clamps at maxPullPx', () => {
    const blackMax = computeSlingshotLaunch(anchor, { x: -200, y: 800 }, launchTuning, 'black_bad');
    const fatMax = computeSlingshotLaunch(anchor, { x: -200, y: 800 }, launchTuning, 'fat_chonk');
    expect(blackMax.pullDistPx).toBe(launchTuning.slingshot.maxPullPx);
    expect(fatMax.vx).toBeLessThan(blackMax.vx);
  });
});

describe('predictTrajectoryPoints', () => {
  it('returns only the first ~35% of the parabolic arc', () => {
    const dots = predictTrajectoryPoints(70, 478, 220, -480, launchTuning, 'black_bad');
    expect(dots.length).toBeGreaterThanOrEqual(4);
    expect(dots[0].x).toBeGreaterThan(70);
    expect(dots[0].y).toBeLessThan(478);
    expect(dots[dots.length - 1].x).toBeLessThan(220);
  });
});

describe('dive slam, relay fountains, and awning flatness', () => {
  it('allows dive slam only once during flying phase', () => {
    expect(canTriggerDiveSlam('aiming', false)).toBe(false);
    expect(canTriggerDiveSlam('flying', false)).toBe(true);
    expect(canTriggerDiveSlam('flying', true)).toBe(false);
    expect(canTriggerDiveSlam('settling_win', false)).toBe(false);
  });

  it('relaxes Stage 2 relay edge trigger to ±38px and respects cooldown', () => {
    const relay = LAUNCH_STAGES[2].relays[0];
    expect(relay.triggerRadiusPx).toBe(38);
    expect(canTriggerRelayFountain(relay.x + 34, relay.y - 12, relay, 0)).toBe(true);
    expect(canTriggerRelayFountain(relay.x + 42, relay.y - 12, relay, 0)).toBe(false);
    expect(canTriggerRelayFountain(relay.x, relay.y, relay, 0.4)).toBe(false);
  });

  it('finds consecutive relays independently in Stage 5', () => {
    const relays = LAUNCH_STAGES[5].relays;
    const cds = { [relays[0].id]: 0.5, [relays[1].id]: 0 };
    const hit = findTriggeredRelayFountain(relays[1].x, relays[1].y - 10, relays, cds);
    expect(hit?.id).toBe(relays[1].id);
  });

  it('requires awning angle within flatThresholdRad to count as flattened', () => {
    const awning = LAUNCH_STAGES[4].awning!;
    expect(isAwningFlattened(awning.restAngleRad, awning)).toBe(false);
    expect(isAwningFlattened(-0.1, awning)).toBe(true);
    expect(isAwningFlattened(0.18, awning)).toBe(true);
    expect(isAwningFlattened(0.25, awning)).toBe(false);
  });
});

describe('seat settle, Stage 3 cup preservation, stars, and Polaroid captions', () => {
  it('accumulates settle timer up to 0.85s below 18 px/s and blocks settle if awning is tilted', () => {
    const seat = LAUNCH_STAGES[4].seat;
    const awning = LAUNCH_STAGES[4].awning!;

    const tilted = evaluateSeatSettle(seat.x, seat.y, 4, true, seat, 0.5, 0.2, launchTuning, -0.4, awning);
    expect(tilted.settled).toBe(false);
    expect(tilted.nextSettleSec).toBe(0);

    const flat1 = evaluateSeatSettle(seat.x, seat.y, 6, true, seat, 0.65, 0.22, launchTuning, 0.05, awning);
    expect(flat1.settled).toBe(true);
    expect(flat1.progressRatio).toBe(1);
  });

  it('resets settle timer when fast, unsupported, or outside seat', () => {
    const seat = LAUNCH_STAGES[1].seat;
    expect(evaluateSeatSettle(seat.x, seat.y, 24, true, seat, 0.5, 0.1, launchTuning).nextSettleSec).toBe(0);
    expect(evaluateSeatSettle(seat.x, seat.y, 5, false, seat, 0.5, 0.1, launchTuning).nextSettleSec).toBe(0);
    expect(evaluateSeatSettle(seat.x + 90, seat.y, 4, true, seat, 0.5, 0.1, launchTuning).nextSettleSec).toBe(0);
  });

  it('evaluates Stage 3 preserve_cups intact check', () => {
    expect(areAllCupsIntact([false, false, false, false, false])).toBe(true);
    expect(areAllCupsIntact([false, true, false, false, false])).toBe(false);
  });

  it('detects rival knockoff and out-of-bounds cleanly', () => {
    const s2Seat = LAUNCH_STAGES[2].seat;
    expect(isRivalKnockedOffSeat(s2Seat.x, s2Seat.y, s2Seat)).toBe(false);
    expect(isRivalKnockedOffSeat(s2Seat.x + 80, s2Seat.y, s2Seat)).toBe(true);
    expect(isBirdOutOfBounds(425, 300, launchTuning)).toBe(true);
  });

  it('awards 1~3 stars, +1000 per saved pigeon, and formats Polaroid captions', () => {
    expect(evaluateLaunchStars(false, true, 2, launchTuning).stars).toBe(0);
    const threeStar = evaluateLaunchStars(true, true, 2, launchTuning);
    expect(threeStar.stars).toBe(3);
    expect(threeStar.bonusScore).toBe(2000);

    const cap = evaluatePolaroidCaptions(LAUNCH_STAGES[3], 3, true);
    expect(cap.mainCaption).toContain('第3关 3★');
    expect(cap.subCaption).toContain('优雅');
  });

  it('persists launchStage 3-star progress via storage adapter', () => {
    const mem = new Map<string, string>();
    const backend: StorageBackend = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
    };
    let prog = createInitialLaunchProgress();
    prog = applyLaunchStageCompletion(prog, 4, 2800, 3);
    expect(prog.stars[4]).toBe(3);
    expect(prog.bestScores[4]).toBe(2800);
    writeLaunchProgress(prog, backend);
    expect(readLaunchProgress(backend)).toEqual(prog);
  });
});

describe('LaunchPrototypeWorld Matter.js 6-stage & dual-character physics', () => {
  it('switches between black_bad and fat_chonk while aiming and updates body radius/mass', () => {
    const world = new LaunchPrototypeWorld(4, launchTuning);
    expect(world.selectedCharacter).toBe('black_bad');
    const blackMass = world.activeBird.mass;

    expect(world.selectCharacter('fat_chonk')).toBe(true);
    expect(world.selectedCharacter).toBe('fat_chonk');
    expect(world.activeBird.mass).toBeGreaterThan(blackMass * 2);

    // Cannot switch mid-flight
    world.phase = 'flying';
    expect(world.selectCharacter('black_bad')).toBe(false);
  });

  it('cancels <15px drag without spending a pigeon', () => {
    const world = new LaunchPrototypeWorld(1, launchTuning);
    expect(world.beginAim({ x: 70, y: 478 })).toBe(true);
    world.updateAim({ x: 64, y: 484 });
    expect(world.releaseAim()).toBe(false);
    expect(world.pigeonsRemaining).toBe(3);
  });

  it('executes fat_chonk 泰山重磅压棚 with higher downward speed and 1-per-flight limit', () => {
    const world = new LaunchPrototypeWorld(4, launchTuning);
    world.selectCharacter('fat_chonk');
    world.beginAim({ x: 70, y: 478 });
    world.updateAim({ x: 18, y: 540 });
    expect(world.releaseAim()).toBe(true);
    for (let i = 0; i < 6; i++) world.step(16.67);

    expect(world.triggerDiveSlam()).toBe(true);
    expect(world.activeBird.velocity.y * 60).toBeGreaterThanOrEqual(CHARACTERS.fat_chonk.diveSlamVy - 20);
    expect(world.triggerDiveSlam()).toBe(false);
  });

  it('triggers Stage 2 relaxed relay edge, clears wall eave, and knocks white pigeon off', () => {
    const world = new LaunchPrototypeWorld(2, launchTuning);
    const relay = LAUNCH_STAGES[2].relays[0];
    // Test relaxed edge hit (+34px from relay center)
    Matter.Body.setPosition(world.activeBird, { x: relay.x + 34, y: 474 });
    Matter.Body.setVelocity(world.activeBird, { x: 1.2, y: 2 });
    world.phase = 'flying';

    const first = world.step(16.67);
    expect(first.relayTriggered).toBe(true);
    expect(world.step(16.67).relayTriggered).toBe(false); // cooldown blocks immediate re-trigger

    let knocked = false;
    for (let i = 0; i < 150; i++) {
      const ev = world.step(16.67);
      if (ev.subGoalNewlyCompleted || world.rivals[0].knocked) {
        knocked = true;
      }
    }
    expect(knocked).toBe(true);
  });

  it('keeps Stage 3 preserve_cups true when landing cleanly on right side, false if cup falls', () => {
    const world = new LaunchPrototypeWorld(3, launchTuning);
    expect(world.subGoalCompleted).toBe(true);

    // Gentle drop onto safe seat zone (x = 326)
    Matter.Body.setPosition(world.activeBird, { x: 326, y: 440 });
    Matter.Body.setVelocity(world.activeBird, { x: 0, y: 0 });
    world.phase = 'flying';
    for (let i = 0; i < 70; i++) world.step(16.67);
    expect(world.subGoalCompleted).toBe(true);
    expect(world.won).toBe(true);

    // Knock a cup -> preserve_cups becomes false
    const world2 = new LaunchPrototypeWorld(3, launchTuning);
    Matter.Body.setPosition(world2.activeBird, { x: 242, y: 395 });
    Matter.Body.setVelocity(world2.activeBird, { x: 2, y: 6 });
    world2.phase = 'flying';
    for (let i = 0; i < 30; i++) world2.step(16.67);
    expect(world2.subGoalCompleted).toBe(false);
  });

  it('allows fat_chonk to flatten Stage 4 elastic awning and settle for 0.85s win', () => {
    const world = new LaunchPrototypeWorld(4, launchTuning);
    world.selectCharacter('fat_chonk');
    Matter.Body.setPosition(world.activeBird, { x: 288, y: 356 });
    Matter.Body.setVelocity(world.activeBird, { x: 0, y: 12 });
    world.phase = 'flying';
    world.pigeonsRemaining = 2;

    let flattened = false;
    let settled = false;
    for (let i = 0; i < 140; i++) {
      const ev = world.step(16.67);
      if (world.awningFlattened) flattened = true;
      if (ev.settledWinStarted || world.won) settled = true;
    }
    expect(flattened).toBe(true);
    expect(settled).toBe(true);
    expect(world.subGoalCompleted).toBe(true);
  });

  it('shatters Stage 5 glass barrier on impact and completes dual_route_bonus', () => {
    const world = new LaunchPrototypeWorld(5, launchTuning);
    const glass = world.glasses[0];
    Matter.Body.setPosition(world.activeBird, { x: glass.body.position.x - 24, y: glass.body.position.y });
    Matter.Body.setVelocity(world.activeBird, { x: 5.5, y: 0 });
    world.phase = 'flying';

    let broke = false;
    for (let i = 0; i < 15; i++) {
      const ev = world.step(16.67);
      if (ev.glassBroken) broke = true;
    }
    expect(broke).toBe(true);
    expect(world.glassBrokenCount).toBe(1);
    expect(world.subGoalCompleted).toBe(true);
  });

  it('triggers Stage 5 dual consecutive relays sequentially', () => {
    const world = new LaunchPrototypeWorld(5, launchTuning);
    const [r1, r2] = LAUNCH_STAGES[5].relays;
    world.phase = 'flying';

    Matter.Body.setPosition(world.activeBird, { x: r1.x, y: 472 });
    Matter.Body.setVelocity(world.activeBird, { x: 1, y: 2 });
    expect(world.step(16.67).relayTriggered).toBe(true);

    Matter.Body.setPosition(world.activeBird, { x: r2.x, y: 472 });
    Matter.Body.setVelocity(world.activeBird, { x: 1, y: 2 });
    expect(world.step(16.67).relayTriggered).toBe(true);
    expect(world.subGoalCompleted).toBe(true);
  });

  it('completes Stage 6 Boss sub-goal only when BOTH white and red_crest rivals are knocked off', () => {
    const world = new LaunchPrototypeWorld(6, launchTuning);
    world.selectCharacter('fat_chonk');
    world.phase = 'flying';

    // Knock only white pigeon off first -> subGoalCompleted still false
    Matter.Body.setPosition(world.rivals[0].body, { x: 40, y: 450 });
    world.step(16.67);
    expect(world.rivals[0].knocked).toBe(true);
    expect(world.subGoalCompleted).toBe(false);

    // Fat chonk dive-slam shockwave knocks heavy red_crest boss off -> subGoalCompleted true!
    Matter.Body.setPosition(world.activeBird, { x: 318, y: 295 });
    Matter.Body.setVelocity(world.activeBird, { x: 0, y: 12 });
    world.triggerDiveSlam();
    for (let i = 0; i < 45; i++) {
      world.step(16.67);
    }
    expect(world.rivals[1].knocked).toBe(true);
    expect(world.subGoalCompleted).toBe(true);
  });

  it('does not show inTargetSeatZone when pigeon stops outside target seat', () => {
    const world = new LaunchPrototypeWorld(2, launchTuning);
    Matter.Body.setPosition(world.activeBird, { x: 170, y: 480 });
    Matter.Body.setVelocity(world.activeBird, { x: 0, y: 0 });
    world.phase = 'flying';
    world.step(16.67);
    expect(world.inTargetSeatZone).toBe(false);
    expect(world.settleProgress).toBe(0);
  });
});
