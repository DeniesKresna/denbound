import Phaser from "phaser";
import {
  DEFAULT_BLUE_CAR_APPEARANCE,
  type VehicleCharacterAppearance,
  type VehicleFacingDirection,
  VehicleCharacter,
} from "./VehicleCharacter";

export type PlayerDirection = VehicleFacingDirection;

export class Player {
  private readonly scene: Phaser.Scene;

  private readonly vehicle: VehicleCharacter;
  private readonly cannon: Phaser.GameObjects.Image;

  public readonly name: string;
  private direction: PlayerDirection;

  private x: number;
  private y: number;

  private readonly width: number;
  private readonly height: number;

  private hp = 1000;
  private readonly maxHp = 1000;

  private readonly statusBarWidth = 80;
  private readonly statusBarHeight = 6;

  private powerBarBackground: Phaser.GameObjects.Rectangle;
  private powerBarFill: Phaser.GameObjects.Rectangle;

  private moveBarBackground: Phaser.GameObjects.Rectangle;
  private moveBarFill: Phaser.GameObjects.Rectangle;

  private readonly turnIndicator: Phaser.GameObjects.Triangle;
  private turnIndicatorColorToggle = false;

  private readonly nameText: Phaser.GameObjects.Text;

  private readonly aimSpeedDegreesPerSecond = 60;
  private aimOffset = 0;
  // Large enough that even on the steepest clamped terrain (±65°, see getCannonWorldAngle)
  // there's still real elevation left over after cancelling the slope, not just enough to level out.
  private readonly maxAimOffset = 100;

  private readonly vehicleAppearance: VehicleCharacterAppearance;
  private readonly cannonLineLength = 42;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    color: number,
    direction: PlayerDirection,
    appearance: VehicleCharacterAppearance = DEFAULT_BLUE_CAR_APPEARANCE,
  ) {
    this.scene = scene;
    this.name = name;
    this.direction = direction;
    this.x = x;
    this.y = y;

    this.vehicleAppearance = {
      ...DEFAULT_BLUE_CAR_APPEARANCE,
      ...appearance,
      bodyTint: color,
    };

    this.vehicle = new VehicleCharacter(
      this.scene,
      x,
      y,
      direction,
      this.vehicleAppearance,
    );

    this.width = this.vehicle.width;
    this.height = this.vehicle.height;

    const cannonX = direction === "right" ? x + this.width / 2 : x - this.width / 2;
    const cannonY = y - this.height + 14;

    this.cannon = this.scene.add.image(cannonX, cannonY, "vehicle-cannon");
    this.cannon.setDisplaySize(this.cannonLineLength, 10);

    this.cannon.setDepth(4);
    this.cannon.setOrigin(0.5, 0.5);

    this.nameText = this.scene.add.text(x, y - this.height - 30, name, {
      fontSize: "18px",
      color: "#ffffff",
    });

    this.nameText.setOrigin(0.5);

    const barWidth = this.statusBarWidth;
    const barHeight = this.statusBarHeight;

    this.powerBarBackground = this.scene.add.rectangle(
      x,
      y - this.height - 34,
      barWidth,
      barHeight,
      0x222222,
    );

    this.powerBarBackground.setOrigin(0.5, 0.5);
    this.powerBarBackground.setVisible(false);

    this.powerBarFill = this.scene.add.rectangle(
      x - barWidth / 2,
      y - this.height - 34,
      0,
      barHeight,
      0xf1c40f,
    );

    this.powerBarFill.setOrigin(0, 0.5);
    this.powerBarFill.setVisible(false);

    this.moveBarBackground = this.scene.add.rectangle(
      x,
      y - this.height - 12,
      barWidth,
      barHeight,
      0x222222,
    );

    this.moveBarBackground.setOrigin(0.5, 0.5);
    this.moveBarBackground.setVisible(false);

    this.moveBarFill = this.scene.add.rectangle(
      x - barWidth / 2,
      y - this.height - 12,
      barWidth,
      barHeight,
      0x2ecc71,
    );

    this.moveBarFill.setOrigin(0, 0.5);
    this.moveBarFill.setVisible(false);

    this.turnIndicator = this.scene.add.triangle(
      x,
      y - this.height - 48,
      0,
      0,
      22,
      0,
      11,
      16,
      0x16324f,
    );

    this.turnIndicator.setOrigin(0.5, 0.5);
    this.turnIndicator.setDepth(6);
    this.turnIndicator.setVisible(false);

    this.scene.tweens.add({
      targets: this.turnIndicator,
      y: { from: this.turnIndicator.y - 3, to: this.turnIndicator.y + 3 },
      angle: { from: -8, to: 8 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.scene.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        if (!this.turnIndicator.visible) {
          return;
        }

        this.turnIndicatorColorToggle = !this.turnIndicatorColorToggle;
        const nextTint = this.turnIndicatorColorToggle ? 0x0d1f33 : 0x244a75;

        this.turnIndicator.setFillStyle(nextTint);
      },
    });

    this.updateCannonTransform();
  }

  public increaseAngle(delta: number): void {
    this.aimOffset += this.aimSpeedDegreesPerSecond * (delta / 1000);

    if (this.aimOffset > this.maxAimOffset) {
      this.aimOffset = this.maxAimOffset;
    }

    this.updateCannonTransform();
  }

  public decreaseAngle(delta: number): void {
    this.aimOffset -= this.aimSpeedDegreesPerSecond * (delta / 1000);

    if (this.aimOffset < -this.maxAimOffset) {
      this.aimOffset = -this.maxAimOffset;
    }

    this.updateCannonTransform();
  }

  public getAngle(): number {
    return this.getCannonWorldAngle();
  }

  private updateCannonTransform(): void {
    const handPoint = this.vehicle.getRiderHandPoint();
    const tipOffset = this.getCannonTipOffset();
    // Rotate straight to the tip vector's own angle instead of flipping the sprite: the cannon
    // texture has a pivot knob on its left and the muzzle on its right, and tipOffset already
    // encodes left/right correctly (via facingDirection on x), so this needs no separate flip.
    const visualAngle = Phaser.Math.RadToDeg(Math.atan2(tipOffset.y, tipOffset.x));

    // Center origin keeps rotation from shifting the sprite's anchor point off-screen.
    this.cannon.setPosition(
      handPoint.x + tipOffset.x / 2,
      handPoint.y + tipOffset.y / 2,
    );
    this.cannon.setAngle(visualAngle);
    this.cannon.setDepth(4);
  }

  // Elevation is facing-independent: positive always means aiming upward.
  // Terrain angle is Phaser's screen-space (clockwise) convention; negate it to match
  // the math convention (counter-clockwise, y-up) used by the sin/cos tip/velocity formulas.
  private getCannonWorldAngle(): number {
    const terrainAngle = this.vehicle.getTerrainAngle();

    // canWalkDirection lets the vehicle rest on near-vertical crater walls (up to 89°), but the
    // -terrainAngle compensation below would then swing the barrel to a matching extreme. Clamp
    // the terrain contribution first so the gun never over-reacts to slopes steeper than this.
    const clampedTerrainAngle = Phaser.Math.Clamp(terrainAngle, -65, 65);
    const rawAngle = -clampedTerrainAngle + this.aimOffset;

    // On steep slopes rawAngle could still cross ±90° once aimOffset is added, flipping cos()'s
    // sign and swinging the barrel backward into the vehicle - clamp the combined result too.
    return Phaser.Math.Clamp(rawAngle, -80, 80);
  }

  // Shared by the visual barrel and getCannonTip() so both match the projectile velocity formula.
  private getCannonTipOffset(): { x: number; y: number } {
    const worldAngle = this.getCannonWorldAngle();
    const rad = Phaser.Math.DegToRad(worldAngle);
    const facingDirection = this.direction === "right" ? 1 : -1;

    return {
      x: Math.cos(rad) * this.cannonLineLength * facingDirection,
      y: -Math.sin(rad) * this.cannonLineLength,
    };
  }

  public setDirection(direction: PlayerDirection): void {
    if (this.direction === direction) {
      return;
    }

    this.direction = direction;

    this.vehicle.setDirection(direction);

    this.updateCannonTransform();
  }

  public moveX(amount: number): void {
    this.x += amount;
  }

  public rollWheels(distance: number): void {
    this.vehicle.roll(distance);
  }

  public getX(): number {
    return this.x;
  }

  public setGroundPosition(x: number, groundY: number): void {
    this.x = x;
    this.y = groundY;

    this.vehicle.setGroundPosition(x, groundY);

    this.nameText.setPosition(x, groundY - this.height - 24);

    const barWidth = this.statusBarWidth;

    this.powerBarBackground.setPosition(x, groundY - this.height - 34);

    this.powerBarFill.setPosition(x - barWidth / 2, groundY - this.height - 34);

    this.moveBarBackground.setPosition(x, groundY - this.height - 12);

    this.moveBarFill.setPosition(x - barWidth / 2, groundY - this.height - 12);

    this.turnIndicator.setPosition(x, groundY - this.height - 48);

    this.updateCannonTransform();
  }

  public setTerrainAngle(angle: number): void {
    this.vehicle.setTerrainAngle(angle);

    this.updateCannonTransform();
  }

  // Positive terrainAngle descends to the right (screen-space atan2), so each travel
  // direction has its own uphill/downhill sense and its own climbable steepness limit.
  public canWalkDirection(direction: PlayerDirection): boolean {
    const terrainAngle = this.vehicle.getTerrainAngle();
    const isDownhill = direction === "right" ? terrainAngle > 0 : terrainAngle < 0;
    const maxAngle = isDownhill ? 89 : 60;

    return Math.abs(terrainAngle) < maxAngle;
  }

  public getTerrainAngle(): number {
    return this.vehicle.getTerrainAngle();
  }

  public getY(): number {
    return this.y;
  }

  public getDirection(): PlayerDirection {
    return this.direction;
  }

  public getCannonTip(): { x: number; y: number } {
    const tipOffset = this.getCannonTipOffset();

    return {
      x: this.cannon.x + tipOffset.x,
      y: this.cannon.y + tipOffset.y,
    };
  }

  public takeDamage(damage: number): void {
    this.hp -= damage;

    if (this.hp < 0) {
      this.hp = 0;
    }

    this.vehicle.setDamageEffects(this.getHPPercent());
  }

  public getHP(): number {
    return this.hp;
  }

  public isDead(): boolean {
    return this.hp <= 0;
  }

  public getCenterX(): number {
    return this.vehicle.getBodyCenter().x;
  }

  public getCenterY(): number {
    return this.vehicle.getBodyCenter().y;
  }

  public getCollisionRadius(): number {
    return Math.max(this.width, this.height) * 0.48;
  }

  public setPowerPercent(percent: number): void {
    const value = Phaser.Math.Clamp(percent, 0, 100);

    this.powerBarFill.width = this.statusBarWidth * (value / 100);

    if (value <= 50) {
      const ratio = value / 50;
      const green = Phaser.Display.Color.IntegerToColor(0x2ecc71);
      const yellow = Phaser.Display.Color.IntegerToColor(0xf1c40f);
      const r = Phaser.Math.Linear(green.red, yellow.red, ratio);
      const g = Phaser.Math.Linear(green.green, yellow.green, ratio);
      const b = Phaser.Math.Linear(green.blue, yellow.blue, ratio);

      this.powerBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, g, b));
      return;
    }

    const ratio = (value - 50) / 50;
    const yellow = Phaser.Display.Color.IntegerToColor(0xf1c40f);
    const red = Phaser.Display.Color.IntegerToColor(0x8b1e1e);
    const r = Phaser.Math.Linear(yellow.red, red.red, ratio);
    const g = Phaser.Math.Linear(yellow.green, red.green, ratio);
    const b = Phaser.Math.Linear(yellow.blue, red.blue, ratio);

    this.powerBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, g, b));
  }

  public setPowerBarVisible(visible: boolean): void {
    this.powerBarBackground.setVisible(visible);
    this.powerBarFill.setVisible(visible);
  }

  public setMovePercent(percent: number): void {
    const value = Phaser.Math.Clamp(percent, 0, 100);

    this.moveBarFill.width = this.statusBarWidth * (value / 100);
  }

  public setMoveBarVisible(visible: boolean): void {
    this.moveBarBackground.setVisible(visible);
    this.moveBarFill.setVisible(visible);
  }

  public setTurnIndicatorVisible(visible: boolean): void {
    this.turnIndicator.setVisible(visible);
  }

  public getHPPercent(): number {
    return (this.hp / this.maxHp) * 100;
  }
}