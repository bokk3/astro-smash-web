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
  public activeCamMode: 'chase' | 'drone' = 'chase';

  // State
  public scoreCyan: number = 0;
  public scoreMagenta: number = 0;
  public matchSecondsRemaining: number = 180;
  public isGoalFreeze: boolean = false;
  public goalFreezeTimer: number = 0;

  // Input Tracking
  private keyState: Record<string, boolean> = {};
  private hotasFrame: HotasFrame | null = null;
  private mousePulseTriggered: boolean = false;

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance'
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.04, 0.05, 0.07, 1.0);

    // Audio & HOTAS Systems
    this.audioEngine = new AudioEngine();
    this.hotasReceiver = new HotasReceiver('TACHYON-7492');

    // Lights
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.55;

    const dirLight = new DirectionalLight('dirLight', new Vector3(-0.3, -1, 0.4), this.scene);
    dirLight.intensity = 0.85;

    // Build World
    this.arena = new Arena(this.scene);
    this.playerStriker = new Striker(this.scene, 'cyan', new Vector3(0, 1.1, -28), 0, this.audioEngine);
    this.aiStriker = new Striker(this.scene, 'magenta', new Vector3(0, 1.1, 28), Math.PI, this.audioEngine);
    this.puck = new Puck(this.scene, this.audioEngine);

    // Cameras
    this.chaseCamera = new UniversalCamera('chaseCam', new Vector3(0, 8, -42), this.scene);
    this.chaseCamera.setTarget(this.playerStriker.position);

    this.droneCamera = new ArcRotateCamera('droneCam', -Math.PI / 2, Math.PI / 3.5, 95, new Vector3(0, 0, 0), this.scene);
    this.droneCamera.upperBetaLimit = Math.PI / 2.2;
    this.droneCamera.lowerRadiusLimit = 40;
    this.droneCamera.upperRadiusLimit = 150;

    this.scene.activeCamera = this.chaseCamera;

    // Cache HUD Elements
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
  }

  private setupInputs(): void {
    window.addEventListener('keydown', (e) => {
      this.keyState[e.code] = true;
      if (e.code === 'KeyC') {
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
      }
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
    if (this.activeCamMode === 'chase') {
      this.activeCamMode = 'drone';
      this.scene.activeCamera = this.droneCamera;
      this.droneCamera.attachControl(this.canvas, true);
    } else {
      this.activeCamMode = 'chase';
      this.scene.activeCamera = this.chaseCamera;
      this.droneCamera.detachControl();
    }
    const label = document.getElementById('camLabel');
    if (label) {
      label.textContent = this.activeCamMode === 'chase' ? 'CHASE CAM' : 'DRONE CAM';
    }
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private update(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    // Goal Freeze state
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

    // 1. Gather Player Inputs (Keyboard + HOTAS blended)
    const playerInputs = this.getPlayerInputs();

    // 2. Gather AI Inputs for Magenta Striker
    const aiInputs = this.getAiInputs(dt);

    // 3. Update Strikers
    const bounds = { width: this.arena.width, length: this.arena.length };
    this.playerStriker.update(dt, playerInputs, bounds);
    this.aiStriker.update(dt, aiInputs, bounds);

    // 4. Update Energy Puck & Detect Goals
    const goalResult = this.puck.update(dt, this.arena, [this.playerStriker, this.aiStriker]);

    if (goalResult === 'cyan_scores') {
      this.scoreCyan++;
      this.onGoal('cyan');
    } else if (goalResult === 'magenta_scores') {
      this.scoreMagenta++;
      this.onGoal('magenta');
    }

    // 5. Update Chase Camera
    if (this.activeCamMode === 'chase') {
      const targetPos = this.playerStriker.position;
      const yaw = this.playerStriker.yaw;
      // Position camera behind and above ship based on yaw
      const camOffset = new Vector3(
        -Math.sin(yaw) * 14,
        6.5,
        -Math.cos(yaw) * 14
      );
      const desiredCamPos = targetPos.add(camOffset);
      this.chaseCamera.position = Vector3.Lerp(this.chaseCamera.position, desiredCamPos, 9 * dt);
      
      const lookAtTarget = targetPos.add(new Vector3(Math.sin(yaw) * 8, 1.2, Math.cos(yaw) * 8));
      this.chaseCamera.setTarget(lookAtTarget);
    }

    // 6. Update HUD Telemetry
    this.updateHud();
  }

  private getPlayerInputs(): StrikerInputs {
    let throttle = 0;
    let steer = 0;
    let boost = false;
    let pulse = this.mousePulseTriggered;
    this.mousePulseTriggered = false;

    // Keyboard inputs
    if (this.keyState['KeyW'] || this.keyState['ArrowUp']) throttle += 1.0;
    if (this.keyState['KeyS'] || this.keyState['ArrowDown']) throttle -= 0.8;
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) steer -= 1.0;
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) steer += 1.0;
    if (this.keyState['Space']) boost = true;

    // HOTAS telemetry overlay
    if (this.hotasFrame) {
      if (Math.abs(this.hotasFrame.pitch) > 0.1) {
        throttle = -this.hotasFrame.pitch; // In cockpit, forward pitch pushes forward
      }
      if (Math.abs(this.hotasFrame.roll) > 0.1) {
        steer = this.hotasFrame.roll;
      }
      if (this.hotasFrame.throttle > 20) {
        throttle = Math.max(throttle, this.hotasFrame.throttle / 100);
      }
      if (this.hotasFrame.boost) boost = true;
      if (this.hotasFrame.fire) pulse = true;
    }

    return { throttle, steer, boost, pulse };
  }

  private getAiInputs(_dt: number): StrikerInputs {
    let throttle = 0;
    let steer = 0;
    let boost = false;

    // AI tactical behavior:
    // Target position is either the puck or defending the Magenta goal (+Z)
    const puckPos = this.puck.position;
    const aiPos = this.aiStriker.position;

    // Desired heading vector: aim at puck, or get behind puck to shoot toward Cyan goal (-Z)
    let target = puckPos.clone();
    if (puckPos.z > aiPos.z) {
      // Puck slipped behind AI: retreat back to goal line
      target = new Vector3(puckPos.x * 0.7, 0, 38);
    } else {
      // Line up shot toward Cyan goal (-Z)
      target = puckPos.add(new Vector3(0, 0, 1.5));
    }

    const toTarget = target.subtract(aiPos);
    toTarget.y = 0;
    const distToTarget = toTarget.length();

    if (distToTarget > 1.0) {
      const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
      let angleDiff = desiredYaw - this.aiStriker.yaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      steer = Math.min(Math.max(angleDiff * 1.5, -1.0), 1.0);

      if (Math.abs(angleDiff) < 0.6) {
        throttle = 1.0;
        if (distToTarget > 12 && Math.abs(angleDiff) < 0.25) {
          boost = true;
        }
      } else {
        throttle = 0.35;
      }
    }

    return { throttle, steer, boost, pulse: false };
  }

  private onGoal(scoringTeam: 'cyan' | 'magenta'): void {
    this.isGoalFreeze = true;
    this.goalFreezeTimer = 2.8;

    if (this.domScoreCyan) this.domScoreCyan.textContent = this.scoreCyan.toString();
    if (this.domScoreMagenta) this.domScoreMagenta.textContent = this.scoreMagenta.toString();

    if (this.domGoalBanner && this.domGoalTitle && this.domGoalSubtitle) {
      const speedKm = Math.round(this.puck.velocity.length() * 3.6);
      if (scoringTeam === 'cyan') {
        this.domGoalTitle.textContent = 'GOAL!';
        this.domGoalTitle.className = 'text-6xl md:text-8xl font-black italic tracking-widest text-[#00F3FF] drop-shadow-[0_0_40px_rgba(0,243,255,1)]';
        this.domGoalSubtitle.textContent = `CYAN STRIKER SCORED // ${speedKm} KM/H`;
      } else {
        this.domGoalTitle.textContent = 'GOAL!';
        this.domGoalTitle.className = 'text-6xl md:text-8xl font-black italic tracking-widest text-[#FF00FF] drop-shadow-[0_0_40px_rgba(255,0,255,1)]';
        this.domGoalSubtitle.textContent = `PULSE AI SCORED // ${speedKm} KM/H`;
      }
      this.domGoalBanner.className = 'self-center transform translate-y-0 scale-100 opacity-100 transition-all duration-300 pointer-events-none text-center animate-goal';
    }
  }

  private resetKickoff(): void {
    this.playerStriker.reset(new Vector3(0, 1.1, -28), 0);
    this.aiStriker.reset(new Vector3(0, 1.1, 28), Math.PI);
    this.puck.reset();
  }

  private updateHud(): void {
    if (this.domSpeedValue) {
      const speed = this.playerStriker.getSpeedKmH().toString().padStart(3, '0');
      this.domSpeedValue.textContent = speed;
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
