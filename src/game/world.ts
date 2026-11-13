import { tuning, type Tuning } from '../config/tuning';
import {
  clamp,
  createInitialMatchState,
  decideAiMove,
  stepMatchState,
  type AiIntent,
  type FountainPhase,
  type MatchState,
  type Occupant,
} from './rules';

export type PlayerExpression = 'smug' | 'bliss' | 'panic' | 'bump' | 'launched';

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

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind: 'water' | 'feather_white' | 'feather_dark' | 'heart' | 'spark';
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

export interface WorldStepEvents {
  readonly bumpedHit: boolean;
  readonly bumpedWhiff: boolean;
  readonly enteredPhase: FountainPhase | null;
  readonly playerHitBySurge: boolean;
  readonly aiHitBySurge: boolean;
  readonly occupant: Occupant;
  readonly combo: 1 | 2 | 3;
}

export class PigeonFountainWorld {
  readonly t: Tuning;
  match: MatchState;
  player: PigeonBody & {
    bumpCooldownSec: number;
    bumpAnimSec: number;
    expression: PlayerExpression;
  };
  ai: PigeonBody & {
    respawnTimerSec: number;
    surgeReactElapsedSec: number;
    intent: AiIntent;
  };
  occupant: Occupant = 'none';
  combo: 1 | 2 | 3 = 1;
  particles: Particle[] = [];
  floats: FloatingText[] = [];
  shakeMag = 0;

  private bubbleSpawnAcc = 0;
  private soakFxAcc = 0;

  constructor(t: Tuning = tuning) {
    this.t = t;
    this.match = createInitialMatchState(t, 1);
    this.player = {
      x: 135,
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
      expression: 'smug',
    };
    this.ai = {
      x: 260,
      y: t.scene.groundY,
      vx: 0,
      vy: 0,
      facing: -1,
      airborne: false,
      spinRad: 0,
      waddlePhase: 0,
      squashX: 1,
      squashY: 1,
      respawnTimerSec: 0,
      surgeReactElapsedSec: 0,
      intent: 'roam',
    };
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
        vy: Math.sin(ang) * spd - 40,
        r: kind.startsWith('feather') ? 5 + Math.random() * 4 : 2.5 + Math.random() * 3,
        color,
        kind,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        life: 0.65 + Math.random() * 0.45,
        maxLife: 1.1,
      });
    }
  }

  private addFloat(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floats.push({
      x: clamp(x, 60, this.t.view.width - 60),
      y,
      text,
      color,
      scale,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  step(moveDir: -1 | 0 | 1, bumpPressed: boolean, dtMs: number): WorldStepEvents {
    const dtSec = Math.min(this.t.loop.maxFrameDtMs, Math.max(0, dtMs)) / 1000;

    // Update particles & floating texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtSec;
      const grav = p.kind.startsWith('feather') ? 110 : p.kind === 'heart' ? -40 : 420;
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

    this.shakeMag = Math.max(0, this.shakeMag - 26 * dtSec);

    if (this.match.finished) {
      return {
        bumpedHit: false,
        bumpedWhiff: false,
        enteredPhase: null,
        playerHitBySurge: false,
        aiHitBySurge: false,
        occupant: this.occupant,
        combo: this.combo,
      };
    }

    // Cooldowns
    this.player.bumpCooldownSec = Math.max(0, this.player.bumpCooldownSec - dtSec);
    this.player.bumpAnimSec = Math.max(0, this.player.bumpAnimSec - dtSec);

    // Player movement
    if (!this.player.airborne) {
      if (moveDir !== 0) {
        this.player.facing = moveDir;
        this.player.vx += moveDir * this.t.pigeon.playerMoveAccel * dtSec;
        this.player.waddlePhase += dtSec * 14;
      } else {
        const drag =
          this.occupant === 'player' ? this.t.pigeon.waterDrag : this.t.pigeon.groundDrag;
        this.player.vx -= this.player.vx * Math.min(1, drag * dtSec);
      }
      if (this.player.bumpAnimSec <= 0) {
        this.player.vx = clamp(
          this.player.vx,
          -this.t.pigeon.playerMaxSpeed,
          this.t.pigeon.playerMaxSpeed,
        );
      }
    } else {
      this.player.vy += 1180 * dtSec;
      this.player.spinRad += 14 * dtSec;
    }

    // AI respawn & movement
    if (this.ai.respawnTimerSec > 0) {
      this.ai.respawnTimerSec = Math.max(0, this.ai.respawnTimerSec - dtSec);
      if (this.ai.respawnTimerSec === 0) {
        const fromLeft = this.player.x > 195;
        this.ai.x = fromLeft ? this.t.scene.stageMinX : this.t.scene.stageMaxX;
        this.ai.y = this.t.scene.groundY;
        this.ai.vx = fromLeft ? 150 : -150;
        this.ai.vy = 0;
        this.ai.airborne = false;
        this.ai.spinRad = 0;
      }
    } else if (!this.ai.airborne) {
      const decision = decideAiMove(
        {
          aiX: this.ai.x,
          playerX: this.player.x,
          fountain: this.match.fountain,
          surgeReactElapsedSec: this.ai.surgeReactElapsedSec,
          elapsedSec: this.match.elapsedSec,
        },
        this.t,
      );
      this.ai.intent = decision.intent;
      this.ai.surgeReactElapsedSec = decision.nextSurgeReactElapsedSec;
      if (decision.moveDir !== 0) {
        this.ai.facing = decision.moveDir;
        this.ai.vx += decision.moveDir * this.t.pigeon.aiMoveAccel * dtSec;
        this.ai.waddlePhase += dtSec * 12;
      } else {
        this.ai.vx -= this.ai.vx * Math.min(1, this.t.pigeon.groundDrag * dtSec);
      }
      this.ai.vx = clamp(this.ai.vx, -this.t.pigeon.aiMaxSpeed, this.t.pigeon.aiMaxSpeed);
    } else {
      this.ai.vy += 1180 * dtSec;
      this.ai.spinRad -= 15 * dtSec;
    }

    // Apply lateral fountain push to whichever pigeon sits on ACTIVE nozzle
    if (this.match.fountain.phase === 'ACTIVE') {
      const pushAccel = this.match.fountain.lateralDir * this.match.fountain.lateralStrength;
      if (this.occupant === 'player' && !this.player.airborne) {
        this.player.vx += pushAccel * dtSec;
      } else if (this.occupant === 'ai' && !this.ai.airborne && this.ai.respawnTimerSec <= 0) {
        this.ai.vx += pushAccel * 0.75 * dtSec;
      }
    }

    // Handle "肥臀猛顶" (Butt Bump!)
    let bumpedHit = false;
    let bumpedWhiff = false;
    if (bumpPressed && this.player.bumpCooldownSec <= 0 && !this.player.airborne) {
      this.player.bumpCooldownSec = this.t.pigeon.bumpCooldownSec;
      this.player.bumpAnimSec = 0.22;

      const distToAi = Math.abs(this.ai.x - this.player.x);
      const aiActive = !this.ai.airborne && this.ai.respawnTimerSec <= 0;
      const dashDir: -1 | 1 =
        aiActive && distToAi <= this.t.pigeon.bumpReachPx
          ? this.ai.x >= this.player.x
            ? 1
            : -1
          : this.player.facing;

      this.player.facing = dashDir;
      this.player.vx = dashDir * this.t.pigeon.bumpSelfDashSpeed;
      this.player.squashX = 1.28;
      this.player.squashY = 0.82;

      if (aiActive && distToAi <= this.t.pigeon.bumpReachPx) {
        bumpedHit = true;
        this.ai.vx = dashDir * this.t.pigeon.bumpKnockbackSpeed;
        this.ai.squashX = 0.78;
        this.ai.squashY = 1.24;
        this.shakeMag = Math.max(this.shakeMag, 4.5);
        this.spawnBurst(
          (this.player.x + this.ai.x) / 2,
          this.t.scene.groundY - 22,
          8,
          'spark',
          '#fde047',
          80,
          210,
        );
        this.spawnBurst(this.ai.x, this.t.scene.groundY - 24, 3, 'feather_white', '#ffffff', 50, 130);
      } else {
        bumpedWhiff = true;
      }
    }

    // Integrate positions
    this.player.x += this.player.vx * dtSec;
    this.player.y += this.player.vy * dtSec;

    if (this.ai.respawnTimerSec <= 0) {
      this.ai.x += this.ai.vx * dtSec;
      this.ai.y += this.ai.vy * dtSec;
    }

    // Soft pigeon-pigeon body collision when both are grounded
    if (!this.player.airborne && !this.ai.airborne && this.ai.respawnTimerSec <= 0) {
      const minSep = this.t.pigeon.radius * 1.65;
      const dx = this.ai.x - this.player.x;
      const absDx = Math.abs(dx);
      if (absDx < minSep) {
        const dir = dx >= 0 ? 1 : -1;
        const overlap = (minSep - absDx) * 0.5;
        this.player.x -= dir * overlap;
        this.ai.x += dir * overlap;
        this.player.vx -= dir * this.t.pigeon.softBounceSpeed * dtSec * 4;
        this.ai.vx += dir * this.t.pigeon.softBounceSpeed * dtSec * 4;
      }
    }

    // Clamp grounded pigeons to stage bounds
    if (!this.player.airborne) {
      this.player.x = clamp(this.player.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
    } else if (this.player.y >= this.t.scene.groundY && this.player.vy > 0) {
      this.player.y = this.t.scene.groundY;
      this.player.vy = 0;
      this.player.vx *= 0.3;
      this.player.airborne = false;
      this.player.spinRad = 0;
      this.player.x = clamp(this.player.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
    }

    if (this.ai.respawnTimerSec <= 0) {
      if (!this.ai.airborne) {
        this.ai.x = clamp(this.ai.x, this.t.scene.stageMinX, this.t.scene.stageMaxX);
      } else if (this.ai.y > this.t.view.height + 60 || this.ai.y < -160) {
        this.ai.airborne = false;
        this.ai.respawnTimerSec = this.t.pigeon.aiRespawnSec;
      }
    }

    // Step pure rules
    const ruleRes = stepMatchState(
      this.match,
      {
        dtSec,
        playerX: this.player.x,
        aiX: this.ai.respawnTimerSec > 0 ? -999 : this.ai.x,
        playerAirborne: this.player.airborne,
        aiAirborne: this.ai.airborne || this.ai.respawnTimerSec > 0,
      },
      this.t,
    );
    this.match = ruleRes.state;
    this.occupant = ruleRes.occupant;
    this.combo = ruleRes.combo;

    // Surge blast reactions!
    if (ruleRes.playerHitBySurge) {
      this.player.airborne = true;
      this.player.vy = -560;
      this.player.vx = (this.player.x < 195 ? 1 : -1) * 95;
      this.shakeMag = Math.max(this.shakeMag, 9);
      this.spawnBurst(this.player.x, this.t.scene.groundY - 20, 10, 'feather_dark', '#334155', 70, 210);
      this.addFloat(this.player.x, this.t.scene.groundY - 76, '哎呀！-1尾羽', '#ef4444', 1.1);
    }

    if (ruleRes.aiHitBySurge) {
      this.ai.airborne = true;
      this.ai.vy = -650;
      this.ai.vx = (this.ai.x < 195 ? -1 : 1) * 165;
      this.shakeMag = Math.max(this.shakeMag, 10);
      this.spawnBurst(this.ai.x, this.t.scene.groundY - 24, 18, 'feather_white', '#ffffff', 90, 260);
      this.addFloat(
        this.ai.x,
        this.t.scene.groundY - 92,
        `太坏了！+${this.t.scoring.sabotageBonus}`,
        '#f59e0b',
        1.25,
      );
    }

    // Water lift & squash-stretch animation
    if (!this.player.airborne) {
      const targetY =
        this.match.fountain.phase === 'ACTIVE' && this.occupant === 'player'
          ? this.t.scene.groundY -
            this.t.pigeon.waterLiftPx +
            Math.sin(this.match.elapsedSec * 14) * 3.5
          : this.t.scene.groundY;
      this.player.y += (targetY - this.player.y) * Math.min(1, 16 * dtSec);
    }
    if (!this.ai.airborne && this.ai.respawnTimerSec <= 0) {
      const targetAiY =
        this.match.fountain.phase === 'ACTIVE' && this.occupant === 'ai'
          ? this.t.scene.groundY -
            this.t.pigeon.waterLiftPx +
            Math.sin(this.match.elapsedSec * 13) * 3.5
          : this.t.scene.groundY;
      this.ai.y += (targetAiY - this.ai.y) * Math.min(1, 16 * dtSec);
    }

    // Recover squash & stretch smoothly
    this.player.squashX += (1 - this.player.squashX) * Math.min(1, 12 * dtSec);
    this.player.squashY += (1 - this.player.squashY) * Math.min(1, 12 * dtSec);
    this.ai.squashX += (1 - this.ai.squashX) * Math.min(1, 12 * dtSec);
    this.ai.squashY += (1 - this.ai.squashY) * Math.min(1, 12 * dtSec);

    // Update player expression
    const activeNozzleX = this.t.scene.nozzles[this.match.fountain.slotIndex];
    if (this.player.airborne) {
      this.player.expression = 'launched';
    } else if (this.player.bumpAnimSec > 0) {
      this.player.expression = 'bump';
    } else if (
      this.match.fountain.phase === 'SURGE_WARN' &&
      Math.abs(this.player.x - activeNozzleX) <= this.t.fountain.coreRadiusPx + 14
    ) {
      this.player.expression = 'panic';
    } else if (this.occupant === 'player' && this.match.fountain.phase === 'ACTIVE') {
      const edgeDist = Math.abs(this.player.x - activeNozzleX);
      this.player.expression = edgeDist > this.t.fountain.coreRadiusPx * 0.65 ? 'panic' : 'bliss';
    } else {
      this.player.expression = 'smug';
    }

    // Ambient fountain bubbles & soak hearts
    this.bubbleSpawnAcc += dtSec;
    if (this.match.fountain.phase === 'WARNING' && this.bubbleSpawnAcc >= 0.09) {
      this.bubbleSpawnAcc = 0;
      this.particles.push({
        x: activeNozzleX + (Math.random() - 0.5) * 28,
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
    } else if (this.match.fountain.phase === 'ACTIVE' && this.bubbleSpawnAcc >= 0.05) {
      this.bubbleSpawnAcc = 0;
      this.particles.push({
        x: activeNozzleX + (Math.random() - 0.5) * 32,
        y: this.t.scene.groundY - 42 - Math.random() * 25,
        vx: this.match.fountain.lateralDir * 35 + (Math.random() - 0.5) * 60,
        vy: -110 - Math.random() * 70,
        r: 2 + Math.random() * 2.5,
        color: '#bae6fd',
        kind: 'water',
        rot: 0,
        vrot: 0,
        life: 0.45,
        maxLife: 0.45,
      });
    }

    this.soakFxAcc += dtSec;
    if (this.occupant === 'player' && this.match.fountain.phase === 'ACTIVE' && this.soakFxAcc >= 0.38) {
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
      enteredPhase: ruleRes.enteredPhase,
      playerHitBySurge: ruleRes.playerHitBySurge,
      aiHitBySurge: ruleRes.aiHitBySurge,
      occupant: this.occupant,
      combo: this.combo,
    };
  }
}
