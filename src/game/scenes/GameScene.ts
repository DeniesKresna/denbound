import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { Projectile } from "../entities/Projectile";
import blueCarUrl from "../../assets/blue-car.png";
import cannon1Url from "../../assets/cannon1.png";
import bulletUrl from "../../assets/bullet.png";
import explode1Url from "../../assets/explode-1.png";
import explode2Url from "../../assets/explode-2.png";
import explode3Url from "../../assets/explode-3.png";
import landUrl from "../../assets/land4.png";
import man1Url from "../../assets/man1.png";
import wheels1Url from "../../assets/wheels1.png";
import { initializeGame } from "./InitGame";
import { progressGame } from "./ProgressGame";

export class GameScene extends Phaser.Scene {
  public player1!: Player;
  public player2!: Player;

  public currentPlayer!: Player;

  public turnText!: Phaser.GameObjects.Text;

  public cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  public isShotInProgress = false;

  public wind = 0;

  public windText!: Phaser.GameObjects.Text;

  public moveEnergy = 100;
  public readonly maxMoveEnergy = 100;

  public terrainTiles: Phaser.GameObjects.Image[] = [];
  public explosionZones: { x: number; radius: number }[] = [];

  private readonly terrainTileSize = 10;
  private readonly grassTileFrame = 0;
  private readonly dirtTileFrame = 18;
  private readonly burntTileFrame = 27;

  public terrainPoints = [
    { x: 0, y: 520 },
    { x: 150, y: 500 },
    { x: 300, y: 540 },
    { x: 450, y: 470 },
    { x: 600, y: 510 },
    { x: 750, y: 450 },
    { x: 900, y: 500 },
    { x: 1050, y: 470 },
    { x: 1280, y: 520 },
  ];

  public spaceKey!: Phaser.Input.Keyboard.Key;

  public power = 0;
  public isCharging = false;

  public projectile?: Projectile;

  public player1HpBar!: Phaser.GameObjects.Rectangle;
  public player2HpBar!: Phaser.GameObjects.Rectangle;

  public player1HpText!: Phaser.GameObjects.Text;
  public player2HpText!: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("vehicle-blue-car", blueCarUrl);
    this.load.image("vehicle-cannon", cannon1Url);
    this.load.image("projectile-bullet", bulletUrl);
    this.load.image("explosion-1", explode1Url);
    this.load.image("explosion-2", explode2Url);
    this.load.image("explosion-3", explode3Url);
    this.load.spritesheet("land-tiles", landUrl, { frameWidth: 197, frameHeight: 222 });
    this.load.image("vehicle-man", man1Url);
    this.load.image("vehicle-wheel", wheels1Url);
  }

  create() {
    initializeGame(this);
  }

  update(_time: number, delta: number) {
    progressGame(this, delta);
  }

  public drawTerrain(): void {
    this.terrainTiles.forEach((tile) => tile.destroy());
    this.terrainTiles = [];

    const tileSize = this.terrainTileSize;

    for (let x = tileSize / 2; x < 1280; x += tileSize) {
      const surfaceY = this.getTerrainY(x);
      const surfaceRow = Math.floor(surfaceY / tileSize);
      const isBurnt = this.explosionZones.some(
        (zone) => Math.abs(x - zone.x) <= zone.radius,
      );

      for (let row = surfaceRow; row * tileSize < 720; row++) {
        const isSurface = row === surfaceRow;
        const frame = isSurface ? (isBurnt ? this.burntTileFrame : this.grassTileFrame) : this.dirtTileFrame;
        const tile = this.add.image(x, row * tileSize + tileSize / 2, "land-tiles", frame);

        // Oversize significantly: the source art has inner padding, so edge-to-edge sizing leaves visible gaps.
        tile.setDisplaySize(tileSize * 1.8, tileSize * 1.8);
        tile.setDepth(0);

        this.terrainTiles.push(tile);
      }
    }
  }

  public getWindText(): string {
    if (this.wind < 0) {
      return `WIND\n← ${Math.abs(this.wind)}`;
    }

    if (this.wind > 0) {
      return `WIND\n${this.wind} →`;
    }

    return "WIND\n0";
  }

  public getTerrainY(x: number): number {
    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const pointA = this.terrainPoints[i];
      const pointB = this.terrainPoints[i + 1];

      if (x >= pointA.x && x <= pointB.x) {
        const progress = (x - pointA.x) / (pointB.x - pointA.x);

        return Phaser.Math.Linear(pointA.y, pointB.y, progress);
      }
    }

    return 720;
  }

  public getTerrainAngle(x: number): number {
    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const pointA = this.terrainPoints[i];
      const pointB = this.terrainPoints[i + 1];

      if (x >= pointA.x && x <= pointB.x) {
        const angle = Phaser.Math.RadToDeg(Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x));

        return angle;
      }
    }

    return 0;
  }

  public changeTurn(): void {
    if (this.currentPlayer === this.player1) {
      this.currentPlayer = this.player2;
    } else {
      this.currentPlayer = this.player1;
    }
  }

  public generateWind(): void {
    this.wind = Phaser.Math.Between(-10, 10);
  }
}