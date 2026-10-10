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

export type ChassisType = 'interceptor' | 'vanguard' | 'wraith';
export type TrailCosmetic = 'ion_cyan' | 'plasma_violet' | 'solar_amber' | 'lightning_blue';

export interface TrailPreset {
  name: string;
  color1: Color3;
  color2: Color3;
  colorDead: Color3;
}

export const TRAIL_PRESETS: Record<TrailCosmetic, TrailPreset> = {
  ion_cyan: {
    name: 'Ion Cyan',
    color1: new Color3(0, 0.95, 1),
    color2: new Color3(0.8, 1, 1),
    colorDead: new Color3(0, 0.1, 0.25)
  },
  plasma_violet: {
    name: 'Plasma Violet',
    color1: new Color3(0.9, 0.1, 1),
    color2: new Color3(0.6, 0.2, 1),
    colorDead: new Color3(0.15, 0, 0.25)
  },
  solar_amber: {
    name: 'Solar Amber',
    color1: new Color3(1, 0.55, 0.05),
    color2: new Color3(1, 0.9, 0.3),
    colorDead: new Color3(0.25, 0.05, 0)
  },
  lightning_blue: {
    name: 'Hypersonic Lightning',
    color1: new Color3(0.2, 0.55, 1.0),
    color2: new Color3(0.9, 0.95, 1.0),
    colorDead: new Color3(0.05, 0.1, 0.3)
  }
};

export interface StrikerInputs {
  throttle: number; // -1 to 1 (W/S or HOTAS)
  steer: number;    // -1 to 1 (A/D or HOTAS Roll/Yaw)
  boost: boolean;   // Space / Left-Shift / HOTAS boost
  jump: boolean;    // KeyJ / Right-Click / HOTAS secondary jump
  pulse: boolean;   // KeyF / Left-Click / HOTAS fire
  airRollLeft: boolean;  // KeyQ / Mobile Roll Left
  airRollRight: boolean; // KeyE / Mobile Roll Right
}

export class Striker {
  public scene: Scene;
  public rootMesh: Mesh;
  public chassisRoot: Mesh | null = null;
  public team: 'cyan' | 'magenta';
  public audioEngine: AudioEngine;
  public primaryColor: Color3;

  // Active Customization
  public currentChassis: ChassisType = 'interceptor';
  public currentTrail: TrailCosmetic = 'ion_cyan';

  // Transform & Kinematics
  public position: Vector3;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public yaw: number = 0;
  public pitch: number = 0;
  public roll: number = 0;

  // 3D Flight & Aerodynamics (HYPER-VELOCITY SPECS)
  public maxSpeed: number = 48;          // ~173 KM/H base ground top speed
  public boostMaxSpeed: number = 88;     // ~317 KM/H Hypersonic afterburner
  public supersonicSpeed: number = 58;   // ~209 KM/H Supersonic threshold
  public acceleration: number = 85;      // Explosive ground acceleration
  public groundTurnSpeed: number = 5.2;  // High-precision flick steering
  public airTurnSpeed: number = 6.2;     // Rapid air rotation agility
  public linearDrag: number = 0.955;     // High kinetic momentum conservation
  public gravity: number = 34;           // Snappy responsive aerial gravity

  // Wall-Riding & Surface Adhesion
  public isWallRiding: boolean = false;
  public wallNormal: Vector3 = new Vector3(0, 0, 0);
  private airRollSoundTimer: number = 0;

  // Jump & Dodge Flip Mechanics
  public isGrounded: boolean = true;
  public jumpCount: number = 0;
  public jumpCooldown: number = 0;
  public airTime: number = 0;
  public isDodgeFlipping: boolean = false;
  public dodgeFlipTimer: number = 0;
  public dodgeFlipDuration: number = 0.38;
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

    this.primaryColor = team === 'cyan' ? new Color3(0, 0.95, 1) : new Color3(1, 0, 0.95);
    this.glowMat = new StandardMaterial(`striker_glow_${team}`, scene);
    this.glowMat.emissiveColor = this.primaryColor;
    this.glowMat.diffuseColor = this.primaryColor.scale(0.8);

    this.rootMesh = new Mesh(`striker_${this.team}`, this.scene);
    this.rootMesh.position = this.position;
    this.rootMesh.rotation.y = this.yaw;

    this.setChassis('interceptor');
    this.initThrusterFX(this.primaryColor);
    this.initSupersonicFX(this.primaryColor);
  }

  public setChassis(type: ChassisType): void {
    this.currentChassis = type;
    if (this.chassisRoot) {
      this.chassisRoot.dispose(false, true);
    }
    this.chassisRoot = new Mesh(`chassis_root_${this.team}_${type}`, this.scene);
    this.chassisRoot.parent = this.rootMesh;

    if (type === 'interceptor') {
      this.buildInterceptorGeometry(this.chassisRoot);
      this.maxSpeed = 48;
      this.boostMaxSpeed = 90;
      this.acceleration = 88;
      this.airTurnSpeed = 6.2;
      this.groundTurnSpeed = 5.2;
    } else if (type === 'vanguard') {
      this.buildVanguardGeometry(this.chassisRoot);
      this.maxSpeed = 46;
      this.boostMaxSpeed = 86;
      this.acceleration = 84;
      this.airTurnSpeed = 5.8;
      this.groundTurnSpeed = 5.4;
    } else {
      this.buildWraithGeometry(this.chassisRoot);
      this.maxSpeed = 50;
      this.boostMaxSpeed = 88;
      this.acceleration = 86;
      this.airTurnSpeed = 6.8;
      this.groundTurnSpeed = 5.6;
    }
  }

  public setTrail(type: TrailCosmetic): void {
    this.currentTrail = type;
    const preset = TRAIL_PRESETS[type];
    if (!preset) return;

    if (this.thrusterParticles) {
      this.thrusterParticles.color1 = preset.color1.toColor4(0.95);
      this.thrusterParticles.color2 = preset.color2.toColor4(0.95);
      this.thrusterParticles.colorDead = preset.colorDead.toColor4(0.0);
    }

    if (this.supersonicTrails) {
      this.supersonicTrails.color1 = preset.color2.toColor4(0.9);
      this.supersonicTrails.color2 = preset.color1.toColor4(0.8);
      this.supersonicTrails.colorDead = preset.colorDead.toColor4(0.0);
    }
  }

  private buildInterceptorGeometry(parent: Mesh): void {
    const bodyMat = new StandardMaterial(`ship_body_${this.team}_interceptor`, this.scene);
    bodyMat.diffuseColor = new Color3(0.08, 0.09, 0.12);
    bodyMat.specularColor = new Color3(0.8, 0.9, 1.0);
    bodyMat.roughness = 0.3;

    // 1. Aerodynamic Needle Fuselage
    const fuselage = MeshBuilder.CreateCylinder(`fuselage_${this.team}`, {
      diameterTop: 0.5,
      diameterBottom: 2.4,
      height: 4.8,
      tessellation: 6
    }, this.scene);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scaling.y = 0.6;
    fuselage.material = bodyMat;
    fuselage.parent = parent;

    // 2. Streamlined Teardrop Canopy
    const cockpit = MeshBuilder.CreateSphere(`canopy_${this.team}`, {
      diameterX: 1.1,
      diameterY: 0.8,
      diameterZ: 2.1,
      segments: 16
    }, this.scene);
    cockpit.position = new Vector3(0, 0.45, 0.2);
    cockpit.material = this.glowMat;
    cockpit.parent = parent;

    // 3. Swept Delta Wings
    const wingMat = new StandardMaterial(`wing_${this.team}`, this.scene);
    wingMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    wingMat.emissiveColor = this.primaryColor.scale(0.25);

    const leftWing = MeshBuilder.CreateBox(`left_wing_${this.team}`, { width: 2.4, height: 0.15, depth: 1.9 }, this.scene);
    leftWing.position = new Vector3(-1.9, 0.1, -0.6);
    leftWing.rotation.y = -0.3;
    leftWing.rotation.z = 0.1;
    leftWing.material = wingMat;
    leftWing.parent = parent;

    const rightWing = MeshBuilder.CreateBox(`right_wing_${this.team}`, { width: 2.4, height: 0.15, depth: 1.9 }, this.scene);
    rightWing.position = new Vector3(1.9, 0.1, -0.6);
    rightWing.rotation.y = 0.3;
    rightWing.rotation.z = -0.1;
    rightWing.material = wingMat;
    rightWing.parent = parent;

    // Wingtip Beacons
    const beaconMat = new StandardMaterial(`beacon_${this.team}`, this.scene);
    beaconMat.emissiveColor = this.primaryColor;
    beaconMat.disableLighting = true;

    const leftBeacon = MeshBuilder.CreateSphere(`l_beacon_${this.team}`, { diameter: 0.38 }, this.scene);
    leftBeacon.position = new Vector3(-2.9, 0.2, -1.0);
    leftBeacon.material = beaconMat;
    leftBeacon.parent = parent;

    const rightBeacon = MeshBuilder.CreateSphere(`r_beacon_${this.team}`, { diameter: 0.38 }, this.scene);
    rightBeacon.position = new Vector3(2.9, 0.2, -1.0);
    rightBeacon.material = beaconMat;
    rightBeacon.parent = parent;

    // Twin Exhaust Rings
    const exhaustMat = new StandardMaterial(`exhaust_${this.team}`, this.scene);
    exhaustMat.emissiveColor = this.primaryColor;
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
  }

  private buildVanguardGeometry(parent: Mesh): void {
    const armorMat = new StandardMaterial(`armor_body_${this.team}_vanguard`, this.scene);
    armorMat.diffuseColor = new Color3(0.07, 0.08, 0.10);
    armorMat.specularColor = new Color3(0.9, 0.95, 1.0);
    armorMat.roughness = 0.22;

    const heavyMat = new StandardMaterial(`heavy_plate_${this.team}`, this.scene);
    heavyMat.diffuseColor = new Color3(0.14, 0.16, 0.20);
    heavyMat.emissiveColor = this.primaryColor.scale(0.3);

    // 1. Chiseled Broad-Brawler Main Hull
    const mainHull = MeshBuilder.CreateBox(`vanguard_hull_${this.team}`, {
      width: 2.8,
      height: 1.1,
      depth: 4.4
    }, this.scene);
    mainHull.position = new Vector3(0, 0.2, 0);
    mainHull.material = armorMat;
    mainHull.parent = parent;

    // 2. Heavy Front Bumper Wedge (Massive Surface for aerial spikes and boomers)
    const frontBumper = MeshBuilder.CreateBox(`vanguard_bumper_${this.team}`, {
      width: 3.1,
      height: 0.48,
      depth: 0.8
    }, this.scene);
    frontBumper.position = new Vector3(0, -0.1, 2.2);
    frontBumper.material = heavyMat;
    frontBumper.parent = parent;

    // 3. Angled Reinforced Cockpit Visor
    const visor = MeshBuilder.CreateBox(`vanguard_visor_${this.team}`, {
      width: 1.4,
      height: 0.65,
      depth: 1.6
    }, this.scene);
    visor.position = new Vector3(0, 0.75, 0.4);
    visor.rotation.x = -0.22;
    visor.material = this.glowMat;
    visor.parent = parent;

    // 4. Side Engine Sponsons / Ram-Air Pods
    [-1.65, 1.65].forEach((xSide, idx) => {
      const sponson = MeshBuilder.CreateBox(`vanguard_sponson_${idx}_${this.team}`, {
        width: 0.65,
        height: 0.85,
        depth: 3.2
      }, this.scene);
      sponson.position = new Vector3(xSide, 0.15, -0.4);
      sponson.material = armorMat;
      sponson.parent = parent;

      const sponsonGlow = MeshBuilder.CreatePlane(`sponson_glow_${idx}_${this.team}`, { width: 0.5, height: 0.6 }, this.scene);
      sponsonGlow.position = new Vector3(xSide, 0.15, 1.25);
      sponsonGlow.material = this.glowMat;
      sponsonGlow.parent = parent;
    });

    // 5. High-Downforce Rear Aerofoil Spoiler
    const spoiler = MeshBuilder.CreateBox(`vanguard_spoiler_${this.team}`, {
      width: 3.4,
      height: 0.14,
      depth: 0.75
    }, this.scene);
    spoiler.position = new Vector3(0, 1.05, -2.0);
    spoiler.material = heavyMat;
    spoiler.parent = parent;

    // Spoiler Struts
    [-1.1, 1.1].forEach((strutX, idx) => {
      const strut = MeshBuilder.CreateBox(`spoiler_strut_${idx}_${this.team}`, {
        width: 0.1,
        height: 0.55,
        depth: 0.3
      }, this.scene);
      strut.position = new Vector3(strutX, 0.78, -2.0);
      strut.material = armorMat;
      strut.parent = parent;
    });

    // 6. Dual Heavy Rectangular Vector Exhausts
    [-0.85, 0.85].forEach((xExhaust, idx) => {
      const exhaust = MeshBuilder.CreateBox(`vanguard_exhaust_${idx}_${this.team}`, {
        width: 0.85,
        height: 0.55,
        depth: 0.4
      }, this.scene);
      exhaust.position = new Vector3(xExhaust, 0.15, -2.3);
      exhaust.material = this.glowMat;
      exhaust.parent = parent;
    });
  }

  private buildWraithGeometry(parent: Mesh): void {
    const stealthMat = new StandardMaterial(`stealth_body_${this.team}_wraith`, this.scene);
    stealthMat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    stealthMat.specularColor = new Color3(1.0, 0.8, 1.0);
    stealthMat.roughness = 0.25;

    const accentMat = new StandardMaterial(`wraith_accent_${this.team}`, this.scene);
    accentMat.diffuseColor = new Color3(0.12, 0.13, 0.18);
    accentMat.emissiveColor = this.primaryColor.scale(0.35);

    // 1. Split Twin-Pontoon Hulls
    [-1.25, 1.25].forEach((xSide, idx) => {
      const hull = MeshBuilder.CreateCylinder(`wraith_hull_${idx}_${this.team}`, {
        diameterTop: 0.4,
        diameterBottom: 1.4,
        height: 4.8,
        tessellation: 5
      }, this.scene);
      hull.rotation.x = Math.PI / 2;
      hull.rotation.y = idx === 0 ? -0.06 : 0.06;
      hull.position = new Vector3(xSide, 0.15, 0);
      hull.material = stealthMat;
      hull.parent = parent;

      // Pontoon Tip Spikes
      const spike = MeshBuilder.CreateCylinder(`wraith_spike_${idx}_${this.team}`, {
        diameterTop: 0.05,
        diameterBottom: 0.42,
        height: 0.8
      }, this.scene);
      spike.rotation.x = Math.PI / 2;
      spike.position = new Vector3(xSide, 0.15, 2.7);
      spike.material = this.glowMat;
      spike.parent = parent;
    });

    // 2. Central Tunnel Bridge Deck
    const centerDeck = MeshBuilder.CreateBox(`wraith_bridge_${this.team}`, {
      width: 1.6,
      height: 0.35,
      depth: 3.2
    }, this.scene);
    centerDeck.position = new Vector3(0, 0.2, -0.2);
    centerDeck.material = accentMat;
    centerDeck.parent = parent;

    // 3. Recessed Stealth Sensor Cockpit
    const cockpit = MeshBuilder.CreateSphere(`wraith_canopy_${this.team}`, {
      diameterX: 0.95,
      diameterY: 0.55,
      diameterZ: 1.8,
      segments: 16
    }, this.scene);
    cockpit.position = new Vector3(0, 0.42, 0.1);
    cockpit.material = this.glowMat;
    cockpit.parent = parent;

    // 4. Forward-Swept Canard Fins
    [-1.8, 1.8].forEach((xSide, idx) => {
      const canard = MeshBuilder.CreateBox(`wraith_canard_${idx}_${this.team}`, {
        width: 1.6,
        height: 0.1,
        depth: 0.9
      }, this.scene);
      canard.position = new Vector3(xSide, 0.22, 0.8);
      canard.rotation.y = idx === 0 ? 0.35 : -0.35;
      canard.material = accentMat;
      canard.parent = parent;
    });

    // 5. Quad Exhaust Thruster Cluster
    [
      { x: -1.25, y: 0.3 },
      { x: -1.25, y: -0.05 },
      { x: 1.25, y: 0.3 },
      { x: 1.25, y: -0.05 }
    ].forEach((pos, idx) => {
      const ring = MeshBuilder.CreateTorus(`wraith_exhaust_${idx}_${this.team}`, {
        diameter: 0.55,
        thickness: 0.12
      }, this.scene);
      ring.position = new Vector3(pos.x, pos.y, -2.35);
      ring.rotation.x = Math.PI / 2;
      ring.material = this.glowMat;
      ring.parent = parent;
    });
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

    if (this.isWallRiding) {
      this.jumpCount = 0;
      this.airTime = 0;
      this.isDodgeFlipping = false;

      // Wall Jump: Launches explosively outward from the wall normal!
      if (inputs.jump && this.jumpCooldown <= 0) {
        this.velocity = this.wallNormal.scale(26).add(new Vector3(0, 11, 0));
        this.isWallRiding = false;
        this.isGrounded = false;
        this.jumpCount = 1;
        this.jumpCooldown = 0.22;
        this.audioEngine.playJump();
      }
    } else if (this.isGrounded) {
      this.jumpCount = 0;
      this.airTime = 0;
      this.isDodgeFlipping = false;

      // Ground Jump
      if (inputs.jump && this.jumpCooldown <= 0) {
        this.velocity.y = 23.5;
        this.isGrounded = false;
        this.jumpCount = 1;
        this.jumpCooldown = 0.18;
        this.audioEngine.playJump();
      }
    } else {
      // Airborne State
      this.airTime += dt;

      // Double Jump or Dodge Flip (Within 1.4s of leaving ground)
      if (inputs.jump && this.jumpCount === 1 && this.airTime < 1.4 && this.jumpCooldown <= 0) {
        this.jumpCount = 2;
        this.jumpCooldown = 0.25;

        const hasDirection = Math.abs(inputs.throttle) > 0.15 || Math.abs(inputs.steer) > 0.15;

        if (hasDirection) {
          // Kinetic Dodge Flip
          this.isDodgeFlipping = true;
          this.dodgeFlipTimer = this.dodgeFlipDuration;

          const forwardVec = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const rightVec = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

          const dodgeImpulse = forwardVec.scale(inputs.throttle * 36)
            .add(rightVec.scale(inputs.steer * 32));
          
          this.velocity.x += dodgeImpulse.x;
          this.velocity.z += dodgeImpulse.z;
          this.velocity.y = Math.max(this.velocity.y, 6.5); // Snappy pop

          this.audioEngine.playDodgeFlip();
        } else {
          // Neutral Double Jump
          this.velocity.y = 19.5;
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

    // 5. 3D Orientation, Steering & Air-Roll
    if (this.airRollSoundTimer > 0) this.airRollSoundTimer -= dt;

    if (this.isWallRiding) {
      // Wall Steering: Rotate heading around wall normal
      if (Math.abs(inputs.steer) > 0.05) {
        this.yaw += inputs.steer * this.groundTurnSpeed * dt;
      }

      // Dynamic surface orientation: align wheels to wall face
      let targetRoll = 0;
      let targetPitch = 0;
      if (this.wallNormal.x > 0.5) {
        // Left wall (+X normal)
        targetRoll = -(Math.PI / 2) * Math.cos(this.yaw);
        targetPitch = (Math.PI / 2) * Math.sin(this.yaw);
      } else if (this.wallNormal.x < -0.5) {
        // Right wall (-X normal)
        targetRoll = (Math.PI / 2) * Math.cos(this.yaw);
        targetPitch = -(Math.PI / 2) * Math.sin(this.yaw);
      } else if (this.wallNormal.z > 0.5) {
        // South wall (+Z normal)
        targetPitch = -(Math.PI / 2) * Math.cos(this.yaw);
        targetRoll = -(Math.PI / 2) * Math.sin(this.yaw);
      } else if (this.wallNormal.z < -0.5) {
        // North wall (-Z normal)
        targetPitch = (Math.PI / 2) * Math.cos(this.yaw);
        targetRoll = (Math.PI / 2) * Math.sin(this.yaw);
      }
      this.roll += (targetRoll - this.roll) * 12 * dt;
      this.pitch += (targetPitch - this.pitch) * 12 * dt;
    } else if (this.isGrounded) {
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
      // Full 3D Aerial Control (Pitch & Yaw in air)
      this.yaw += inputs.steer * this.airTurnSpeed * dt;
      // In air, W tilts nose down, S tilts nose up
      const airPitchRate = 3.6;
      this.pitch += (-inputs.throttle * airPitchRate) * dt;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

      // Dedicated Air-Roll (KeyQ / KeyE or Touch Roll)
      const airRollRate = 4.8;
      if (inputs.airRollLeft) {
        this.roll += airRollRate * dt;
        if (this.airRollSoundTimer <= 0) {
          this.audioEngine.playAirRoll();
          this.airRollSoundTimer = 0.32;
        }
      } else if (inputs.airRollRight) {
        this.roll -= airRollRate * dt;
        if (this.airRollSoundTimer <= 0) {
          this.audioEngine.playAirRoll();
          this.airRollSoundTimer = 0.32;
        }
      } else {
        // Aerodynamic self-stabilization damping when not rolling
        this.roll += (-inputs.steer * 0.45 - this.roll) * 5 * dt;
      }
    }

    // 6. Thrust & Aerial Boost Acceleration
    const forward3D = new Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const forward2D = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    if (this.isWallRiding) {
      // Wall Surface Drive: project forward vector onto the wall surface plane
      const fDotN = Vector3.Dot(forward3D, this.wallNormal);
      const wallTangent = forward3D.subtract(this.wallNormal.scale(fDotN)).normalize();
      const accel = this.isBoosting ? this.acceleration * 2.6 : this.acceleration;

      if (Math.abs(inputs.throttle) > 0.05) {
        this.velocity.addInPlace(wallTangent.scale(inputs.throttle * accel * dt));
      }
      this.velocity.scaleInPlace(this.linearDrag);
    } else if (this.isGrounded) {
      // Ground driving
      const accel = this.isBoosting ? this.acceleration * 2.6 : this.acceleration;

      if (Math.abs(inputs.throttle) > 0.05) {
        this.velocity.addInPlace(forward2D.scale(inputs.throttle * accel * dt));
      }
      this.velocity.scaleInPlace(this.linearDrag);
    } else {
      // Aerial boost flight (Thrusts in 3D direction of car nose!)
      if (this.isBoosting) {
        this.velocity.addInPlace(forward3D.scale(this.acceleration * 2.8 * dt));
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
      this.isWallRiding = false;
    }

    // Ceiling Collision
    if (this.position.y >= arenaBounds.wallHeight - 1.2) {
      this.position.y = arenaBounds.wallHeight - 1.2;
      this.velocity.y *= -0.5;
    }

    // Perimeter Wall Proximity & Kinetic Surface Adhesion
    const halfW = arenaBounds.width / 2 - 2.2;
    const halfL = arenaBounds.length / 2 - 2.2;

    const nearLeft = this.position.x <= -halfW + 0.65;
    const nearRight = this.position.x >= halfW - 0.65;
    const nearBack = this.position.z <= -halfL + 0.65 && (Math.abs(this.position.x) > 11 || this.position.y > 9);
    const nearFront = this.position.z >= halfL - 0.65 && (Math.abs(this.position.x) > 11 || this.position.y > 9);

    const isNearWall = nearLeft || nearRight || nearBack || nearFront;
    const speed = this.velocity.length();

    if (isNearWall && (this.position.y > 1.3 || speed > 10)) {
      this.isWallRiding = true;
      this.isGrounded = true;

      if (nearLeft) {
        this.position.x = -halfW;
        this.wallNormal.set(1, 0, 0);
        if (this.velocity.x < 0) this.velocity.x = 0;
        this.velocity.x -= 28 * dt; // Inward adhesion downforce
      } else if (nearRight) {
        this.position.x = halfW;
        this.wallNormal.set(-1, 0, 0);
        if (this.velocity.x > 0) this.velocity.x = 0;
        this.velocity.x += 28 * dt; // Inward adhesion downforce
      } else if (nearBack) {
        this.position.z = -halfL;
        this.wallNormal.set(0, 0, 1);
        if (this.velocity.z < 0) this.velocity.z = 0;
        this.velocity.z -= 28 * dt; // Inward adhesion downforce
      } else if (nearFront) {
        this.position.z = halfL;
        this.wallNormal.set(0, 0, -1);
        if (this.velocity.z > 0) this.velocity.z = 0;
        this.velocity.z += 28 * dt; // Inward adhesion downforce
      }

      // Adhesion aerodynamic downforce: cancels downward slip proportional to speed
      const speedAdhesionRatio = Math.min(1.0, speed / 24);
      this.velocity.y -= this.gravity * (1.0 - speedAdhesionRatio * 0.88) * dt;
    } else {
      this.isWallRiding = false;

      // Hard Boundary Clamp for free air
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
    this.isWallRiding = false;
    this.jumpCount = 0;
    this.isDodgeFlipping = false;
    this.boostMeter = 33; // Standard reset boost
    this.isSupersonic = false;
    this.isDemolished = false;
    this.rootMesh.setEnabled(true);
  }
}
