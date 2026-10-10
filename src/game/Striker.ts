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
  boost: boolean;   // Space or HOTAS boost
  pulse: boolean;   // Click/F or HOTAS fire
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

  // Flight Specs
  public maxSpeed: number = 32;       // Standard top speed
  public boostMaxSpeed: number = 55;  // Boost top speed
  public acceleration: number = 42;
  public turnSpeed: number = 3.6;     // Radians per sec
  public linearDrag: number = 0.94;
  public angularDrag: number = 0.88;

  // Boost Resource
  public boostMeter: number = 100;
  public boostDepleteRate: number = 35; // Per second
  public boostRechargeRate: number = 18; // Per second
  public isBoosting: boolean = false;

  // Kinetic Pulse
  public pulseCooldown: number = 0;
  public isPulseActive: boolean = false;

  // Visuals
  private thrusterParticles: ParticleSystem | null = null;
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
  }

  private buildShipMesh(primaryColor: Color3): Mesh {
    const parent = new Mesh(`striker_${this.team}`, this.scene);

    const bodyMat = new StandardMaterial(`ship_body_${this.team}`, this.scene);
    bodyMat.diffuseColor = new Color3(0.08, 0.09, 0.12);
    bodyMat.specularColor = new Color3(0.8, 0.9, 1.0);
    bodyMat.roughness = 0.3;

    // Aerodynamic Wedge Fuselage
    const fuselage = MeshBuilder.CreateCylinder(`fuselage_${this.team}`, {
      diameterTop: 0.6,
      diameterBottom: 2.4,
      height: 4.5,
      tessellation: 6
    }, this.scene);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scaling.y = 0.6;
    fuselage.material = bodyMat;
    fuselage.parent = parent;

    // Cockpit Canopy (Glowing Neon)
    const cockpit = MeshBuilder.CreateSphere(`canopy_${this.team}`, {
      diameterX: 1.1,
      diameterY: 0.75,
      diameterZ: 2.0,
      segments: 16
    }, this.scene);
    cockpit.position = new Vector3(0, 0.45, 0.2);
    cockpit.material = this.glowMat;
    cockpit.parent = parent;

    // Swept-Forward Wings
    const wingMat = new StandardMaterial(`wing_${this.team}`, this.scene);
    wingMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    wingMat.emissiveColor = primaryColor.scale(0.25);

    const leftWing = MeshBuilder.CreateBox(`left_wing_${this.team}`, {
      width: 2.2,
      height: 0.15,
      depth: 1.8
    }, this.scene);
    leftWing.position = new Vector3(-1.8, 0.1, -0.6);
    leftWing.rotation.y = -0.3;
    leftWing.rotation.z = 0.1;
    leftWing.material = wingMat;
    leftWing.parent = parent;

    const rightWing = MeshBuilder.CreateBox(`right_wing_${this.team}`, {
      width: 2.2,
      height: 0.15,
      depth: 1.8
    }, this.scene);
    rightWing.position = new Vector3(1.8, 0.1, -0.6);
    rightWing.rotation.y = 0.3;
    rightWing.rotation.z = -0.1;
    rightWing.material = wingMat;
    rightWing.parent = parent;

    // Neon Wingtip Beacons
    const beaconMat = new StandardMaterial(`beacon_${this.team}`, this.scene);
    beaconMat.emissiveColor = primaryColor;
    beaconMat.disableLighting = true;

    const leftBeacon = MeshBuilder.CreateSphere(`l_beacon_${this.team}`, { diameter: 0.35 }, this.scene);
    leftBeacon.position = new Vector3(-2.8, 0.2, -1.0);
    leftBeacon.material = beaconMat;
    leftBeacon.parent = parent;

    const rightBeacon = MeshBuilder.CreateSphere(`r_beacon_${this.team}`, { diameter: 0.35 }, this.scene);
    rightBeacon.position = new Vector3(2.8, 0.2, -1.0);
    rightBeacon.material = beaconMat;
    rightBeacon.parent = parent;

    // Twin Thruster Exhaust Rings
    const exhaustMat = new StandardMaterial(`exhaust_${this.team}`, this.scene);
    exhaustMat.emissiveColor = primaryColor;
    exhaustMat.disableLighting = true;

    const exhaustL = MeshBuilder.CreateTorus(`exhaust_l_${this.team}`, { diameter: 0.7, thickness: 0.16 }, this.scene);
    exhaustL.position = new Vector3(-0.7, 0.05, -2.1);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.material = exhaustMat;
    exhaustL.parent = parent;

    const exhaustR = MeshBuilder.CreateTorus(`exhaust_r_${this.team}`, { diameter: 0.7, thickness: 0.16 }, this.scene);
    exhaustR.position = new Vector3(0.7, 0.05, -2.1);
    exhaustR.rotation.x = Math.PI / 2;
    exhaustR.material = exhaustMat;
    exhaustR.parent = parent;

    return parent;
  }

  private initThrusterFX(primaryColor: Color3): void {
    const emitter = MeshBuilder.CreateBox(`thruster_emitter_${this.team}`, { size: 0.1 }, this.scene);
    emitter.position = new Vector3(0, 0, -2.2);
    emitter.isVisible = false;
    emitter.parent = this.rootMesh;

    const ps = new ParticleSystem(`particles_${this.team}`, 150, this.scene);
    ps.emitter = emitter;
    ps.minSize = 0.2;
    ps.maxSize = 0.6;
    ps.minLifeTime = 0.08;
    ps.maxLifeTime = 0.25;
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0, 0);
    ps.direction1 = new Vector3(-0.4, -0.1, -1.2);
    ps.direction2 = new Vector3(0.4, 0.1, -1.5);
    ps.color1 = primaryColor.toColor4(0.9);
    ps.color2 = new Color3(1, 1, 1).toColor4(0.95);
    ps.colorDead = new Color3(0, 0, 0).toColor4(0.0);
    ps.start();

    this.thrusterParticles = ps;
  }

  public update(dt: number, inputs: StrikerInputs, arenaBounds: { width: number, length: number }): void {
    // 1. Boost Management
    if (inputs.boost && this.boostMeter > 0) {
      this.isBoosting = true;
      this.boostMeter = Math.max(0, this.boostMeter - this.boostDepleteRate * dt);
    } else {
      this.isBoosting = false;
      this.boostMeter = Math.min(100, this.boostMeter + this.boostRechargeRate * dt);
    }

    // 2. Pulse Management
    if (this.pulseCooldown > 0) {
      this.pulseCooldown -= dt;
    }
    this.isPulseActive = inputs.pulse && this.pulseCooldown <= 0;
    if (this.isPulseActive) {
      this.pulseCooldown = 1.2;
      this.audioEngine.playKineticPulse();
    }

    // 3. Steering & Turning
    if (Math.abs(inputs.steer) > 0.05) {
      this.yaw += inputs.steer * this.turnSpeed * dt;
    }

    // Aerodynamic Banking / Roll
    const targetRoll = -inputs.steer * 0.42;
    this.roll += (targetRoll - this.roll) * 8 * dt;

    // Pitch tilt upon acceleration
    const targetPitch = inputs.throttle * 0.15;
    this.pitch += (targetPitch - this.pitch) * 8 * dt;

    // 4. Thrust & Acceleration
    const forwardVec = new Vector3(
      Math.sin(this.yaw),
      0,
      Math.cos(this.yaw)
    );

    const currentMaxSpeed = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
    const accelRate = this.isBoosting ? this.acceleration * 1.85 : this.acceleration;

    if (Math.abs(inputs.throttle) > 0.05) {
      const thrustForce = forwardVec.scale(inputs.throttle * accelRate * dt);
      this.velocity.addInPlace(thrustForce);
    }

    // 5. Apply Drag & Friction
    this.velocity.scaleInPlace(this.linearDrag);

    // Speed Clamp
    const currentSpeed = this.velocity.length();
    if (currentSpeed > currentMaxSpeed) {
      this.velocity.scaleInPlace(currentMaxSpeed / currentSpeed);
    }

    // 6. Update Position
    this.position.addInPlace(this.velocity.scale(dt));
    this.position.y = 1.1 + Math.sin(Date.now() * 0.005) * 0.08; // Gentle hover bobbing

    // 7. Arena Boundary Constraints
    const halfW = arenaBounds.width / 2 - 2.0;
    const halfL = arenaBounds.length / 2 - 2.0;

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

    // 8. Apply Transforms to Mesh
    this.rootMesh.position = this.position;
    this.rootMesh.rotation.y = this.yaw;
    this.rootMesh.rotation.z = this.roll;
    this.rootMesh.rotation.x = this.pitch;

    // 9. Thruster Visuals & Audio
    const isThrusting = Math.abs(inputs.throttle) > 0.1 || this.isBoosting;
    if (this.thrusterParticles) {
      this.thrusterParticles.emitRate = this.isBoosting ? 260 : isThrusting ? 90 : 0;
    }

    if (this.team === 'cyan') {
      this.audioEngine.updateThrusters(isThrusting, this.isBoosting);
    }
  }

  public getSpeedKmH(): number {
    return Math.round(this.velocity.length() * 3.6);
  }

  public reset(pos: Vector3, yaw: number): void {
    this.position = pos.clone();
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.boostMeter = 100;
  }
}
