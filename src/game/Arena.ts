import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  PointLight,
  Mesh
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';

export class Arena {
  public scene: Scene;
  public width: number = 60;
  public length: number = 100;
  public wallHeight: number = 12;
  public goalWidth: number = 22;
  public goalHeight: number = 9;

  public cyanGoalTrigger!: Mesh;
  public magentaGoalTrigger!: Mesh;

  constructor(scene: Scene) {
    this.scene = scene;
    this.buildStadium();
  }

  private buildStadium(): void {
    // 1. Cybernetic Floor with Grid Material
    const ground = MeshBuilder.CreateGround('arena_ground', {
      width: this.width,
      height: this.length,
      subdivisions: 4
    }, this.scene);
    ground.position = new Vector3(0, 0, 0);

    const gridMat = new GridMaterial('arena_ground_mat', this.scene);
    gridMat.majorUnitFrequency = 5;
    gridMat.minorUnitVisibility = 0.45;
    gridMat.gridRatio = 2;
    gridMat.backFaceCulling = false;
    gridMat.mainColor = new Color3(0.04, 0.05, 0.08);
    gridMat.lineColor = new Color3(0.0, 0.7, 0.9);
    gridMat.opacity = 0.98;
    ground.material = gridMat;

    // 2. Field Boundary Lines & Center Field Ring
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

    // 3. Perimeter Glass Walls (Side Walls)
    const wallMat = new StandardMaterial('wall_glass_mat', this.scene);
    wallMat.diffuseColor = new Color3(0.05, 0.1, 0.18);
    wallMat.specularColor = new Color3(0.2, 0.8, 1.0);
    wallMat.emissiveColor = new Color3(0.01, 0.05, 0.1);
    wallMat.alpha = 0.45;
    wallMat.backFaceCulling = false;

    // Left Wall (-X)
    const leftWall = MeshBuilder.CreateBox('left_wall', {
      width: 1.5,
      height: this.wallHeight,
      depth: this.length
    }, this.scene);
    leftWall.position = new Vector3(-this.width / 2, this.wallHeight / 2, 0);
    leftWall.material = wallMat;

    // Right Wall (+X)
    const rightWall = MeshBuilder.CreateBox('right_wall', {
      width: 1.5,
      height: this.wallHeight,
      depth: this.length
    }, this.scene);
    rightWall.position = new Vector3(this.width / 2, this.wallHeight / 2, 0);
    rightWall.material = wallMat;

    // Glowing Neon Handrails along walls
    this.createNeonRail(new Vector3(-this.width / 2 + 0.8, this.wallHeight, 0), this.length, new Color3(0, 0.95, 1));
    this.createNeonRail(new Vector3(this.width / 2 - 0.8, this.wallHeight, 0), this.length, new Color3(1, 0, 0.95));

    // 4. End Walls with Goal Openings
    this.buildEndWall(-this.length / 2, 'cyan', new Color3(0, 0.95, 1));
    this.buildEndWall(this.length / 2, 'magenta', new Color3(1, 0, 0.95));

    // 5. Goal Trigger Volumes
    // Cyan Goal (at -Z) - When ball enters, Magenta scores!
    this.cyanGoalTrigger = MeshBuilder.CreateBox('cyan_goal_trigger', {
      width: this.goalWidth,
      height: this.goalHeight,
      depth: 6
    }, this.scene);
    this.cyanGoalTrigger.position = new Vector3(0, this.goalHeight / 2, -this.length / 2 - 3);
    this.cyanGoalTrigger.isVisible = false;

    // Magenta Goal (at +Z) - When ball enters, Cyan scores!
    this.magentaGoalTrigger = MeshBuilder.CreateBox('magenta_goal_trigger', {
      width: this.goalWidth,
      height: this.goalHeight,
      depth: 6
    }, this.scene);
    this.magentaGoalTrigger.position = new Vector3(0, this.goalHeight / 2, this.length / 2 + 3);
    this.magentaGoalTrigger.isVisible = false;

    // 6. Dynamic Stadium Lights
    const cyanLight = new PointLight('cyan_stadium_light', new Vector3(0, 16, -this.length / 3), this.scene);
    cyanLight.diffuse = new Color3(0, 0.9, 1);
    cyanLight.intensity = 1.6;
    cyanLight.range = 75;

    const magentaLight = new PointLight('magenta_stadium_light', new Vector3(0, 16, this.length / 3), this.scene);
    magentaLight.diffuse = new Color3(1, 0.1, 0.9);
    magentaLight.intensity = 1.6;
    magentaLight.range = 75;
  }

  private createNeonRail(pos: Vector3, length: number, color: Color3): void {
    const rail = MeshBuilder.CreateCylinder('neon_rail', {
      height: length,
      diameter: 0.35,
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
    wallMat.emissiveColor = color.scale(0.15);
    wallMat.alpha = 0.55;

    // Left segment
    const leftSeg = MeshBuilder.CreateBox(`end_left_${team}`, {
      width: segmentWidth,
      height: this.wallHeight,
      depth: 1.5
    }, this.scene);
    leftSeg.position = new Vector3(-this.width / 2 + segmentWidth / 2, this.wallHeight / 2, zPos);
    leftSeg.material = wallMat;

    // Right segment
    const rightSeg = MeshBuilder.CreateBox(`end_right_${team}`, {
      width: segmentWidth,
      height: this.wallHeight,
      depth: 1.5
    }, this.scene);
    rightSeg.position = new Vector3(this.width / 2 - segmentWidth / 2, this.wallHeight / 2, zPos);
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
      thickness: 0.6,
      tessellation: 32
    }, this.scene);
    goalArch.rotation.z = Math.PI / 2;
    goalArch.position = new Vector3(0, this.goalHeight / 2, zPos);
    const archMat = new StandardMaterial(`arch_mat_${team}`, this.scene);
    archMat.emissiveColor = color;
    archMat.disableLighting = true;
    goalArch.material = archMat;

    // Goal net cage (back of the net)
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
}
