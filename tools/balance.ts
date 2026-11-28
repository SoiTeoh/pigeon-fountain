import { tuning } from '../src/config/tuning';
import { getCampaignLevel } from '../src/content/levels/campaign';
import { mulberry32 } from '../src/core/rng';
import { didPlayerWinRace, getMaxRivalControl } from '../src/game/rules';
import { PigeonFountainWorld } from '../src/game/world';
import type { WorldStepInput } from '../src/game/worldTypes';
import type { StageId } from '../src/platform/storage';

type BotKind = 'sitter' | 'normal' | 'expert';

interface BotMemory {
  surgeReactSec: number;
  jumpWaitForPlug: boolean;
  decisionCooldownSec: number;
  moveOffsetPx: number;
  plugOffsetPx: number;
  mistakeTimerSec: number;
  mistakeTargetSlot: number | null;
}

function decideBotInput(
  bot: BotKind,
  world: PigeonFountainWorld,
  mem: BotMemory,
  dtSec: number,
  nextFloat: () => number,
): WorldStepInput {
  const px = world.player.x;
  const nozzles = world.match.nozzles;
  const reactDelaySec = bot === 'expert' ? 0.24 : 0.32;

  mem.decisionCooldownSec -= dtSec;
  if (mem.mistakeTimerSec > 0) {
    mem.mistakeTimerSec = Math.max(0, mem.mistakeTimerSec - dtSec);
  }
  if (mem.decisionCooldownSec <= 0) {
    mem.decisionCooldownSec = 0.35 + nextFloat() * 0.2;
    mem.moveOffsetPx = (nextFloat() * 2 - 1) * 10;
    mem.plugOffsetPx = (nextFloat() * 2 - 1) * 12;
    mem.mistakeTargetSlot = null;
    if (nextFloat() < 0.08) {
      if (nextFloat() < 0.5) {
        mem.mistakeTimerSec = 0.3;
      } else {
        mem.mistakeTargetSlot = Math.floor(nextFloat() * nozzles.length);
      }
    }
  }

  if (mem.mistakeTimerSec > 0 && world.plug.activeSlotIndex === null && !world.player.airborne) {
    return { moveDir: 0, bumpPressed: false, jumpPressed: false };
  }

  if (bot === 'sitter') {
    const target =
      (mem.mistakeTargetSlot !== null ? nozzles[mem.mistakeTargetSlot] : undefined) ??
      nozzles.find((n) => n.phase === 'ACTIVE') ??
      nozzles.find((n) => n.phase === 'WARNING') ??
      nozzles[Math.floor(nozzles.length / 2)];
    const dx = target.x + mem.moveOffsetPx - px;
    return {
      moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
      bumpPressed: false,
      jumpPressed: false,
    };
  }

  // Normal & Expert: flee SURGE_WARN after human reaction delay
  const danger = nozzles.find(
    (n) =>
      (n.phase === 'SURGE_WARN' || (n.angryWarnTimerSec ?? 0) > 0) &&
      Math.abs(px - n.x) <= tuning.fountain.coreRadiusPx + 14,
  );
  if (danger && !world.player.airborne) {
    mem.surgeReactSec += dtSec;
    if (mem.surgeReactSec >= reactDelaySec) {
      const fleeDir: -1 | 1 = px < danger.x ? -1 : px > danger.x ? 1 : danger.x >= 195 ? -1 : 1;
      return { moveDir: fleeDir, bumpPressed: false, jumpPressed: false };
    }
  } else {
    mem.surgeReactSec = 0;
  }

  // Expert: if holding plug, release after 0.65s to claim reward water & blast adjacent rival
  if (bot === 'expert' && world.plug.activeSlotIndex !== null) {
    if (world.plug.holdSec >= tuning.plug.adjacentSurgeThresholdSec + 0.05) {
      const plugged = nozzles[world.plug.activeSlotIndex];
      const leaveDir: -1 | 1 = plugged && px <= plugged.x ? 1 : -1;
      return { moveDir: leaveDir, bumpPressed: false, jumpPressed: false };
    }
    return { moveDir: 0, bumpPressed: false, jumpPressed: false };
  }

  // Expert: only plug when adjacent rival sits on ACTIVE >= 1.35s, no free ACTIVE/imminent WARNING exists, and net gain > ~1.5s cost
  if (bot === 'expert' && world.plug.cooldownSec <= 0) {
    if (world.player.airborne && mem.jumpWaitForPlug && world.player.vy > -220) {
      mem.jumpWaitForPlug = false;
      return { moveDir: 0, bumpPressed: false, jumpPressed: false, slamPressed: true };
    }
    const freeActiveOrSoon = nozzles.some(
      (n) =>
        (n.phase === 'ACTIVE' || (n.phase === 'WARNING' && n.phaseTimerSec <= 0.65)) &&
        !world.rivals.some(
          (r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - n.x) <= tuning.fountain.coreRadiusPx + 8,
        ),
    );
    const hasRewardBoostNow = nozzles.some(
      (n) => n.phase === 'ACTIVE' && n.plugRewardOwner === 'player' && (n.plugRewardTimerSec ?? 0) > 0,
    );
    if (
      !world.stage.lowGravity &&
      !freeActiveOrSoon &&
      !hasRewardBoostNow &&
      !world.player.airborne &&
      world.player.jumpCooldownSec <= 0
    ) {
      const rivalActive = nozzles.find(
        (n) =>
          n.phase === 'ACTIVE' &&
          n.phaseTimerSec >= 1.8 &&
          world.rivals.some((r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - n.x) <= tuning.fountain.coreRadiusPx + 6),
      );
      if (rivalActive) {
        const plugRange = 22;
        const plugSpot = nozzles.find(
          (n) =>
            n.phase === 'IDLE' &&
            Math.abs(n.slotIndex - rivalActive.slotIndex) === 1 &&
            Math.abs(n.x - px) <= plugRange,
        );
        if (plugSpot) {
          const targetX = plugSpot.x + mem.plugOffsetPx * 0.2;
          const dx = targetX - px;
          if (Math.abs(dx) <= 10) {
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
  let target =
    (mem.mistakeTargetSlot !== null ? nozzles[mem.mistakeTargetSlot] : undefined) ??
    candidates[0] ??
    nozzles[Math.floor(nozzles.length / 2)];
  if (mem.mistakeTargetSlot === null && candidates.length > 1) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const hasRival = world.rivals.some(
        (r) => !r.airborne && r.respawnTimerSec <= 0 && Math.abs(r.x - c.x) <= tuning.fountain.coreRadiusPx + 8,
      );
      const rewardBoost = c.plugRewardOwner === 'player' && (c.plugRewardTimerSec ?? 0) > 0 ? -70 : 0;
      const score = Math.abs(c.x - px) + (hasRival ? 90 : 0) + rewardBoost;
      if (score < bestScore) {
        bestScore = score;
        target = c;
      }
    }
  }

  const dx = target.x + mem.moveOffsetPx - px;
  return {
    moveDir: Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : 0,
    bumpPressed,
    jumpPressed: false,
  };
}

function runBatch(stageId: StageId, bot: BotKind, count: number, campaignIdx?: number) {
  let wins = 0;
  let reached100 = 0;
  let totalPlugs = 0;
  let totalSec = 0;
  let totalRivalCtrl = 0;
  let totalPlayerCtrl = 0;
  const dtMs = tuning.loop.fixedDtMs;
  const dtSec = dtMs / 1000;

  for (let i = 0; i < count; i++) {
    const seed = 100000 + (campaignIdx ?? stageId) * 10000 + i * 7919 + (bot === 'sitter' ? 1 : bot === 'normal' ? 2 : 3);
    const botRng = mulberry32(seed ^ 0x9e3779b9);
    const world = new PigeonFountainWorld('stage', stageId, tuning, seed, campaignIdx);
    const mem: BotMemory = {
      surgeReactSec: 0,
      jumpWaitForPlug: false,
      decisionCooldownSec: 0,
      moveOffsetPx: 0,
      plugOffsetPx: 0,
      mistakeTimerSec: 0,
      mistakeTargetSlot: null,
    };

    while (!world.match.finished) {
      const input = decideBotInput(bot, world, mem, dtSec, botRng);
      const ev = world.step(input, dtMs);
      if (ev.plugStarted) totalPlugs += 1;
    }

    if (didPlayerWinRace(world.match)) wins += 1;
    if (world.match.endReason === 'player_full' || world.match.endReason === 'rival_full') {
      reached100 += 1;
    }
    totalSec += world.match.elapsedSec;
    totalRivalCtrl += getMaxRivalControl(world.match);
    totalPlayerCtrl += world.match.playerControl;
  }

  return {
    stageId,
    bot,
    winRate: (wins / count) * 100,
    reached100Rate: (reached100 / count) * 100,
    avgPlugs: totalPlugs / count,
    avgSec: totalSec / count,
    avgRivalCtrl: totalRivalCtrl / count,
    avgPlayerCtrl: totalPlayerCtrl / count,
  };
}

const MATCHES_PER_CELL = 150;
const stages: StageId[] = [1, 2, 3, 4];
const bots: BotKind[] = ['sitter', 'normal', 'expert'];

console.log(`Balance Simulation (${MATCHES_PER_CELL} matches per stage/bot):`);
console.log('| 关卡 | 机器人 | 胜率 | 平均时长 | 达到 100 结束的比例 | 平均堵泉次数 | 对手平均霸占条 | 我方平均霸占条 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');

const byStage: Record<StageId, Record<BotKind, ReturnType<typeof runBatch>>> = {
  1: {} as never,
  2: {} as never,
  3: {} as never,
  4: {} as never,
};

for (const sid of stages) {
  for (const bot of bots) {
    const res = runBatch(sid, bot, MATCHES_PER_CELL);
    byStage[sid][bot] = res;
    console.log(
      `| 第 ${sid} 关 | ${bot} | ${res.winRate.toFixed(1)}% | ${res.avgSec.toFixed(1)}s | ${res.reached100Rate.toFixed(1)}% | ${res.avgPlugs.toFixed(2)} | ${res.avgRivalCtrl.toFixed(1)} | ${res.avgPlayerCtrl.toFixed(1)} |`,
    );
  }
}

const s1 = byStage[1];
const s2 = byStage[2];
const s3 = byStage[3];
const s4 = byStage[4];
console.log('\nLegacy Target Checks:');
console.log(`Stage 1: sitter(60-75%)=${s1.sitter.winRate.toFixed(1)}%, normal(>=95%)=${s1.normal.winRate.toFixed(1)}%, normalSec(30-50s)=${s1.normal.avgSec.toFixed(1)}s`);
console.log(`Stage 2: sitter(40-60%)=${s2.sitter.winRate.toFixed(1)}%, normal(>=90%)=${s2.normal.winRate.toFixed(1)}%, expert>=normal=${s2.expert.winRate.toFixed(1)}%>=${s2.normal.winRate.toFixed(1)}%, normalSec(30-50s)=${s2.normal.avgSec.toFixed(1)}s`);
console.log(`Stage 3: sitter(20-40%)=${s3.sitter.winRate.toFixed(1)}%, normal(75-90%)=${s3.normal.winRate.toFixed(1)}%, expert>=normal+5=${s3.expert.winRate.toFixed(1)}%>=${(s3.normal.winRate + 5).toFixed(1)}%, normalSec(30-50s)=${s3.normal.avgSec.toFixed(1)}s`);
console.log(`Stage 4: normal(60-80%)=${s4.normal.winRate.toFixed(1)}%, expert>=normal+10=${s4.expert.winRate.toFixed(1)}%>=${(s4.normal.winRate + 10).toFixed(1)}%, reached100=${s4.normal.reached100Rate.toFixed(1)}%, normalSec=${s4.normal.avgSec.toFixed(1)}s`);

console.log('\nCampaign Sawtooth Checks (100 matches per cell):');
console.log('| 关卡 | normal胜率 | expert胜率 | sitter胜率 | normal时长 | expert堵泉 |');
console.log('| --- | --- | --- | --- | --- | --- |');
const sampleCampaignIndices = [1, 3, 6, 8, 9, 13, 16, 18, 22, 24];
for (const idx of sampleCampaignIndices) {
  const lvl = getCampaignLevel(idx);
  const sit = runBatch(1, 'sitter', 100, idx);
  const norm = runBatch(1, 'normal', 100, idx);
  const exp = runBatch(1, 'expert', 100, idx);
  console.log(
    `| ${lvl.shortName} | ${norm.winRate.toFixed(1)}% | ${exp.winRate.toFixed(1)}% | ${sit.winRate.toFixed(1)}% | ${norm.avgSec.toFixed(1)}s | ${exp.avgPlugs.toFixed(2)} |`,
  );
}
