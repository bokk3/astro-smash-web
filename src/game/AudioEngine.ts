/**
 * Tachyon Procedural Web Audio Engine
 * Zero external audio dependencies - 100% synthetically generated spatial sound effects
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private thrusterGain: GainNode | null = null;
  private thrusterOsc: OscillatorNode | null = null;
  private isThrusterActive: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.thrusterGain) {
      this.thrusterGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Continuous Thruster / Afterburner Sound
   */
  public updateThrusters(isThrottling: boolean, isBoosting: boolean): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    if (isThrottling || isBoosting) {
      if (!this.isThrusterActive) {
        this.isThrusterActive = true;
        this.thrusterOsc = ctx.createOscillator();
        this.thrusterGain = ctx.createGain();

        this.thrusterOsc.type = 'sawtooth';
        this.thrusterOsc.frequency.setValueAtTime(65, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, ctx.currentTime);

        this.thrusterGain.gain.setValueAtTime(0.01, ctx.currentTime);
        this.thrusterGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);

        this.thrusterOsc.connect(filter);
        filter.connect(this.thrusterGain);
        this.thrusterGain.connect(ctx.destination);
        this.thrusterOsc.start();
      }

      if (this.thrusterOsc && this.thrusterGain) {
        const targetFreq = isBoosting ? 180 : 85;
        const targetVol = isBoosting ? 0.22 : 0.10;
        this.thrusterOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
        this.thrusterGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.08);
      }
    } else if (this.isThrusterActive) {
      this.isThrusterActive = false;
      if (this.thrusterGain) {
        this.thrusterGain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.1);
        setTimeout(() => {
          if (!this.isThrusterActive && this.thrusterOsc) {
            try { this.thrusterOsc.stop(); } catch {}
            this.thrusterOsc.disconnect();
            this.thrusterOsc = null;
          }
        }, 150);
      }
    }
  }

  /**
   * Striker Hits Orb / Puck
   */
  public playBallHit(intensity: number = 1.0): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const clamped = Math.min(Math.max(intensity, 0.2), 2.5);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280 * clamped, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450 * clamped, ctx.currentTime);
    filter.Q.setValueAtTime(3.5, ctx.currentTime);

    gain.gain.setValueAtTime(0.3 * Math.min(clamped, 1.2), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  /**
   * Wall Collision Deflection
   */
  public playWallBounce(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  /**
   * Kinetic Shunt / Shockwave
   */
  public playKineticPulse(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  /**
   * Goal Detonation Resonance
   */
  public playGoalExplosion(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // Sub-bass boom
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 1.2);

    subGain.gain.setValueAtTime(0.5, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start();
    subOsc.stop(ctx.currentTime + 1.35);

    // Harmonic fanfare chords (Sci-Fi victory chord)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 1.5);
    });
  }

  /**
   * Vertical Jump Impulse
   */
  public playJump(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Dodge Roll / Flip Kinetic Burst
   */
  public playDodgeFlip(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // Fast low-to-high whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }

  /**
   * Boost Pad / Mega Canister Pickup
   */
  public playBoostPickup(isMega: boolean): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    if (isMega) {
      // 100% Mega Canister: Lush double chord
      [440, 660, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.04);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.04 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.04);
        osc.stop(ctx.currentTime + idx * 0.04 + 0.45);
      });
    } else {
      // Small Pad: Quick crystalline chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  }

  /**
   * Supersonic Sonic Boom Crack
   */
  public playSonicBoom(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /**
   * Demolition / Kinetic Obliteration Blast
   */
  public playDemolition(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // Violent explosive crunch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.7);

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  }

  /**
   * Aerodynamic Air-Roll Vortex Whoosh
   */
  public playAirRoll(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.28);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }

  /**
   * Stadium Goal Blast & Siren
   */
  public playGoalWhistle(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // Dual-tone stadium blast whistle (2400Hz + 2800Hz with high tremolo)
    [2400, 2800].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    });
  }

  /**
   * Garage Chassis / Cosmetic Equip Hydraulic Click & Plasma Charge
   */
  public playGarageEquip(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(740, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1180, t + 0.16);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }
}

