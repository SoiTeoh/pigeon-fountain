import Matter from 'matter-js';
import {
  LAUNCH_STAGES,
  type LaunchStageConfig,
  type RelayFountainSpec,
} from '../config/launchStages';
import {
  CHARACTERS,
  launchTuning,
  type LaunchTuning,
  type PigeonCharacterId,
} from '../config/launchTuning';
import type { LaunchChapterStageId } from '../platform/storage';
import {
  areAllCupsIntact,
  canTriggerDiveSlam,
  clamp,
  computeSlingshotLaunch,
  evaluateLaunchStars,
  evaluateSeatSettle,
  findTriggeredRelayFountain,
  isAwningFlattened,
  isBirdOutOfBounds,
  isRivalKnockedOffSeat,
  predictTrajectoryPoints,
  type FlightPhase,
  type LaunchScoreResult,
  type Point2D,
} from './launchRules';

export interface LaunchParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind: 'water' | 'feather_white' | 'feather_red' | 'feather_dark' | 'spark' | 'glass';
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
}

export interface LaunchFloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface LaunchShockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface CupEntity {
  id: string;
  body: Matter.Body;
  w: number;
  h: number;
  initX: number;
  initY: number;
  disturbed: boolean;
}

export interface GlassEntity {
  id: string;
  body: Matter.Body;
  w: number;
  h: number;
  broken: boolean;
}

export interface RivalEntity {
  id: string;
  archetype: 'white' | 'red_crest';
  radius: number;
  body: Matter.Body;
  knocked: boolean;
}

export interface SpentBirdEntity {
  body: Matter.Body;
  characterId: PigeonCharacterId;
  radius: number;
}

export interface LaunchStepEvents {
  readonly launched: boolean;
  readonly diveSlammed: boolean;
  readonly relayTriggered: boolean;
  readonly glassBroken: boolean;
  readonly subGoalNewlyCompleted: boolean;
  readonly settledWinStarted: boolean;
  readonly roundFinished: boolean;
  readonly birdAdvanced: boolean;
}

export class LaunchPrototypeWorld {
  readonly t: LaunchTuning;
  readonly stage: LaunchStageConfig;
  readonly engine: Matter.Engine;
  readonly supportBodies: Matter.Body[] = [];
  readonly wallBodies: Matter.Body[] = [];
  readonly groundBody: Matter.Body;
  readonly benchBody: Matter.Body | null = null;
  readonly awningBody: Matter.Body | null = null;
  readonly cups: CupEntity[] = [];
  readonly glasses: GlassEntity[] = [];
  readonly rivals: RivalEntity[] = [];
  readonly spentBirds: SpentBirdEntity[] = [];

  selectedCharacter: PigeonCharacterId = 'black_bad';
  activeBird: Matter.Body;
  subGoalCompleted: boolean;

  phase: FlightPhase = 'aiming';
  pigeonsRemaining: number;
  diveSlamUsed = false;
  diveSlamAnimSec = 0;
  pendingSlamShockwave = false;

  // Slingshot state
  isDragging = false;
  dragPointer: Point2D = { x: 0, y: 0 };
  previewDots: Point2D[] = [];
  aimLaunchVx = 0;
  aimLaunchVy = 0;
  aimPowerRatio = 0;
  aimValid = false;

  // Relay & route tracking
  relayCooldowns: Record<string, number> = {};
  relaySprayTimers: Record<string, number> = {};
  relaysTriggeredIds = new Set<string>();
  glassBrokenCount = 0;

  // Timers & state
  mainSprayAnimSec = 0;
  settleTimerSec = 0;
  settleProgress = 0;
  inTargetSeatZone = false;
  offSeatStillTimerSec = 0;
  winSlowMoTimerSec = 0;
  flashAlpha = 0;
  won = false;
  scoreResult: LaunchScoreResult = { stars: 0, bonusScore: 0, totalScore: 0 };
  elapsedSec = 0;
  shakeMag = 0;
  lastSpeedPxPerSec = 0;
  isSupported = true;
  awningFlattened = false;

  particles: LaunchParticle[] = [];
  floats: LaunchFloatText[] = [];
  shockwaves: LaunchShockwave[] = [];

  private bubbleAcc = 0;

  constructor(stageId: LaunchChapterStageId = 1, t: LaunchTuning = launchTuning) {
    this.t = t;
    this.stage = LAUNCH_STAGES[stageId];
    this.pigeonsRemaining = t.match.totalPigeons;
    this.subGoalCompleted = this.stage.subGoalKind === 'preserve_cups';

    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: t.physics.gravityY, scale: t.physics.gravityScale },
      positionIterations: 8,
      velocityIterations: 6,
    });

    // Ground
    this.groundBody = Matter.Bodies.rectangle(
      t.view.width / 2,
      t.physics.groundY + 30,
      t.view.width + 160,
      60,
      {
        isStatic: true,
        friction: 0.72,
        restitution: 0.15,
        label: 'ground',
      },
    );
    this.supportBodies.push(this.groundBody);

    const leftGuard = Matter.Bodies.rectangle(-25, t.view.height / 2, 50, t.view.height * 2, {
      isStatic: true,
      friction: 0.2,
      restitution: 0.4,
      label: 'left_guard',
    });

    // Bench (if stage uses fixed bench)
    if (this.stage.bench) {
      this.benchBody = Matter.Bodies.rectangle(
        this.stage.bench.x,
        this.stage.bench.y,
        this.stage.bench.w,
        this.stage.bench.h,
        {
          isStatic: true,
          friction: t.physics.benchFriction,
          frictionStatic: 1.0,
          restitution: 0.12,
          label: 'bench',
        },
      );
      this.supportBodies.push(this.benchBody);
    }

    // Hinged elastic awning (Stage 4)
    const constraints: Matter.Constraint[] = [];
    if (this.stage.awning) {
      const a = this.stage.awning;
      this.awningBody = Matter.Bodies.rectangle(a.x, a.y, a.w, a.h, {
        isStatic: false,
        density: 0.0028,
        friction: 0.94,
        frictionStatic: 1.2,
        restitution: 0.1,
        label: 'awning',
      });
      Matter.Body.setAngle(this.awningBody, a.restAngleRad);
      const hinge = Matter.Constraint.create({
        pointA: { x: a.x, y: a.y },
        bodyB: this.awningBody,
        pointB: { x: 0, y: 0 },
        stiffness: 1,
        length: 0,
      });
      constraints.push(hinge);
      this.supportBodies.push(this.awningBody);
    }

    // Platforms
    const platformBodies = this.stage.platforms.map((p) => {
      const b = Matter.Bodies.rectangle(p.x, p.y, p.w, p.h, {
        isStatic: true,
        friction: 0.8,
        restitution: 0.15,
        label: 'platform',
      });
      this.supportBodies.push(b);
      return b;
    });

    // Walls / eaves / posts
    for (const w of this.stage.walls) {
      const wb = Matter.Bodies.rectangle(w.x, w.y, w.w, w.h, {
        isStatic: true,
        friction: 0.5,
        restitution: 0.3,
        label: `wall_${w.kind ?? 'brick'}`,
      });
      this.wallBodies.push(wb);
      this.supportBodies.push(wb);
    }

    // Fragile glass barriers (Stage 5)
    for (const g of this.stage.glasses) {
      const gb = Matter.Bodies.rectangle(g.x, g.y, g.w, g.h, {
        isStatic: true,
        friction: 0.1,
        restitution: 0.2,
        label: `glass:${g.id}`,
      });
      this.glasses.push({ id: g.id, body: gb, w: g.w, h: g.h, broken: false });
      this.supportBodies.push(gb);
    }

    // Decorative cups
    for (const c of this.stage.cups) {
      const cb = Matter.Bodies.rectangle(c.x, c.y, c.w, c.h, {
        density: t.physics.cupDensity,
        friction: 0.5,
        frictionStatic: 0.9,
        restitution: 0.24,
        label: `cup:${c.id}`,
      });
      this.cups.push({
        id: c.id,
        body: cb,
        w: c.w,
        h: c.h,
        initX: c.x,
        initY: c.y,
        disturbed: false,
      });
    }

    // Rivals (Stage 2 white pigeon, Stage 6 white + heavy red_crest boss)
    for (const r of this.stage.rivals) {
      const rb = Matter.Bodies.circle(r.x, r.y, r.radius, {
        density: r.density,
        friction: 0.52,
        restitution: 0.42,
        frictionAir: 0.002,
        label: `rival:${r.id}`,
      });
      this.rivals.push({
        id: r.id,
        archetype: r.archetype,
        radius: r.radius,
        body: rb,
        knocked: false,
      });
    }

    for (const r of this.stage.relays) {
      this.relayCooldowns[r.id] = 0;
      this.relaySprayTimers[r.id] = 0;
    }

    this.activeBird = this.createPlayerBirdBody(this.selectedCharacter);

    const allBodies: Matter.Body[] = [
      this.groundBody,
      leftGuard,
      ...(this.benchBody ? [this.benchBody] : []),
      ...(this.awningBody ? [this.awningBody] : []),
      ...platformBodies,
      ...this.wallBodies,
      ...this.glasses.map((g) => g.body),
      ...this.cups.map((c) => c.body),
      ...this.rivals.map((r) => r.body),
      this.activeBird,
    ];
    Matter.Composite.add(this.engine.world, [...allBodies, ...constraints]);
  }

  private createPlayerBirdBody(charId: PigeonCharacterId): Matter.Body {
    const spec = CHARACTERS[charId];
    return Matter.Bodies.circle(this.stage.fountainX, this.stage.fountainY, spec.radius, {
      isStatic: false,
      density: spec.density,
      friction: spec.friction,
      frictionStatic: spec.frictionStatic,
      frictionAir: spec.frictionAir,
      restitution: spec.restitution,
      label: `player_${charId}`,
    });
  }

  selectCharacter(charId: PigeonCharacterId): boolean {
    if (this.phase !== 'aiming' || this.isDragging) return false;
    if (this.selectedCharacter === charId) return true;
    this.selectedCharacter = charId;
    Matter.Composite.remove(this.engine.world, this.activeBird);
    this.activeBird = this.createPlayerBirdBody(charId);
    Matter.Composite.add(this.engine.world, this.activeBird);
    return true;
  }

  private spawnBurst(
    x: number,
    y: number,
    count: number,
    kind: LaunchParticle['kind'],
    color: string,
    speedMin: number,
    speedMax: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI + Math.random() * Math.PI;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 45,
        r: kind.startsWith('feather') ? 5 + Math.random() * 3.5 : 2.5 + Math.random() * 3,
        color,
        kind,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        life: 0.65 + Math.random() * 0.45,
        maxLife: 1.1,
      });
    }
  }

  private addFloat(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floats.push({
      x: clamp(x, 68, this.t.view.width - 68),
      y: clamp(y, 78, this.t.physics.groundY - 16),
      text,
      color,
      scale,
      life: 1.25,
      maxLife: 1.25,
    });
  }

  beginAim(pt: Point2D): boolean {
    if (this.phase !== 'aiming') return false;
    const dist = Math.hypot(pt.x - this.stage.fountainX, pt.y - this.stage.fountainY);
    if (dist > this.t.slingshot.grabRadiusPx) return false;
    this.isDragging = true;
    this.updateAim(pt);
    return true;
  }

  updateAim(pt: Point2D): void {
    if (!this.isDragging || this.phase !== 'aiming') return;
    this.dragPointer = { x: pt.x, y: pt.y };
    const anchor = { x: this.stage.fountainX, y: this.stage.fountainY };
    const res = computeSlingshotLaunch(anchor, pt, this.t, this.selectedCharacter);
    this.aimValid = res.valid;
    this.aimPowerRatio = res.powerRatio;
    this.aimLaunchVx = res.vx;
    this.aimLaunchVy = res.vy;

    if (res.valid) {
      this.previewDots = predictTrajectoryPoints(
        anchor.x,
        anchor.y,
        res.vx,
        res.vy,
        this.t,
        this.selectedCharacter,
      );
    } else {
      this.previewDots = [];
    }
  }

  releaseAim(): boolean {
    if (!this.isDragging || this.phase !== 'aiming') return false;
    this.isDragging = false;
    const anchor = { x: this.stage.fountainX, y: this.stage.fountainY };
    const res = computeSlingshotLaunch(anchor, this.dragPointer, this.t, this.selectedCharacter);
    this.previewDots = [];

    if (!res.valid) {
      this.aimValid = false;
      this.aimPowerRatio = 0;
      return false;
    }

    Matter.Body.setPosition(this.activeBird, { x: anchor.x, y: anchor.y });
    Matter.Body.setAngle(this.activeBird, 0);
    Matter.Body.setAngularVelocity(this.activeBird, 0);
    Matter.Body.setVelocity(this.activeBird, {
      x: res.vx / 60,
      y: res.vy / 60,
    });

    this.phase = 'flying';
    this.pigeonsRemaining = Math.max(0, this.pigeonsRemaining - 1);
    this.diveSlamUsed = false;
    this.pendingSlamShockwave = false;
    this.settleTimerSec = 0;
    this.settleProgress = 0;
    this.inTargetSeatZone = false;
    this.offSeatStillTimerSec = 0;
    this.mainSprayAnimSec = 0.5;
    this.shakeMag = Math.max(this.shakeMag, 6.5);
    this.spawnBurst(anchor.x, this.t.physics.groundY - 6, 16, 'water', '#e0f2fe', 90, 240);
    return true;
  }

  triggerDiveSlam(): boolean {
    if (!canTriggerDiveSlam(this.phase, this.diveSlamUsed)) return false;
    if (this.isSupported && this.activeBird.position.y > this.t.physics.groundY - 38) return false;

    const spec = CHARACTERS[this.selectedCharacter];
    this.diveSlamUsed = true;
    this.diveSlamAnimSec = 0.4;
    this.pendingSlamShockwave = this.selectedCharacter === 'fat_chonk';

    const curVx = this.activeBird.velocity.x * 60;
    Matter.Body.setVelocity(this.activeBird, {
      x: (curVx * spec.diveSlamVxDamp) / 60,
      y: spec.diveSlamVy / 60,
    });
    Matter.Body.setAngularVelocity(this.activeBird, 0);
    Matter.Body.setAngle(this.activeBird, 0);
    this.shakeMag = Math.max(this.shakeMag, this.selectedCharacter === 'fat_chonk' ? 8.5 : 5);
    this.shockwaves.push({
      x: this.activeBird.position.x,
      y: this.activeBird.position.y + 8,
      r: 8,
      maxR: this.selectedCharacter === 'fat_chonk' ? 68 : 48,
      life: 0.28,
      maxLife: 0.28,
      color: this.selectedCharacter === 'fat_chonk' ? '#f59e0b' : '#38bdf8',
    });
    this.spawnBurst(
      this.activeBird.position.x,
      this.activeBird.position.y,
      this.selectedCharacter === 'fat_chonk' ? 14 : 9,
      'water',
      '#bae6fd',
      70,
      210,
    );
    this.addFloat(
      this.activeBird.position.x,
      this.activeBird.position.y - 36,
      this.selectedCharacter === 'fat_chonk' ? '泰山重磅压棚！' : '铁臀速降！',
      this.selectedCharacter === 'fat_chonk' ? '#f59e0b' : '#38bdf8',
      this.selectedCharacter === 'fat_chonk' ? 1.16 : 1.05,
    );
    return true;
  }

  private applyFatChonkShockwave(originX: number, originY: number): void {
    const spec = CHARACTERS.fat_chonk;
    this.shakeMag = Math.max(this.shakeMag, 11);
    this.shockwaves.push({
      x: originX,
      y: originY + 12,
      r: 12,
      maxR: spec.shockRadiusPx,
      life: 0.34,
      maxLife: 0.34,
      color: '#f59e0b',
    });

    // Blast nearby rivals off!
    for (const r of this.rivals) {
      const dist = Math.hypot(r.body.position.x - originX, r.body.position.y - originY);
      if (dist <= spec.shockRadiusPx + 24) {
        const dir = r.body.position.x >= originX ? 1 : -1;
        Matter.Body.setVelocity(r.body, {
          x: (dir * spec.shockSpeedPx) / 60,
          y: -310 / 60,
        });
        Matter.Body.setAngularVelocity(r.body, dir * 0.24);
      }
    }

    // Flatten awning decisively if landing on it
    if (this.awningBody && Math.abs(originX - this.awningBody.position.x) <= 68) {
      Matter.Body.setAngle(this.awningBody, 0);
      Matter.Body.setAngularVelocity(this.awningBody, 0);
    }
  }

  canAdvanceNextBird(): boolean {
    return (
      this.phase === 'flying' &&
      this.pigeonsRemaining > 0 &&
      !this.inTargetSeatZone &&
      (this.offSeatStillTimerSec >= 0.3 || this.diveSlamUsed)
    );
  }

  advanceNextBird(): boolean {
    if (this.phase !== 'flying') return false;
    if (this.pigeonsRemaining <= 0) {
      this.phase = 'round_over';
      this.won = false;
      this.scoreResult = evaluateLaunchStars(false, this.subGoalCompleted, 0, this.t);
      return true;
    }

    if (!isBirdOutOfBounds(this.activeBird.position.x, this.activeBird.position.y, this.t)) {
      this.spentBirds.push({
        body: this.activeBird,
        characterId: this.selectedCharacter,
        radius: CHARACTERS[this.selectedCharacter].radius,
      });
      this.activeBird.label = 'spent_bird';
    } else {
      Matter.Composite.remove(this.engine.world, this.activeBird);
    }

    this.activeBird = this.createPlayerBirdBody(this.selectedCharacter);
    Matter.Composite.add(this.engine.world, this.activeBird);

    this.phase = 'aiming';
    this.diveSlamUsed = false;
    this.pendingSlamShockwave = false;
    this.settleTimerSec = 0;
    this.settleProgress = 0;
    this.inTargetSeatZone = false;
    this.offSeatStillTimerSec = 0;
    this.isDragging = false;
    this.aimValid = false;
    this.previewDots = [];
    return true;
  }

  private triggerRelayBlast(relay: RelayFountainSpec): void {
    this.relayCooldowns[relay.id] = relay.cooldownSec;
    this.relaySprayTimers[relay.id] = 0.6;
    this.relaysTriggeredIds.add(relay.id);
    this.shakeMag = Math.max(this.shakeMag, 8.5);
    const blendVx = relay.launchVx + clamp(this.activeBird.velocity.x * 60 * 0.04, -10, 12);
    Matter.Body.setPosition(this.activeBird, {
      x: relay.x,
      y: Math.min(this.activeBird.position.y, 474),
    });
    Matter.Body.setVelocity(this.activeBird, {
      x: blendVx / 60,
      y: relay.launchVy / 60,
    });
    this.spawnBurst(relay.x, this.t.physics.groundY - 6, 22, 'water', '#bae6fd', 110, 290);
    this.addFloat(relay.x, relay.y - 54, '噗嗤——轰！二段喷泉！', '#38bdf8', 1.15);
  }

  step(dtMs: number): LaunchStepEvents {
    const rawDtSec = Math.min(this.t.loop.maxFrameDtMs, Math.max(0, dtMs)) / 1000;
    const simScale = this.phase === 'settling_win' ? 0.25 : 1;
    const dtSec = rawDtSec * simScale;
    this.elapsedSec += rawDtSec;

    this.mainSprayAnimSec = Math.max(0, this.mainSprayAnimSec - rawDtSec);
    this.diveSlamAnimSec = Math.max(0, this.diveSlamAnimSec - rawDtSec);
    this.shakeMag = Math.max(0, this.shakeMag - 24 * rawDtSec);
    this.flashAlpha = Math.max(0, this.flashAlpha - 2.6 * rawDtSec);

    for (const r of this.stage.relays) {
      this.relayCooldowns[r.id] = Math.max(0, (this.relayCooldowns[r.id] ?? 0) - rawDtSec);
      this.relaySprayTimers[r.id] = Math.max(0, (this.relaySprayTimers[r.id] ?? 0) - rawDtSec);
    }

    // Update particles, floats, shockwaves
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= rawDtSec;
      const grav = p.kind.startsWith('feather') ? 110 : 420;
      p.vy += grav * rawDtSec;
      p.x += p.vx * rawDtSec;
      p.y += p.vy * rawDtSec;
      p.rot += p.vrot * rawDtSec;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= rawDtSec;
      f.y -= 32 * rawDtSec;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= rawDtSec;
      sw.r = sw.maxR * (1 - clamp(sw.life / sw.maxLife, 0, 1));
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    // Ambient bubbles
    this.bubbleAcc += rawDtSec;
    if (this.bubbleAcc >= 0.11) {
      this.bubbleAcc = 0;
      if (this.phase === 'aiming' && this.isDragging && this.aimValid) {
        this.particles.push({
          x: this.stage.fountainX + (Math.random() - 0.5) * 28,
          y: this.t.physics.groundY - 4,
          vx: (Math.random() - 0.5) * 35,
          vy: -60 - this.aimPowerRatio * 75,
          r: 2.5 + Math.random() * 2.5,
          color: '#e0f2fe',
          kind: 'water',
          rot: 0,
          vrot: 0,
          life: 0.42,
          maxLife: 0.42,
        });
      }
      for (const r of this.stage.relays) {
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 28,
          y: this.t.physics.groundY - 4,
          vx: (Math.random() - 0.5) * 22,
          vy: -55 - Math.random() * 40,
          r: 2.5 + Math.random() * 2,
          color: '#7dd3fc',
          kind: 'water',
          rot: 0,
          vrot: 0,
          life: 0.45,
          maxLife: 0.45,
        });
      }
    }

    let relayTriggered = false;
    let glassBroken = false;
    let subGoalNewlyCompleted = false;
    let settledWinStarted = false;
    let roundFinished = false;
    let birdAdvanced = false;

    if (this.phase === 'round_over') {
      return {
        launched: false,
        diveSlammed: false,
        relayTriggered,
        glassBroken,
        subGoalNewlyCompleted,
        settledWinStarted,
        roundFinished,
        birdAdvanced,
      };
    }

    // Pin active bird on fountain while aiming
    if (this.phase === 'aiming') {
      Matter.Body.setPosition(this.activeBird, {
        x: this.stage.fountainX,
        y: this.stage.fountainY,
      });
      Matter.Body.setVelocity(this.activeBird, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.activeBird, 0);
      Matter.Body.setAngle(this.activeBird, 0);
    }

    // Stage 4 hinged awning spring restoring torque vs fat_chonk weight compression
    if (this.stage.awning && this.awningBody) {
      const a = this.stage.awning;
      const fatOnAwning =
        this.selectedCharacter === 'fat_chonk' &&
        this.phase !== 'aiming' &&
        Math.abs(this.activeBird.position.x - a.x) <= a.w / 2 + 12 &&
        Math.abs(this.activeBird.position.y - this.awningBody.position.y) <= 52;

      if (fatOnAwning) {
        // Fat pigeon's heavy weight compresses the elastic awning toward flat (0 rad) and holds it steady!
        const compressDiff = 0 - this.awningBody.angle;
        Matter.Body.setAngularVelocity(
          this.awningBody,
          this.awningBody.angularVelocity * 0.65 + compressDiff * 0.18,
        );
      } else {
        const diff = a.restAngleRad - this.awningBody.angle;
        Matter.Body.setAngularVelocity(
          this.awningBody,
          this.awningBody.angularVelocity * 0.88 + diff * a.springStiffness,
        );
      }
      this.awningFlattened = isAwningFlattened(this.awningBody.angle, a);
    }

    // Pre-step fragile glass shatter check (swept overlap so bird bursts straight through!)
    const speedBeforeImpact =
      Math.hypot(this.activeBird.velocity.x, this.activeBird.velocity.y) * 60;
    const birdSpec = CHARACTERS[this.selectedCharacter];
    const nextBirdX = this.activeBird.position.x + this.activeBird.velocity.x;
    const nextBirdY = this.activeBird.position.y + this.activeBird.velocity.y;
    for (const g of this.glasses) {
      if (g.broken) continue;
      const hitGlass =
        Math.abs(nextBirdX - g.body.position.x) <= g.w / 2 + birdSpec.radius + 2 &&
        Math.abs(nextBirdY - g.body.position.y) <= g.h / 2 + birdSpec.radius + 2;
      if (
        hitGlass &&
        (speedBeforeImpact >= this.t.physics.glassBreakSpeedPx ||
          this.selectedCharacter === 'fat_chonk' ||
          this.diveSlamUsed)
      ) {
        g.broken = true;
        glassBroken = true;
        this.glassBrokenCount += 1;
        Matter.Composite.remove(this.engine.world, g.body);
        const sIdx = this.supportBodies.indexOf(g.body);
        if (sIdx >= 0) this.supportBodies.splice(sIdx, 1);
        this.shakeMag = Math.max(this.shakeMag, 7.5);
        this.spawnBurst(g.body.position.x, g.body.position.y, 18, 'glass', '#bae6fd', 90, 260);
        this.addFloat(g.body.position.x, g.body.position.y - 24, '哗啦！玻璃碎了！', '#38bdf8', 1.1);
        Matter.Body.setVelocity(this.activeBird, {
          x: Math.max(this.activeBird.velocity.x * 0.85, 2.2),
          y: this.activeBird.velocity.y * 0.9,
        });
      }
    }

    // Step Matter.js physics
    Matter.Engine.update(this.engine, this.t.loop.fixedDtMs * simScale);

    // Clamp awning tilt range cleanly
    if (this.awningBody) {
      const clampedAngle = clamp(this.awningBody.angle, -0.56, 0.28);
      if (clampedAngle !== this.awningBody.angle) {
        Matter.Body.setAngle(this.awningBody, clampedAngle);
        Matter.Body.setAngularVelocity(this.awningBody, 0);
      }
      this.awningFlattened = isAwningFlattened(this.awningBody.angle, this.stage.awning);
    }

    // Re-pin after physics step while aiming
    if (this.phase === 'aiming') {
      Matter.Body.setPosition(this.activeBird, {
        x: this.stage.fountainX,
        y: this.stage.fountainY,
      });
      Matter.Body.setVelocity(this.activeBird, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.activeBird, 0);
      Matter.Body.setAngle(this.activeBird, 0);
    }

    // Check support contact for active bird
    const prevSupported = this.isSupported;
    const collisions = Matter.Query.collides(this.activeBird, [
      ...this.supportBodies,
      ...this.spentBirds.map((s) => s.body),
    ]);
    this.isSupported = collisions.length > 0;

    // Trigger Fat-Chonk ground/bench shockwave on impact after dive slam!
    if (this.pendingSlamShockwave && !prevSupported && this.isSupported && this.phase === 'flying') {
      this.pendingSlamShockwave = false;
      this.applyFatChonkShockwave(this.activeBird.position.x, this.activeBird.position.y);
    }

    // Gentle upright/angular damping when seated/supported
    if (this.phase === 'flying' && this.isSupported) {
      Matter.Body.setAngularVelocity(this.activeBird, this.activeBird.angularVelocity * 0.78);
      if (Math.abs(this.activeBird.angle) > 0.02) {
        Matter.Body.setAngle(this.activeBird, this.activeBird.angle * 0.88);
      }
    }

    const speedPxPerSec =
      Math.hypot(this.activeBird.velocity.x, this.activeBird.velocity.y) * 60;
    this.lastSpeedPxPerSec = speedPxPerSec;

    // Check Relay Fountain triggers (Stage 2, Stage 5 dual relays, Stage 6)
    if (this.phase === 'flying') {
      const triggeredRelay = findTriggeredRelayFountain(
        this.activeBird.position.x,
        this.activeBird.position.y,
        this.stage.relays,
        this.relayCooldowns,
      );
      if (triggeredRelay) {
        relayTriggered = true;
        this.triggerRelayBlast(triggeredRelay);
      }
    }

    // Evaluate stage-specific sub-goals
    for (const cup of this.cups) {
      if (cup.disturbed) continue;
      const moved = Math.hypot(cup.body.position.x - cup.initX, cup.body.position.y - cup.initY);
      if (moved > 14 || Math.abs(cup.body.angle) > 0.35) {
        cup.disturbed = true;
        if (this.stage.subGoalKind === 'knock_cups' && !this.subGoalCompleted) {
          this.subGoalCompleted = true;
          subGoalNewlyCompleted = true;
          this.addFloat(cup.body.position.x, cup.body.position.y - 26, '碰翻纸杯 ★2达成！', '#facc15', 1.1);
        } else if (this.stage.subGoalKind === 'preserve_cups') {
          this.addFloat(cup.body.position.x, cup.body.position.y - 26, '哎呀！纸杯倒了！', '#fb7185', 1.02);
        }
      }
    }

    if (this.stage.subGoalKind === 'preserve_cups') {
      this.subGoalCompleted = areAllCupsIntact(this.cups.map((c) => c.disturbed));
    } else if (this.stage.subGoalKind === 'dual_route_bonus' && !this.subGoalCompleted) {
      if (this.glassBrokenCount > 0 || this.relaysTriggeredIds.size >= 2) {
        this.subGoalCompleted = true;
        subGoalNewlyCompleted = true;
        this.addFloat(
          this.activeBird.position.x,
          this.activeBird.position.y - 36,
          this.glassBrokenCount > 0 ? '碎玻捷径 ★2达成！' : '双泉彩虹 ★2达成！',
          '#facc15',
          1.12,
        );
      }
    }

    // Rivals knockoff & comedic impact
    for (const r of this.rivals) {
      if (!r.knocked && this.phase === 'flying') {
        if (Matter.Query.collides(this.activeBird, [r.body]).length > 0) {
          const pushDir = r.body.position.x >= this.activeBird.position.x ? 1 : -1;
          const isBoss = r.archetype === 'red_crest';
          const isFat = this.selectedCharacter === 'fat_chonk';
          const knockVx = isBoss ? (isFat ? 280 : 120) : isFat ? 300 : 230;
          const knockVy = isBoss ? (isFat ? -295 : -130) : -270;
          Matter.Body.setVelocity(r.body, {
            x: (pushDir * knockVx) / 60,
            y: knockVy / 60,
          });
          Matter.Body.setAngularVelocity(r.body, pushDir * (isFat ? 0.24 : 0.16));
          this.spawnBurst(
            r.body.position.x,
            r.body.position.y,
            10,
            isBoss ? 'feather_red' : 'feather_white',
            isBoss ? '#ef4444' : '#ffffff',
            60,
            190,
          );
        }
      }

      if (!r.knocked) {
        Matter.Body.setAngularVelocity(r.body, r.body.angularVelocity * 0.78);
        if (isRivalKnockedOffSeat(r.body.position.x, r.body.position.y, this.stage.seat)) {
          r.knocked = true;
          this.shakeMag = Math.max(this.shakeMag, 8);
          this.spawnBurst(
            r.body.position.x,
            r.body.position.y,
            16,
            r.archetype === 'red_crest' ? 'feather_red' : 'feather_white',
            r.archetype === 'red_crest' ? '#ef4444' : '#ffffff',
            80,
            240,
          );
        }
      }
    }

    if (
      (this.stage.subGoalKind === 'knock_rivals' ||
        this.stage.subGoalKind === 'clear_boss_rivals') &&
      !this.subGoalCompleted &&
      this.rivals.length > 0 &&
      this.rivals.every((r) => r.knocked)
    ) {
      this.subGoalCompleted = true;
      subGoalNewlyCompleted = true;
      this.addFloat(
        this.stage.seat.x,
        this.stage.seat.y - 44,
        this.stage.id === 6 ? '全员清场 ★2达成！' : '白鸽飞走 ★2达成！',
        '#f59e0b',
        1.18,
      );
    }

    // Evaluate Target Seat settle (0.85s below 18 px/s; Stage 4 also requires flattened awning!)
    if (this.phase === 'flying') {
      const awningAngle = this.awningBody ? this.awningBody.angle : 0;
      const settle = evaluateSeatSettle(
        this.activeBird.position.x,
        this.activeBird.position.y,
        speedPxPerSec,
        this.isSupported,
        this.stage.seat,
        this.settleTimerSec,
        dtSec,
        this.t,
        awningAngle,
        this.stage.awning,
      );
      this.inTargetSeatZone = settle.inZone;
      this.settleTimerSec = settle.nextSettleSec;
      this.settleProgress = settle.progressRatio;

      if (this.stage.subGoalKind === 'flatten_awning' && !this.subGoalCompleted) {
        if (settle.inZone && this.awningFlattened && this.selectedCharacter === 'fat_chonk') {
          this.subGoalCompleted = true;
          subGoalNewlyCompleted = true;
          this.addFloat(this.stage.seat.x, this.stage.seat.y - 42, '压平遮阳棚 ★2达成！', '#facc15', 1.12);
        }
      }

      if (settle.settled) {
        this.phase = 'settling_win';
        this.winSlowMoTimerSec = this.t.settle.winSlowMoSec;
        this.flashAlpha = 0.92;
        this.won = true;
        settledWinStarted = true;
        if (this.stage.subGoalKind === 'flatten_awning') {
          this.subGoalCompleted = true;
        }
        this.scoreResult = evaluateLaunchStars(
          true,
          this.subGoalCompleted,
          this.pigeonsRemaining,
          this.t,
        );
        Matter.Body.setVelocity(this.activeBird, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(this.activeBird, 0);
        Matter.Body.setAngle(this.activeBird, 0);
        this.spawnBurst(
          this.activeBird.position.x,
          this.activeBird.position.y - 12,
          14,
          'spark',
          '#fde047',
          70,
          180,
        );
      } else if (!settle.inZone) {
        if (isBirdOutOfBounds(this.activeBird.position.x, this.activeBird.position.y, this.t)) {
          birdAdvanced = this.advanceNextBird();
          if ((this.phase as FlightPhase) === 'round_over') roundFinished = true;
        } else if (speedPxPerSec < this.t.settle.speedThresholdPxPerSec && this.isSupported) {
          this.offSeatStillTimerSec += rawDtSec;
          if (this.offSeatStillTimerSec >= this.t.settle.offSeatStillTimeoutSec) {
            birdAdvanced = this.advanceNextBird();
            if ((this.phase as FlightPhase) === 'round_over') roundFinished = true;
          }
        } else {
          this.offSeatStillTimerSec = 0;
        }
      } else {
        this.offSeatStillTimerSec = 0;
      }
    } else if (this.phase === 'settling_win') {
      this.winSlowMoTimerSec = Math.max(0, this.winSlowMoTimerSec - rawDtSec);
      if (this.winSlowMoTimerSec <= 0) {
        this.phase = 'round_over';
        roundFinished = true;
      }
    }

    return {
      launched: false,
      diveSlammed: false,
      relayTriggered,
      glassBroken,
      subGoalNewlyCompleted,
      settledWinStarted,
      roundFinished,
      birdAdvanced,
    };
  }
}
