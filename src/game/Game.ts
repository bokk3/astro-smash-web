import {
  Engine,
  Scene,
  Vector3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  UniversalCamera,
  ArcRotateCamera
} from '@babylonjs/core';
import { Arena } from './Arena';
import { Striker, type StrikerInputs } from './Striker';
import { Puck } from './Puck';
import { AudioEngine } from './AudioEngine';
import { HotasReceiver, type HotasFrame } from './HotasReceiver';

export class Game {
  public canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;
  public audioEngine: AudioEngine;
  public hotasReceiver: HotasReceiver;

  // Game Objects
  public arena: Arena;
  public playerStriker: Striker;
  public aiStriker: Striker;
  public puck: Puck;

  // Cameras
  public chaseCamera: UniversalCamera;
  public droneCamera: ArcRotateCamera;
  public activeCamMode: 'ball' | 'chase' | 'drone' = 'ball';

  // Match State
  public scoreCyan: number = 0;
  public scoreMagenta: number = 0;
  public matchSecondsRemaining: number = 180;
  public isGoalFreeze: boolean = false;
  public goalFreezeTimer: number = 0;

  // Input Tracking
  private keyState: Record<string, boolean> = {};
  private hotasFrame: HotasFrame | null = null;
  private mousePulseTriggered: boolean = false;
  private jumpPressedThisFrame: boolean = false;

  // DOM Elements Cache
  private domScoreCyan: HTMLElement | null = null;
  private domScoreMagenta: HTMLElement | null = null;
  private domMatchTimer: HTMLElement | null = null;
  private domSpeedValue: HTMLElement | null = null;
  private domBoostPercent: HTMLElement | null = null;
  private domBoostBar: HTMLElement | null = null;
  private domPulseStatus: HTMLElement | null = null;
  private domGoalBanner: HTMLElement | null = null;
  private domGoalTitle: HTMLElement | null = null;
  private domGoalSubtitle: HTMLElement | null = null;
  private domHotasIndicator: HTMLElement | null = null;
  private domHotasLabel: HTMLElement | null = null;
  private domCamLabel: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance'
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.04, 0.05, 0.07, 1.0);

    // Audio & Systems
    this.audioEngine = new AudioEngine();
    this.hotasReceiver = new HotasReceiver('TACHYON-7492');

    // Lights
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.55;

    const dirLight = new DirectionalLight('dirLight', new Vector3(-0.3, -1, 0.4), this.scene);
    dirLight.intensity = 0.9;

    // Build World
    this.arena = new Arena(this.scene, this.audioEngine);
    this.playerStriker = new Striker(this.scene, 'cyan', new Vector3(0, 1.1, -30), 0, this.audioEngine);
    this.aiStriker = new Striker(this.scene, 'magenta', new Vector3(0, 1.1, 30), Math.PI, this.audioEngine);
    this.puck = new Puck(this.scene, this.audioEngine);

    // Cameras
    this.chaseCamera = new UniversalCamera('chaseCam', new Vector3(0, 8, -45), this.scene);
    this.chaseCamera.setTarget(this.playerStriker.position);

    this.droneCamera = new ArcRotateCamera('droneCam', -Math.PI / 2, Math.PI / 3.4, 100, new Vector3(0, 0, 0), this.scene);
    this.droneCamera.upperBetaLimit = Math.PI / 2.2;
    this.droneCamera.lowerRadiusLimit = 40;
    this.droneCamera.upperRadiusLimit = 160;

    this.scene.activeCamera = this.chaseCamera;

    // Cache HUD & Setup Listeners
    this.cacheDomElements();
    this.setupInputs();
    this.setupHotasHooks();
    this.setupResize();

    // Start Engine Loop
    this.engine.runRenderLoop(() => {
      this.update();
      this.scene.render();
    });
  }

  private cacheDomElements(): void {
    this.domScoreCyan = document.getElementById('scoreCyan');
    this.domScoreMagenta = document.getElementById('scoreMagenta');
    this.domMatchTimer = document.getElementById('matchTimer');
    this.domSpeedValue = document.getElementById('speedValue');
    this.domBoostPercent = document.getElementById('boostPercent');
    this.domBoostBar = document.getElementById('boostBar');
    this.domPulseStatus = document.getElementById('pulseStatus');
    this.domGoalBanner = document.getElementById('goalBanner');
    this.domGoalTitle = document.getElementById('goalTitle');
    this.domGoalSubtitle = document.getElementById('goalSubtitle');
    this.domHotasIndicator = document.getElementById('hotasIndicator');
    this.domHotasLabel = document.getElementById('hotasLabel');
    this.domCamLabel = document.getElementById('camLabel');
  }

  private setupInputs(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.keyState[e.code]) {
        if (e.code === 'KeyJ' || e.code === 'Space') {
          this.jumpPressedThisFrame = true;
        }
      }
      this.keyState[e.code] = true;

      // Camera toggle: C or B toggles Ball Cam / Chase Cam
      if (e.code === 'KeyC' || e.code === 'KeyB') {
        this.toggleCamera();
      }
      if (e.code === 'KeyF') {
        this.mousePulseTriggered = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mousePulseTriggered = true;
      } else if (e.button === 2) {
        this.jumpPressedThisFrame = true;
      }
    });

    // Prevent context menu on right click (so right click jumps cleanly)
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Sound toggle button
    const soundBtn = document.getElementById('soundToggle');
    soundBtn?.addEventListener('click', () => {
      const isMuted = !this.audioEngine.isMuted();
      this.audioEngine.setMuted(isMuted);
      const label = document.getElementById('soundLabel');
      const icon = document.getElementById('soundIcon');
      if (label && icon) {
        label.textContent = isMuted ? 'SFX: MUTED' : 'SFX: ON';
        icon.textContent = isMuted ? '🔇' : '🔊';
      }
    });

    // Camera toggle button
    const camBtn = document.getElementById('camToggle');
    camBtn?.addEventListener('click', () => {
      this.toggleCamera();
    });

    // HOTAS modal open/close
    const hotasBtn = document.getElementById('hotasBtn');
    const hotasModal = document.getElementById('hotasModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalDoneBtn = document.getElementById('modalDoneBtn');

    hotasBtn?.addEventListener('click', () => {
      hotasModal?.classList.remove('hidden');
    });
    closeModalBtn?.addEventListener('click', () => {
      hotasModal?.classList.add('hidden');
    });
    modalDoneBtn?.addEventListener('click', () => {
      hotasModal?.classList.add('hidden');
    });
  }

  private setupHotasHooks(): void {
    this.hotasReceiver.onFrame((frame) => {
      this.hotasFrame = frame;
      if (frame.rcsUp) {
        this.jumpPressedThisFrame = true;
      }
    });

    this.hotasReceiver.onConnectionChange((connected) => {
      if (this.domHotasIndicator && this.domHotasLabel) {
        if (connected) {
          this.domHotasIndicator.className = 'w-2 h-2 rounded-full bg-[#00F3FF] shadow-[0_0_8px_#00F3FF]';
          this.domHotasLabel.textContent = 'HOTAS: CONNECTED (60Hz)';
        } else {
          this.domHotasIndicator.className = 'w-2 h-2 rounded-full bg-amber-500';
          this.domHotasLabel.textContent = 'HOTAS: DISCONNECTED';
        }
      }
    });
  }

  public toggleCamera(): void {
    if (this.activeCamMode === 'ball') {
      this.activeCamMode = 'chase';
      this.scene.activeCamera = this.chaseCamera;
      this.droneCamera.detachControl();
    } else if (this.activeCamMode === 'chase') {
      this.activeCamMode = 'drone';
      this.scene.activeCamera = this.droneCamera;
      this.droneCamera.attachControl(this.canvas, true);
    } else {
      this.activeCamMode = 'ball';
      this.scene.activeCamera = this.chaseCamera;
      this.droneCamera.detachControl();
    }

    if (this.domCamLabel) {
      if (this.activeCamMode === 'ball') this.domCamLabel.textContent = 'BALL CAM (LOCKED)';
      else if (this.activeCamMode === 'chase') this.domCamLabel.textContent = 'CHASE CAM';
      else this.domCamLabel.textContent = 'DRONE CAM';
    }
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private update(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    // Goal Freeze state & Slow-Mo
    if (this.isGoalFreeze) {
      this.goalFreezeTimer -= dt;
      if (this.goalFreezeTimer <= 0) {
        this.isGoalFreeze = false;
        this.resetKickoff();
        if (this.domGoalBanner) {
          this.domGoalBanner.className = 'self-center transform -translate-y-8 scale-90 opacity-0 transition-all duration-300 pointer-events-none text-center';
        }
      }
      return;
    }

    // Match Timer Countdown
    this.matchSecondsRemaining = Math.max(0, this.matchSecondsRemaining - dt);
    const mins = Math.floor(this.matchSecondsRemaining / 60);
    const secs = Math.floor(this.matchSecondsRemaining % 60);
    if (this.domMatchTimer) {
      this.domMatchTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 1. Gather Player Inputs
    const playerInputs = this.getPlayerInputs();

    // 2. Gather AI Inputs
    const aiInputs = this.getAiInputs(dt);

    // 3. Update Arena Boost Pads
    this.arena.update(dt);

    // Check Boost Pickups
    const playerBoostGained = this.arena.checkBoostPickups(this.playerStriker.position);
    if (playerBoostGained > 0) this.playerStriker.addBoost(playerBoostGained);

    const aiBoostGained = this.arena.checkBoostPickups(this.aiStriker.position);
    if (aiBoostGained > 0) this.aiStriker.addBoost(aiBoostGained);

    // 4. Update Strikers
    const bounds = { width: this.arena.width, length: this.arena.length, wallHeight: this.arena.wallHeight };
    this.playerStriker.update(dt, playerInputs, bounds);
    this.aiStriker.update(dt, aiInputs, bounds);

    // 5. Check Striker-on-Striker Collisions & Supersonic Demolitions
    this.checkVehicleCollisions();

    // 6. Update Energy Ball & Check Goals
    const goalResult = this.puck.update(dt, this.arena, [this.playerStriker, this.aiStriker]);

    if (goalResult === 'cyan_scores') {
      this.scoreCyan++;
      this.onGoal('cyan');
    } else if (goalResult === 'magenta_scores') {
      this.scoreMagenta++;
      this.onGoal('magenta');
    }

    // 7. Update Dynamic Camera
    this.updateCamera(dt);

    // 8. Update HUD
    this.updateHud();
  }

  private checkVehicleCollisions(): void {
    if (this.playerStriker.isDemolished || this.aiStriker.isDemolished) return;

    const diff = this.playerStriker.position.subtract(this.aiStriker.position);
    const dist = diff.length();
    const minDist = 3.6;

    if (dist < minDist && dist > 0.001) {
      const normal = diff.scale(1 / dist);

      // Check Demolitions: If one is supersonic and ramming into the other
      if (this.playerStriker.isSupersonic && !this.aiStriker.isSupersonic) {
        this.aiStriker.demolish();
        return;
      } else if (this.aiStriker.isSupersonic && !this.playerStriker.isSupersonic) {
        this.playerStriker.demolish();
        return;
      }

      // Elastic vehicle bump
      this.playerStriker.position.addInPlace(normal.scale((minDist - dist) * 0.5));
      this.aiStriker.position.subtractInPlace(normal.scale((minDist - dist) * 0.5));

      const relVel = this.playerStriker.velocity.subtract(this.aiStriker.velocity);
      const impulse = normal.scale(Vector3.Dot(relVel, normal) * 0.85);

      this.playerStriker.velocity.subtractInPlace(impulse);
      this.aiStriker.velocity.addInPlace(impulse);
      this.audioEngine.playWallBounce();
    }
  }

  private getPlayerInputs(): StrikerInputs {
    let throttle = 0;
    let steer = 0;
    let boost = false;
    let jump = this.jumpPressedThisFrame;
    this.jumpPressedThisFrame = false;
    let pulse = this.mousePulseTriggered;
    this.mousePulseTriggered = false;

    // Keyboard bindings
    if (this.keyState['KeyW'] || this.keyState['ArrowUp']) throttle += 1.0;
    if (this.keyState['KeyS'] || this.keyState['ArrowDown']) throttle -= 0.85;
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) steer -= 1.0;
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) steer += 1.0;

    // Shift or Space for Turbo Boost
    if (this.keyState['ShiftLeft'] || this.keyState['ShiftRight']) boost = true;

    // HOTAS telemetry blending
    if (this.hotasFrame) {
      if (Math.abs(this.hotasFrame.pitch) > 0.1) {
        throttle = -this.hotasFrame.pitch;
      }
      if (Math.abs(this.hotasFrame.roll) > 0.1) {
        steer = this.hotasFrame.roll;
      }
      if (this.hotasFrame.throttle > 15) {
        throttle = Math.max(throttle, this.hotasFrame.throttle / 100);
      }
      if (this.hotasFrame.boost) boost = true;
      if (this.hotasFrame.fire) pulse = true;
    }

    return { throttle, steer, boost, jump, pulse };
  }

  private getAiInputs(_dt: number): StrikerInputs {
    let throttle = 0;
    let steer = 0;
    let boost = false;
    let jump = false;

    if (this.aiStriker.isDemolished) {
      return { throttle: 0, steer: 0, boost: false, jump: false, pulse: false };
    }

    const ballPos = this.puck.position;
    const aiPos = this.aiStriker.position;

    // Target calculation: defend Magenta goal (+Z) or strike towards Cyan goal (-Z)
    let target = ballPos.clone();
    if (ballPos.z > aiPos.z) {
      target = new Vector3(ballPos.x * 0.6, 0, 42); // Retreat to goal line
    } else {
      target = ballPos.add(new Vector3(0, 0, 1.8)); // Line up shot towards -Z
    }

    const toTarget = target.subtract(aiPos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist > 1.2) {
      const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
      let angleDiff = desiredYaw - this.aiStriker.yaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      steer = Math.min(Math.max(angleDiff * 1.6, -1.0), 1.0);

      if (Math.abs(angleDiff) < 0.65) {
        throttle = 1.0;
        if (dist > 14 && Math.abs(angleDiff) < 0.28 && this.aiStriker.boostMeter > 25) {
          boost = true;
        }
        // AI Jump / Dodge Flip shot when close to the ball
        if (dist < 6.5 && Math.abs(angleDiff) < 0.35 && this.aiStriker.isGrounded) {
          jump = true;
        }
      } else {
        throttle = 0.4;
      }
    }

    // Aerial save if ball is high above goal
    if (ballPos.z > 25 && ballPos.y > 4 && dist < 12 && this.aiStriker.boostMeter > 30) {
      jump = true;
      boost = true;
    }

    return { throttle, steer, boost, jump, pulse: false };
  }

  private updateCamera(dt: number): void {
    if (this.activeCamMode === 'drone') return;

    const shipPos = this.playerStriker.position;
    const shipYaw = this.playerStriker.yaw;
    const ballPos = this.puck.position;

    if (this.activeCamMode === 'ball') {
      // Dynamic Ball Cam: Positioned behind craft, dynamically aiming at the ball
      const toBall = ballPos.subtract(shipPos);

      // Camera sits behind ship, biased towards ball vector
      const behindVec = new Vector3(-Math.sin(shipYaw), 0, -Math.cos(shipYaw));
      const ballNorm = toBall.clone().normalize();

      // Blend between ship heading and ball angle for natural feel
      const camDir = Vector3.Lerp(behindVec, ballNorm.scale(-1), 0.55).normalize();
      const camOffset = camDir.scale(15).add(new Vector3(0, 6.8, 0));
      const desiredPos = shipPos.add(camOffset);

      this.chaseCamera.position = Vector3.Lerp(this.chaseCamera.position, desiredPos, 11 * dt);

      // Look at a point between ship and ball so both remain in view
      const targetFocus = Vector3.Lerp(shipPos.add(new Vector3(0, 1.5, 0)), ballPos, 0.45);
      this.chaseCamera.setTarget(targetFocus);
    } else {
      // Standard Chase Cam
      const camOffset = new Vector3(-Math.sin(shipYaw) * 14.5, 6.2, -Math.cos(shipYaw) * 14.5);
      const desiredPos = shipPos.add(camOffset);
      this.chaseCamera.position = Vector3.Lerp(this.chaseCamera.position, desiredPos, 10 * dt);

      const lookAt = shipPos.add(new Vector3(Math.sin(shipYaw) * 8, 1.2, Math.cos(shipYaw) * 8));
      this.chaseCamera.setTarget(lookAt);
    }
  }

  private onGoal(scoringTeam: 'cyan' | 'magenta'): void {
    this.isGoalFreeze = true;
    this.goalFreezeTimer = 3.0;

    if (this.domScoreCyan) this.domScoreCyan.textContent = this.scoreCyan.toString();
    if (this.domScoreMagenta) this.domScoreMagenta.textContent = this.scoreMagenta.toString();

    // Goal Radial Shockwave flings all crafts
    const goalCenter = new Vector3(0, 3, scoringTeam === 'cyan' ? 52 : -52);
    [this.playerStriker, this.aiStriker].forEach(ship => {
      const blastDir = ship.position.subtract(goalCenter).normalize();
      ship.velocity = blastDir.scale(38);
      ship.velocity.y = 22;
      ship.isGrounded = false;
    });

    if (this.domGoalBanner && this.domGoalTitle && this.domGoalSubtitle) {
      const speedKm = Math.round(this.puck.velocity.length() * 3.6);
      if (scoringTeam === 'cyan') {
        this.domGoalTitle.textContent = 'GOAL!';
        this.domGoalTitle.className = 'text-6xl md:text-8xl font-black italic tracking-widest text-[#00F3FF] drop-shadow-[0_0_45px_rgba(0,243,255,1)]';
        this.domGoalSubtitle.textContent = `CYAN STRIKER SCORED // ${speedKm} KM/H BOOMER`;
      } else {
        this.domGoalTitle.textContent = 'GOAL!';
        this.domGoalTitle.className = 'text-6xl md:text-8xl font-black italic tracking-widest text-[#FF00FF] drop-shadow-[0_0_45px_rgba(255,0,255,1)]';
        this.domGoalSubtitle.textContent = `PULSE AI SCORED // ${speedKm} KM/H REBOUND`;
      }
      this.domGoalBanner.className = 'self-center transform translate-y-0 scale-100 opacity-100 transition-all duration-300 pointer-events-none text-center animate-goal';
    }
  }

  private resetKickoff(): void {
    this.playerStriker.reset(new Vector3(0, 1.1, -30), 0);
    this.aiStriker.reset(new Vector3(0, 1.1, 30), Math.PI);
    this.puck.reset();
  }

  private updateHud(): void {
    if (this.domSpeedValue) {
      const speed = this.playerStriker.getSpeedKmH();
      this.domSpeedValue.textContent = speed.toString().padStart(3, '0');
      if (this.playerStriker.isSupersonic) {
        this.domSpeedValue.className = 'text-3xl font-black font-mono text-[#00F3FF] leading-none animate-pulse drop-shadow-[0_0_15px_#00F3FF]';
      } else {
        this.domSpeedValue.className = 'text-3xl font-black font-mono text-white leading-none';
      }
    }

    if (this.domBoostPercent && this.domBoostBar) {
      const pct = Math.round(this.playerStriker.boostMeter);
      this.domBoostPercent.textContent = `${pct}%`;
      this.domBoostBar.style.width = `${pct}%`;
    }

    if (this.domPulseStatus) {
      if (this.playerStriker.pulseCooldown <= 0) {
        this.domPulseStatus.textContent = 'READY';
        this.domPulseStatus.className = 'text-xs font-mono font-bold text-cyan-400 mt-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,243,255,0.4)]';
      } else {
        const cd = this.playerStriker.pulseCooldown.toFixed(1);
        this.domPulseStatus.textContent = `${cd}S`;
        this.domPulseStatus.className = 'text-xs font-mono font-bold text-slate-500 mt-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800';
      }
    }
  }
}
