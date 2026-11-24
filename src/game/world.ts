import { tuning, type StageConfig, type Tuning } from '../config/tuning';
import { generateRandomSeed, hashState, mulberry32, normalizeSeed } from '../core/rng';
import type { GameMode, StageId } from '../platform/storage';
import { formatPluggedByRival, formatPluggedRival } from '../content/strings.zh';
import { createInitialPlugState, findPluggableNozzle, startPlugOnNozzle, stepPlugState, type PlugState } from './plug';
import { clamp, createInitialMatchState, createInitialProps, evaluateButtSlam, getStageForMatch, stepMatchState, type MatchState, type Occupant, type PropState } from './rules';
import { pushFloatingText, spawnParticleBurst, stepBirdSquashAndExpression, stepWorldVisualFx } from './worldFx';
import { spawnAmbientFountainParticles, stepCornAndPickups } from './worldPickups';
import { launchRivalFromFountain, performPlayerBump, resolveRivalInteractions, stepRivalsMovement } from './worldRivals';
import { createEmptyWorldEvents, createRivalBirds, type BonusPickup, type FloatingText, type Particle, type PigeonBody, type PlayerExpression, type PlugCallout, type RivalBird, type ShockwaveRing, type WorldStepEvents, type WorldStepInput } from './worldTypes';

export * from './worldTypes';

export class PigeonFountainWorld {
  readonly t: Tuning;
  readonly stage: StageConfig;
  readonly seed: number;
  match: MatchState;
  props: PropState[];
  plug: PlugState = createInitialPlugState();
  player: PigeonBody & {
    bumpCooldownSec: number;
    bumpAnimSec: number;
    jumpCooldownSec: number;
    smugTimerSec: number;
    isJumping: boolean;
    expression: PlayerExpression;
  };
  rivals: RivalBird[];
  plugCallout: PlugCallout | null = null;
  occupant: Occupant = 'none';
  occupiedSlotIndex: number | null = null;
  combo: 1 | 2 | 3 = 1;
  particles: Particle[] = [];
  floats: FloatingText[] = [];
  shockwaves: ShockwaveRing[] = [];
  pickups: BonusPickup[] = [];
  shakeMag = 0;
  hitStopTimerSec = 0;
  auntieNoticeTimerSec = 0;

  private readonly simRng: () => number;
  private readonly fxRng: () => number;
  private bubbleSpawnAcc = 0;
  private soakFxAcc = 0;
  private cornSpawnTimerSec = 6.5;
  private nextPickupIdRef = { value: 1 };

  constructor(
    mode: GameMode = 'stage',
    stageId: StageId = 1,
    t: Tuning = tuning,
    seed?: number,
  ) {
    this.t = t;
    this.seed = seed !== undefined ? normalizeSeed(seed) : generateRandomSeed();
    this.simRng = mulberry32(this.seed);
    this.fxRng = mulberry32(this.seed ^ 0xa5a5a5a5);
    this.stage = getStageForMatch(mode, stageId);
    this.match = createInitialMatchState(mode, stageId, t);
    this.props = createInitialProps(this.stage);
    this.player = {
      x: 118,
      y: t.scene.groundY,
      vx: 0,
      vy: 0,
      facing: 1,
      airborne: false,
      spinRad: 0,
      waddlePhase: 0,
      squashX: 1,
      squashY: 1,
      bumpCooldownSec: 0,
      bumpAnimSec: 0,
      jumpCooldownSec: 0,
      smugTimerSec: 0,
      isJumping: false,
      expression: 'smug',
    };
    this.rivals = createRivalBirds(this.stage, t);
  }

  step(input: WorldStepInput, dtMs: number): WorldStepEvents {
    const dtSec = Math.min(this.t.loop.maxFrameDtMs, Math.max(0, dtMs)) / 1000;

    if (this.hitStopTimerSec > 0) {
      this.hitStopTimerSec = Math.max(0, this.hitStopTimerSec - dtSec);
      return createEmptyWorldEvents(this.occupant, this.combo);
    }

    stepWorldVisualFx(this.particles, this.floats, this.shockwaves, dtSec);
    this.shakeMag = Math.max(0, this.shakeMag - 26 * dtSec);
    this.auntieNoticeTimerSec = Math.max(0, this.auntieNoticeTimerSec - dtSec);
    if (this.plugCallout) {
      this.plugCallout.timerSec -= dtSec;
      if (this.plugCallout.timerSec <= 0) this.plugCallout = null;
    }

    if (this.match.finished) {
      return createEmptyWorldEvents(this.occupant, this.combo);
    }

    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      if (!prop.intact && this.stage.propRespawnSec !== null && prop.respawnTimerSec > 0) {
        const nextRespawn = prop.respawnTimerSec - dtSec;
        if (nextRespawn <= 0) {
          this.props[i] = { ...prop, intact: true, respawnTimerSec: 0 };
          spawnParticleBurst(this.particles, this.fxRng, prop.x, prop.y, 8, 'spark', '#38bdf8', 40, 110);
        } else {
          this.props[i] = { ...prop, respawnTimerSec: nextRespawn };
        }
      }
    }

    this.player.bumpCooldownSec = Math.max(0, this.player.bumpCooldownSec - dtSec);
    this.player.bumpAnimSec = Math.max(0, this.player.bumpAnimSec - dtSec);
    this.player.jumpCooldownSec = Math.max(0, this.player.jumpCooldownSec - dtSec);
    this.player.smugTimerSec = Math.max(0, this.player.smugTimerSec - dtSec);

    // Jump ("小跳")
    let jumped = false;
    if (input.jumpPressed && this.player.jumpCooldownSec <= 0 && !this.player.airborne) {
      jumped = true;
      this.player.jumpCooldownSec = this.t.pigeon.jumpCooldownSec;
      this.player.airborne = true;
      this.player.isJumping = true;
      this.player.vy = this.t.pigeon.jumpSpeed;
      this.player.squashX = 0.82;
      this.player.squashY = 1.24;
      spawnParticleBurst(this.particles, this.fxRng, this.player.x, this.t.scene.groundY - 4, 4, 'water', '#e0f2fe', 40, 95);
    }

    // Air fast-drop slam ("下墩")
    if (input.slamPressed && this.player.airborne) {
      this.player.isJumping = true;
      this.player.vy = Math.max(this.player.vy, 540);
      this.player.squashX = 0.86;
      this.player.squashY = 1.2;
    }

    // Resolve horizontal movement: proportional joystick / moveDir or legacy moveTargetX
    let moveDir: -1 | 0 | 1 = input.moveDir;
    const moveScale = clamp(input.moveScale ?? 1, 0, 1);
    if (
      moveDir === 0 &&
      input.moveTargetX !== undefined &&
      input.moveTargetX !== null
    ) {
      const dx = input.moveTargetX - this.player.x;
      if (Math.abs(dx) > 6) {
        moveDir = dx > 0 ? 1 : -1;
      }
    }

    if (moveDir !== 0 && moveScale > 0) {
      this.player.facing = moveDir;
      // Clear opposing momentum immediately on direction reversal so turning is instantaneous
      if (this.player.vx * moveDir < 0) {
        this.player.vx = 0;
      }
      if (input.directControl && !this.player.airborne && this.player.bumpAnimSec <= 0) {
        this.player.vx = moveDir * this.t.pigeon.playerMaxSpeed * moveScale;
      } else {
        const airControl = this.player.airborne ? 0.85 : 1;
        this.player.vx += moveDir * this.t.pigeon.playerMoveAccel * 4 * moveScale * airControl * dtSec;
      }
      if (!this.player.airborne) {
        this.player.waddlePhase += dtSec * (10 + 6 * moveScale);
      }
    } else if (!this.player.airborne) {
      if (input.stopOnRelease && this.player.bumpAnimSec <= 0) {
        this.player.vx = 0;
      } else {
        const drag =
          this.occupant === 'player' ? this.t.pigeon.waterDrag : this.t.pigeon.groundDrag;
        this.player.vx -= this.player.vx * Math.min(1, drag * dtSec);
      }
    }

    if (this.player.bumpAnimSec <= 0 && (!this.player.airborne || this.player.isJumping)) {
      const maxSpd =
        moveDir !== 0 ? this.t.pigeon.playerMaxSpeed * moveScale : this.t.pigeon.playerMaxSpeed;
      this.player.vx = clamp(this.player.vx, -maxSpd, maxSpd);
    }

    if (this.player.airborne) {
      this.player.vy += this.t.pigeon.gravity * dtSec;
      if (!this.player.isJumping) {
        this.player.spinRad += 14 * dtSec;
      }
    }

    const aiMoveRes = stepRivalsMovement(
      this.rivals,
      this.player,
      this.match,
      this.plug.activeSlotIndex,
      this.particles,
      this.floats,
      this.fxRng,
      dtSec,
      this.t,
    );
    const redCrestCharged = aiMoveRes.redCrestCharged;
    if (aiMoveRes.rivalBumpedPlayer) {
      this.shakeMag = Math.max(this.shakeMag, 4);
    }

    // Apply lateral water push on ACTIVE nozzles
    for (const nozzle of this.match.nozzles) {
      if (nozzle.phase !== 'ACTIVE') continue;
      const pushAccel = nozzle.lateralDir * nozzle.lateralStrength;
      if (
        !this.player.airborne &&
        this.occupiedSlotIndex === nozzle.slotIndex &&
        this.occupant === 'player'
      ) {
        this.player.vx += pushAccel * dtSec;
      }
      for (const r of this.rivals) {
        if (
          !r.airborne &&
          r.respawnTimerSec <= 0 &&
          r.stunTimerSec <= 0 &&
          Math.abs(r.x - nozzle.x) <= this.t.fountain.coreRadiusPx
        ) {
          r.vx += pushAccel * 0.72 * dtSec;
        }
      }
    }

    // Handle "肥臀猛顶" (Butt Bump)
    let bumpedHit = false;
    let bumpedWhiff = false;
    if (input.bumpPressed && this.player.bumpCooldownSec <= 0 && !this.player.airborne) {
      const bumpRes = performPlayerBump(
        this.player,
        this.rivals,
        this.particles,
        this.floats,
        this.fxRng,
        this.t,
      );
      bumpedHit = bumpRes.bumpedHit;
      bumpedWhiff = bumpRes.bumpedWhiff;
      this.shakeMag = Math.max(this.shakeMag, bumpRes.shakeMagDelta);
    }

    // Integrate positions
    this.player.x += this.player.vx * dtSec;
    this.player.y += this.player.vy * dtSec;

    for (const r of this.rivals) {
      if (r.respawnTimerSec <= 0) {
        r.x += r.vx * dtSec;
        r.y += r.vy * dtSec;
      }
    }

    const rivalRes = resolveRivalInteractions(
      this.player,
      this.rivals,
      this.props,
      this.pickups,
      this.stage,
      this.match,
      this.particles,
      this.floats,
      this.fxRng,
      this.nextPickupIdRef,
      dtSec,
      this.t,
    );
    this.match = rivalRes.match;
    this.shakeMag = Math.max(this.shakeMag, rivalRes.shakeMagDelta);
    if (rivalRes.hitStopSec > 0) this.hitStopTimerSec = rivalRes.hitStopSec;

    // Clamp player & check jump landing ("铁臀墩坐" or "堵泉")
    let slammed = false;
    let plugStarted = false;
    if (!this.player.airborne) {
      this.player.x = clamp(this.player.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
    } else if (this.player.y >= this.t.scene.groundY && this.player.vy > 0) {
      const slam = evaluateButtSlam(
        this.player.isJumping,
        this.player.vy,
        this.player.x,
        this.match.nozzles,
        this.t,
      );
      const plugTarget = !slam.triggered
        ? findPluggableNozzle(
            this.player.x,
            this.player.isJumping,
            this.player.vy,
            this.plug.cooldownSec,
            this.match.nozzles,
            this.t,
          )
        : null;

      this.player.y = this.t.scene.groundY;
      this.player.vy = 0;
      this.player.vx *= 0.35;
      this.player.airborne = false;
      this.player.isJumping = false;
      this.player.spinRad = 0;
      this.player.x = clamp(this.player.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);

      if (slam.triggered) {
        slammed = true;
        this.match = {
          ...this.match,
          score: this.match.score + slam.bonusScore,
          slamCount: this.match.slamCount + 1,
        };
        this.player.squashX = 1.5;
        this.player.squashY = 0.56;
        this.shakeMag = Math.max(this.shakeMag, 6.5);
        spawnParticleBurst(this.particles, this.fxRng, this.player.x, this.t.scene.groundY - 8, 16, 'water', '#bae6fd', 90, 240);
        spawnParticleBurst(this.particles, this.fxRng, this.player.x, this.t.scene.groundY - 12, 8, 'spark', '#38bdf8', 70, 175);
        this.shockwaves.push({
          x: this.player.x,
          y: this.t.scene.groundY - 6,
          r: 12,
          maxR: this.t.pigeon.slamShockwaveRadius,
          life: 0.32,
          maxLife: 0.32,
          color: '#38bdf8',
        });
        pushFloatingText(this.floats, this.t, this.player.x, this.t.scene.groundY - 72, `铁臀墩坐！+${slam.bonusScore}`, '#38bdf8', 1.18);

        for (const r of this.rivals) {
          if (r.airborne || r.respawnTimerSec > 0) continue;
          const dist = Math.abs(r.x - this.player.x);
          if (dist <= this.t.pigeon.slamShockwaveRadius) {
            const pushDir: -1 | 1 = r.x >= this.player.x ? 1 : -1;
            r.vx = pushDir * this.t.pigeon.slamKnockbackSpeed;
            r.stunTimerSec = Math.max(r.stunTimerSec, this.t.pigeon.slamStunSec);
            r.squashX = 0.84;
            r.squashY = 1.18;
          }
        }
      } else if (plugTarget) {
        plugStarted = true;
        const started = startPlugOnNozzle(plugTarget.slotIndex, this.match.nozzles);
        this.plug = started.plug;
        this.match = { ...this.match, nozzles: started.nozzles };
        this.player.x = plugTarget.x;
        this.player.vx = 0;
        this.player.squashX = 1.35;
        this.player.squashY = 0.65;
        pushFloatingText(this.floats, this.t, plugTarget.x, this.t.scene.groundY - 66, '堵住憋压中...', '#fde047', 1.05);
      }
    } else {
      this.player.x = clamp(this.player.x, 20, this.t.view.width - 20);
    }

    // Clamp grounded rivals or handle AI plug-landing / AI plug hold / despawn launched rivals
    for (const r of this.rivals) {
      if (r.respawnTimerSec > 0) continue;
      if (!r.airborne) {
        r.x = clamp(r.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
        if (r.plugSlotIndex !== null) {
          const slot = this.match.nozzles[r.plugSlotIndex];
          if (!slot || slot.phase !== 'PLUGGED') {
            r.plugSlotIndex = null;
            r.plugHoldSec = 0;
            r.plugCooldownSec = this.t.plug.cooldownSec;
          } else {
            r.x = slot.x;
            r.vx = 0;
            r.plugHoldSec += dtSec;
            const playerOnAdj = this.match.nozzles.some(
              (n) => Math.abs(n.slotIndex - slot.slotIndex) === 1 && Math.abs(this.player.x - n.x) <= this.t.fountain.coreRadiusPx + 6,
            );
            const shouldRelease =
              r.plugHoldSec >= this.t.plug.aiPlugMinHoldSec &&
              (playerOnAdj || r.plugHoldSec >= 1.2);
            if (shouldRelease) {
              const adjIndices = [slot.slotIndex - 1, slot.slotIndex + 1].filter(
                (idx) => idx >= 0 && idx < this.match.nozzles.length,
              );
              const nextNozzles = this.match.nozzles.map((n) =>
                n.slotIndex === slot.slotIndex
                  ? { ...n, phase: 'IDLE' as const, phaseTimerSec: 0 }
                  : adjIndices.includes(n.slotIndex)
                    ? { ...n, phase: 'SURGE' as const, phaseTimerSec: this.t.fountain.surgeDurationSec, lateralDir: 0 as const, lateralStrength: 0 }
                    : n,
              );
              this.match = { ...this.match, nozzles: nextNozzles };
              r.plugSlotIndex = null;
              r.plugHoldSec = 0;
              r.plugCooldownSec = this.t.plug.cooldownSec;
              if (
                !this.player.airborne &&
                adjIndices.some((idx) => Math.abs(this.player.x - nextNozzles[idx].x) <= this.t.fountain.coreRadiusPx + 4)
              ) {
                this.player.airborne = true;
                this.player.isJumping = false;
                this.player.vy = -520;
                this.shakeMag = Math.max(this.shakeMag, 9);
                r.smugTimerSec = 0.6;
                this.plugCallout = {
                  text: formatPluggedByRival(r.archetype),
                  avatarKind: r.archetype,
                  timerSec: 1.6,
                };
                this.match = {
                  ...this.match,
                  playerControl: Math.max(0, this.match.playerControl - this.t.control.surgePenalty),
                  playerSurgeHits: this.match.playerSurgeHits + 1,
                };
              }
            }
          }
        }
      } else if (r.isJumpingToPlug && r.y >= this.t.scene.groundY && r.vy > 0) {
        r.y = this.t.scene.groundY;
        r.vy = 0;
        r.vx = 0;
        r.airborne = false;
        r.isJumpingToPlug = false;
        r.spinRad = 0;
        const hitSlot = this.match.nozzles.find(
          (n) => (n.phase === 'IDLE' || n.phase === 'WARNING') && Math.abs(r.x - n.x) <= this.t.plug.coreRadiusPx,
        );
        if (hitSlot) {
          const nextNozzles = this.match.nozzles.map((n) =>
            n.slotIndex === hitSlot.slotIndex
              ? { ...n, phase: 'PLUGGED' as const, phaseTimerSec: 0, lateralDir: 0 as const, lateralStrength: 0 }
              : n,
          );
          this.match = { ...this.match, nozzles: nextNozzles };
          r.plugSlotIndex = hitSlot.slotIndex;
          r.plugHoldSec = 0;
          r.x = hitSlot.x;
        }
      } else if (
        r.y > this.t.view.height + 60 ||
        r.y < -180 ||
        r.x < -60 ||
        r.x > this.t.view.width + 60
      ) {
        r.airborne = false;
        r.isJumpingToPlug = false;
        r.launchedByFountain = false;
        r.plugSlotIndex = null;
        r.plugHoldSec = 0;
        r.respawnTimerSec = this.t.pigeon.aiRespawnSec;
      }
    }

    // Auntie corn & pickups
    const cornRes = stepCornAndPickups(
      this.pickups,
      this.player,
      this.rivals,
      this.stage,
      this.match,
      this.particles,
      this.floats,
      this.simRng,
      this.fxRng,
      this.nextPickupIdRef,
      this.cornSpawnTimerSec,
      dtSec,
      this.t,
    );
    const cornPickedUp = cornRes.cornPickedUp;
    this.cornSpawnTimerSec = cornRes.cornSpawnTimerSec;
    if (cornRes.auntieNoticeDeltaSec > 0) {
      this.auntieNoticeTimerSec = cornRes.auntieNoticeDeltaSec;
    }
    if (cornRes.scoreBonus > 0) {
      this.match = { ...this.match, score: this.match.score + cornRes.scoreBonus };
    }

    // Step plug state & trigger adjacent surges if released or big ult!
    const plugRes = stepPlugState(
      this.plug,
      this.match.nozzles,
      this.player.x,
      this.player.airborne,
      dtSec,
      this.t,
    );
    this.plug = plugRes.nextPlug;
    let nextMatchState: MatchState = { ...this.match, nozzles: plugRes.nextNozzles };
    let aiHitByPlugSurge = false;

    if (plugRes.bigUltTriggered) {
      const nextCtrl = clamp(
        nextMatchState.playerControl + plugRes.controlBonus,
        0,
        this.t.control.maxControl,
      );
      nextMatchState = {
        ...nextMatchState,
        playerControl: nextCtrl,
        finished: nextCtrl >= this.t.control.maxControl ? true : nextMatchState.finished,
        endReason: nextCtrl >= this.t.control.maxControl ? 'player_full' : nextMatchState.endReason,
      };
      this.player.airborne = true;
      this.player.isJumping = true;
      this.player.vy = this.t.plug.bigUltLaunchVy;
      this.player.squashX = 0.78;
      this.player.squashY = 1.32;
      this.shakeMag = Math.max(this.shakeMag, 10);
      spawnParticleBurst(this.particles, this.fxRng, this.player.x, this.t.scene.groundY - 12, 18, 'water', '#38bdf8', 110, 280);
      pushFloatingText(this.floats, this.t, this.player.x, this.t.scene.groundY - 82, '坏到家了！', '#fde047', 1.32);
    }

    if (plugRes.triggeredSurgeSlots.length > 0) {
      const updatedRivalControls = nextMatchState.rivalControls.map((rc) => ({ ...rc }));
      let sabotageCount = nextMatchState.sabotageCount;
      for (const slotIdx of plugRes.triggeredSurgeSlots) {
        const slot = nextMatchState.nozzles[slotIdx];
        if (!slot) continue;
        for (const rival of this.rivals) {
          if (
            !rival.airborne &&
            rival.respawnTimerSec <= 0 &&
            Math.abs(rival.x - slot.x) <= this.t.fountain.coreRadiusPx + 6
          ) {
            aiHitByPlugSurge = true;
            sabotageCount += 1;
            this.player.smugTimerSec = 0.6;
            this.plugCallout = {
              text: formatPluggedRival(rival.archetype),
              avatarKind: rival.archetype,
              timerSec: 1.6,
            };
            const rc = updatedRivalControls.find((c) => c.id === rival.id);
            if (rc) rc.control = Math.max(0, rc.control - this.t.control.surgePenalty);
            this.shakeMag = Math.max(
              this.shakeMag,
              launchRivalFromFountain(
                rival,
                slot.x,
                slot.tiltDeg,
                false,
                this.props,
                this.particles,
                this.floats,
                this.fxRng,
                this.t,
              ),
            );
          }
        }
      }
      nextMatchState = {
        ...nextMatchState,
        rivalControls: updatedRivalControls,
        sabotageCount,
      };
    }

    // Step pure rules
    const ruleRes = stepMatchState(
      nextMatchState,
      {
        dtSec,
        playerX: this.player.x,
        playerAirborne: this.player.airborne,
        rivals: this.rivals.map((r) => ({
          id: r.id,
          x: r.respawnTimerSec > 0 ? -999 : r.x,
          airborne: r.airborne || r.respawnTimerSec > 0,
          stunned: r.stunTimerSec > 0,
        })),
      },
      this.t,
      this.simRng,
    );
    this.match = ruleRes.state;
    this.occupant = ruleRes.occupant;
    this.occupiedSlotIndex = ruleRes.occupiedSlotIndex;
    this.combo = ruleRes.combo;

    const playerHitBySurge = ruleRes.playerHitBySurgeSlot !== null;
    if (ruleRes.playerHitBySurgeSlot !== null) {
      const nozzle = this.match.nozzles[ruleRes.playerHitBySurgeSlot];
      this.player.airborne = true;
      this.player.isJumping = false;
      this.player.vy = -560;
      this.player.vx = (this.player.x < (nozzle?.x ?? 195) ? -1 : 1) * 105;
      this.shakeMag = Math.max(this.shakeMag, 9);
      spawnParticleBurst(this.particles, this.fxRng, this.player.x, this.t.scene.groundY - 20, 10, 'feather_dark', '#334155', 70, 210);
      pushFloatingText(this.floats, this.t, this.player.x, this.t.scene.groundY - 76, `哎呀！-${this.t.control.surgePenalty}`, '#ef4444', 1.1);
    }

    const aiHitBySurge = aiHitByPlugSurge || ruleRes.rivalsHitBySurge.length > 0;
    for (const hit of ruleRes.rivalsHitBySurge) {
      const rival = this.rivals.find((r) => r.id === hit.rivalId);
      const nozzle = this.match.nozzles[hit.slotIndex];
      if (rival && nozzle) {
        this.shakeMag = Math.max(
          this.shakeMag,
          launchRivalFromFountain(rival, nozzle.x, nozzle.tiltDeg, false, this.props, this.particles, this.floats, this.fxRng, this.t),
        );
      }
    }

    // Water lift, squash-stretch & player expression
    stepBirdSquashAndExpression(
      this.player,
      this.rivals,
      this.match,
      this.plug,
      this.occupant,
      this.occupiedSlotIndex,
      dtSec,
      this.t,
    );

    // Ambient fountain bubbles & plug pressure particles
    const fxAcc = spawnAmbientFountainParticles(
      this.particles,
      this.match,
      this.plug,
      this.player,
      this.occupant,
      this.fxRng,
      this.bubbleSpawnAcc,
      this.soakFxAcc,
      dtSec,
      this.t,
    );
    this.bubbleSpawnAcc = fxAcc.bubbleSpawnAcc;
    this.soakFxAcc = fxAcc.soakFxAcc;

    return {
      bumpedHit,
      bumpedWhiff,
      jumped,
      slammed,
      propSmashed: rivalRes.propSmashed,
      cornPickedUp,
      redCrestCharged,
      enteredPhases: ruleRes.enteredPhases,
      playerHitBySurge,
      aiHitBySurge,
      angledCannonLaunch: rivalRes.angledCannonLaunch,
      plugStarted,
      plugBigUlt: plugRes.bigUltTriggered,
      occupant: this.occupant,
      combo: this.combo,
    };
  }

  getStateHash(): string {
    return hashState({
      seed: this.seed,
      match: this.match,
      plug: this.plug,
      player: this.player,
      rivals: this.rivals,
      props: this.props,
      pickups: this.pickups,
      occupant: this.occupant,
      occupiedSlotIndex: this.occupiedSlotIndex,
      combo: this.combo,
      cornSpawnTimerSec: this.cornSpawnTimerSec,
      nextPickupId: this.nextPickupIdRef.value,
    });
  }
}
