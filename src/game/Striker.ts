import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  ParticleSystem
} from '@babylonjs/core';
import type { AudioEngine } from './AudioEngine';

export interface StrikerInputs {
  throttle: number; // -1 to 1 (W/S or HOTAS)
  steer: number;    // -1 to 1 (A/D or HOTAS Roll/Yaw)
  boost: boolean;   // Space / Left-Shift / HOTAS boost
  jump: boolean;    // KeyJ / Right-Click / HOTAS secondary jump
  pulse: boolean;   // KeyF / Left-Click / HOTAS fire
}

export class Striker {
  public scene: Scene;
  public rootMesh: Mesh;
  public team: 'cyan' | 'magenta';
  public audioEngine: AudioEngine;

  // Transform & Kinematics
  public position: Vector3;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public yaw: number = 0;
  public pitch: number = 0;
  public roll: number = 0;

  // 3D Flight & Aerodynamics
  public maxSpeed: number = 30;          // Standard top ground speed
  public boostMaxSpeed: number = 52;     // Afterburner speed
  public supersonicSpeed: number = 44;   // Supersonic threshold
  public acceleration: number = 40;
  public groundTurnSpeed: number = 3.8;  // Radians per sec
  public airTurnSpeed: number = 4.2;     // Air rotational agility
  public linearDrag: number = 0.94;
  public gravity: number = 28;           // 3D downward gravity

  // Jump & Dodge Flip Mechanics
  public isGrounded: boolean = true;
  public jumpCount: number = 0;
  public jumpCooldown: number = 0;
  public airTime: number = 0;
  public isDodgeFlipping: boolean = false;
  public dodgeFlipTimer: number = 0;
  public dodgeFlipDuration: number = 0.65;
  public dodgeFlipType: 'front' | 'back' | 'left' | 'right' | 'diagonal' | 'neutral' = 'neutral';

  // Supersonic & Demolition State
  public isSupersonic: boolean = false;
  private supersonicTriggered: boolean = false;
  public isDemolished: boolean = false;
  public demolishTimer: number = 0;

  // Boost Resource (Standard competitive start: 33%)
  public boostMeter: number = 33;
  public boostDepleteRate: number = 34; // Per sec
  public isBoosting: boolean = false;

  // Kinetic Pulse
  public pulseCooldown: number = 0;
  public isPulseActive: boolean = false;

  // Visuals & Effects
  private thrusterParticles: ParticleSystem | null = null;
  private supersonicTrails: ParticleSystem | null = null;
  private glowMat: StandardMaterial;

  constructor(scene: Scene, team: 'cyan' | 'magenta', initialPos: Vector3, initialYaw: number, audioEngine: AudioEngine) {
    this.scene = scene;
    this.team = team;
    this.position = initialPos.clone();
    this.yaw = initialYaw;
    this.audioEngine = audioEngine;

    const primaryColor = team === 'cyan' ? new Color3(0, 0.95, 1) : new Color3(1, 0, 0.95);
    this.glowMat = new StandardMaterial(`striker_glow_${team}`, scene);
    this.glowMat.emissiveColor = primaryColor;
    this.glowMat.diffuseColor = primaryColor.scale(0.8);

    this.rootMesh = this.buildShipMesh(primaryColor);
    this.rootMesh.position = this.position;
    this.rootMesh.rotation.y = this.yaw;

    this.initThrusterFX(primaryColor);
    this.initSupersonicFX(primaryColor);
  }

  private buildShipMesh(primaryColor: Color3): Mesh {
    const parent = new Mesh(`striker_${this.team}`, this.scene);

    const bodyMat = new StandardMaterial(`ship_body_${this.team}`, this.scene);
    bodyMat.diffuseColor = new Color3(0.08, 0.09, 0.12);
    bodyMat.specularColor = new Color3(0.8, 0.9, 1.0);
    bodyMat.roughness = 0.3;

    // Aerodynamic Wedge Chassis
    const fuselage = MeshBuilder.CreateCylinder(`fuselage_${this.team}`, {
      diameterTop: 0.6,
      diameterBottom: 2.5,
      height: 4.6,
      tessellation: 6
    }, this.scene);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scaling.y = 0.6;
    fuselage.material = bodyMat;
    fuselage.parent = parent;

    // Glowing Cockpit Canopy
    const cockpit = MeshBuilder.CreateSphere(`canopy_${this.team}`, {
      diameterX: 1.1,
      diameterY: 0.8,
      diameterZ: 2.1,
      segments: 16
    }, this.scene);
    cockpit.position = new Vector3(0, 0.45, 0.2);
    cockpit.material = this.glowMat;
    cockpit.parent = parent;

    // Swept High-Velocity Wings
    const wingMat = new StandardMaterial(`wing_${this.team}`, this.scene);
    wingMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    wingMat.emissiveColor = primaryColor.scale(0.25);

    const leftWing = MeshBuilder.CreateBox(`left_wing_${this.team}`, {
      width: 2.4,
      height: 0.15,
      depth: 1.9
    }, this.scene);
    leftWing.position = new Vector3(-1.9, 0.1, -0.6);
    leftWing.rotation.y = -0.3;
    leftWing.rotation.z = 0.1;
    leftWing.material = wingMat;
    leftWing.parent = parent;

    const rightWing = MeshBuilder.CreateBox(`right_wing_${this.team}`, {
      width: 2.4,
      height: 0.15,
      depth: 1.9
    }, this.scene);
    rightWing.position = new Vector3(1.9, 0.1, -0.6);
    rightWing.rotation.y = 0.3;
    rightWing.rotation.z = -0.1;
    rightWing.material = wingMat;
    rightWing.parent = parent;

    // Wingtip Beacons
    const beaconMat = new StandardMaterial(`beacon_${this.team}`, this.scene);
    beaconMat.emissiveColor = primaryColor;
    beaconMat.disableLighting = true;

    const leftBeacon = MeshBuilder.CreateSphere(`l_beacon_${this.team}`, { diameter: 0.38 }, this.scene);
    leftBeacon.position = new Vector3(-2.9, 0.2, -1.0);
    leftBeacon.material = beaconMat;
    leftBeacon.parent = parent;

    const rightBeacon = MeshBuilder.CreateSphere(`r_beacon_${this.team}`, { diameter: 0.38 }, this.scene);
    rightBeacon.position = new Vector3(2.9, 0.2, -1.0);
    rightBeacon.material = beaconMat;
    rightBeacon.parent = parent;

    // Twin High-Thrust Exhaust Rings
    const exhaustMat = new StandardMaterial(`exhaust_${this.team}`, this.scene);
    exhaustMat.emissiveColor = primaryColor;
    exhaustMat.disableLighting = true;

    const exhaustL = MeshBuilder.CreateTorus(`exhaust_l_${this.team}`, { diameter: 0.75, thickness: 0.18 }, this.scene);
    exhaustL.position = new Vector3(-0.75, 0.05, -2.2);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.material = exhaustMat;
    exhaustL.parent = parent;

    const exhaustR = MeshBuilder.CreateTorus(`exhaust_r_${this.team}`, { diameter: 0.75, thickness: 0.18 }, this.scene);
    exhaustR.position = new Vector3(0.75, 0.05, -2.2);
    exhaustR.rotation.x = Math.PI / 2;
    exhaustR.material = exhaustMat;
    exhaustR.parent = parent;

    return parent;
  }

  private initThrusterFX(primaryColor: Color3): void {
    const emitter = MeshBuilder.CreateBox(`thruster_emitter_${this.team}`, { size: 0.1 }, this.scene);
    emitter.position = new Vector3(0, 0, -2.3);
    emitter.isVisible = false;
    emitter.parent = this.rootMesh;

    const ps = new ParticleSystem(`particles_${this.team}`, 180, this.scene);
    ps.emitter = emitter;
    ps.minSize = 0.25;
    ps.maxSize = 0.75;
    ps.minLifeTime = 0.08;
    ps.maxLifeTime = 0.3;
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0, 0);
    ps.direction1 = new Vector3(-0.4, -0.1, -1.5);
    ps.direction2 = new Vector3(0.4, 0.1, -2.0);
    ps.color1 = primaryColor.toColor4(0.95);
    ps.color2 = new Color3(1, 1, 1).toColor4(0.95);
    ps.colorDead = new Color3(0, 0, 0).toColor4(0.0);
    ps.start();

    this.thrusterParticles = ps;
  }

  private initSupersonicFX(primaryColor: Color3): void {
    const emitter = MeshBuilder.CreateBox(`supersonic_emitter_${this.team}`, { size: 0.1 }, this.scene);
    emitter.position = new Vector3(0, 0, -1.0);
    emitter.isVisible = false;
    emitter.parent = this.rootMesh;

    const ps = new ParticleSystem(`supersonic_trails_${this.team}`, 120, this.scene);
    ps.emitter = emitter;
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.4;
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.direction1 = new Vector3(-1.2, 0, -2.5);
    ps.direction2 = new Vector3(1.2, 0, -2.5);
    ps.color1 = new Color3(1, 1, 1).toColor4(0.9);
    ps.color2 = primaryColor.toColor4(0.8);
    ps.colorDead = new Color3(0, 0, 0).toColor4(0.0);
    ps.start();

    this.supersonicTrails = ps;
  }

  public update(dt: number, inputs: StrikerInputs, arenaBounds: { width: number, length: number, wallHeight: number }): void {
    // 1. Demolition Respawn Handling
    if (this.isDemolished) {
      this.demolishTimer -= dt;
      if (this.demolishTimer <= 0) {
        this.isDemolished = false;
        this.rootMesh.setEnabled(true);
        const spawnZ = this.team === 'cyan' ? -38 : 38;
        this.reset(new Vector3(0, 1.1, spawnZ), this.team === 'cyan' ? 0 : Math.PI);
      }
      return;
    }

    // 2. Jump & Dodge Flip Handling
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

    if (this.isGrounded) {
      this.jumpCount = 0;
      this.airTime = 0;
      this.isDodgeFlipping = false;

      // Ground Jump
      if (inputs.jump && this.jumpCooldown <= 0) {
        this.velocity.y = 17.5;
        this.isGrounded = false;
        this.jumpCount = 1;
        this.jumpCooldown = 0.22;
        this.audioEngine.playJump();
      }
    } else {
      // Airborne State
      this.airTime += dt;

      // Double Jump or Dodge Flip (Within 1.4s of leaving ground)
      if (inputs.jump && this.jumpCount === 1 && this.airTime < 1.4 && this.jumpCooldown <= 0) {
        this.jumpCount = 2;
        this.jumpCooldown = 0.3;

        const hasDirection = Math.abs(inputs.throttle) > 0.2 || Math.abs(inputs.steer) > 0.2;

        if (hasDirection) {
          // Kinetic Dodge Flip
          this.isDodgeFlipping = true;
          this.dodgeFlipTimer = this.dodgeFlipDuration;

          const forwardVec = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const rightVec = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

          const dodgeImpulse = forwardVec.scale(inputs.throttle * 19)
            .add(rightVec.scale(inputs.steer * 17));
          
          this.velocity.x += dodgeImpulse.x;
          this.velocity.z += dodgeImpulse.z;
          this.velocity.y = Math.max(this.velocity.y, 4.0); // Slight lift

          this.audioEngine.playDodgeFlip();
        } else {
          // Neutral Double Jump
          this.velocity.y = 15.0;
          this.audioEngine.playJump();
        }
      }

      // Dodge Flip Spin Animation
      if (this.isDodgeFlipping) {
        this.dodgeFlipTimer -= dt;
        this.pitch += (Math.PI * 2 * (dt / this.dodgeFlipDuration));

        if (this.dodgeFlipTimer <= 0) {
          this.isDodgeFlipping = false;
          this.pitch = 0;
        }
      }
    }

    // 3. Boost Management
    if (inputs.boost && this.boostMeter > 0) {
      this.isBoosting = true;
      this.boostMeter = Math.max(0, this.boostMeter - this.boostDepleteRate * dt);
    } else {
      this.isBoosting = false;
    }

    // 4. Kinetic Pulse Handling
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    this.isPulseActive = inputs.pulse && this.pulseCooldown <= 0;
    if (this.isPulseActive) {
      this.pulseCooldown = 1.0;
      this.audioEngine.playKineticPulse();
    }

    // 5. 3D Orientation & Steering
    if (this.isGrounded) {
      // Ground Steering
      if (Math.abs(inputs.steer) > 0.05) {
        this.yaw += inputs.steer * this.groundTurnSpeed * dt;
      }
      // Aerodynamic banking
      const targetRoll = -inputs.steer * 0.45;
      this.roll += (targetRoll - this.roll) * 10 * dt;
      const targetPitch = inputs.throttle * 0.12;
      this.pitch += (targetPitch - this.pitch) * 10 * dt;
    } else if (!this.isDodgeFlipping) {
      // Full 3D Aerial Control (Pitch & Yaw/Roll in air)
      this.yaw += inputs.steer * this.airTurnSpeed * dt;
      // In air, W tilts nose down, S tilts nose up
      const airPitchRate = 3.6;
      this.pitch += (-inputs.throttle * airPitchRate) * dt;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
      this.roll += (-inputs.steer * 0.5 - this.roll) * 6 * dt;
    }

    // 6. Thrust & Aerial Boost Acceleration
    const forward3D = new Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    const forward2D = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    if (this.isGrounded) {
      // Ground driving
      const accel = this.isBoosting ? this.acceleration * 1.9 : this.acceleration;

      if (Math.abs(inputs.throttle) > 0.05) {
        this.velocity.addInPlace(forward2D.scale(inputs.throttle * accel * dt));
      }
      this.velocity.scaleInPlace(this.linearDrag);
    } else {
      // Aerial boost flight (Thrusts in 3D direction of car nose!)
      if (this.isBoosting) {
        this.velocity.addInPlace(forward3D.scale(this.acceleration * 2.1 * dt));
      }
      // Gravity in air
      this.velocity.y -= this.gravity * dt;
      // Air drag
      this.velocity.x *= 0.985;
      this.velocity.z *= 0.985;
    }

    // Speed Clamp
    const currentSpeed = this.velocity.length();
    const currentMax = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
    if (currentSpeed > currentMax) {
      this.velocity.scaleInPlace(currentMax / currentSpeed);
    }

    // 7. Supersonic Detection & Audio
    this.isSupersonic = currentSpeed >= this.supersonicSpeed;
    if (this.isSupersonic && !this.supersonicTriggered) {
      this.supersonicTriggered = true;
      this.audioEngine.playSonicBoom();
    } else if (!this.isSupersonic) {
      this.supersonicTriggered = false;
    }

    // 8. Integrate Position
    this.position.addInPlace(this.velocity.scale(dt));

    // Floor Collision
    if (this.position.y <= 1.1) {
      this.position.y = 1.1;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Ceiling Collision
    if (this.position.y >= arenaBounds.wallHeight - 1.2) {
      this.position.y = arenaBounds.wallHeight - 1.2;
      this.velocity.y *= -0.5;
    }

    // Side Boundaries
    const halfW = arenaBounds.width / 2 - 2.2;
    const halfL = arenaBounds.length / 2 - 2.2;

    if (this.position.x < -halfW) {
      this.position.x = -halfW;
      this.velocity.x *= -0.5;
    } else if (this.position.x > halfW) {
      this.position.x = halfW;
      this.velocity.x *= -0.5;
    }

    if (this.position.z < -halfL) {
      this.position.z = -halfL;
      this.velocity.z *= -0.5;
    } else if (this.position.z > halfL) {
      this.position.z = halfL;
      this.velocity.z *= -0.5;
    }

    // 9. Sync Mesh Transforms
    this.rootMesh.position = this.position;
    this.rootMesh.rotation.y = this.yaw;
    this.rootMesh.rotation.x = this.pitch;
    this.rootMesh.rotation.z = this.roll;

    // 10. Particle FX
    const isThrusting = Math.abs(inputs.throttle) > 0.1 || this.isBoosting;
    if (this.thrusterParticles) {
      this.thrusterParticles.emitRate = this.isBoosting ? 280 : isThrusting ? 95 : 0;
    }

    if (this.supersonicTrails) {
      this.supersonicTrails.emitRate = this.isSupersonic ? 140 : 0;
    }

    if (this.team === 'cyan') {
      this.audioEngine.updateThrusters(isThrusting, this.isBoosting);
    }
  }

  public demolish(): void {
    if (this.isDemolished) return;
    this.isDemolished = true;
    this.demolishTimer = 3.0;
    this.rootMesh.setEnabled(false);
    this.audioEngine.playDemolition();
  }

  public getSpeedKmH(): number {
    return Math.round(this.velocity.length() * 3.6);
  }

  public addBoost(amount: number): void {
    this.boostMeter = Math.min(100, this.boostMeter + amount);
  }

  public reset(pos: Vector3, yaw: number): void {
    this.position = pos.clone();
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.isGrounded = true;
    this.jumpCount = 0;
    this.isDodgeFlipping = false;
    this.boostMeter = 33; // Standard reset boost
    this.isSupersonic = false;
    this.isDemolished = false;
    this.rootMesh.setEnabled(true);
  }
}
