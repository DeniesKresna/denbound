import Phaser from "phaser";

export type VehicleFacingDirection = "left" | "right";

export interface VehicleCharacterAppearance {
  bodyKey: string;
  riderKey: string;
  wheelKey: string;
  bodyTint?: number;
  bodyWidth?: number;
  bodyHeight?: number;
  riderWidth?: number;
  riderHeight?: number;
  wheelSize?: number;
  bodyOffsetY?: number;
  riderOffsetY?: number;
  wheelOffsetY?: number;
  wheelOffsetX?: number;
}

export const DEFAULT_BLUE_CAR_APPEARANCE: VehicleCharacterAppearance = {
  bodyKey: "vehicle-blue-car",
  riderKey: "vehicle-man",
  wheelKey: "vehicle-wheel",
  bodyTint: 0xffffff,
  bodyWidth: 136,
  bodyHeight: 82,
  riderWidth: 62,
  riderHeight: 88,
  wheelSize: 34,
  bodyOffsetY: 34,
  riderOffsetY: 55,
  wheelOffsetY: 6,
  wheelOffsetX: 40,
};

export class VehicleCharacter {
  private readonly scene: Phaser.Scene;

  private readonly body: Phaser.GameObjects.Image;
  private readonly rider: Phaser.GameObjects.Image;
  private readonly rearWheel: Phaser.GameObjects.Image;
  private readonly frontWheel: Phaser.GameObjects.Image;
  private readonly smokeEffects: Phaser.GameObjects.Image[];
  private readonly fireEffects: Phaser.GameObjects.Image[];

  public readonly width: number;
  public readonly height: number;

  private readonly bodyOffsetY: number;
  private readonly riderOffsetY: number;
  private readonly riderHandOffsetX: number;
  private readonly riderHandOffsetY: number;
  private readonly wheelOffsetY: number;
  private readonly wheelOffsetX: number;

  private direction: VehicleFacingDirection;
  private baseX = 0;
  private baseGroundY = 0;
  private terrainAngle = 0;
  private wheelSpin = 0;
  private hpPercent = 100;
  private damageEffectFrameIndex = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    direction: VehicleFacingDirection,
    appearance: VehicleCharacterAppearance,
  ) {
    this.scene = scene;
    this.direction = direction;

    this.width = appearance.bodyWidth ?? DEFAULT_BLUE_CAR_APPEARANCE.bodyWidth ?? 136;
    this.height = appearance.bodyHeight ?? DEFAULT_BLUE_CAR_APPEARANCE.bodyHeight ?? 82;

    this.bodyOffsetY = appearance.bodyOffsetY ?? DEFAULT_BLUE_CAR_APPEARANCE.bodyOffsetY ?? 34;
    this.riderOffsetY = appearance.riderOffsetY ?? DEFAULT_BLUE_CAR_APPEARANCE.riderOffsetY ?? 55;
    this.riderHandOffsetX = this.width * 0.18;
    this.riderHandOffsetY = this.height * 0.18;
    this.wheelOffsetY = appearance.wheelOffsetY ?? DEFAULT_BLUE_CAR_APPEARANCE.wheelOffsetY ?? 6;
    this.wheelOffsetX = appearance.wheelOffsetX ?? DEFAULT_BLUE_CAR_APPEARANCE.wheelOffsetX ?? 40;

    const wheelSize = appearance.wheelSize ?? DEFAULT_BLUE_CAR_APPEARANCE.wheelSize ?? 34;
    const riderWidth = appearance.riderWidth ?? DEFAULT_BLUE_CAR_APPEARANCE.riderWidth ?? 62;
    const riderHeight = appearance.riderHeight ?? DEFAULT_BLUE_CAR_APPEARANCE.riderHeight ?? 88;

    this.rearWheel = scene.add.image(0, 0, appearance.wheelKey);
    this.rearWheel.setDisplaySize(wheelSize, wheelSize);
    this.rearWheel.setOrigin(0.5, 0.5);

    this.frontWheel = scene.add.image(0, 0, appearance.wheelKey);
    this.frontWheel.setDisplaySize(wheelSize, wheelSize);
    this.frontWheel.setOrigin(0.5, 0.5);

    this.smokeEffects = [
      scene.add.image(0, 0, "vehicle-smoke-1"),
      scene.add.image(0, 0, "vehicle-smoke-2"),
      scene.add.image(0, 0, "vehicle-smoke-3"),
    ];

    this.fireEffects = [
      scene.add.image(0, 0, "vehicle-fired-1"),
      scene.add.image(0, 0, "vehicle-fired-2"),
      scene.add.image(0, 0, "vehicle-fired-3"),
    ];

    this.smokeEffects.forEach((effect) => {
      effect.setOrigin(0.5, 0.5);
      effect.setDisplaySize(56, 56);
      effect.setAlpha(0.5);
      effect.setDepth(10);
      effect.setVisible(false);
    });

    this.fireEffects.forEach((effect) => {
      effect.setOrigin(0.5, 0.5);
      effect.setDisplaySize(46, 46);
      effect.setAlpha(0.55);
      effect.setDepth(11);
      effect.setVisible(false);
    });

    this.body = scene.add.image(0, 0, appearance.bodyKey);
    this.body.setDisplaySize(this.width, this.height);
    this.body.setOrigin(0.5, 0.5);
    this.body.setTint(appearance.bodyTint ?? 0xffffff);

    this.rider = scene.add.image(0, 0, appearance.riderKey);
    this.rider.setDisplaySize(riderWidth, riderHeight);
    this.rider.setOrigin(0.5, 0.5);

    this.setDirection(direction);
    this.setGroundPosition(x, groundY);

    this.rider.setDepth(0);
    this.body.setDepth(1);
    this.rearWheel.setDepth(2);
    this.frontWheel.setDepth(2);

    this.scene.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        this.damageEffectFrameIndex = (this.damageEffectFrameIndex + 1) % 3;

        this.updateDamageEffectsFrame();
      },
    });
  }

  public setDirection(direction: VehicleFacingDirection): void {
    this.direction = direction;

    const flipped = direction === "left";

    this.body.setFlipX(flipped);
    this.rider.setFlipX(flipped);

    this.updateVisualRotation();
  }

  public setGroundPosition(x: number, groundY: number): void {
    this.baseX = x;
    this.baseGroundY = groundY;

    this.body.setPosition(x, groundY - this.bodyOffsetY);
    this.rider.setPosition(x, groundY - this.riderOffsetY);

    this.rider.setDepth(0);
    this.body.setDepth(1);
    this.rearWheel.setDepth(2);
    this.frontWheel.setDepth(2);

    this.updateVisualRotation();
  }

  public setTerrainAngle(angle: number): void {
    this.terrainAngle = angle;

    this.updateVisualRotation();
  }

  public getTerrainAngle(): number {
    return this.terrainAngle;
  }

  public getBodyCenter(): { x: number; y: number } {
    return {
      x: this.baseX,
      y: this.baseGroundY - this.bodyOffsetY,
    };
  }

  public getRiderHandPoint(): { x: number; y: number } {
    const riderCenter = {
      x: this.baseX,
      y: this.baseGroundY - this.riderOffsetY,
    };

    const bodyRotation = Phaser.Math.DegToRad(this.terrainAngle);
    const handLocalX = this.direction === "right" ? this.riderHandOffsetX : -this.riderHandOffsetX;
    const handLocalY = this.riderHandOffsetY;
    const handOffset = this.rotateOffset(handLocalX, handLocalY, bodyRotation);

    return {
      x: riderCenter.x + handOffset.x,
      y: riderCenter.y + handOffset.y,
    };
  }

  public roll(distance: number): void {
    const wheelRadius = this.rearWheel.displayHeight / 2;
    const circumference = Math.max(1, 2 * Math.PI * wheelRadius);

    const wheelRotation = (distance / circumference) * 360;

    this.wheelSpin += wheelRotation;

    this.updateVisualRotation();
  }

  private updateVisualRotation(): void {
    const wheelAngle = this.terrainAngle + this.wheelSpin;
    const centerX = this.baseX;
    const centerY = this.baseGroundY - this.bodyOffsetY;
    const wheelLocalY = this.bodyOffsetY - this.wheelOffsetY;
    const rotation = Phaser.Math.DegToRad(this.terrainAngle);

    const frontLocalX = this.direction === "right" ? this.wheelOffsetX : -this.wheelOffsetX;
    const rearLocalX = -frontLocalX;

    const frontPosition = this.rotateOffset(frontLocalX, wheelLocalY, rotation);
    const rearPosition = this.rotateOffset(rearLocalX, wheelLocalY, rotation);

    this.body.setPosition(centerX, centerY);
    this.rider.setPosition(centerX, this.baseGroundY - this.riderOffsetY);
    this.frontWheel.setPosition(centerX + frontPosition.x, centerY + frontPosition.y);
    this.rearWheel.setPosition(centerX + rearPosition.x, centerY + rearPosition.y);

    this.updateDamageEffectsPosition();

    this.body.setAngle(this.terrainAngle);
    this.rider.setAngle(this.terrainAngle);
    this.frontWheel.setAngle(wheelAngle);
    this.rearWheel.setAngle(wheelAngle);

    this.smokeEffects.forEach((effect) => effect.setAngle(this.terrainAngle));
    this.fireEffects.forEach((effect) => effect.setAngle(this.terrainAngle));
  }

  public setDamageEffects(hpPercent: number): void {
    this.hpPercent = Phaser.Math.Clamp(hpPercent, 0, 100);

    this.updateDamageEffectsVisibility();
    this.updateDamageEffectsFrame();
    this.updateDamageEffectsPosition();
  }

  private rotateOffset(
    offsetX: number,
    offsetY: number,
    rotation: number,
  ): { x: number; y: number } {
    return {
      x: offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation),
      y: offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation),
    };
  }

  private updateDamageEffectsPosition(): void {
    const center = this.getBodyCenter();
    const rotation = Phaser.Math.DegToRad(this.terrainAngle);
    const facingMultiplier = this.direction === "right" ? 1 : -1;

    const smokeOffset = this.rotateOffset(16 * facingMultiplier, -18, rotation);
    const fireOffset = this.rotateOffset(6 * facingMultiplier, -8, rotation);
    const frontFireOffset = this.rotateOffset(48 * facingMultiplier, 2, rotation);
    const rearFireOffset = this.rotateOffset(-42 * facingMultiplier, 8, rotation);

    this.smokeEffects.forEach((effect, index) => {
      effect.setPosition(center.x + smokeOffset.x, center.y + smokeOffset.y - 4 + index * 2);
    });

    this.fireEffects[0].setPosition(center.x + fireOffset.x, center.y + fireOffset.y);
    this.fireEffects[1].setPosition(center.x + frontFireOffset.x, center.y + frontFireOffset.y);
    this.fireEffects[2].setPosition(center.x + rearFireOffset.x, center.y + rearFireOffset.y);
  }

  private updateDamageEffectsVisibility(): void {
    const showSmoke = this.hpPercent <= 60;
    const showFire = this.hpPercent <= 30;
    const showFrontRearFire = this.hpPercent <= 10;

    this.smokeEffects.forEach((effect) => effect.setVisible(showSmoke));
    this.fireEffects[0].setVisible(showFire);
    this.fireEffects[1].setVisible(showFrontRearFire);
    this.fireEffects[2].setVisible(showFrontRearFire);
  }

  private updateDamageEffectsFrame(): void {
    const smokeFrames = ["vehicle-smoke-1", "vehicle-smoke-2", "vehicle-smoke-3"];
    const fireFrames = ["vehicle-fired-1", "vehicle-fired-2", "vehicle-fired-3"];

    this.smokeEffects.forEach((effect, index) => {
      effect.setTexture(smokeFrames[(this.damageEffectFrameIndex + index) % 3]);
      effect.setAlpha(0.42);
    });

    this.fireEffects.forEach((effect, index) => {
      effect.setTexture(fireFrames[(this.damageEffectFrameIndex + index) % 3]);
      effect.setAlpha(0.5);
    });

    this.fireEffects[1].setDisplaySize(38, 38);
    this.fireEffects[2].setDisplaySize(30, 30);
    this.smokeEffects.forEach((effect) => effect.setDisplaySize(58, 58));
  }
}