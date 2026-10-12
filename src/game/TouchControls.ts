/**
 * TouchControls.ts
 * Ergonomic Mobile Touchscreen Interface for Astro-Smash: Arena.
 * Features:
 * - Floating Virtual Analog Joystick on the left for Throttle & Steering / Aerial Pitch
 * - Precision Action Touch Buttons on the right (Boost, Jump/Dodge, Kinetic Shunt, Air-Roll Left, Air-Roll Right)
 * - Dynamic Ball Cam switch button
 * - Device Haptic Feedback API integration
 */

export interface MobileStrikerInputs {
  throttle: number;
  steer: number;
  boost: boolean;
  jump: boolean;
  pulse: boolean;
  airRollLeft: boolean;
  airRollRight: boolean;
  drift?: boolean;
}

export class TouchControls {
  private isTouchDevice: boolean = false;
  private isEnabled: boolean = false;

  // Touch Identifiers
  private stickTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private joystickRadius = 55;

  // Axis values
  private currentThrottle: number = 0;
  private currentSteer: number = 0;

  // Action States
  private isBoosting: boolean = false;
  private isJumpingThisFrame: boolean = false;
  private isPulsingThisFrame: boolean = false;
  private isRollingLeft: boolean = false;
  private isRollingRight: boolean = false;
  private isDrifting: boolean = false;

  // Callback for camera & garage
  private camToggleCallback: (() => void) | null = null;
  private garageToggleCallback: (() => void) | null = null;

  // DOM Elements
  private overlay: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private boostBtn: HTMLElement | null = null;
  private jumpBtn: HTMLElement | null = null;
  private pulseBtn: HTMLElement | null = null;
  private rollLBtn: HTMLElement | null = null;
  private rollRBtn: HTMLElement | null = null;
  private driftBtn: HTMLElement | null = null;
  private camBtn: HTMLElement | null = null;
  private garageBtn: HTMLElement | null = null;

  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024;
  }

  public init(): void {
    this.createDomOverlay();
    if (this.isTouchDevice) {
      this.enable(true);
    }
    this.bindEvents();
  }

  public isMobile(): boolean {
    return this.isTouchDevice;
  }

  public onCamToggle(cb: () => void): void {
    this.camToggleCallback = cb;
  }

  public onGarageToggle(cb: () => void): void {
    this.garageToggleCallback = cb;
  }

  public getActive(): boolean {
    return this.isEnabled;
  }

  public enable(enable: boolean): void {
    this.isEnabled = enable;
    if (this.overlay) {
      this.overlay.style.display = enable ? 'block' : 'none';
    }
  }

  private triggerHaptic(durationMs: number = 15): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch {}
  }

  private createDomOverlay(): void {
    if (document.getElementById('mobileTouchOverlay')) {
      this.overlay = document.getElementById('mobileTouchOverlay');
      return;
    }

    const container = document.createElement('div');
    container.id = 'mobileTouchOverlay';
    container.className = 'absolute inset-0 pointer-events-none select-none z-30 touch-none';
    container.style.display = 'none';

    container.innerHTML = `
      <!-- Left Joystick Zone -->
      <div id="touchJoystickZone" class="absolute bottom-6 left-6 w-40 h-40 pointer-events-auto flex items-center justify-center">
        <div id="touchJoystickBase" class="w-32 h-32 rounded-full border-2 border-cyan-500/30 bg-black/40 backdrop-blur-md relative flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.15)]">
          <div class="absolute inset-0 rounded-full border border-cyan-400/10 m-3"></div>
          <div id="touchJoystickKnob" class="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(0,243,255,0.6)] transform transition-transform duration-75"></div>
        </div>
      </div>

      <!-- Right Action Cluster -->
      <div class="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-end gap-3">
        <!-- Air Roll Left & Right Row + Auxiliary Settings -->
        <div class="flex items-center gap-2 mb-1">
          <button id="touchGarageBtn" class="w-11 h-11 rounded-xl bg-black/70 border border-fuchsia-500/50 text-fuchsia-400 text-xs font-mono font-bold active:scale-95 active:bg-fuchsia-950/80 backdrop-blur-md shadow-md flex items-center justify-center" title="Garage Customization">
            🛠️
          </button>
          <button id="touchRollLBtn" class="w-11 h-11 rounded-xl bg-black/60 border border-slate-700 text-cyan-400 text-xs font-mono font-bold active:scale-95 active:bg-cyan-950/80 backdrop-blur-md shadow-md flex items-center justify-center">
            ↶ Q
          </button>
          <button id="touchRollRBtn" class="w-11 h-11 rounded-xl bg-black/60 border border-slate-700 text-cyan-400 text-xs font-mono font-bold active:scale-95 active:bg-cyan-950/80 backdrop-blur-md shadow-md flex items-center justify-center">
            E ↷
          </button>
          <button id="touchCamBtn" class="w-11 h-11 rounded-xl bg-black/60 border border-slate-700 text-amber-400 text-xs font-mono font-bold active:scale-95 active:bg-amber-950/80 backdrop-blur-md shadow-md flex items-center justify-center">
            CAM
          </button>
        </div>

        <!-- Primary Action Cluster -->
        <div class="flex items-center gap-3">
          <!-- Drift / Handbrake Button -->
          <button id="touchDriftBtn" class="w-14 h-14 rounded-2xl bg-black/70 border border-amber-500/50 text-amber-400 text-xs font-mono font-bold active:scale-95 active:bg-amber-950/80 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.3)] flex flex-col items-center justify-center">
            <span class="text-sm">💨</span>
            <span class="text-[9px]">DRIFT</span>
          </button>

          <!-- Kinetic Pulse Button -->
          <button id="touchPulseBtn" class="w-14 h-14 rounded-2xl bg-black/70 border border-purple-500/50 text-fuchsia-400 text-xs font-mono font-bold active:scale-95 active:bg-fuchsia-950/80 backdrop-blur-md shadow-[0_0_15px_rgba(255,0,255,0.3)] flex flex-col items-center justify-center">
            <span class="text-sm">⚡</span>
            <span class="text-[9px]">PULSE</span>
          </button>

          <!-- Jump / Flip Button -->
          <button id="touchJumpBtn" class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-400/80 text-white font-mono font-bold text-sm active:scale-95 active:border-white shadow-[0_0_20px_rgba(0,243,255,0.4)] flex flex-col items-center justify-center">
            <span class="text-base leading-none">▲</span>
            <span class="text-[10px] tracking-wider text-cyan-300">JUMP</span>
          </button>

          <!-- Boost / Afterburner Button -->
          <button id="touchBoostBtn" class="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 text-black font-black font-mono text-base active:scale-95 shadow-[0_0_25px_rgba(0,243,255,0.8)] flex flex-col items-center justify-center">
            <span class="text-xl leading-none">🚀</span>
            <span class="text-[11px] tracking-widest uppercase">BOOST</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.overlay = container;

    this.joystickBase = document.getElementById('touchJoystickBase');
    this.joystickKnob = document.getElementById('touchJoystickKnob');
    this.boostBtn = document.getElementById('touchBoostBtn');
    this.jumpBtn = document.getElementById('touchJumpBtn');
    this.pulseBtn = document.getElementById('touchPulseBtn');
    this.rollLBtn = document.getElementById('touchRollLBtn');
    this.rollRBtn = document.getElementById('touchRollRBtn');
    this.driftBtn = document.getElementById('touchDriftBtn');
    this.camBtn = document.getElementById('touchCamBtn');
    this.garageBtn = document.getElementById('touchGarageBtn');
  }

  private bindEvents(): void {
    const zone = document.getElementById('touchJoystickZone');
    if (zone) {
      zone.addEventListener('touchstart', (e) => this.handleJoystickStart(e), { passive: false });
      zone.addEventListener('touchmove', (e) => this.handleJoystickMove(e), { passive: false });
      zone.addEventListener('touchend', (e) => this.handleJoystickEnd(e), { passive: false });
      zone.addEventListener('touchcancel', (e) => this.handleJoystickEnd(e), { passive: false });
    }

    // Boost button
    if (this.boostBtn) {
      this.boostBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isBoosting = true;
        this.triggerHaptic(20);
      }, { passive: false });

      const endBoost = (e: TouchEvent) => {
        e.preventDefault();
        this.isBoosting = false;
      };
      this.boostBtn.addEventListener('touchend', endBoost, { passive: false });
      this.boostBtn.addEventListener('touchcancel', endBoost, { passive: false });
    }

    // Jump button
    if (this.jumpBtn) {
      this.jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isJumpingThisFrame = true;
        this.triggerHaptic(15);
      }, { passive: false });
    }

    // Pulse button
    if (this.pulseBtn) {
      this.pulseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isPulsingThisFrame = true;
        this.triggerHaptic(25);
      }, { passive: false });
    }

    // Roll Left button
    if (this.rollLBtn) {
      this.rollLBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isRollingLeft = true;
        this.triggerHaptic(10);
      }, { passive: false });
      const endRollL = (e: TouchEvent) => {
        e.preventDefault();
        this.isRollingLeft = false;
      };
      this.rollLBtn.addEventListener('touchend', endRollL, { passive: false });
      this.rollLBtn.addEventListener('touchcancel', endRollL, { passive: false });
    }

    // Roll Right button
    if (this.rollRBtn) {
      this.rollRBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isRollingRight = true;
        this.triggerHaptic(10);
      }, { passive: false });
      const endRollR = (e: TouchEvent) => {
        e.preventDefault();
        this.isRollingRight = false;
      };
      this.rollRBtn.addEventListener('touchend', endRollR, { passive: false });
      this.rollRBtn.addEventListener('touchcancel', endRollR, { passive: false });
    }

    // Drift / Handbrake button
    if (this.driftBtn) {
      this.driftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isDrifting = true;
        this.triggerHaptic(14);
      }, { passive: false });
      const endDrift = (e: TouchEvent) => {
        e.preventDefault();
        this.isDrifting = false;
      };
      this.driftBtn.addEventListener('touchend', endDrift, { passive: false });
      this.driftBtn.addEventListener('touchcancel', endDrift, { passive: false });
    }

    // Cam button
    if (this.camBtn) {
      this.camBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.triggerHaptic(15);
        if (this.camToggleCallback) this.camToggleCallback();
      }, { passive: false });
    }

    // Garage button
    if (this.garageBtn) {
      this.garageBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.triggerHaptic(18);
        if (this.garageToggleCallback) this.garageToggleCallback();
      }, { passive: false });
    }
  }

  private handleJoystickStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.stickTouchId !== null) return;

    const touch = e.changedTouches[0];
    this.stickTouchId = touch.identifier;

    if (this.joystickBase) {
      const rect = this.joystickBase.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }

    this.processJoystickPosition(touch.clientX, touch.clientY);
  }

  private handleJoystickMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.stickTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.stickTouchId) {
        this.processJoystickPosition(touch.clientX, touch.clientY);
        break;
      }
    }
  }

  private handleJoystickEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.stickTouchId) {
        this.stickTouchId = null;
        this.currentThrottle = 0;
        this.currentSteer = 0;
        if (this.joystickKnob) {
          this.joystickKnob.style.transform = 'translate(0px, 0px)';
        }
        break;
      }
    }
  }

  private processJoystickPosition(touchX: number, touchY: number): void {
    const dx = touchX - this.joystickCenter.x;
    const dy = touchY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, this.joystickRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    // X axis: Steering (-1 left to +1 right)
    this.currentSteer = (knobX / this.joystickRadius);
    // Y axis: Throttle / Air Pitch (+1 forward/up to -1 reverse/down)
    this.currentThrottle = -(knobY / this.joystickRadius);
  }

  public getInputs(): MobileStrikerInputs {
    const jump = this.isJumpingThisFrame;
    this.isJumpingThisFrame = false;

    const pulse = this.isPulsingThisFrame;
    this.isPulsingThisFrame = false;

    return {
      throttle: this.currentThrottle,
      steer: this.currentSteer,
      boost: this.isBoosting,
      jump,
      pulse,
      airRollLeft: this.isRollingLeft,
      airRollRight: this.isRollingRight,
      drift: this.isDrifting
    };
  }
}
