import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  PointLight,
  ParticleSystem
} from '@babylonjs/core';
import type { AudioEngine } from './AudioEngine';
import type { Striker } from './Striker';
import type { Arena } from './Arena';

export class Puck {
  public scene: Scene;
  public rootMesh: Mesh;
  public radius: number = 1.35;
  public position: Vector3;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public maxSpeed: number = 70;
  public friction: number = 0.992;
  public restitution: number = 0.88; // Bounciness

  private light: PointLight;
  private trailSystem: ParticleSystem | null = null;
  private ringMesh: Mesh;
  private audioEngine: AudioEngine;

  constructor(scene: Scene, audioEngine: AudioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.position = new Vector3(0, 1.35, 0);

    // Glowing Core Mesh
    this.rootMesh = MeshBuilder.CreateSphere('energy_puck', {
      diameter: this.radius * 2,
      segments: 24
    }, scene);
    this.rootMesh.position = this.position;

    const coreMat = new StandardMaterial('puck_core_mat', scene);
    coreMat.emissiveColor = new Color3(1, 0.9, 0.2); // Golden Plasma Core
    coreMat.diffuseColor = new Color3(1, 0.7, 0.0);
    this.rootMesh.material = coreMat;

    // Outer Orbiting Energy Ring
    this.ringMesh = MeshBuilder.CreateTorus('puck_ring', {
      diameter: this.radius * 2.6,
      thickness: 0.16,
      tessellation: 32
    }, scene);
    this.ringMesh.position = this.position;
    this.ringMesh.parent = this.rootMesh;

    const ringMat = new StandardMaterial('puck_ring_mat', scene);
    ringMat.emissiveColor = new Color3(0, 0.95, 1);
    ringMat.disableLighting = true;
    this.ringMesh.material = ringMat;

    // Dynamic Dynamic Light
    this.light = new PointLight('puck_glow_light', this.position, scene);
    this.light.diffuse = new Color3(1, 0.8, 0.2);
    this.light.intensity = 2.0;
    this.light.range = 22;

    this.initTrailFX();
  }

  private initTrailFX(): void {
    const ps = new ParticleSystem('puck_trail', 200, this.scene);
    ps.emitter = this.rootMesh;
    ps.minSize = 0.3;
    ps.maxSize = 0.9;
    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.45;
    ps.emitRate = 60;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0, 0);
    ps.direction1 = new Vector3(-0.2, -0.2, -0.2);
    ps.direction2 = new Vector3(0.2, 0.2, 0.2);
    ps.color1 = new Color3(1, 0.85, 0.2).toColor4(0.9);
    ps.color2 = new Color3(0, 0.95, 1).toColor4(0.7);
    ps.colorDead = new Color3(0, 0, 0).toColor4(0.0);
    ps.start();

    this.trailSystem = ps;
  }

  public update(dt: number, arena: Arena, strikers: Striker[]): 'none' | 'cyan_scores' | 'magenta_scores' {
    // 1. Apply Friction
    this.velocity.scaleInPlace(this.friction);

    // Speed Clamp
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.scaleInPlace(this.maxSpeed / speed);
    }

    // 2. Position Integration
    this.position.addInPlace(this.velocity.scale(dt));
    this.position.y = 1.35; // Maintain flat hover height

    // 3. Ring Rotation FX
    this.ringMesh.rotation.x += 2.5 * dt;
    this.ringMesh.rotation.y += 3.5 * dt;

    // 4. Update Particle Trail Density with speed
    if (this.trailSystem) {
      this.trailSystem.emitRate = Math.min(240, 30 + speed * 4.5);
    }

    // 5. Striker-Puck Collision Response
    strikers.forEach(striker => {
      const distVec = this.position.subtract(striker.position);
      distVec.y = 0;
      const dist = distVec.length();
      const minDistance = this.radius + 1.8; // Radius of puck + approximate radius of striker

      if (dist < minDistance && dist > 0.001) {
        const normal = distVec.scale(1 / dist);
        // Push puck outside striker collision envelope
        this.position = striker.position.add(normal.scale(minDistance));

        // Relative velocity
        const relVel = this.velocity.subtract(striker.velocity);
        const normalSpeed = Vector3.Dot(relVel, normal);

        if (normalSpeed < 0) {
          // Striker is moving towards or striking puck
          const impulseStrength = 1.45;
          const impulse = normal.scale(-normalSpeed * (1 + this.restitution) * impulseStrength);
          this.velocity.addInPlace(impulse);

          // Add Striker forward momentum
          const forwardVec = new Vector3(Math.sin(striker.yaw), 0, Math.cos(striker.yaw));
          const forwardPush = forwardVec.scale(striker.isBoosting ? 28 : 14);
          this.velocity.addInPlace(forwardPush);

          // Sound effect
          this.audioEngine.playBallHit(this.velocity.length() / 25);
        }

        // Kinetic Pulse Supercharge
        if (striker.isPulseActive) {
          const pulseDirection = new Vector3(Math.sin(striker.yaw), 0, Math.cos(striker.yaw));
          this.velocity = pulseDirection.scale(this.maxSpeed * 0.95);
          this.audioEngine.playBallHit(2.5);
        }
      }
    });

    // 6. Arena Wall Collisions & Goal Detection
    const halfW = arena.width / 2 - this.radius;
    const halfL = arena.length / 2 - this.radius;
    const goalHalfW = arena.goalWidth / 2;

    // Side Wall Collisions (X axis)
    if (this.position.x < -halfW) {
      this.position.x = -halfW;
      this.velocity.x *= -this.restitution;
      this.audioEngine.playWallBounce();
    } else if (this.position.x > halfW) {
      this.position.x = halfW;
      this.velocity.x *= -this.restitution;
      this.audioEngine.playWallBounce();
    }

    // End Wall / Goal Collisions (Z axis)
    // Check if inside Goal Opening width
    const isInsideGoalMouth = Math.abs(this.position.x) < goalHalfW;

    // Cyan End (-Z)
    if (this.position.z < -halfL) {
      if (isInsideGoalMouth) {
        // Deep inside Cyan Goal Trigger -> Magenta Scores!
        if (this.position.z < -halfL - 2.5) {
          this.audioEngine.playGoalExplosion();
          return 'magenta_scores';
        }
      } else {
        // Hit End Wall solid area
        this.position.z = -halfL;
        this.velocity.z *= -this.restitution;
        this.audioEngine.playWallBounce();
      }
    }

    // Magenta End (+Z)
    if (this.position.z > halfL) {
      if (isInsideGoalMouth) {
        // Deep inside Magenta Goal Trigger -> Cyan Scores!
        if (this.position.z > halfL + 2.5) {
          this.audioEngine.playGoalExplosion();
          return 'cyan_scores';
        }
      } else {
        // Hit End Wall solid area
        this.position.z = halfL;
        this.velocity.z *= -this.restitution;
        this.audioEngine.playWallBounce();
      }
    }

    // 7. Sync Mesh & Light
    this.rootMesh.position = this.position;
    this.light.position = this.position;

    return 'none';
  }

  public reset(): void {
    this.position.set(0, 1.35, 0);
    this.velocity.set(0, 0, 0);
    this.rootMesh.position = this.position;
    this.light.position = this.position;
  }
}
