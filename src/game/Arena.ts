import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  PointLight,
  Mesh,
  MirrorTexture,
  Plane,
  SpotLight,
  DynamicTexture
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import type { AudioEngine } from './AudioEngine';

export interface BoostPad {
  id: string;
  position: Vector3;
  type: 'mega' | 'small';
  amount: number;
  respawnDuration: number;
  timer: number;
  isActive: boolean;
  rootMesh: Mesh;
  crystalMesh: Mesh;
  light?: PointLight;
}

export class Arena {
  public scene: Scene;
  public width: number = 64;
  public length: number = 104;
  public wallHeight: number = 18;
  public goalWidth: number = 22;
  public goalHeight: number = 9;

  public groundMesh!: Mesh;
  public groundMirror!: MirrorTexture;
  public cyanGoalTrigger!: Mesh;
  public magentaGoalTrigger!: Mesh;
  public boostPads: BoostPad[] = [];

  private jumbotrons: { mesh: Mesh; texture: DynamicTexture }[] = [];
  private jumbotronScroll: number = 0;
  private jumbotronTimer: number = 0;
  private audioEngine: AudioEngine | null = null;

  constructor(scene: Scene, audioEngine?: AudioEngine) {
    this.scene = scene;
    if (audioEngine) this.audioEngine = audioEngine;
    this.buildStadium();
    this.initBoostPads();
  }

  public setAudioEngine(ae: AudioEngine): void {
    this.audioEngine = ae;
  }

  public addMirrorRenderMesh(mesh: Mesh): void {
    if (this.groundMirror && this.groundMirror.renderList) {
      this.groundMirror.renderList.push(mesh);
    }
  }

  private buildStadium(): void {
    // 1. Polished Obsidian Ground with Real-Time Planar Mirror Reflections
    this.groundMirror = new MirrorTexture('arena_ground_mirror', 1024, this.scene, true);
    this.groundMirror.mirrorPlane = new Plane(0, -1, 0, 0);
    this.groundMirror.blurRatio = 1.0;
    this.groundMirror.adaptiveBlurKernel = 16;

    this.groundMesh = MeshBuilder.CreateGround('arena_ground', {
      width: this.width,
      height: this.length,
      subdivisions: 4
    }, this.scene);
    this.groundMesh.position = new Vector3(0, 0, 0);

    const groundMat = new StandardMaterial('arena_ground_mat', this.scene);
    groundMat.diffuseColor = new Color3(0.015, 0.02, 0.035);
    groundMat.specularColor = new Color3(0.7, 0.85, 1.0);
    groundMat.specularPower = 128;
    groundMat.reflectionTexture = this.groundMirror;
    groundMat.reflectionTexture.level = 0.48; // Crisp, high-gloss wet-look mirror reflection
    this.groundMesh.material = groundMat;
    this.groundMesh.receiveShadows = true;

    // Semi-transparent Cyber Grid Overlay right above the mirror floor
    const gridOverlay = MeshBuilder.CreateGround('arena_grid_overlay', {
      width: this.width,
      height: this.length,
      subdivisions: 4
    }, this.scene);
    gridOverlay.position = new Vector3(0, 0.02, 0);

    const gridMat = new GridMaterial('arena_grid_mat', this.scene);
    gridMat.majorUnitFrequency = 6;
    gridMat.minorUnitVisibility = 0.35;
    gridMat.gridRatio = 3;
    gridMat.backFaceCulling = false;
    gridMat.mainColor = new Color3(0.02, 0.03, 0.05);
    gridMat.lineColor = new Color3(0.0, 0.85, 1.0);
    gridMat.opacity = 0.42;
    gridOverlay.material = gridMat;

    // 2. High Ceiling Transparent Containment Barrier
    const ceiling = MeshBuilder.CreateGround('arena_ceiling', {
      width: this.width,
      height: this.length,
      subdivisions: 2
    }, this.scene);
    ceiling.position = new Vector3(0, this.wallHeight, 0);
    ceiling.rotation.x = Math.PI;

    const ceilingMat = new StandardMaterial('ceiling_mat', this.scene);
    ceilingMat.diffuseColor = new Color3(0.02, 0.04, 0.08);
    ceilingMat.emissiveColor = new Color3(0.0, 0.2, 0.4);
    ceilingMat.alpha = 0.15;
    ceiling.material = ceilingMat;

    // 3. Center Kickoff Ring & Midfield Line
    const centerRing = MeshBuilder.CreateTorus('center_ring', {
      diameter: 18,
      thickness: 0.35,
      tessellation: 64
    }, this.scene);
    centerRing.position = new Vector3(0, 0.08, 0);
    const ringMat = new StandardMaterial('ring_mat', this.scene);
    ringMat.emissiveColor = new Color3(0.0, 0.95, 1.0);
    ringMat.disableLighting = true;
    centerRing.material = ringMat;

    // Center dividing line
    const centerLine = MeshBuilder.CreateBox('center_line', {
      width: this.width - 2,
      height: 0.06,
      depth: 0.4
    }, this.scene);
    centerLine.position = new Vector3(0, 0.05, 0);
    const lineMat = new StandardMaterial('line_mat', this.scene);
    lineMat.emissiveColor = new Color3(0.3, 0.5, 0.8);
    centerLine.material = lineMat;

    // 4. Perimeter Glass Walls (Side Walls)
    const wallMat = new StandardMaterial('wall_glass_mat', this.scene);
    wallMat.diffuseColor = new Color3(0.04, 0.08, 0.14);
    wallMat.specularColor = new Color3(0.2, 0.8, 1.0);
    wallMat.emissiveColor = new Color3(0.01, 0.05, 0.1);
    wallMat.alpha = 0.45;
    wallMat.backFaceCulling = false;

    // Left Wall (-X)
    const leftWall = MeshBuilder.CreateBox('left_wall', {
      width: 1.5,
      height: this.wallHeight,
      depth: this.length - 24
    }, this.scene);
    leftWall.position = new Vector3(-this.width / 2, this.wallHeight / 2, 0);
    leftWall.material = wallMat;

    // Right Wall (+X)
    const rightWall = MeshBuilder.CreateBox('right_wall', {
      width: 1.5,
      height: this.wallHeight,
      depth: this.length - 24
    }, this.scene);
    rightWall.position = new Vector3(this.width / 2, this.wallHeight / 2, 0);
    rightWall.material = wallMat;

    // 5. Chamfered 45-Degree Corner Walls (Predictable Rebounds)
    this.buildCornerWall(-this.width / 2 + 6, -this.length / 2 + 6, Math.PI / 4, 'c_sw');
    this.buildCornerWall(this.width / 2 - 6, -this.length / 2 + 6, -Math.PI / 4, 'c_se');
    this.buildCornerWall(-this.width / 2 + 6, this.length / 2 - 6, 3 * Math.PI / 4, 'c_nw');
    this.buildCornerWall(this.width / 2 - 6, this.length / 2 - 6, -3 * Math.PI / 4, 'c_ne');

    // 6. Glowing Neon Handrails & Truss Beams
    this.createNeonRail(new Vector3(-this.width / 2 + 0.8, this.wallHeight, 0), this.length, new Color3(0, 0.95, 1));
    this.createNeonRail(new Vector3(this.width / 2 - 0.8, this.wallHeight, 0), this.length, new Color3(1, 0, 0.95));

    // 7. End Walls with Goal Openings
    this.buildEndWall(-this.length / 2, 'cyan', new Color3(0, 0.95, 1));
    this.buildEndWall(this.length / 2, 'magenta', new Color3(1, 0, 0.95));

    // 8. Goal Trigger Volumes
    this.cyanGoalTrigger = MeshBuilder.CreateBox('cyan_goal_trigger', {
      width: this.goalWidth,
      height: this.goalHeight,
      depth: 6
    }, this.scene);
    this.cyanGoalTrigger.position = new Vector3(0, this.goalHeight / 2, -this.length / 2 - 3);
    this.cyanGoalTrigger.isVisible = false;

    this.magentaGoalTrigger = MeshBuilder.CreateBox('magenta_goal_trigger', {
      width: this.goalWidth,
      height: this.goalHeight,
      depth: 6
    }, this.scene);
    this.magentaGoalTrigger.position = new Vector3(0, this.goalHeight / 2, this.length / 2 + 3);
    this.magentaGoalTrigger.isVisible = false;

    // 9. Dynamic Stadium Lighting
    const cyanLight = new PointLight('cyan_stadium_light', new Vector3(0, 18, -this.length / 3), this.scene);
    cyanLight.diffuse = new Color3(0, 0.95, 1);
    cyanLight.intensity = 1.8;
    cyanLight.range = 80;

    const magentaLight = new PointLight('magenta_stadium_light', new Vector3(0, 18, this.length / 3), this.scene);
    magentaLight.diffuse = new Color3(1, 0.1, 0.95);
    magentaLight.intensity = 1.8;
    magentaLight.range = 80;

    // 10. Outer Cyberpunk Orbital Megadome & Atmospheric Truss System
    this.buildMegadomeAtmosphere();
  }

  private buildMegadomeAtmosphere(): void {
    // 1. Cosmic Starfield & Nebula Dome
    const skySphere = MeshBuilder.CreateSphere('cosmic_sky', { diameter: 360, segments: 16, sideOrientation: Mesh.BACKSIDE }, this.scene);
    const skyMat = new StandardMaterial('cosmic_sky_mat', this.scene);
    skyMat.diffuseColor = new Color3(0.01, 0.015, 0.03);
    skyMat.emissiveColor = new Color3(0.02, 0.03, 0.06);
    skyMat.disableLighting = true;
    skySphere.material = skyMat;

    // 2. Grand Outer Megadome Bowl
    const domeShell = MeshBuilder.CreateCylinder('megadome_shell', {
      diameterTop: 220,
      diameterBottom: 180,
      height: 60,
      tessellation: 36,
      sideOrientation: Mesh.BACKSIDE
    }, this.scene);
    domeShell.position = new Vector3(0, 26, 0);
    const domeMat = new StandardMaterial('dome_mat', this.scene);
    domeMat.diffuseColor = new Color3(0.025, 0.03, 0.045);
    domeMat.specularColor = new Color3(0.15, 0.25, 0.35);
    domeMat.emissiveColor = new Color3(0.01, 0.015, 0.025);
    domeShell.material = domeMat;

    // 3. 4 Corner Stadium Floodlight Towers with High-Intensity Spotlights
    const towerCoords = [
      { x: -this.width / 2 - 14, z: -this.length / 2 - 10, rotY: Math.PI / 4, col: new Color3(0, 0.9, 1) },
      { x: this.width / 2 + 14, z: -this.length / 2 - 10, rotY: -Math.PI / 4, col: new Color3(0, 0.9, 1) },
      { x: -this.width / 2 - 14, z: this.length / 2 + 10, rotY: 3 * Math.PI / 4, col: new Color3(1, 0.1, 0.9) },
      { x: this.width / 2 + 14, z: this.length / 2 + 10, rotY: -3 * Math.PI / 4, col: new Color3(1, 0.1, 0.9) },
    ];

    towerCoords.forEach((t, idx) => {
      // Pylon Truss column
      const pylon = MeshBuilder.CreateBox(`flood_pylon_${idx}`, { width: 3, height: 38, depth: 3 }, this.scene);
      pylon.position = new Vector3(t.x, 19, t.z);
      const pylonMat = new StandardMaterial(`pylon_mat_${idx}`, this.scene);
      pylonMat.diffuseColor = new Color3(0.08, 0.09, 0.12);
      pylonMat.specularColor = new Color3(0.4, 0.5, 0.6);
      pylon.material = pylonMat;

      // Angled Light Bank Head
      const head = MeshBuilder.CreateBox(`flood_head_${idx}`, { width: 8, height: 4, depth: 2 }, this.scene);
      head.position = new Vector3(t.x, 37, t.z);
      head.rotation.y = t.rotY;
      head.rotation.x = 0.45; // Angled down toward pitch
      const headMat = new StandardMaterial(`flood_head_mat_${idx}`, this.scene);
      headMat.emissiveColor = new Color3(0.95, 0.98, 1.0);
      head.material = headMat;

      // Stadium SpotLight shining into the pitch
      const spot = new SpotLight(`stadium_spot_${idx}`, head.position, new Vector3(-t.x * 0.5, -28, -t.z * 0.5).normalize(), Math.PI / 3, 2, this.scene);
      spot.diffuse = new Color3(0.9, 0.95, 1.0);
      spot.intensity = 1.4;
      spot.range = 120;
    });

    // 4. 3 Massive Curved Space Truss Arches crossing the ceiling
    [-32, 0, 32].forEach((zArch, idx) => {
      const arch = MeshBuilder.CreateTorus(`space_arch_${idx}`, {
        diameter: this.width + 18,
        thickness: 1.4,
        tessellation: 36
      }, this.scene);
      arch.position = new Vector3(0, 18, zArch);
      arch.rotation.z = Math.PI / 2;
      const archMat = new StandardMaterial(`arch_mat_${idx}`, this.scene);
      archMat.diffuseColor = new Color3(0.06, 0.08, 0.12);
      archMat.specularColor = new Color3(0.6, 0.7, 0.9);
      arch.material = archMat;

      // Glowing Neon Spine on arch
      const neonSpine = MeshBuilder.CreateTorus(`arch_neon_${idx}`, {
        diameter: this.width + 18.8,
        thickness: 0.35,
        tessellation: 36
      }, this.scene);
      neonSpine.position = new Vector3(0, 18, zArch);
      neonSpine.rotation.z = Math.PI / 2;
      const neonMat = new StandardMaterial(`arch_neon_mat_${idx}`, this.scene);
      neonMat.emissiveColor = idx === 1 ? new Color3(0, 0.95, 1) : (idx === 0 ? new Color3(0, 0.8, 1) : new Color3(1, 0, 0.9));
      neonMat.disableLighting = true;
      neonSpine.material = neonMat;
    });

    // 5. 4 Giant Holographic Jumbotrons / LED Ribbons
    const jumbotronConfigs = [
      { id: 'jumbo_west', pos: new Vector3(-this.width / 2 - 2, 14, 0), rotY: Math.PI / 2, width: 44, height: 7 },
      { id: 'jumbo_east', pos: new Vector3(this.width / 2 + 2, 14, 0), rotY: -Math.PI / 2, width: 44, height: 7 },
      { id: 'jumbo_north', pos: new Vector3(0, 15, this.length / 2 + 2), rotY: Math.PI, width: 32, height: 6 },
      { id: 'jumbo_south', pos: new Vector3(0, 15, -this.length / 2 - 2), rotY: 0, width: 32, height: 6 },
    ];

    jumbotronConfigs.forEach(cfg => {
      const plane = MeshBuilder.CreatePlane(cfg.id, { width: cfg.width, height: cfg.height }, this.scene);
      plane.position = cfg.pos;
      plane.rotation.y = cfg.rotY;

      const dt = new DynamicTexture(`dt_${cfg.id}`, { width: 512, height: 128 }, this.scene, false);
      const mat = new StandardMaterial(`mat_${cfg.id}`, this.scene);
      mat.diffuseTexture = dt;
      mat.emissiveTexture = dt;
      mat.emissiveColor = new Color3(0.9, 0.9, 0.9);
      mat.disableLighting = true;
      plane.material = mat;

      this.jumbotrons.push({ mesh: plane, texture: dt });
      this.drawJumbotron(dt, 0);
    });
  }

  private drawJumbotron(dt: DynamicTexture, scrollOffset: number): void {
    const ctx = dt.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#030509';
    ctx.fillRect(0, 0, 512, 128);

    // Glowing border frame
    ctx.strokeStyle = '#00F3FF';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 122);

    // Header badge
    ctx.fillStyle = '#FF00FF';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('⚡ TACHYON ESPORTS // HYPER-VELOCITY CIRCUIT ⚡', 24, 38);

    // Scrolling text banner
    ctx.fillStyle = '#00F3FF';
    ctx.font = 'bold 34px monospace';
    const text = 'ASTRO-SMASH ARENA // MACH 1 BOOMERS // 60 FPS P2P // OVERDRIVE';
    const xPos = 40 - (scrollOffset % 600);
    ctx.fillText(text, xPos, 86);
    ctx.fillText(text, xPos + 600, 86);

    // Scanlines
    ctx.fillStyle = 'rgba(0, 243, 255, 0.08)';
    for (let y = 0; y < 128; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }
    dt.update();
  }

  private buildCornerWall(x: number, z: number, rotationY: number, id: string): void {
    const corner = MeshBuilder.CreateBox(`corner_${id}`, {
      width: 17,
      height: this.wallHeight,
      depth: 1.5
    }, this.scene);
    corner.position = new Vector3(x, this.wallHeight / 2, z);
    corner.rotation.y = rotationY;

    const cornerMat = new StandardMaterial(`corner_mat_${id}`, this.scene);
    cornerMat.diffuseColor = new Color3(0.04, 0.08, 0.14);
    cornerMat.emissiveColor = new Color3(0.0, 0.4, 0.8);
    cornerMat.alpha = 0.55;
    corner.material = cornerMat;
  }

  private createNeonRail(pos: Vector3, length: number, color: Color3): void {
    const rail = MeshBuilder.CreateCylinder('neon_rail', {
      height: length,
      diameter: 0.4,
      tessellation: 16
    }, this.scene);
    rail.rotation.x = Math.PI / 2;
    rail.position = pos;

    const mat = new StandardMaterial('neon_rail_mat', this.scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    rail.material = mat;
  }

  private buildEndWall(zPos: number, team: 'cyan' | 'magenta', color: Color3): void {
    const segmentWidth = (this.width - this.goalWidth) / 2;
    const isBack = zPos > 0;
    const sign = isBack ? 1 : -1;

    const wallMat = new StandardMaterial(`endwall_${team}`, this.scene);
    wallMat.diffuseColor = new Color3(0.04, 0.08, 0.14);
    wallMat.emissiveColor = color.scale(0.18);
    wallMat.alpha = 0.55;

    // Left segment
    const leftSeg = MeshBuilder.CreateBox(`end_left_${team}`, {
      width: segmentWidth - 6,
      height: this.wallHeight,
      depth: 1.5
    }, this.scene);
    leftSeg.position = new Vector3(-this.width / 2 + segmentWidth / 2 + 3, this.wallHeight / 2, zPos);
    leftSeg.material = wallMat;

    // Right segment
    const rightSeg = MeshBuilder.CreateBox(`end_right_${team}`, {
      width: segmentWidth - 6,
      height: this.wallHeight,
      depth: 1.5
    }, this.scene);
    rightSeg.position = new Vector3(this.width / 2 - segmentWidth / 2 - 3, this.wallHeight / 2, zPos);
    rightSeg.material = wallMat;

    // Top crossbar over the goal
    const topBar = MeshBuilder.CreateBox(`end_top_${team}`, {
      width: this.goalWidth,
      height: this.wallHeight - this.goalHeight,
      depth: 1.5
    }, this.scene);
    topBar.position = new Vector3(0, this.goalHeight + (this.wallHeight - this.goalHeight) / 2, zPos);
    topBar.material = wallMat;

    // Goal Frame / Arch
    const goalArch = MeshBuilder.CreateTorus(`goal_arch_${team}`, {
      diameter: this.goalWidth,
      thickness: 0.7,
      tessellation: 32
    }, this.scene);
    goalArch.rotation.z = Math.PI / 2;
    goalArch.position = new Vector3(0, this.goalHeight / 2, zPos);
    const archMat = new StandardMaterial(`arch_mat_${team}`, this.scene);
    archMat.emissiveColor = color;
    archMat.disableLighting = true;
    goalArch.material = archMat;

    // Goal Net Cage (Back)
    const goalBack = MeshBuilder.CreateBox(`goal_cage_${team}`, {
      width: this.goalWidth,
      height: this.goalHeight,
      depth: 1
    }, this.scene);
    goalBack.position = new Vector3(0, this.goalHeight / 2, zPos + sign * 6);
    const cageMat = new StandardMaterial(`cage_mat_${team}`, this.scene);
    cageMat.diffuseColor = new Color3(0.02, 0.02, 0.04);
    cageMat.emissiveColor = color.scale(0.35);
    cageMat.alpha = 0.35;
    goalBack.material = cageMat;
  }

  // ==============================================================
  // TACTICAL BOOST PADS & MEGA CANISTERS SYSTEM
  // ==============================================================
  private initBoostPads(): void {
    // 6 Mega Boost Canisters (+100% Boost, 10s Respawn)
    const megaLocations = [
      { id: 'mega_sw', x: -this.width / 2 + 6, z: -this.length / 2 + 10 },
      { id: 'mega_se', x: this.width / 2 - 6, z: -this.length / 2 + 10 },
      { id: 'mega_nw', x: -this.width / 2 + 6, z: this.length / 2 - 10 },
      { id: 'mega_ne', x: this.width / 2 - 6, z: this.length / 2 - 10 },
      { id: 'mega_mw', x: -this.width / 2 + 4, z: 0 },
      { id: 'mega_me', x: this.width / 2 - 4, z: 0 }
    ];

    megaLocations.forEach(loc => {
      this.createBoostPad(loc.id, new Vector3(loc.x, 1.2, loc.z), 'mega', 100, 10);
    });

    // 12 Small Boost Pads (+12% Boost, 4s Respawn)
    const smallLocations = [
      // Midfield Line
      { id: 'sm_m1', x: 0, z: -8 },
      { id: 'sm_m2', x: 0, z: 8 },
      { id: 'sm_m3', x: -14, z: 0 },
      { id: 'sm_m4', x: 14, z: 0 },
      // Defensive Arches (Cyan)
      { id: 'sm_c1', x: 0, z: -26 },
      { id: 'sm_c2', x: -12, z: -34 },
      { id: 'sm_c3', x: 12, z: -34 },
      { id: 'sm_c4', x: 0, z: -44 },
      // Defensive Arches (Magenta)
      { id: 'sm_mg1', x: 0, z: 26 },
      { id: 'sm_mg2', x: -12, z: 34 },
      { id: 'sm_mg3', x: 12, z: 34 },
      { id: 'sm_mg4', x: 0, z: 44 }
    ];

    smallLocations.forEach(loc => {
      this.createBoostPad(loc.id, new Vector3(loc.x, 0.4, loc.z), 'small', 12, 4);
    });
  }

  private createBoostPad(id: string, pos: Vector3, type: 'mega' | 'small', amount: number, respawnDuration: number): void {
    const isMega = type === 'mega';
    const root = new Mesh(`pad_${id}`, this.scene);
    root.position = pos;

    // Floor Base Plate (Pulsing Octagon)
    const plate = MeshBuilder.CreateCylinder(`plate_${id}`, {
      diameter: isMega ? 4.2 : 2.2,
      height: 0.12,
      tessellation: 8
    }, this.scene);
    plate.position = new Vector3(0, -pos.y + 0.06, 0);
    plate.parent = root;

    const plateMat = new StandardMaterial(`plate_mat_${id}`, this.scene);
    plateMat.diffuseColor = new Color3(0.08, 0.1, 0.15);
    plateMat.emissiveColor = isMega ? new Color3(1, 0.7, 0) : new Color3(0, 0.85, 1);
    plateMat.emissiveColor.scaleToRef(0.4, plateMat.emissiveColor);
    plate.material = plateMat;

    // Floating Rotating Energy Crystal
    let crystal: Mesh;
    if (isMega) {
      // Rotating Octahedron Gem / Floating Canister
      crystal = MeshBuilder.CreatePolyhedron(`crystal_${id}`, {
        type: 1, // Octahedron
        size: 1.1
      }, this.scene);
    } else {
      // Small Glowing Hexagon Tablet
      crystal = MeshBuilder.CreateCylinder(`crystal_${id}`, {
        diameter: 1.4,
        height: 0.25,
        tessellation: 6
      }, this.scene);
    }
    crystal.position = new Vector3(0, 0, 0);
    crystal.parent = root;

    const crystalMat = new StandardMaterial(`crystal_mat_${id}`, this.scene);
    crystalMat.emissiveColor = isMega ? new Color3(1, 0.85, 0.1) : new Color3(0, 0.95, 1);
    crystalMat.disableLighting = true;
    crystal.material = crystalMat;

    // Point Light for Mega Canisters
    let light: PointLight | undefined;
    if (isMega) {
      light = new PointLight(`pad_light_${id}`, pos, this.scene);
      light.diffuse = new Color3(1, 0.75, 0);
      light.intensity = 1.2;
      light.range = 10;
    }

    this.boostPads.push({
      id,
      position: pos,
      type,
      amount,
      respawnDuration,
      timer: 0,
      isActive: true,
      rootMesh: root,
      crystalMesh: crystal,
      light
    });
  }

  public update(dt: number): void {
    // Animate scrolling cyber jumbotrons
    this.jumbotronTimer += dt;
    if (this.jumbotronTimer > 0.04) {
      this.jumbotronTimer = 0;
      this.jumbotronScroll += 3.5;
      this.jumbotrons.forEach(j => {
        this.drawJumbotron(j.texture, this.jumbotronScroll);
      });
    }

    // Animate Boost Pads and handle respawn timers
    this.boostPads.forEach(pad => {
      if (pad.isActive) {
        // Floating spin animation
        pad.crystalMesh.rotation.y += (pad.type === 'mega' ? 2.8 : 1.6) * dt;
        pad.crystalMesh.position.y = Math.sin(Date.now() * 0.004 + pad.position.x) * 0.22;
      } else {
        pad.timer -= dt;
        if (pad.timer <= 0) {
          pad.isActive = true;
          pad.crystalMesh.isVisible = true;
          if (pad.light) pad.light.setEnabled(true);
        }
      }
    });
  }

  public checkBoostPickups(strikerPos: Vector3): number {
    let boostAwarded = 0;

    for (const pad of this.boostPads) {
      if (!pad.isActive) continue;

      const dist = Vector3.Distance(strikerPos, pad.position);
      const pickupRadius = pad.type === 'mega' ? 3.4 : 2.0;

      if (dist < pickupRadius) {
        pad.isActive = false;
        pad.timer = pad.respawnDuration;
        pad.crystalMesh.isVisible = false;
        if (pad.light) pad.light.setEnabled(false);

        boostAwarded += pad.amount;
        if (this.audioEngine) {
          this.audioEngine.playBoostPickup(pad.type === 'mega');
        }
        break; // Collect one at a time per frame
      }
    }

    return boostAwarded;
  }
}
