import {
  tuning,
  type AiArchetype,
  type PropKind,
  type StageConfig,
  type Tuning,
} from '../config/tuning';
import type { GameMode, StageId } from '../platform/storage';
import {
  checkPropHit,
  clamp,
  computeParabolicLaunchVelocity,
  createInitialMatchState,
  createInitialProps,
  decideAiMove,
  evaluateButtSlam,
  getStageForMatch,
  stepMatchState,
  type AiIntent,
  type FountainPhase,
  type MatchState,
  type Occupant,
  type PropState,
  type RedCrestPhase,
} from './rules';

export type PlayerExpression = 'smug' | 'bliss' | 'panic' | 'bump' | 'launched' | 'jump';

export interface PigeonBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  airborne: boolean;
  spinRad: number;
  waddlePhase: number;
  squashX: number;
  squashY: number;
}

export interface RivalBird extends PigeonBody {
  id: number;
  archetype: AiArchetype;
  radius: number;
  stunTimerSec: number;
  respawnTimerSec: number;
  surgeReactElapsedSec: number;
  intent: AiIntent;
  launchedByFountain: boolean;
  redCrestState: RedCrestPhase;
  redCrestTimerSec: number;
  redCrestCooldownSec: number;
  redCrestDir: -1 | 1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind:
    | 'water'
    | 'feather_white'
    | 'feather_dark'
    | 'feather_sparrow'
    | 'feather_red'
    | 'heart'
    | 'spark'
    | 'cup'
    | 'seed'
    | 'balloon'
    | 'coffee';
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface BonusPickup {
  id: number;
  kind: 'corn' | 'melon_spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  ttlSec: number;
}

export interface WorldStepInput {
  readonly moveDir: -1 | 0 | 1;
  readonly bumpPressed: boolean;
  readonly jumpPressed: boolean;
}

export interface WorldStepEvents {
  readonly bumpedHit: boolean;
  readonly bumpedWhiff: boolean;
  readonly jumped: boolean;
  readonly slammed: boolean;
  readonly propSmashed: boolean;
  readonly cornPickedUp: boolean;
  readonly redCrestCharged: boolean;
  readonly enteredPhases: readonly FountainPhase[];
  readonly playerHitBySurge: boolean;
  readonly aiHitBySurge: boolean;
  readonly angledCannonLaunch: boolean;
  readonly occupant: Occupant;
  readonly combo: 1 | 2 | 3;
}

function createRivalBirds(stage: StageConfig, t: Tuning): RivalBird[] {
  const count = stage.rivals.length;
  return stage.rivals.map((archetype, idx) => {
    const spreadStart = 215;
    const spreadStep = count > 1 ? 105 / (count - 1) : 0;
    const x = clamp(spreadStart + idx * spreadStep, t.scene.stageMinX + 10, t.scene.stageMaxX - 10);
    return {
      id: idx,
      archetype,
      radius: archetype === 'sparrow' ? t.pigeon.sparrowRadius : t.pigeon.radius,
      x,
      y: t.scene.groundY,
      vx: 0,
      vy: 0,
      facing: -1,
      airborne: false,
      spinRad: 0,
      waddlePhase: idx * 0.9,
      squashX: 1,
      squashY: 1,
      stunTimerSec: 0,
      respawnTimerSec: 0,
      surgeReactElapsedSec: 0,
      intent: 'roam',
      launchedByFountain: false,
      redCrestState: 'idle',
      redCrestTimerSec: 0,
      redCrestCooldownSec: 1.5 + idx * 0.6,
      redCrestDir: -1,
    };
  });
}

export class PigeonFountainWorld {
  readonly t: Tuning;
  readonly stage: StageConfig;
  match: MatchState;
  props: PropState[];
  player: PigeonBody & {
    bumpCooldownSec: number;
    bumpAnimSec: number;
    jumpCooldownSec: number;
    isJumping: boolean;
    expression: PlayerExpression;
  };
  rivals: RivalBird[];
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

  private bubbleSpawnAcc = 0;
  private soakFxAcc = 0;
  private cornSpawnTimerSec = 6.5;
  private nextPickupId = 1;

  constructor(mode: GameMode = 'stage', stageId: StageId = 1, t: Tuning = tuning) {
    this.t = t;
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
      isJumping: false,
      expression: 'smug',
    };
    this.rivals = createRivalBirds(this.stage, t);
  }

  private spawnBurst(
    x: number,
    y: number,
    count: number,
    kind: Particle['kind'],
    color: string,
    speedMin: number,
    speedMax: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI + Math.random() * Math.PI;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        r: kind.startsWith('feather') ? 5 + Math.random() * 4 : 3 + Math.random() * 3.5,
        color,
        kind,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        life: 0.65 + Math.random() * 0.5,
        maxLife: 1.15,
      });
    }
  }

  private spawnPropDebris(prop: PropState): void {
    const kindMap: Record<PropKind, { pKind: Particle['kind']; colors: string[] }> = {
      cup_tower: { pKind: 'cup', colors: ['#ffffff', '#38bdf8', '#94a3b8'] },
      melon_stall: { pKind: 'seed', colors: ['#fde047', '#ca8a04', '#78350f'] },
      balloon_cart: { pKind: 'balloon', colors: ['#f43f5e', '#facc15', '#38bdf8', '#a855f7'] },
      coffee_rack: { pKind: 'coffee', colors: ['#78350f', '#f5e6d3', '#fb923c'] },
    };
    const spec = kindMap[prop.kind];
    for (const color of spec.colors) {
      this.spawnBurst(prop.x, prop.y, 7, spec.pKind, color, 85, 250);
    }
    this.spawnBurst(prop.x, prop.y, 12, 'spark', '#fde047', 100, 260);
  }

  private addFloat(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floats.push({
      x: clamp(x, 66, this.t.view.width - 66),
      y: clamp(y, 88, this.t.scene.groundY - 20),
      text,
      color,
      scale,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  private pickPropFallbackDir(fromX: number): -1 | 1 {
    const intact = this.props.filter((p) => p.intact);
    if (intact.length > 0) {
      let nearest = intact[0];
      let bestDist = Math.abs(nearest.x - fromX);
      for (const p of intact) {
        const d = Math.abs(p.x - fromX);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      return nearest.x >= fromX ? 1 : -1;
    }
    return fromX >= 195 ? -1 : 1;
  }

  private rivalFeatherKind(archetype: AiArchetype): {
    kind: Particle['kind'];
    color: string;
  } {
    if (archetype === 'sparrow') return { kind: 'feather_sparrow', color: '#a16207' };
    if (archetype === 'red_crest') return { kind: 'feather_red', color: '#ef4444' };
    return { kind: 'feather_white', color: '#ffffff' };
  }

  private launchRivalFromFountain(
    r: RivalBird,
    nozzleX: number,
    tiltDeg: number,
    isCannon: boolean,
  ): void {
    const vel = computeParabolicLaunchVelocity(
      {
        birdX: r.x,
        nozzleX,
        tiltDeg,
        fallbackDir: this.pickPropFallbackDir(nozzleX),
      },
      this.t,
    );
    r.airborne = true;
    r.launchedByFountain = true;
    r.stunTimerSec = 0;
    r.redCrestState = 'idle';
    r.vx = vel.vx;
    r.vy = vel.vy;
    this.shakeMag = Math.max(this.shakeMag, 9.5);
    const feather = this.rivalFeatherKind(r.archetype);
    this.spawnBurst(r.x, this.t.scene.groundY - 24, 16, feather.kind, feather.color, 90, 260);
    if (isCannon) {
      this.addFloat(r.x, this.t.scene.groundY - 88, '斜喷炮弹！+80', '#38bdf8', 1.18);
    } else {
      this.addFloat(
        r.x,
        this.t.scene.groundY - 92,
        `太坏了！+${this.t.scoring.sabotageBonus}`,
        '#f59e0b',
        1.25,
      );
    }
  }

  step(input: WorldStepInput, dtMs: number): WorldStepEvents {
    const dtSec = Math.min(this.t.loop.maxFrameDtMs, Math.max(0, dtMs)) / 1000;

    // 0.07s comedy Hit-Stop freezes physics & timer briefly on prop smash!
    if (this.hitStopTimerSec > 0) {
      this.hitStopTimerSec = Math.max(0, this.hitStopTimerSec - dtSec);
      return {
        bumpedHit: false,
        bumpedWhiff: false,
        jumped: false,
        slammed: false,
        propSmashed: false,
        cornPickedUp: false,
        redCrestCharged: false,
        enteredPhases: [],
        playerHitBySurge: false,
        aiHitBySurge: false,
        angledCannonLaunch: false,
        occupant: this.occupant,
        combo: this.combo,
      };
    }

    // Update particles, floating texts, shockwaves
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtSec;
      const grav = p.kind.startsWith('feather')
        ? 110
        : p.kind === 'heart'
          ? -40
          : p.kind === 'balloon'
            ? 140
            : 430;
      p.vy += grav * dtSec;
      if (p.kind.startsWith('feather')) {
        p.vx += Math.sin(p.life * 9) * 38 * dtSec;
      }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rot += p.vrot * dtSec;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dtSec;
      f.y -= 36 * dtSec;
      if (f.life <= 0) this.floats.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dtSec;
      const tNorm = 1 - clamp(sw.life / sw.maxLife, 0, 1);
      sw.r = sw.maxR * tNorm;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    this.shakeMag = Math.max(0, this.shakeMag - 26 * dtSec);
    this.auntieNoticeTimerSec = Math.max(0, this.auntieNoticeTimerSec - dtSec);

    if (this.match.finished) {
      return {
        bumpedHit: false,
        bumpedWhiff: false,
        jumped: false,
        slammed: false,
        propSmashed: false,
        cornPickedUp: false,
        redCrestCharged: false,
        enteredPhases: [],
        playerHitBySurge: false,
        aiHitBySurge: false,
        angledCannonLaunch: false,
        occupant: this.occupant,
        combo: this.combo,
      };
    }

    // Prop auto-respawn in Endless mode (8s)
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      if (!prop.intact && this.stage.propRespawnSec !== null && prop.respawnTimerSec > 0) {
        const nextRespawn = prop.respawnTimerSec - dtSec;
        if (nextRespawn <= 0) {
          this.props[i] = { ...prop, intact: true, respawnTimerSec: 0 };
          this.spawnBurst(prop.x, prop.y, 8, 'spark', '#38bdf8', 40, 110);
        } else {
          this.props[i] = { ...prop, respawnTimerSec: nextRespawn };
        }
      }
    }

    // Cooldowns
    this.player.bumpCooldownSec = Math.max(0, this.player.bumpCooldownSec - dtSec);
    this.player.bumpAnimSec = Math.max(0, this.player.bumpAnimSec - dtSec);
    this.player.jumpCooldownSec = Math.max(0, this.player.jumpCooldownSec - dtSec);

    // Handle Jump ("小跳 W", cooldown 0.9s)
    let jumped = false;
    if (input.jumpPressed && this.player.jumpCooldownSec <= 0 && !this.player.airborne) {
      jumped = true;
      this.player.jumpCooldownSec = this.t.pigeon.jumpCooldownSec;
      this.player.airborne = true;
      this.player.isJumping = true;
      this.player.vy = this.t.pigeon.jumpSpeed;
      this.player.squashX = 0.82;
      this.player.squashY = 1.24;
      this.spawnBurst(this.player.x, this.t.scene.groundY - 4, 4, 'water', '#e0f2fe', 40, 95);
    }

    // Player horizontal movement (works in air too so player can hop over rivals/surges!)
    if (input.moveDir !== 0) {
      this.player.facing = input.moveDir;
      const airControl = this.player.airborne ? 0.72 : 1;
      this.player.vx += input.moveDir * this.t.pigeon.playerMoveAccel * airControl * dtSec;
      if (!this.player.airborne) {
        this.player.waddlePhase += dtSec * 14;
      }
    } else if (!this.player.airborne) {
      const drag =
        this.occupant === 'player' ? this.t.pigeon.waterDrag : this.t.pigeon.groundDrag;
      this.player.vx -= this.player.vx * Math.min(1, drag * dtSec);
    }

    if (this.player.bumpAnimSec <= 0 && (!this.player.airborne || this.player.isJumping)) {
      this.player.vx = clamp(
        this.player.vx,
        -this.t.pigeon.playerMaxSpeed,
        this.t.pigeon.playerMaxSpeed,
      );
    }

    if (this.player.airborne) {
      this.player.vy += this.t.pigeon.gravity * dtSec;
      if (!this.player.isJumping) {
        this.player.spinRad += 14 * dtSec;
      }
    }

    // Rivals AI & movement
    let redCrestCharged = false;
    for (const r of this.rivals) {
      if (r.respawnTimerSec > 0) {
        r.respawnTimerSec = Math.max(0, r.respawnTimerSec - dtSec);
        if (r.respawnTimerSec === 0) {
          const fromLeft = this.player.x > 195;
          r.x = fromLeft ? this.t.scene.stageMinX : this.t.scene.stageMaxX;
          r.y = this.t.scene.groundY;
          r.vx = fromLeft ? 150 : -150;
          r.vy = 0;
          r.airborne = false;
          r.launchedByFountain = false;
          r.spinRad = 0;
          r.stunTimerSec = 0;
          r.redCrestState = 'idle';
          r.redCrestTimerSec = 0;
        }
        continue;
      }

      if (r.stunTimerSec > 0) {
        r.stunTimerSec = Math.max(0, r.stunTimerSec - dtSec);
      }

      if (!r.airborne) {
        const decision = decideAiMove(
          {
            archetype: r.archetype,
            birdIndex: r.id,
            aiX: r.x,
            playerX: this.player.x,
            nozzles: this.match.nozzles,
            stunTimerSec: r.stunTimerSec,
            surgeReactElapsedSec: r.surgeReactElapsedSec,
            redCrestState: r.redCrestState,
            redCrestTimerSec: r.redCrestTimerSec,
            redCrestCooldownSec: r.redCrestCooldownSec,
            redCrestDir: r.redCrestDir,
            elapsedSec: this.match.elapsedSec,
            dtSec,
          },
          this.t,
        );
        r.intent = decision.intent;
        r.surgeReactElapsedSec = decision.nextSurgeReactElapsedSec;
        r.redCrestState = decision.nextRedCrestState;
        r.redCrestTimerSec = decision.nextRedCrestTimerSec;
        r.redCrestCooldownSec = decision.nextRedCrestCooldownSec;
        r.redCrestDir = decision.nextRedCrestDir;
        if (decision.startedCharge) {
          redCrestCharged = true;
        }

        const baseMax =
          r.archetype === 'sparrow'
            ? this.t.pigeon.sparrowMaxSpeed
            : r.archetype === 'red_crest'
              ? this.t.pigeon.redCrestMaxSpeed
              : this.t.pigeon.aiMaxSpeed;

        if (r.stunTimerSec > 0) {
          // Stunned sliding decay (low friction slide so knocked bird slides into surge/angled jet!)
          r.vx -= r.vx * Math.min(1, 3.6 * dtSec);
        } else if (decision.moveDir !== 0) {
          r.facing = decision.moveDir;
          if (r.redCrestState === 'lunging') {
            r.vx = decision.moveDir * this.t.pigeon.redCrestLungeSpeed;
          } else {
            r.vx += decision.moveDir * this.t.pigeon.aiMoveAccel * dtSec;
            r.vx = clamp(r.vx, -baseMax * decision.speedMultiplier, baseMax * decision.speedMultiplier);
          }
          r.waddlePhase += dtSec * (r.archetype === 'sparrow' ? 18 : 12);
        } else {
          r.vx -= r.vx * Math.min(1, this.t.pigeon.groundDrag * dtSec);
        }
      } else {
        r.vy += this.t.pigeon.gravity * dtSec;
        r.spinRad -= 15 * dtSec;
      }
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

    // Handle "肥臀猛顶" (Butt Bump!) — can bowl multiple rivals & grants 0.60s stun!
    let bumpedHit = false;
    let bumpedWhiff = false;
    if (input.bumpPressed && this.player.bumpCooldownSec <= 0 && !this.player.airborne) {
      this.player.bumpCooldownSec = this.t.pigeon.bumpCooldownSec;
      this.player.bumpAnimSec = 0.22;

      const targets = this.rivals.filter(
        (r) =>
          !r.airborne &&
          r.respawnTimerSec <= 0 &&
          Math.abs(r.x - this.player.x) <= this.t.pigeon.bumpReachPx,
      );

      let dashDir: -1 | 1 = this.player.facing;
      if (targets.length > 0) {
        let nearest = targets[0];
        let bestD = Math.abs(nearest.x - this.player.x);
        for (const r of targets) {
          const d = Math.abs(r.x - this.player.x);
          if (d < bestD) {
            bestD = d;
            nearest = r;
          }
        }
        dashDir = nearest.x >= this.player.x ? 1 : -1;
      }

      this.player.facing = dashDir;
      this.player.vx = dashDir * this.t.pigeon.bumpSelfDashSpeed;
      this.player.squashX = 1.3;
      this.player.squashY = 0.8;

      if (targets.length > 0) {
        bumpedHit = true;
        for (const r of targets) {
          const knockMult = r.archetype === 'sparrow' ? this.t.pigeon.sparrowKnockbackMult : 1;
          const hitDir = r.x >= this.player.x - 10 ? dashDir : (-dashDir as -1 | 1);
          r.vx = hitDir * this.t.pigeon.bumpKnockbackSpeed * knockMult;
          r.stunTimerSec = this.t.pigeon.bumpStunSec;
          r.redCrestState = 'idle';
          r.redCrestTimerSec = 0;
          r.squashX = 0.76;
          r.squashY = 1.26;
          const feather = this.rivalFeatherKind(r.archetype);
          this.spawnBurst(r.x, this.t.scene.groundY - 24, 4, feather.kind, feather.color, 55, 140);
        }
        this.shakeMag = Math.max(this.shakeMag, 5);
        this.spawnBurst(
          this.player.x + dashDir * 24,
          this.t.scene.groundY - 22,
          9,
          'spark',
          '#fde047',
          80,
          215,
        );
        if (targets.length >= 2) {
          this.addFloat(this.player.x, this.t.scene.groundY - 68, '一锅端！', '#fde047', 1.12);
        }
      } else {
        bumpedWhiff = true;
      }
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

    // Check stunned rival entering an ACTIVE angled fountain -> cannon-launch!
    let angledCannonLaunch = false;
    for (const r of this.rivals) {
      if (r.airborne || r.respawnTimerSec > 0 || r.stunTimerSec <= 0) continue;
      for (const nozzle of this.match.nozzles) {
        if (
          nozzle.phase === 'ACTIVE' &&
          nozzle.style === 'angled' &&
          Math.abs(r.x - nozzle.x) <= this.t.fountain.coreRadiusPx
        ) {
          angledCannonLaunch = true;
          this.launchRivalFromFountain(r, nozzle.x, nozzle.tiltDeg, true);
          this.match = {
            ...this.match,
            score: this.match.score + 80,
            sabotageCount: this.match.sabotageCount + 1,
          };
          break;
        }
      }
    }

    // Soft pigeon-pigeon body collision when both are grounded
    if (!this.player.airborne) {
      for (const r of this.rivals) {
        if (r.airborne || r.respawnTimerSec > 0) continue;
        // Red-crest lunge impact check
        if (
          r.archetype === 'red_crest' &&
          r.redCrestState === 'lunging' &&
          Math.abs(r.x - this.player.x) <= this.t.pigeon.radius + r.radius - 2
        ) {
          this.player.vx = r.redCrestDir * 310;
          this.player.squashX = 0.78;
          this.player.squashY = 1.24;
          r.redCrestState = 'idle';
          r.redCrestTimerSec = 0;
          this.shakeMag = Math.max(this.shakeMag, 5.5);
          this.addFloat(this.player.x, this.t.scene.groundY - 62, '被顶开啦！', '#fb7185', 1);
        }

        const minSep = (this.t.pigeon.radius + r.radius) * 0.82;
        const dx = r.x - this.player.x;
        const absDx = Math.abs(dx);
        if (absDx < minSep) {
          const dir = dx >= 0 ? 1 : -1;
          const overlap = (minSep - absDx) * 0.5;
          this.player.x -= dir * overlap;
          r.x += dir * overlap;
          this.player.vx -= dir * this.t.pigeon.softBounceSpeed * dtSec * 4;
          r.vx += dir * this.t.pigeon.softBounceSpeed * dtSec * 4;
        }
      }
    }

    // Parabolic prop smash check for launched rivals!
    let propSmashed = false;
    for (const r of this.rivals) {
      if (!r.airborne || !r.launchedByFountain || r.respawnTimerSec > 0) continue;
      for (let pi = 0; pi < this.props.length; pi++) {
        const prop = this.props[pi];
        if (!prop.intact) continue;
        if (checkPropHit(r.x, r.y, r.radius, prop)) {
          propSmashed = true;
          this.props[pi] = {
            ...prop,
            intact: false,
            respawnTimerSec: this.stage.propRespawnSec ?? 0,
          };
          this.hitStopTimerSec = this.t.props.hitStopSec;
          this.shakeMag = Math.max(this.shakeMag, 12);
          this.match = {
            ...this.match,
            score: this.match.score + prop.bonus,
            propSmashCount: this.match.propSmashCount + 1,
          };
          this.spawnPropDebris(prop);
          this.addFloat(prop.x, prop.y - 26, `连锁爆破 +${prop.bonus}！`, '#facc15', 1.28);

          // Melon stall bursts golden seed sparks onto plaza!
          if (prop.kind === 'melon_stall') {
            for (let s = 0; s < this.t.props.melonSparkCount; s++) {
              const targetX = clamp(
                prop.side === 'left' ? 90 + s * 36 : 300 - s * 36,
                this.t.scene.stageMinX + 8,
                this.t.scene.stageMaxX - 8,
              );
              this.pickups.push({
                id: this.nextPickupId++,
                kind: 'melon_spark',
                x: prop.x,
                y: prop.y - 12,
                vx: (targetX - prop.x) * 1.9,
                vy: -280 - s * 35,
                value: this.t.props.melonSparkValue,
                ttlSec: 9.0,
              });
            }
          }

          // Deflect flying bird amusingly
          r.vx = -r.vx * 0.35;
          r.vy = Math.min(r.vy, -110);
          break;
        }
      }
    }

    // Clamp player & check jump landing ("铁臀墩坐！")
    let slammed = false;
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
        this.spawnBurst(this.player.x, this.t.scene.groundY - 8, 16, 'water', '#bae6fd', 90, 240);
        this.spawnBurst(this.player.x, this.t.scene.groundY - 12, 8, 'spark', '#38bdf8', 70, 175);
        this.shockwaves.push({
          x: this.player.x,
          y: this.t.scene.groundY - 6,
          r: 12,
          maxR: this.t.pigeon.slamShockwaveRadius,
          life: 0.32,
          maxLife: 0.32,
          color: '#38bdf8',
        });
        this.addFloat(
          this.player.x,
          this.t.scene.groundY - 72,
          `铁臀墩坐！+${slam.bonusScore}`,
          '#38bdf8',
          1.18,
        );

        // Shockwave nudges nearby grounded rivals away!
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
      }
    } else {
      // Keep mid-air horizontal position within visible canvas
      this.player.x = clamp(this.player.x, 20, this.t.view.width - 20);
    }

    // Clamp grounded rivals or despawn launched rivals
    for (const r of this.rivals) {
      if (r.respawnTimerSec > 0) continue;
      if (!r.airborne) {
        r.x = clamp(r.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
      } else if (
        r.y > this.t.view.height + 60 ||
        r.y < -180 ||
        r.x < -60 ||
        r.x > this.t.view.width + 60
      ) {
        r.airborne = false;
        r.launchedByFountain = false;
        r.respawnTimerSec = this.t.pigeon.aiRespawnSec;
      }
    }

    // Auntie corn kernel spawner (Stage 2, Stage 4, Endless)
    if (this.stage.cornEnabled) {
      this.cornSpawnTimerSec -= dtSec;
      if (this.cornSpawnTimerSec <= 0) {
        this.cornSpawnTimerSec = this.t.corn.spawnIntervalSec;
        const nozzle =
          this.match.nozzles[Math.floor(Math.random() * this.match.nozzles.length)];
        const offset = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 20);
        const targetX = clamp(
          nozzle.x + offset,
          this.t.scene.stageMinX + 10,
          this.t.scene.stageMaxX - 10,
        );
        this.pickups.push({
          id: this.nextPickupId++,
          kind: 'corn',
          x: targetX < 195 ? 20 : this.t.view.width - 20,
          y: 260,
          vx: (targetX - (targetX < 195 ? 20 : this.t.view.width - 20)) * 1.4,
          vy: -160,
          value: this.t.corn.scoreValue,
          ttlSec: this.t.corn.ttlSec,
        });
        this.auntieNoticeTimerSec = 2.2;
      }
    }

    // Update bonus pickups (corn & melon sparks)
    let cornPickedUp = false;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.ttlSec -= dtSec;
      if (pk.ttlSec <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.y < this.t.scene.groundY - 8 || pk.vy < 0) {
        pk.vy += 860 * dtSec;
        pk.x += pk.vx * dtSec;
        pk.y += pk.vy * dtSec;
        if (pk.y >= this.t.scene.groundY - 8) {
          pk.y = this.t.scene.groundY - 8;
          pk.vy = 0;
          pk.vx = 0;
          pk.x = clamp(pk.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
        } else {
          pk.x = clamp(pk.x, 12, this.t.view.width - 12);
        }
      }

      // Player pickup check
      if (
        Math.abs(this.player.x - pk.x) <= this.t.corn.pickupRadius &&
        Math.abs(this.player.y - 16 - pk.y) <= 30
      ) {
        cornPickedUp = true;
        this.match = {
          ...this.match,
          score: this.match.score + pk.value,
        };
        this.spawnBurst(pk.x, pk.y, 7, 'spark', '#fde047', 50, 140);
        this.addFloat(
          pk.x,
          pk.y - 34,
          pk.kind === 'corn' ? `闪亮玉米！+${pk.value}` : `瓜子火花！+${pk.value}`,
          '#fde047',
          1.12,
        );
        this.pickups.splice(i, 1);
        continue;
      }

      // Rivals can steal grounded corn if player wasn't quick enough!
      if (pk.kind === 'corn' && pk.vy === 0) {
        const thief = this.rivals.find(
          (r) =>
            !r.airborne &&
            r.respawnTimerSec <= 0 &&
            r.stunTimerSec <= 0 &&
            Math.abs(r.x - pk.x) <= 18,
        );
        if (thief) {
          this.addFloat(pk.x, pk.y - 30, '玉米被抢吃！', '#cbd5e1', 0.92);
          this.pickups.splice(i, 1);
        }
      }
    }

    // Step pure rules
    const ruleRes = stepMatchState(
      this.match,
      {
        dtSec,
        playerX: this.player.x,
        playerAirborne: this.player.airborne,
        rivals: this.rivals.map((r) => ({
          id: r.id,
          x: r.respawnTimerSec > 0 ? -999 : r.x,
          airborne: r.airborne || r.respawnTimerSec > 0,
        })),
      },
      this.t,
    );
    this.match = ruleRes.state;
    this.occupant = ruleRes.occupant;
    this.occupiedSlotIndex = ruleRes.occupiedSlotIndex;
    this.combo = ruleRes.combo;

    // Surge blast reactions!
    const playerHitBySurge = ruleRes.playerHitBySurgeSlot !== null;
    if (ruleRes.playerHitBySurgeSlot !== null) {
      const nozzle = this.match.nozzles[ruleRes.playerHitBySurgeSlot];
      this.player.airborne = true;
      this.player.isJumping = false;
      this.player.vy = -560;
      this.player.vx = (this.player.x < (nozzle?.x ?? 195) ? -1 : 1) * 105;
      this.shakeMag = Math.max(this.shakeMag, 9);
      this.spawnBurst(this.player.x, this.t.scene.groundY - 20, 10, 'feather_dark', '#334155', 70, 210);
      this.addFloat(this.player.x, this.t.scene.groundY - 76, '哎呀！-1尾羽', '#ef4444', 1.1);
    }

    const aiHitBySurge = ruleRes.rivalsHitBySurge.length > 0;
    for (const hit of ruleRes.rivalsHitBySurge) {
      const rival = this.rivals.find((r) => r.id === hit.rivalId);
      const nozzle = this.match.nozzles[hit.slotIndex];
      if (rival && nozzle) {
        this.launchRivalFromFountain(rival, nozzle.x, nozzle.tiltDeg, false);
      }
    }

    // Water lift & squash-stretch animation
    if (!this.player.airborne) {
      const targetY =
        this.occupant === 'player'
          ? this.t.scene.groundY -
            this.t.pigeon.waterLiftPx +
            Math.sin(this.match.elapsedSec * 14) * 3.5
          : this.t.scene.groundY;
      this.player.y += (targetY - this.player.y) * Math.min(1, 16 * dtSec);
    }

    for (const r of this.rivals) {
      if (!r.airborne && r.respawnTimerSec <= 0) {
        const onActiveNozzle = this.match.nozzles.some(
          (n) => n.phase === 'ACTIVE' && Math.abs(r.x - n.x) <= this.t.fountain.coreRadiusPx,
        );
        const targetAiY = onActiveNozzle
          ? this.t.scene.groundY -
            this.t.pigeon.waterLiftPx * (r.archetype === 'sparrow' ? 1.1 : 0.95) +
            Math.sin(this.match.elapsedSec * 13 + r.id) * 3.5
          : this.t.scene.groundY;
        r.y += (targetAiY - r.y) * Math.min(1, 16 * dtSec);
      }
      r.squashX += (1 - r.squashX) * Math.min(1, 12 * dtSec);
      r.squashY += (1 - r.squashY) * Math.min(1, 12 * dtSec);
    }

    this.player.squashX += (1 - this.player.squashX) * Math.min(1, 12 * dtSec);
    this.player.squashY += (1 - this.player.squashY) * Math.min(1, 12 * dtSec);

    // Update player expression
    const dangerNear = this.match.nozzles.some(
      (n) =>
        n.phase === 'SURGE_WARN' &&
        Math.abs(this.player.x - n.x) <= this.t.fountain.coreRadiusPx + 14,
    );
    if (this.player.airborne) {
      this.player.expression = this.player.isJumping ? 'jump' : 'launched';
    } else if (this.player.bumpAnimSec > 0) {
      this.player.expression = 'bump';
    } else if (dangerNear) {
      this.player.expression = 'panic';
    } else if (this.occupant === 'player' && this.occupiedSlotIndex !== null) {
      const nozzle = this.match.nozzles[this.occupiedSlotIndex];
      const edgeDist = nozzle ? Math.abs(this.player.x - nozzle.x) : 0;
      this.player.expression = edgeDist > this.t.fountain.coreRadiusPx * 0.65 ? 'panic' : 'bliss';
    } else {
      this.player.expression = 'smug';
    }

    // Ambient fountain bubbles & soak hearts
    this.bubbleSpawnAcc += dtSec;
    if (this.bubbleSpawnAcc >= 0.06) {
      this.bubbleSpawnAcc = 0;
      for (const n of this.match.nozzles) {
        if (n.phase === 'WARNING') {
          this.particles.push({
            x: n.x + (Math.random() - 0.5) * 28,
            y: this.t.scene.groundY - 4,
            vx: (Math.random() - 0.5) * 24,
            vy: -55 - Math.random() * 45,
            r: 2.5 + Math.random() * 2.5,
            color: '#e0f2fe',
            kind: 'water',
            rot: 0,
            vrot: 0,
            life: 0.45,
            maxLife: 0.45,
          });
        } else if (n.phase === 'ACTIVE') {
          const rad = (n.tiltDeg * Math.PI) / 180;
          this.particles.push({
            x: n.x + (Math.random() - 0.5) * 26,
            y: this.t.scene.groundY - 42 - Math.random() * 25,
            vx: Math.sin(rad) * 180 + n.lateralDir * 30 + (Math.random() - 0.5) * 55,
            vy: -Math.cos(rad) * 125 - Math.random() * 60,
            r: 2 + Math.random() * 2.5,
            color: '#bae6fd',
            kind: 'water',
            rot: 0,
            vrot: 0,
            life: 0.45,
            maxLife: 0.45,
          });
        }
      }
    }

    this.soakFxAcc += dtSec;
    if (this.occupant === 'player' && this.soakFxAcc >= 0.38) {
      this.soakFxAcc = 0;
      this.particles.push({
        x: this.player.x + (Math.random() - 0.5) * 20,
        y: this.player.y - 42,
        vx: (Math.random() - 0.5) * 20,
        vy: -45,
        r: 6,
        color: '#fb7185',
        kind: 'heart',
        rot: 0,
        vrot: 0,
        life: 0.75,
        maxLife: 0.75,
      });
    }

    return {
      bumpedHit,
      bumpedWhiff,
      jumped,
      slammed,
      propSmashed,
      cornPickedUp,
      redCrestCharged,
      enteredPhases: ruleRes.enteredPhases,
      playerHitBySurge,
      aiHitBySurge,
      angledCannonLaunch,
      occupant: this.occupant,
      combo: this.combo,
    };
  }
}
