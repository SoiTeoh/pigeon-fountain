import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import { toWorldStepInput, type UnifiedInput } from '../src/core/input';
import {
  parseReplay,
  ReplayRecorder,
  runReplay,
  serializeReplay,
} from '../src/core/replay';
import { PigeonFountainWorld } from '../src/game/world';

describe('core/replay', () => {
  it('records delta inputs and replays to the exact same state hash', () => {
    const seed = 20261123;
    const liveWorld = new PigeonFountainWorld('stage', 3, tuning, seed);
    const recorder = new ReplayRecorder('stage', 3, seed);
    const totalFrames = 3000; // 50s at 60fps

    for (let f = 0; f < totalFrames; f++) {
      const input: UnifiedInput = {
        moveTargetX: null,
        moveAxis: f % 120 < 45 ? 1 : f % 120 < 90 ? -1 : 0,
        action: f % 60 === 15,
        jump: f % 80 === 25,
      };
      recorder.recordFrame(input);
      liveWorld.step(toWorldStepInput(input), tuning.loop.fixedDtMs);
    }

    const liveHash = liveWorld.getStateHash();
    const replay = recorder.finalize(liveHash);
    const serialized = serializeReplay(replay);

    // 50s replay payload must remain compact (< 2KB for typical sparse changes, or verify delta compression)
    expect(replay.frames.length).toBeLessThan(totalFrames / 5);
    expect(serialized.length).toBeLessThan(8192);

    const parsed = parseReplay(serialized);
    const replayed = runReplay(parsed, tuning);

    expect(replayed.finalHash).toBe(liveHash);
    expect(replayed.world.match.score).toBe(liveWorld.match.score);
    expect(replayed.world.match.elapsedSec).toBe(liveWorld.match.elapsedSec);
  });

  it('produces compact < 2KB payload for realistic 50s match input cadence', () => {
    const recorder = new ReplayRecorder('stage', 1, 777);
    const totalFrames = 3000; // 50 seconds

    for (let f = 0; f < totalFrames; f++) {
      // Realistic human input: direction change ~once per second, action ~every 2s
      const input: UnifiedInput = {
        moveTargetX: null,
        moveAxis: Math.floor(f / 60) % 3 === 0 ? 1 : Math.floor(f / 60) % 3 === 1 ? -1 : 0,
        action: f % 120 === 30,
        jump: f % 240 === 60,
      };
      recorder.recordFrame(input);
    }

    const payload = serializeReplay(recorder.finalize());
    expect(new TextEncoder().encode(payload).byteLength).toBeLessThan(2048);
  });
});
