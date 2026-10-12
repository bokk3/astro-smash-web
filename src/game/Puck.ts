import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  PointLight,
  ParticleSystem,
  LinesMesh
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
  public maxSpeed: number = 130; // ~468 KM/H ceiling for hypersonic boomer pinches
  public friction: number = 0.996;
  public restitution: number = 0.92; // High kinetic elasticity
  public gravity: number = 18.5;

  // Ground Indicator Reticle
  private groundReticle: Mesh;
  private reticleMat: StandardMaterial;

  private light: PointLight;
  private trailSystem: ParticleSystem | null = null;
  private ringMesh: Mesh;
  private audioEngine: AudioEngine;
  private lightningLines: LinesMesh[] = [];
  private lightningTimer: number = 0;

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
          let impulseMult = 1.7;
          // Extreme Boomer Shot if contacting during a supersonic dodge flip!
          if (striker.isDodgeFlipping) {
            impulseMult = 2.85;
          }

          const impulse = normal.scale(-normalSpeed * (1 + this.restitution) * impulseMult);
          this.velocity.addInPlace(impulse);

          // Add Striker forward momentum
          const forwardVec = new Vector3(
            Math.sin(striker.yaw) * Math.cos(striker.pitch),
            -Math.sin(striker.pitch) + 0.38, // Lift ball upward
            Math.cos(striker.yaw) * Math.cos(striker.pitch)
          );

          const forwardPush = forwardVec.scale(striker.isBoosting ? 58 : 28);
          this.velocity.addInPlace(forwardPush);

          // Sound effect
          this.audioEngine.playBallHit(Math.min(3.0, this.velocity.length() / 25));
        }

        // Kinetic Pulse Shockwave
        if (striker.isPulseActive) {
          const pulseDirection = new Vector3(
            Math.sin(striker.yaw),
            0.35,
            Math.cos(striker.yaw)
          ).normalize();
          this.velocity = pulseDirection.scale(this.maxSpeed * 0.98);
          this.audioEngine.playBallHit(3.2);
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

    // 10. Electrostatic Lightning Arcs when traveling at high kinetic speed
    this.updateElectrostaticLightning(speed, dt);

    return 'none';
  }

  private updateElectrostaticLightning(speed: number, dt: number): void {
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      // Dispose old arcs
      for (let i = 0; i < this.lightningLines.length; i++) {
        this.lightningLines[i].dispose();
      }
      this.lightningLines = [];

      if (speed < 18) return;

      const numArcs = speed > 50 ? 4 : speed > 30 ? 3 : 2;
      this.lightningTimer = speed > 50 ? 0.04 : 0.07;

      for (let a = 0; a < numArcs; a++) {
        const points: Vector3[] = [];
        points.push(this.position.clone());

        // Target endpoint (random sphere perimeter or downward ground strike)
        let targetEnd: Vector3;
        if (Math.random() < 0.45 && this.position.y < 9) {
          // Ground strike arc
          targetEnd = new Vector3(
            this.position.x + (Math.random() - 0.5) * 4.5,
            0.04,
            this.position.z + (Math.random() - 0.5) * 4.5
          );
        } else {
          // Aerial electrostatic discharge
          const arcAngle = Math.random() * Math.PI * 2;
          const arcPitch = (Math.random() - 0.5) * Math.PI;
          const arcDist = this.radius * (1.8 + Math.random() * 2.2);
          targetEnd = this.position.add(new Vector3(
            Math.cos(arcAngle) * Math.cos(arcPitch) * arcDist,
            Math.sin(arcPitch) * arcDist,
            Math.sin(arcAngle) * Math.cos(arcPitch) * arcDist
          ));
        }

        // Generate jagged midpoints with Brownian displacement
        const steps = 6;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const interp = Vector3.Lerp(this.position, targetEnd, t);
          const jitter = (1.0 - Math.abs(t - 0.5) * 1.5) * 0.95;
          interp.x += (Math.random() - 0.5) * jitter;
          interp.y += (Math.random() - 0.5) * jitter;
          interp.z += (Math.random() - 0.5) * jitter;
          points.push(interp);
        }
        points.push(targetEnd);

        const arc = MeshBuilder.CreateLines(`puck_lightning_${a}`, { points }, this.scene);
        arc.color = speed > 50
          ? new Color3(1.0, 0.95, 0.4) // Intense golden-white plasma
          : Math.random() > 0.5
            ? new Color3(0, 0.95, 1)   // Electric Cyan
            : new Color3(0.9, 0.2, 1); // Neon Violet
        arc.isPickable = false;
        this.lightningLines.push(arc);
      }
    }
  }

  public reset(): void {
    this.position.set(0, 1.4, 0);
    this.velocity.set(0, 0, 0);
    this.rootMesh.position = this.position;
    this.light.position = this.position;
    this.groundReticle.position.set(0, 0.06, 0);
    this.lightningLines.forEach(l => l.dispose());
    this.lightningLines = [];
  }
}
