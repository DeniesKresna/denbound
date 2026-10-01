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

  applyExplosionDamage(scene, x, y, damageRadius);

  destroyTerrain(scene, x, y, craterRadius);

  updatePlayersGroundPosition(scene);

  evaluateGameOver(scene);
}

export function explodeOnPlayer(scene: GameScene, player: Player, x: number, y: number): void {
  const craterRadius = 45;

  spawnVisualExplosion(scene, x, y, 1.45);

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

  for (let x = 0; x <= 1280; x += 5) {
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
  const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
  backdrop.setDepth(100);

  const panel = scene.add.rectangle(width / 2, height / 2, 520, 250, 0x16324f);
  panel.setStrokeStyle(6, 0xffffff, 0.35);
  panel.setDepth(101);

  const winnerText = scene.add.text(width / 2, height / 2 - 55, title, {
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
  });
  winnerText.setOrigin(0.5);
  winnerText.setDepth(102);

  const restartButton = scene.add.rectangle(width / 2, height / 2 + 55, 220, 56, 0x2ecc71);
  restartButton.setStrokeStyle(4, 0xffffff, 0.4);
  restartButton.setInteractive({ useHandCursor: true });
  restartButton.setDepth(102);

  const restartText = scene.add.text(width / 2, height / 2 + 55, "Main Ulang", {
    fontSize: "24px",
    color: "#0b1b14",
    fontStyle: "bold",
  });
  restartText.setOrigin(0.5);
  restartText.setDepth(103);

  restartButton.on("pointerover", () => {
    restartButton.setFillStyle(0x3ee280);
  });

  restartButton.on("pointerout", () => {
    restartButton.setFillStyle(0x2ecc71);
  });

  restartButton.on("pointerup", () => {
    scene.scene.restart();
  });
}