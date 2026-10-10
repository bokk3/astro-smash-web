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
  public radius: number = 1.4;
  public position: Vector3;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public maxSpeed: number = 65;
  public friction: number = 0.995;
  public restitution: number = 0.82; // Bounciness
  public gravity: number = 16.5;

  // Ground Indicator Reticle
  private groundReticle: Mesh;
  private reticleMat: StandardMaterial;

  private light: PointLight;
  private trailSystem: ParticleSystem | null = null;
  private ringMesh: Mesh;
  private audioEngine: AudioEngine;

  constructor(scene: Scene, audioEngine: AudioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.position = new Vector3(0, 1.4, 0);

    // 1. Glowing Core Energy Sphere
    this.rootMesh = MeshBuilder.CreateSphere('energy_ball', {
      diameter: this.radius * 2,
      segments: 24
    }, scene);
    this.rootMesh.position = this.position;

    const coreMat = new StandardMaterial('ball_core_mat', scene);
    coreMat.emissiveColor = new Color3(1, 0.88, 0.15); // Golden Plasma
    coreMat.diffuseColor = new Color3(1, 0.7, 0.0);
    this.rootMesh.material = coreMat;

    // 2. Orbiting Confinement Ring
    this.ringMesh = MeshBuilder.CreateTorus('ball_ring', {
      diameter: this.radius * 2.5,
      thickness: 0.16,
      tessellation: 32
    }, scene);
    this.ringMesh.position = this.position;
    this.ringMesh.parent = this.rootMesh;

    const ringMat = new StandardMaterial('ball_ring_mat', scene);
    ringMat.emissiveColor = new Color3(0, 0.95, 1);
    ringMat.disableLighting = true;
    this.ringMesh.material = ringMat;

    // 3. Ground Indicator Reticle (Projected directly under the ball)
    this.groundReticle = MeshBuilder.CreateTorus('ball_ground_reticle', {
      diameter: 3.5,
      thickness: 0.18,
      tessellation: 32
    }, scene);
    this.groundReticle.position = new Vector3(0, 0.06, 0);

    this.reticleMat = new StandardMaterial('reticle_mat', scene);
    this.reticleMat.emissiveColor = new Color3(1, 0.85, 0.1);
    this.reticleMat.disableLighting = true;
    this.reticleMat.alpha = 0.8;
    this.groundReticle.material = this.reticleMat;

    // 4. Dynamic Spatial Illumination
    this.light = new PointLight('ball_light', this.position, scene);
    this.light.diffuse = new Color3(1, 0.8, 0.2);
    this.light.intensity = 2.2;
    this.light.range = 28;

    this.initTrailFX();
  }

  private initTrailFX(): void {
    const ps = new ParticleSystem('ball_trail', 220, this.scene);
    ps.emitter = this.rootMesh;
    ps.minSize = 0.35;
    ps.maxSize = 1.1;
    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.45;
    ps.emitRate = 60;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0, 0);
    ps.direction1 = new Vector3(-0.3, -0.3, -0.3);
    ps.direction2 = new Vector3(0.3, 0.3, 0.3);
    ps.color1 = new Color3(1, 0.85, 0.2).toColor4(0.95);
    ps.color2 = new Color3(0, 0.95, 1).toColor4(0.75);
    ps.colorDead = new Color3(0, 0, 0).toColor4(0.0);
    ps.start();

    this.trailSystem = ps;
  }

  public update(dt: number, arena: Arena, strikers: Striker[]): 'none' | 'cyan_scores' | 'magenta_scores' {
    // 1. Gravity & Friction
    this.velocity.y -= this.gravity * dt;
    this.velocity.x *= this.friction;
    this.velocity.z *= this.friction;

    // Speed Clamp
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.scaleInPlace(this.maxSpeed / speed);
    }

    // 2. Position Integration
    this.position.addInPlace(this.velocity.scale(dt));

    // 3. Ring Rotation
    this.ringMesh.rotation.x += 2.8 * dt;
    this.ringMesh.rotation.y += 3.8 * dt;

    // 4. Update Particle Trail Density
    if (this.trailSystem) {
      this.trailSystem.emitRate = Math.min(260, 40 + speed * 5);
    }

    // 5. Floor Bounce
    if (this.position.y <= this.radius) {
      this.position.y = this.radius;
      if (Math.abs(this.velocity.y) > 2) {
        this.velocity.y *= -this.restitution * 0.88;
        this.audioEngine.playBallHit(Math.abs(this.velocity.y) / 15);
      } else {
        this.velocity.y = 0;
      }
    }

    // Ceiling Bounce
    if (this.position.y >= arena.wallHeight - this.radius) {
      this.position.y = arena.wallHeight - this.radius;
      this.velocity.y *= -this.restitution;
      this.audioEngine.playWallBounce();
    }

    // 6. Update Ground Reticle Projection
    this.groundReticle.position.x = this.position.x;
    this.groundReticle.position.z = this.position.z;
    const altitude = Math.max(0, this.position.y - this.radius);
    const reticleScale = 1.0 + Math.min(altitude / 10, 1.8);
    this.groundReticle.scaling.set(reticleScale, 1.0, reticleScale);
    this.reticleMat.alpha = Math.max(0.3, 0.9 - altitude / 25);

    // 7. Striker-Ball Collisions
    strikers.forEach(striker => {
      if (striker.isDemolished) return;

      const distVec = this.position.subtract(striker.position);
      const dist = distVec.length();
      const minDistance = this.radius + 1.85;

      if (dist < minDistance && dist > 0.001) {
        const normal = distVec.scale(1 / dist);
        this.position = striker.position.add(normal.scale(minDistance));

        const relVel = this.velocity.subtract(striker.velocity);
        const normalSpeed = Vector3.Dot(relVel, normal);

        if (normalSpeed < 0) {
          // Striker contacted ball
          let impulseMult = 1.45;
          // Massive boomer shot if contacting during a dodge flip!
          if (striker.isDodgeFlipping) {
            impulseMult = 2.1;
          }

          const impulse = normal.scale(-normalSpeed * (1 + this.restitution) * impulseMult);
          this.velocity.addInPlace(impulse);

          // Add Striker forward momentum
          const forwardVec = new Vector3(
            Math.sin(striker.yaw) * Math.cos(striker.pitch),
            -Math.sin(striker.pitch) + 0.35, // Lift ball upward
            Math.cos(striker.yaw) * Math.cos(striker.pitch)
          );

          const forwardPush = forwardVec.scale(striker.isBoosting ? 32 : 16);
          this.velocity.addInPlace(forwardPush);

          // Sound effect
          this.audioEngine.playBallHit(this.velocity.length() / 20);
        }

        // Kinetic Pulse Shockwave
        if (striker.isPulseActive) {
          const pulseDirection = new Vector3(
            Math.sin(striker.yaw),
            0.4,
            Math.cos(striker.yaw)
          ).normalize();
          this.velocity = pulseDirection.scale(this.maxSpeed * 0.96);
          this.audioEngine.playBallHit(2.6);
        }
      }
    });

    // 8. Arena Wall Collisions & Goal Detection
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
    const isInsideGoalMouth = Math.abs(this.position.x) < goalHalfW && this.position.y < arena.goalHeight;

    // Cyan End (-Z)
    if (this.position.z < -halfL) {
      if (isInsideGoalMouth) {
        if (this.position.z < -halfL - 2.8) {
          this.audioEngine.playGoalExplosion();
          return 'magenta_scores';
        }
      } else {
        // Hit End Wall
        this.position.z = -halfL;
        this.velocity.z *= -this.restitution;
        this.audioEngine.playWallBounce();
      }
    }

    // Magenta End (+Z)
    if (this.position.z > halfL) {
      if (isInsideGoalMouth) {
        if (this.position.z > halfL + 2.8) {
          this.audioEngine.playGoalExplosion();
          return 'cyan_scores';
        }
      } else {
        // Hit End Wall
        this.position.z = halfL;
        this.velocity.z *= -this.restitution;
        this.audioEngine.playWallBounce();
      }
    }

    // 9. Sync Mesh & Light
    this.rootMesh.position = this.position;
    this.light.position = this.position;

    return 'none';
  }

  public reset(): void {
    this.position.set(0, 1.4, 0);
    this.velocity.set(0, 0, 0);
    this.rootMesh.position = this.position;
    this.light.position = this.position;
    this.groundReticle.position.set(0, 0.06, 0);
  }
}
