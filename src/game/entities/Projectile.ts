import Phaser from "phaser";

export class Projectile {
  private readonly bullet: Phaser.GameObjects.Image;

  private velocityX: number;
  private velocityY: number;

  private active = true;

  private readonly gravity = 500;

  private readonly wind: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    wind: number,
  ) {
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.wind = wind;

    this.bullet = scene.add.image(x, y, "projectile-bullet");
    this.bullet.setDisplaySize(20, 13);
    this.bullet.setOrigin(0.5, 0.5);
    this.bullet.setDepth(6);
  }

  public update(delta: number): void {
    if (!this.active) {
      return;
    }

    const dt = delta / 1000;

    // Wind mempengaruhi horizontal velocity
    this.velocityX += this.wind * dt;

    // Gravity mempengaruhi vertical velocity
    this.velocityY += this.gravity * dt;

    this.bullet.x += this.velocityX * dt;
    this.bullet.y += this.velocityY * dt;
    this.bullet.rotation = Math.atan2(this.velocityY, this.velocityX);
  }

  public getX(): number {
    return this.bullet.x;
  }

  public getY(): number {
    return this.bullet.y;
  }

  public isActive(): boolean {
    return this.active;
  }

  public destroy(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.bullet.destroy();
  }
}
