import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import {
  computeJoystickResponse,
  InputController,
  toWorldStepInput,
} from '../src/core/input';
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
      moveScale: 1,
      stopOnRelease: false,
      action: true,
      jump: false,
      slam: false,
    });
    expect(toWorldStepInput(frame1)).toEqual({
      moveDir: 1,
      moveScale: 1,
      stopOnRelease: false,
      bumpPressed: true,
      jumpPressed: false,
      slamPressed: false,
    });

    const frame2 = input.consumeFrameInput();
    expect(frame2.action).toBe(false);
    expect(frame2.moveAxis).toBe(1);

    input.onKeyUp('KeyD');
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('implements relative horizontal joystick deadzone (±10px), proportional acceleration (to ±45px), and stop on release', () => {
    expect(computeJoystickResponse(0)).toEqual({ axis: 0, scale: 0 });
    expect(computeJoystickResponse(10)).toEqual({ axis: 0, scale: 0 });
    expect(computeJoystickResponse(-10)).toEqual({ axis: 0, scale: 0 });

    const mid = computeJoystickResponse(27.5);
    expect(mid.axis).toBe(1);
    expect(mid.scale).toBeCloseTo(0.5, 4);

    expect(computeJoystickResponse(45)).toEqual({ axis: 1, scale: 1 });
    expect(computeJoystickResponse(-80)).toEqual({ axis: -1, scale: 1 });

    const input = new InputController('touch');
    expect(input.startJoystick(1, 100, 520, 'touch')).toBe(true);
    input.updateJoystick(1, 108, 520); // within ±10px deadzone
    expect(input.peekMove()).toEqual({ axis: 0, scale: 0 });

    input.updateJoystick(1, 127.5, 520); // halfway between 10 and 45
    const moveFrame = input.consumeFrameInput();
    expect(moveFrame.moveAxis).toBe(1);
    expect(moveFrame.moveScale).toBeCloseTo(0.5, 4);

    // Release joystick -> stopOnRelease stops grounded player immediately
    input.endPointer(1);
    const relFrame = input.consumeFrameInput();
    expect(relFrame.moveAxis).toBe(0);
    expect(relFrame.stopOnRelease).toBe(true);

    const world = new PigeonFountainWorld('stage', 1, tuning, 123);
    world.player.vx = 180;
    world.step(toWorldStepInput(relFrame), tuning.loop.fixedDtMs);
    expect(world.player.vx).toBe(0);
  });

  it('isolates dragging pointer from button triggers and supports multi-touch', () => {
    const input = new InputController('touch');
    expect(input.startJoystick(10, 100, 520, 'touch')).toBe(true);

    // Same pointerId (already dragging) cannot trigger a button!
    expect(input.tryTriggerButton(10, 'bump', false, 'touch')).toBe(false);
    expect(input.tryTriggerButton(10, 'jump', false, 'touch')).toBe(false);

    // A second finger (pointerId 20) can trigger bump/jump independently
    expect(input.tryTriggerButton(20, 'bump', false, 'touch')).toBe(true);
    const frame = input.consumeFrameInput();
    expect(frame.action).toBe(true);

    // Airborne jump button triggers slam
    expect(input.tryTriggerButton(21, 'jump', true, 'touch')).toBe(true);
    const airFrame = input.consumeFrameInput();
    expect(airFrame.slam).toBe(true);
    expect(airFrame.jump).toBe(false);
  });

  it('ignores key repeat for one-shot jump/action', () => {
    const input = new InputController('keyboard');
    input.onKeyDown('Space', true);
    input.onKeyDown('KeyW', true);
    expect(input.consumeFrameInput()).toEqual({
      moveTargetX: null,
      moveAxis: 0,
      moveScale: 0,
      stopOnRelease: false,
      action: false,
      jump: false,
      slam: false,
    });
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
