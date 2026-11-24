import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import {
  createInitialPlugState,
  findPluggableNozzle,
  startPlugOnNozzle,
  stepPlugState,
} from '../src/game/plug';
import { createInitialMatchState } from '../src/game/rules';
import { PigeonFountainWorld } from '../src/game/world';

describe('game/plug fountain plugging', () => {
  it('allows plugging IDLE or WARNING nozzles from air within ±20px, but rejects ACTIVE/SURGE', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const nozzles = base.nozzles.map((n, i) =>
      i === 0
        ? { ...n, phase: 'IDLE' as const }
        : i === 1
          ? { ...n, phase: 'ACTIVE' as const }
          : { ...n, phase: 'WARNING' as const },
    );

    expect(findPluggableNozzle(nozzles[0].x + 18, true, 200, 0, nozzles, tuning)?.slotIndex).toBe(0);
    expect(findPluggableNozzle(nozzles[0].x + 25, true, 200, 0, nozzles, tuning)).toBeNull();
    expect(findPluggableNozzle(nozzles[1].x, true, 200, 0, nozzles, tuning)).toBeNull();
    expect(findPluggableNozzle(nozzles[2].x - 10, true, 200, 0, nozzles, tuning)?.slotIndex).toBe(2);
    expect(findPluggableNozzle(nozzles[0].x, false, 200, 0, nozzles, tuning)).toBeNull();
  });

  it('triggers adjacent SURGE when released after > 0.6s, but not before 0.6s', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const started = startPlugOnNozzle(1, base.nozzles);
    expect(started.nozzles[1].phase).toBe('PLUGGED');

    // Early release (< 0.6s) -> no adjacent surge, enters 3.0s cooldown
    const earlyHold = stepPlugState(started.plug, started.nozzles, started.nozzles[1].x, false, 0.4, tuning);
    expect(earlyHold.released).toBe(false);
    const earlyRelease = stepPlugState(earlyHold.nextPlug, earlyHold.nextNozzles, started.nozzles[1].x + 30, false, 0.05, tuning);
    expect(earlyRelease.released).toBe(true);
    expect(earlyRelease.triggeredSurgeSlots).toEqual([]);
    expect(earlyRelease.nextPlug.cooldownSec).toBe(tuning.plug.cooldownSec);

    // Hold > 0.6s then release -> adjacent nozzles 0 and 2 immediately SURGE
    const longHold = stepPlugState(started.plug, started.nozzles, started.nozzles[1].x, false, 0.8, tuning);
    const longRelease = stepPlugState(longHold.nextPlug, longHold.nextNozzles, started.nozzles[1].x + 30, false, 0.05, tuning);
    expect(longRelease.released).toBe(true);
    expect(longRelease.bigUltTriggered).toBe(false);
    expect(longRelease.triggeredSurgeSlots).toEqual([0, 2]);
    expect(longRelease.nextNozzles[0].phase).toBe('SURGE');
    expect(longRelease.nextNozzles[2].phase).toBe('SURGE');
    expect(longRelease.nextNozzles[1].phase).toBe('IDLE');
  });

  it('triggers big ult at 2.0s: both sides SURGE, launches player high, and grants +8 control', () => {
    const world = new PigeonFountainWorld('stage', 1, tuning, 12345);
    const centerNozzle = world.match.nozzles[1];
    world.player.x = centerNozzle.x;
    world.player.y = tuning.scene.groundY - 2;
    world.player.vy = 240;
    world.player.airborne = true;
    world.player.isJumping = true;

    // Step 1 frame to land on IDLE center nozzle and start plugging
    const landEv = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, tuning.loop.fixedDtMs);
    expect(landEv.plugStarted).toBe(true);
    expect(world.plug.activeSlotIndex).toBe(1);
    expect(world.match.nozzles[1].phase).toBe('PLUGGED');

    // Place stunned rival on adjacent nozzle 2 so big ult blasts it
    world.rivals[0].x = world.match.nozzles[2].x;
    world.rivals[0].y = tuning.scene.groundY;
    world.rivals[0].airborne = false;
    world.rivals[0].stunTimerSec = 2.5;

    const ctrlBefore = world.match.playerControl;
    let bigUltSeen = false;
    for (let i = 0; i < 140; i++) {
      const ev = world.step({ moveDir: 0, bumpPressed: false, jumpPressed: false }, tuning.loop.fixedDtMs);
      if (ev.plugBigUlt) {
        bigUltSeen = true;
        break;
      }
    }

    expect(bigUltSeen).toBe(true);
    expect(world.player.airborne).toBe(true);
    expect(world.player.vy).toBeLessThan(0);
    expect(world.match.playerControl).toBeGreaterThanOrEqual(ctrlBefore + tuning.plug.bigUltControlBonus);
    expect(world.rivals[0].airborne).toBe(true);
    expect(world.plug.cooldownSec).toBeGreaterThan(2.5);
  });

  it('enforces 3.0s cooldown before the pigeon can plug again', () => {
    const base = createInitialMatchState('stage', 1, tuning);
    const plug = createInitialPlugState();
    expect(findPluggableNozzle(base.nozzles[0].x, true, 200, 1.5, base.nozzles, tuning)).toBeNull();
    const cooled = stepPlugState({ ...plug, cooldownSec: 3.0 }, base.nozzles, 100, false, 3.0, tuning);
    expect(cooled.nextPlug.cooldownSec).toBe(0);
    expect(findPluggableNozzle(base.nozzles[0].x, true, 200, cooled.nextPlug.cooldownSec, base.nozzles, tuning)?.slotIndex).toBe(0);
  });
});
