import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { GameScene } from "./GameScene";

export function finishShot(scene: GameScene): void {
  scene.time.delayedCall(500, () => {
    if (scene.isGameOver) {
      return;
    }

    scene.changeTurn();

    scene.generateWind();

    scene.moveEnergy = scene.maxMoveEnergy;
    scene.power = 0;
    scene.isCharging = false;
    scene.isShotInProgress = false;
  });
}

export function explode(scene: GameScene, x: number, y: number): void {
  const damageRadius = 160;
  const craterRadius = 45;

  spawnVisualExplosion(scene, x, y);
  scene.playBrickExplosionSound();

  applyExplosionDamage(scene, x, y, damageRadius);

  destroyTerrain(scene, x, y, craterRadius);

  updatePlayersGroundPosition(scene);

  evaluateGameOver(scene);
}

export function explodeOnPlayer(scene: GameScene, player: Player, x: number, y: number): void {
  const craterRadius = 45;

  spawnVisualExplosion(scene, x, y, 1.45);
  scene.playExplosionSound();

  applyDirectHitDamage(player, x, y);

  destroyTerrain(scene, x, y, craterRadius);

  updatePlayersGroundPosition(scene);

  evaluateGameOver(scene);
}

function spawnVisualExplosion(scene: GameScene, x: number, y: number, sizeMultiplier = 1): void {
  const frameNames = ["explosion-1", "explosion-2", "explosion-3"];
  const explosion = scene.add.image(x, y, frameNames[0]);
  const baseSize = 64 * sizeMultiplier;

  explosion.setOrigin(0.5, 0.5);
  explosion.setDisplaySize(baseSize, baseSize);
  explosion.setDepth(9);

  scene.tweens.add({
    targets: explosion,
    scale: { from: 0.85 * sizeMultiplier, to: 1.1 * sizeMultiplier },
    alpha: { from: 1, to: 1 },
    duration: 90,
    ease: "Linear",
  });

  scene.time.delayedCall(90, () => {
    if (!explosion.active) {
      return;
    }

    explosion.setTexture(frameNames[1]);
    explosion.setDisplaySize(70 * sizeMultiplier, 70 * sizeMultiplier);
  });

  scene.time.delayedCall(180, () => {
    if (!explosion.active) {
      return;
    }

    explosion.setTexture(frameNames[2]);
    explosion.setDisplaySize(84 * sizeMultiplier, 84 * sizeMultiplier);
  });

  scene.time.delayedCall(270, () => {
    explosion.destroy();
  });
}

function applyDirectHitDamage(player: Player, impactX: number, impactY: number): void {
  const distance = Phaser.Math.Distance.Between(
    impactX,
    impactY,
    player.getCenterX(),
    player.getCenterY(),
  );

  const maxDirectHitDamage = 200;
  // A confirmed hit must always outdamage any near-miss splash, so it never falls below this.
  const minDirectHitDamage = 140;
  const directHitFalloffRadius = 100;

  const damagePercent = Phaser.Math.Clamp(1 - distance / directHitFalloffRadius, 0, 1);

  const damage = minDirectHitDamage + (maxDirectHitDamage - minDirectHitDamage) * damagePercent;

  player.takeDamage(damage);
}

function evaluateGameOver(scene: GameScene): void {
  if (scene.isGameOver) {
    return;
  }

  const player1Dead = scene.player1.isDead();
  const player2Dead = scene.player2.isDead();

  if (!player1Dead && !player2Dead) {
    return;
  }

  scene.isGameOver = true;
  scene.isShotInProgress = false;
  scene.isCharging = false;
  scene.stopTruckSound();
  scene.playGameOverMusic();

  let title = "DRAW!";

  if (player1Dead && !player2Dead) {
    title = `${scene.player2.name} MENANG!`;
  } else if (player2Dead && !player1Dead) {
    title = `${scene.player1.name} MENANG!`;
  }

  showGameOverPopup(scene, title);
}

function applyExplosionDamage(
  scene: GameScene,
  explosionX: number,
  explosionY: number,
  radius: number,
): void {
  applyDamageToPlayer(scene.player1, explosionX, explosionY, radius);
  applyDamageToPlayer(scene.player2, explosionX, explosionY, radius);
}

function applyDamageToPlayer(
  player: Player,
  explosionX: number,
  explosionY: number,
  radius: number,
): void {
  const distance = Phaser.Math.Distance.Between(
    explosionX,
    explosionY,
    player.getCenterX(),
    player.getCenterY(),
  );

  if (distance > radius) {
    return;
  }

  // Kept below the direct-hit floor so a miss never outdamages an actual hit.
  const maxDamage = 130;

  const damagePercent = 1 - distance / radius;

  const damage = maxDamage * damagePercent;

  player.takeDamage(damage);
}

function destroyTerrain(
  scene: GameScene,
  explosionX: number,
  explosionY: number,
  radius: number,
): void {
  scene.explosionZones.push({ x: explosionX, radius });

  const newPoints: {
    x: number;
    y: number;
  }[] = [];

  for (let x = 0; x <= scene.worldWidth; x += 5) {
    const currentY = scene.getTerrainY(x);

    const distanceX = x - explosionX;

    if (Math.abs(distanceX) <= radius) {
      const circleHeight = Math.sqrt(radius * radius - distanceX * distanceX);

      const craterY = explosionY + circleHeight;

      newPoints.push({
        x,
        y: Math.max(currentY, craterY),
      });
    } else {
      newPoints.push({
        x,
        y: currentY,
      });
    }
  }

  scene.terrainPoints = newPoints;

  scene.drawTerrain();
}

function updatePlayersGroundPosition(scene: GameScene): void {
  const player1X = scene.player1.getX();

  scene.player1.setGroundPosition(player1X, scene.getTerrainY(player1X));
  scene.player1.setTerrainAngle(scene.getTerrainAngle(player1X));

  const player2X = scene.player2.getX();

  scene.player2.setGroundPosition(player2X, scene.getTerrainY(player2X));
  scene.player2.setTerrainAngle(scene.getTerrainAngle(player2X));
}

function showGameOverPopup(scene: GameScene, title: string): void {
  const { width, height } = scene.scale;

  const register = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    scene.uiObjects.add(object);

    return object;
  };

  const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
  register(backdrop);
  backdrop.setDepth(100);

  const panel = register(scene.add.rectangle(width / 2, height / 2, 520, 250, 0x16324f));
  panel.setStrokeStyle(6, 0xffffff, 0.35);
  panel.setDepth(101);

  const winnerText = register(scene.add.text(width / 2, height / 2 - 55, title, {
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
  }));
  winnerText.setOrigin(0.5);
  winnerText.setDepth(102);

  const restartButton = register(scene.add.rectangle(width / 2, height / 2 + 55, 220, 56, 0x2ecc71));
  restartButton.setStrokeStyle(4, 0xffffff, 0.4);
  restartButton.setInteractive({ useHandCursor: true });
  restartButton.setDepth(102);

  const restartText = register(scene.add.text(width / 2, height / 2 + 55, "Main Ulang", {
    fontSize: "24px",
    color: "#0b1b14",
    fontStyle: "bold",
  }));
  restartText.setOrigin(0.5);
  restartText.setDepth(103);

  restartButton.on("pointerover", () => {
    restartButton.setFillStyle(0x3ee280);
  });

  restartButton.on("pointerout", () => {
    restartButton.setFillStyle(0x2ecc71);
  });

  restartButton.on("pointerup", () => {
    scene.stopMusic();
    scene.scene.restart();
  });

  scene.syncCameraIgnoreLists();
}

export function showSettingsPopup(scene: GameScene): void {
  if (scene.isSettingsPopupOpen) {
    return;
  }

  scene.isSettingsPopupOpen = true;
  scene.stopTruckSound();

  const { width, height } = scene.scale;
  const panelWidth = 620;
  const panelHeight = 400;
  const uiObjects: Phaser.GameObjects.GameObject[] = [];

  const register = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    uiObjects.push(object);
    scene.uiObjects.add(object);

    return object;
  };

  const closePopup = (): void => {
    if (!scene.isSettingsPopupOpen) {
      return;
    }

    scene.isSettingsPopupOpen = false;
    uiObjects.forEach((object) => {
      scene.uiObjects.delete(object);
      object.destroy();
    });
  };

  register(scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setDepth(100));

  register(scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x16324f).setDepth(101));

  const border = register(scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x000000, 0));
  border.setStrokeStyle(6, 0xffffff, 0.35);
  border.setDepth(102);

  register(
    scene.add.text(width / 2 - 208, height / 2 - 162, "tune", {
      fontFamily: "Material Symbols Outlined",
      fontSize: "24px",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(103),
  );

  register(
    scene.add.text(width / 2 - 166, height / 2 - 170, "PENGATURAN", {
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0, 0).setDepth(103),
  );

  const closeButton = register(scene.add.rectangle(width / 2 + 258, height / 2 - 160, 34, 34, 0x244a75));
  closeButton.setStrokeStyle(2, 0xffffff, 0.25);
  closeButton.setDepth(104);
  closeButton.setInteractive({ useHandCursor: true });

  register(
    scene.add.text(width / 2 + 258, height / 2 - 159.5, "close", {
      fontFamily: "Material Symbols Outlined",
      fontSize: "20px",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(105),
  );

  closeButton.on("pointerover", () => {
    closeButton.setFillStyle(0x2f5c8a, 1);
  });

  closeButton.on("pointerout", () => {
    closeButton.setFillStyle(0x244a75, 1);
  });

  closeButton.on("pointerup", () => {
    closePopup();
  });

  const createSlider = (
    label: string,
    iconName: string,
    initialValue: number,
    onChange: (value: number) => void,
    y: number,
  ): void => {
    const labelX = width / 2 - 205;
    const sliderX = width / 2 - 140;
    const sliderWidth = 420;
    const valueX = width / 2 + 240;

    register(
      scene.add.text(labelX, y - 8, iconName, {
        fontFamily: "Material Symbols Outlined",
        fontSize: "22px",
        color: "#ffffff",
      }).setOrigin(0, 0.5).setDepth(103),
    );

    register(
      scene.add.text(labelX + 34, y - 8, label, {
        fontSize: "19px",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0, 0.5).setDepth(103),
    );

    const trackY = y + 18;
    const track = register(scene.add.rectangle(sliderX, trackY, sliderWidth, 14, 0x0f2033).setOrigin(0, 0.5).setDepth(103));
    const fill = register(scene.add.rectangle(sliderX, trackY, sliderWidth * initialValue, 14, 0x2ecc71).setOrigin(0, 0.5).setDepth(104));
    const knob = register(scene.add.circle(sliderX + sliderWidth * initialValue, trackY, 10, 0xffffff).setDepth(105));
    const hitArea = register(scene.add.rectangle(sliderX, trackY, sliderWidth, 34, 0xffffff, 0).setOrigin(0, 0.5).setDepth(106));
    const valueText = register(
      scene.add.text(valueX, y - 8, `${Math.round(initialValue * 100)}%`, {
        fontSize: "17px",
        color: "#d8e5f2",
        fontStyle: "bold",
      }).setOrigin(1, 0.5).setDepth(103),
    );

    let currentValue = initialValue;

    const applyValue = (nextValue: number): void => {
      currentValue = Phaser.Math.Clamp(nextValue, 0, 1);
      fill.width = sliderWidth * currentValue;
      knob.setPosition(sliderX + sliderWidth * currentValue, trackY);
      valueText.setText(`${Math.round(currentValue * 100)}%`);
      onChange(currentValue);
    };

    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      applyValue((pointer.x - sliderX) / sliderWidth);
    });

    knob.setInteractive({ useHandCursor: true });
    scene.input.setDraggable(knob);

    knob.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
      applyValue((dragX - sliderX) / sliderWidth);
    });

    track.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      applyValue((pointer.x - sliderX) / sliderWidth);
    });

    applyValue(initialValue);
  };

  createSlider(
    "Musik Latar",
    "music_note",
    scene.backgroundMusicVolume,
    (value) => scene.setBackgroundMusicVolume(value),
    height / 2 - 68,
  );

  createSlider(
    "Efek Suara",
    "volume_up",
    scene.soundEffectVolume,
    (value) => scene.setSoundEffectVolume(value),
    height / 2 + 24,
  );

  const doneButton = register(scene.add.rectangle(width / 2, height / 2 + 142, 180, 54, 0x2ecc71));
  doneButton.setStrokeStyle(4, 0xffffff, 0.35);
  doneButton.setInteractive({ useHandCursor: true });
  doneButton.setDepth(104);

  register(
    scene.add.text(width / 2, height / 2 + 142, "Tutup", {
      fontSize: "22px",
      color: "#0b1b14",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(105),
  );

  doneButton.on("pointerover", () => {
    doneButton.setFillStyle(0x3ee280);
  });

  doneButton.on("pointerout", () => {
    doneButton.setFillStyle(0x2ecc71);
  });

  doneButton.on("pointerup", () => {
    closePopup();
  });

  register(
    scene.add.text(width / 2, height / 2 + 192, "Perubahan volume berlaku langsung.", {
      fontSize: "15px",
      color: "#d8e5f2",
    }).setOrigin(0.5).setDepth(103),
  );

  const backdrop = uiObjects[0];

  if (backdrop instanceof Phaser.GameObjects.Rectangle) {
    backdrop.setInteractive();
    backdrop.on("pointerup", () => {
      closePopup();
    });
  }

  scene.syncCameraIgnoreLists();
}