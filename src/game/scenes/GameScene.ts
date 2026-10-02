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
import hillUrl from "../../assets/wallpaper/hill.png";
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

  public windIndicator!: Phaser.GameObjects.Graphics;

  public moveEnergy = 100;
  public readonly maxMoveEnergy = 100;

  public readonly maxPower = 120;

  public readonly worldWidth = 1920;
  public readonly worldHeight = 1400;

  public explosionZones: { x: number; radius: number }[] = [];

  private readonly initialTerrainPoints = [
    { x: 0, y: 1185 },
    { x: 130, y: 1165 },
    { x: 260, y: 1215 },
    { x: 400, y: 1145 },
    { x: 560, y: 1205 },
    { x: 710, y: 1120 },
    { x: 860, y: 1185 },
    { x: 1010, y: 1105 },
    { x: 1140, y: 1180 },
    { x: 1280, y: 1130 },
    { x: 1440, y: 1220 },
    { x: 1580, y: 1140 },
    { x: 1710, y: 1195 },
    { x: 1860, y: 1155 },
    { x: 1920, y: 1175 },
  ];

  private terrainGraphics?: Phaser.GameObjects.Graphics;

  // Terrain is drawn as color bands following the surface curve rather than tile images,
  // so slopes and crater edges stay smooth at any steepness.
  private readonly terrainSampleStep = 6;
  private readonly grassEdgeThickness = 4;
  private readonly grassThickness = 10;
  private readonly lightDirtThickness = 70;

  private readonly grassEdgeColor = 0x2f5d2a;
  private readonly grassColor = 0x4f9c3a;
  private readonly lightDirtColor = 0x9c6b3e;
  private readonly darkDirtColor = 0x6b4423;
  private readonly scorchColor = 0x241812;
  private readonly scorchAlpha = 0.55;

  public terrainPoints = this.initialTerrainPoints.map((point) => ({ ...point }));

  public spaceKey!: Phaser.Input.Keyboard.Key;

  public power = 0;
  public isCharging = false;

  public projectile?: Projectile;

  public player1HpBar!: Phaser.GameObjects.Rectangle;
  public player2HpBar!: Phaser.GameObjects.Rectangle;

  public player1HpText!: Phaser.GameObjects.Text;
  public player2HpText!: Phaser.GameObjects.Text;

  public uiCamera!: Phaser.Cameras.Scene2D.Camera;
  // Objects registered here render only on uiCamera; everything else renders only on the world camera.
  // Re-split every frame via syncCameraIgnoreLists() so late-created objects (bullets, explosions) don't double-render.
  public uiObjects = new Set<Phaser.GameObjects.GameObject>();

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
    this.load.image("hill-background", hillUrl);
    this.load.audio("truck-sfx", truckSfxUrl);
    this.load.audio("brick-explode-sfx", brickExplodeSfxUrl);
    this.load.audio("explode-sfx", explodeSfxUrl);
    this.load.audio("projectile-sfx", projectileSfxUrl);
    this.load.audio("dagored-music", dagoredUrl);
    this.load.audio("pufino-music", pufinoUrl);
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
    this.terrainGraphics ??= this.add.graphics();
    this.terrainGraphics.setDepth(0);
    this.terrainGraphics.clear();

    const samples = this.sampleTerrainSurface();
    const grassBottom = this.grassEdgeThickness + this.grassThickness;
    const dirtBottom = grassBottom + this.lightDirtThickness;

    this.fillTerrainBand(samples, dirtBottom, this.worldHeight, this.darkDirtColor);
    this.fillTerrainBand(samples, grassBottom, dirtBottom, this.lightDirtColor);
    this.fillTerrainBand(samples, this.grassEdgeThickness, grassBottom, this.grassColor);
    this.fillTerrainBand(samples, 0, this.grassEdgeThickness, this.grassEdgeColor);

    this.fillScorchedPatches(samples, dirtBottom);
  }

  private sampleTerrainSurface(): { x: number; y: number; burnt: boolean }[] {
    const samples: { x: number; y: number; burnt: boolean }[] = [];

    for (let x = 0; x <= this.worldWidth; x += this.terrainSampleStep) {
      samples.push({
        x,
        y: this.getTerrainY(x),
        burnt: this.explosionZones.some((zone) => Math.abs(x - zone.x) <= zone.radius),
      });
    }

    if (samples[samples.length - 1].x < this.worldWidth) {
      samples.push({
        x: this.worldWidth,
        y: this.getTerrainY(this.worldWidth),
        burnt: this.explosionZones.some(
          (zone) => Math.abs(this.worldWidth - zone.x) <= zone.radius,
        ),
      });
    }

    return samples;
  }

  // Draws a band that follows the surface curve between two vertical offsets, so slopes
  // and crater edges stay smooth instead of being stair-stepped like a tile grid.
  private fillTerrainBand(
    samples: { x: number; y: number }[],
    topOffset: number,
    bottomOffset: number,
    color: number,
    alpha = 1,
  ): void {
    const graphics = this.terrainGraphics!;

    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(samples[0].x, samples[0].y + topOffset);

    for (const sample of samples) {
      graphics.lineTo(sample.x, sample.y + topOffset);
    }

    for (let i = samples.length - 1; i >= 0; i--) {
      graphics.lineTo(samples[i].x, samples[i].y + bottomOffset);
    }

    graphics.closePath();
    graphics.fillPath();
  }

  // Overlays a translucent char color across each blast radius so the scorched ground
  // reads as browned/blackened without needing separate burnt texture variants.
  private fillScorchedPatches(
    samples: { x: number; y: number; burnt: boolean }[],
    scorchDepth: number,
  ): void {
    let runStart = -1;

    for (let i = 0; i <= samples.length; i++) {
      const isBurnt = i < samples.length && samples[i].burnt;

      if (isBurnt && runStart === -1) {
        runStart = i;
        continue;
      }

      if (!isBurnt && runStart !== -1) {
        const run = samples.slice(Math.max(0, runStart - 1), i + 1);

        this.fillTerrainBand(run, 0, scorchDepth, this.scorchColor, this.scorchAlpha);

        runStart = -1;
      }
    }
  }

  public resetGameState(): void {
    this.isShotInProgress = false;
    this.isGameOver = false;
    this.wind = 0;
    this.terrainGraphics = undefined;
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

  public updateWindIndicator(): void {
    if (!this.windIndicator) {
      return;
    }

    const graphics = this.windIndicator;
    const strength = Math.abs(this.wind) / 10;
    const direction = Math.sign(this.wind);
    const flagLength = this.wind === 0 ? 24 : 20 + strength * 26;
    const flapAmplitude = strength * 9;
    const flapSpeed = 3 + strength * 12;
    const phase = (this.time.now / 1000) * flapSpeed;
    const baseX = 3;

    graphics.clear();
    graphics.lineStyle(2, 0xffffff, 0.9);
    graphics.beginPath();
    graphics.moveTo(0, -15);
    graphics.lineTo(0, 15);
    graphics.strokePath();

    const flagPoint = (progress: number, edge: number): { x: number; y: number } => {
      const wave = Math.sin(phase - progress * 5) * flapAmplitude * progress;
      const halfHeight = 8 * (1 - progress * 0.2);

      if (direction === 0) {
        return {
          x: baseX + edge * halfHeight,
          y: progress * flagLength,
        };
      }

      return {
        x: baseX + direction * flagLength * progress,
        y: wave + edge * halfHeight,
      };
    };

    graphics.fillStyle(0xffffff, 0.95);
    graphics.beginPath();
    for (let step = 0; step <= 8; step++) {
      const point = flagPoint(step / 8, -1);
      if (step === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    }
    for (let step = 8; step >= 0; step--) {
      const point = flagPoint(step / 8, 1);
      graphics.lineTo(point.x, point.y);
    }
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, 0x2ecc71, 0.95);
    graphics.beginPath();
    for (let step = 1; step <= 6; step++) {
      const point = flagPoint(step / 8, 0);
      if (step === 1) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    }
    graphics.strokePath();
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

    return this.worldHeight;
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

  public syncCamera(force = false, delta = 0): void {
    if (!this.player1 || !this.player2) {
      return;
    }

    const camera = this.cameras.main;
    const player1X = this.player1.getCenterX();
    const player2X = this.player2.getCenterX();

    const playerSpanX = Math.abs(player1X - player2X);
    const paddedSpanX = Math.max(480, playerSpanX + 420);
    const targetZoom = Phaser.Math.Clamp(camera.width / paddedSpanX, 0.7, 1.15);
    const currentZoom = force ? targetZoom : Phaser.Math.Linear(camera.zoom, targetZoom, Math.min(1, delta / 220));

    const midX = (player1X + player2X) / 2;
    const viewHalfWidth = camera.width / (2 * currentZoom);
    const viewHalfHeight = camera.height / (2 * currentZoom);

    let targetCenterX = midX;

    if (viewHalfWidth >= this.worldWidth / 2) {
      targetCenterX = this.worldWidth / 2;
    } else {
      targetCenterX = Phaser.Math.Clamp(midX, viewHalfWidth, this.worldWidth - viewHalfWidth);
    }

    const targetCenterY = this.worldHeight - viewHalfHeight;

    camera.setZoom(currentZoom);
    camera.centerOn(targetCenterX, targetCenterY);
  }

  // Objects created after uiObjects was last populated (bullets, explosion fx) default to
  // rendering on both cameras; re-split on every list change so neither camera shows the wrong set.
  public syncCameraIgnoreLists(): void {
    if (!this.uiCamera) {
      return;
    }

    const uiList = Array.from(this.uiObjects);
    const worldList = this.children.list.filter((child) => !this.uiObjects.has(child));

    this.cameras.main.ignore(uiList);
    this.uiCamera.ignore(worldList);
  }
}