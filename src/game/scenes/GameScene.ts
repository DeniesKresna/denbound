import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { Projectile } from "../entities/Projectile";
import blueCarUrl from "../../assets/blue-car.png";
import cannon1Url from "../../assets/cannon1.png";
import bulletUrl from "../../assets/bullet.png";
import explode1Url from "../../assets/explode-1.png";
import explode2Url from "../../assets/explode-2.png";
import explode3Url from "../../assets/explode-3.png";
import smoke1Url from "../../assets/car/effect/smoke-1.png";
import smoke2Url from "../../assets/car/effect/smoke-2.png";
import smoke3Url from "../../assets/car/effect/smoke-3.png";
import fired1Url from "../../assets/car/effect/fired-1.png";
import fired2Url from "../../assets/car/effect/fired-2.png";
import fired3Url from "../../assets/car/effect/fired-3.png";
import landUrl from "../../assets/land4.png";
import greenLakeUrl from "../../assets/wallpaper/green-lake.png";
import projectileSfxUrl from "../../assets/music/projectile.mp3";
import truckSfxUrl from "../../assets/music/truck.mp3";
import brickExplodeSfxUrl from "../../assets/music/brick-explode.mp3";
import explodeSfxUrl from "../../assets/music/explode.mp3";
import dagoredUrl from "../../assets/music/dagored.mp3";
import pufinoUrl from "../../assets/music/pufino.mp3";
import man1Url from "../../assets/man1.png";
import wheels1Url from "../../assets/wheels1.png";
import { initializeGame } from "./InitGame";
import { progressGame } from "./ProgressGame";

export class GameScene extends Phaser.Scene {
  public player1!: Player;
  public player2!: Player;

  public currentPlayer!: Player;

  public cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  public isShotInProgress = false;
  public isGameOver = false;

  public wind = 0;

  public windText!: Phaser.GameObjects.Text;

  public moveEnergy = 100;
  public readonly maxMoveEnergy = 100;

  public readonly maxPower = 120;

  public terrainTiles: Phaser.GameObjects.Image[] = [];
  public explosionZones: { x: number; radius: number }[] = [];

  private readonly initialTerrainPoints = [
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

  private readonly terrainTileSize = 10;
  private readonly grassTileFrame = 0;
  private readonly dirtTileFrame = 18;
  private readonly burntTileFrame = 27;

  public terrainPoints = this.initialTerrainPoints.map((point) => ({ ...point }));

  public spaceKey!: Phaser.Input.Keyboard.Key;

  public power = 0;
  public isCharging = false;

  public projectile?: Projectile;

  public player1HpBar!: Phaser.GameObjects.Rectangle;
  public player2HpBar!: Phaser.GameObjects.Rectangle;

  public player1HpText!: Phaser.GameObjects.Text;
  public player2HpText!: Phaser.GameObjects.Text;

  public isSettingsPopupOpen = false;

  public backgroundMusicVolume = 0.5;
  public soundEffectVolume = 0.55;

  private gameMusic?: Phaser.Sound.BaseSound;
  private gameOverMusic?: Phaser.Sound.BaseSound;
  private truckSound?: Phaser.Sound.BaseSound;

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
    this.load.image("vehicle-smoke-1", smoke1Url);
    this.load.image("vehicle-smoke-2", smoke2Url);
    this.load.image("vehicle-smoke-3", smoke3Url);
    this.load.image("vehicle-fired-1", fired1Url);
    this.load.image("vehicle-fired-2", fired2Url);
    this.load.image("vehicle-fired-3", fired3Url);
    this.load.image("green-lake-background", greenLakeUrl);
    this.load.audio("truck-sfx", truckSfxUrl);
    this.load.audio("brick-explode-sfx", brickExplodeSfxUrl);
    this.load.audio("explode-sfx", explodeSfxUrl);
    this.load.audio("projectile-sfx", projectileSfxUrl);
    this.load.audio("dagored-music", dagoredUrl);
    this.load.audio("pufino-music", pufinoUrl);
    // frameHeight must keep 4 full rows within the 887px source height (4 * 222 would overflow and drop row 3).
    this.load.spritesheet("land-tiles", landUrl, { frameWidth: 197, frameHeight: 221 });
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

  public resetGameState(): void {
    this.isShotInProgress = false;
    this.isGameOver = false;
    this.wind = 0;
    this.moveEnergy = this.maxMoveEnergy;
    this.power = 0;
    this.isCharging = false;
    this.projectile = undefined;
    this.explosionZones = [];
    this.terrainPoints = this.initialTerrainPoints.map((point) => ({ ...point }));
    this.stopTruckSound();
  }

  public playGameMusic(): void {
    this.stopMusic();

    this.gameMusic = this.sound.add("dagored-music", {
      loop: true,
      volume: this.backgroundMusicVolume,
    });

    this.gameMusic.play();
  }

  public playGameOverMusic(): void {
    if (this.gameOverMusic?.isPlaying) {
      return;
    }

    this.gameMusic?.stop();

    this.gameOverMusic = this.sound.add("pufino-music", {
      loop: true,
      volume: this.backgroundMusicVolume,
    });

    this.gameOverMusic.play();
  }

  public stopMusic(): void {
    this.gameMusic?.stop();
    this.gameOverMusic?.stop();

    this.gameMusic?.destroy();
    this.gameOverMusic?.destroy();

    this.gameMusic = undefined;
    this.gameOverMusic = undefined;
  }

  public playTruckSound(): void {
    if (!this.truckSound) {
      this.truckSound = this.sound.add("truck-sfx", {
        loop: true,
        volume: this.getSoundEffectVolume(0.82),
      });
    }

    if (!this.truckSound.isPlaying) {
      this.truckSound.play();
    }
  }

  public stopTruckSound(): void {
    if (!this.truckSound) {
      return;
    }

    this.truckSound.stop();
  }

  public playProjectileSound(): void {
    this.sound.play("projectile-sfx", { volume: this.getSoundEffectVolume() });
  }

  public playBrickExplosionSound(): void {
    this.sound.play("brick-explode-sfx", { volume: this.getSoundEffectVolume(1.18) });
  }

  public playExplosionSound(): void {
    this.sound.play("explode-sfx", { volume: this.getSoundEffectVolume(1.27) });
  }

  public setBackgroundMusicVolume(volume: number): void {
    this.backgroundMusicVolume = Phaser.Math.Clamp(volume, 0, 1);

    this.updateSoundVolume(this.gameMusic, this.backgroundMusicVolume);
    this.updateSoundVolume(this.gameOverMusic, this.backgroundMusicVolume);
  }

  public setSoundEffectVolume(volume: number): void {
    this.soundEffectVolume = Phaser.Math.Clamp(volume, 0, 1);

    this.updateSoundVolume(this.truckSound, this.getSoundEffectVolume(0.82));
  }

  private getSoundEffectVolume(multiplier = 1): number {
    return Phaser.Math.Clamp(this.soundEffectVolume * multiplier, 0, 1);
  }

  private updateSoundVolume(sound: Phaser.Sound.BaseSound | undefined, volume: number): void {
    if (!sound) {
      return;
    }

    (sound as Phaser.Sound.BaseSound & {
      setVolume(volume: number): void;
    }).setVolume(volume);
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
    this.player1.setMoveBarVisible(false);
    this.player2.setMoveBarVisible(false);

    if (this.currentPlayer === this.player1) {
      this.player1.setTurnIndicatorVisible(false);
      this.currentPlayer = this.player2;
      this.player2.setTurnIndicatorVisible(true);
    } else {
      this.player2.setTurnIndicatorVisible(false);
      this.currentPlayer = this.player1;
      this.player1.setTurnIndicatorVisible(true);
    }
  }

  public generateWind(): void {
    this.wind = Phaser.Math.Between(-10, 10);
  }
}