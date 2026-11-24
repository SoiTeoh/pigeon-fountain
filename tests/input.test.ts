import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import { InputController, resolveContextAction, toWorldStepInput } from '../src/core/input';
import { PigeonFountainWorld } from '../src/game/world';
import {
  createInitialProgress,
  readProgress,
  writeProgress,
  type StorageBackend,
} from '../src/platform/storage';

describe('core/input', () => {
  it('unifies keyboard and touch movement and tracks lastInputMethod', () => {
    const input = new InputController('touch');
    expect(input.getLastInputMethod()).toBe('touch');

    input.onKeyDown('KeyD', false);
    expect(input.getLastInputMethod()).toBe('keyboard');
    expect(input.peekMoveAxis()).toBe(1);

    input.onKeyDown('Space', false);
    const frame1 = input.consumeFrameInput();
    expect(frame1).toEqual({
      moveTargetX: null,
      moveAxis: 1,
      action: true,
      jump: false,
      slam: false,
    });
    expect(toWorldStepInput(frame1)).toEqual({
      moveDir: 1,
      bumpPressed: true,
      jumpPressed: false,
      slamPressed: false,
      moveTargetX: null,
    });

    // Queued one-shot actions are consumed on read
    const frame2 = input.consumeFrameInput();
    expect(frame2.action).toBe(false);
    expect(frame2.moveAxis).toBe(1);

    input.onKeyUp('KeyD');
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('tracks touch pointers independently and switches lastInputMethod back to touch', () => {
    const input = new InputController('keyboard');
    input.setMovePointer(1, -1, false, 72, 'touch');
    expect(input.getLastInputMethod()).toBe('touch');

    input.queueJump('touch');
    const frame = input.consumeFrameInput();
    expect(frame).toEqual({
      moveTargetX: 72,
      moveAxis: -1,
      action: false,
      jump: true,
      slam: false,
    });

    input.removeMovePointer(1);
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('ignores key repeat for one-shot jump/action', () => {
    const input = new InputController('keyboard');
    input.onKeyDown('Space', true);
    input.onKeyDown('KeyW', true);
    expect(input.consumeFrameInput()).toEqual({
      moveTargetX: null,
      moveAxis: 0,
      action: false,
      jump: false,
      slam: false,
    });
  });

  it('resolves context action (bump within 70px, jump on ground, slam in air) and drags toward moveTargetX', () => {
    expect(
      resolveContextAction(100, false, [{ x: 150, airborne: false, respawnTimerSec: 0 }], tuning),
    ).toBe('bump');
    expect(
      resolveContextAction(100, false, [{ x: 220, airborne: false, respawnTimerSec: 0 }], tuning),
    ).toBe('jump');
    expect(
      resolveContextAction(100, true, [{ x: 150, airborne: false, respawnTimerSec: 0 }], tuning),
    ).toBe('slam');

    const world = new PigeonFountainWorld('stage', 1, tuning, 123);
    const startX = world.player.x;
    for (let i = 0; i < 15; i++) {
      world.step(
        { moveDir: 0, bumpPressed: false, jumpPressed: false, moveTargetX: 250 },
        tuning.loop.fixedDtMs,
      );
    }
    expect(world.player.x).toBeGreaterThan(startX + 10);
  });

  it('persists classicFourButtons setting via storage', () => {
    const mem = new Map<string, string>();
    const backend: StorageBackend = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
    };
    const p = { ...createInitialProgress(), classicFourButtons: true };
    writeProgress(p, backend);
    expect(readProgress(backend).classicFourButtons).toBe(true);
  });
});
