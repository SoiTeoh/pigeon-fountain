import { tuning } from '../src/config/tuning';
import { didPlayerWinRace, getMaxRivalControl } from '../src/game/rules';
import { PigeonFountainWorld } from '../src/game/world';
import type { WorldStepInput } from '../src/game/worldTypes';
import type { StageId } from '../src/platform/storage';

type BotKind = 'sitter' | 'normal' | 'expert';

interface BotMemory {
  surgeReactSec: number;
  jumpWaitForPlug: boolean;
}

function decideBotInput(
  bot: BotKind,
  world: PigeonFountainWorld,
  mem: BotMemory,
  dtSec: number,
): WorldStepInput {
  const px = world.player.x;
  const nozzles = world.match.nozzles;

  if (bot === 'sitter') {
    const target =
      nozzles.find((n) => n.phase === 'ACTIVE') ??
      nozzles.find((n) => n.phase === 'WARNING') ??
      nozzles[Math.floor(nozzles.length / 2)];
    const dx = target.x - px;
    return {
      moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
      bumpPressed: false,
      jumpPressed: false,
    };
  }

  // Normal & Expert: flee SURGE_WARN after 0.30s reaction
  const danger = nozzles.find(
    (n) => n.phase === 'SURGE_WARN' && Math.abs(px - n.x) <= tuning.fountain.coreRadiusPx + 14,
  );
  if (danger && !world.player.airborne) {
    mem.surgeReactSec += dtSec;
    if (mem.surgeReactSec >= 0.28) {
      const fleeDir: -1 | 1 = px < danger.x ? -1 : px > danger.x ? 1 : danger.x >= 195 ? -1 : 1;
      return { moveDir: fleeDir, bumpPressed: false, jumpPressed: false };
    }
  } else {
    mem.surgeReactSec = 0;
  }

  // Expert: if holding plug, wait > 0.75s then leave or hold to 2.0s big ult
  if (bot === 'expert' && world.plug.activeSlotIndex !== null) {
    const pluggedIdx = world.plug.activeSlotIndex;
    const rivalOnAdj = world.rivals.some(
      (r) =>
        !r.airborne &&
        r.respawnTimerSec <= 0 &&
        nozzles.some(
          (n) => Math.abs(n.slotIndex - pluggedIdx) === 1 && Math.abs(r.x - n.x) <= tuning.fountain.coreRadiusPx + 6,
        ),
    );
    if (world.plug.holdSec >= 0.7 && rivalOnAdj) {
      return { moveDir: 1, bumpPressed: false, jumpPressed: false };
    }
    return { moveDir: 0, bumpPressed: false, jumpPressed: false };
  }

  // Expert: jump & slam onto adjacent IDLE/WARNING nozzle when rival sits on ACTIVE
  if (bot === 'expert' && world.plug.cooldownSec <= 0) {
    if (world.player.airborne && mem.jumpWaitForPlug && world.player.vy > -60) {
      mem.jumpWaitForPlug = false;
      return { moveDir: 0, bumpPressed: false, jumpPressed: false, slamPressed: true };
    }
    if (!world.player.airborne && world.player.jumpCooldownSec <= 0) {
      const rivalActive = nozzles.find(
        (n) =>
          n.phase === 'ACTIVE' &&
          world.rivals.some((r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - n.x) <= tuning.fountain.coreRadiusPx + 6),
      );
      if (rivalActive) {
        const plugSpot = nozzles.find(
          (n) =>
            (n.phase === 'IDLE' || n.phase === 'WARNING') &&
            Math.abs(n.slotIndex - rivalActive.slotIndex) === 1,
        );
        if (plugSpot) {
          const dx = plugSpot.x - px;
          if (Math.abs(dx) <= tuning.plug.coreRadiusPx - 4) {
            mem.jumpWaitForPlug = true;
            return { moveDir: 0, bumpPressed: false, jumpPressed: true };
          }
          return { moveDir: dx > 0 ? 1 : -1, bumpPressed: false, jumpPressed: false };
        }
      }
    }
  }

  // Bump nearby rivals when contesting or approaching
  const nearRival = world.rivals.find(
    (r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - px) <= tuning.pigeon.bumpReachPx - 6,
  );
  const bumpPressed = Boolean(nearRival && !world.player.airborne && world.player.bumpCooldownSec <= 0);

  // Move to nearest ACTIVE or WARNING nozzle (prefer uncontested if multiple)
  const candidates = nozzles.filter((n) => n.phase === 'ACTIVE' || n.phase === 'WARNING');
  let target = candidates[0] ?? nozzles[Math.floor(nozzles.length / 2)];
  if (candidates.length > 1) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const hasRival = world.rivals.some(
        (r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - c.x) <= tuning.fountain.coreRadiusPx + 8,
      );
      const score = Math.abs(c.x - px) + (hasRival ? 90 : 0);
      if (score < bestScore) {
        bestScore = score;
        target = c;
      }
    }
  }

  const dx = target.x - px;
  return {
    moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
    bumpPressed,
    jumpPressed: false,
  };
}

function runBatch(stageId: StageId, bot: BotKind, count: number) {
  let wins = 0;
  let totalSec = 0;
  let totalRivalCtrl = 0;
  let totalPlayerCtrl = 0;
  const dtMs = tuning.loop.fixedDtMs;
  const dtSec = dtMs / 1000;

  for (let i = 0; i < count; i++) {
    const seed = 100000 + stageId * 10000 + i * 7919 + (bot === 'sitter' ? 1 : bot === 'normal' ? 2 : 3);
    const world = new PigeonFountainWorld('stage', stageId, tuning, seed);
    const mem: BotMemory = { surgeReactSec: 0, jumpWaitForPlug: false };

    while (!world.match.finished) {
      const input = decideBotInput(bot, world, mem, dtSec);
      world.step(input, dtMs);
    }

    if (didPlayerWinRace(world.match)) wins += 1;
    totalSec += world.match.elapsedSec;
    totalRivalCtrl += getMaxRivalControl(world.match);
    totalPlayerCtrl += world.match.playerControl;
  }

  return {
    stageId,
    bot,
    winRate: (wins / count) * 100,
    avgSec: totalSec / count,
    avgRivalCtrl: totalRivalCtrl / count,
    avgPlayerCtrl: totalPlayerCtrl / count,
  };
}

const MATCHES_PER_CELL = 300;
const stages: StageId[] = [1, 2, 3, 4];
const bots: BotKind[] = ['sitter', 'normal', 'expert'];

console.log(`Balance Simulation (${MATCHES_PER_CELL} matches per stage/bot):`);
console.log('| 关卡 | 机器人 | 胜率 | 平均时长 | 对手平均霸占条 | 我方平均霸占条 |');
console.log('| --- | --- | --- | --- | --- | --- |');

const stage1Results: Record<BotKind, ReturnType<typeof runBatch>> = {} as never;

for (const sid of stages) {
  for (const bot of bots) {
    const res = runBatch(sid, bot, MATCHES_PER_CELL);
    if (sid === 1) stage1Results[bot] = res;
    console.log(
      `| 第 ${sid} 关 | ${bot} | ${res.winRate.toFixed(1)}% | ${res.avgSec.toFixed(1)}s | ${res.avgRivalCtrl.toFixed(1)} | ${res.avgPlayerCtrl.toFixed(1)} |`,
    );
  }
}

const s1SitterOk = stage1Results.sitter.winRate >= 55 && stage1Results.sitter.winRate <= 75;
const s1NormalOk = stage1Results.normal.winRate >= 90;
const s1TimeOk =
  stage1Results.sitter.avgSec >= 30 &&
  stage1Results.sitter.avgSec <= 45 &&
  stage1Results.normal.avgSec >= 30 &&
  stage1Results.normal.avgSec <= 45;

console.log(
  `\nStage 1 Targets -> sitter(55-75%): ${s1SitterOk ? 'PASS' : 'FAIL'} (${stage1Results.sitter.winRate.toFixed(1)}%), ` +
    `normal(>=90%): ${s1NormalOk ? 'PASS' : 'FAIL'} (${stage1Results.normal.winRate.toFixed(1)}%), ` +
    `avgSec(30-45s): ${s1TimeOk ? 'PASS' : 'FAIL'} (sitter=${stage1Results.sitter.avgSec.toFixed(1)}s, normal=${stage1Results.normal.avgSec.toFixed(1)}s)`,
);
