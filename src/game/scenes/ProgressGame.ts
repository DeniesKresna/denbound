import Phaser from "phaser";
import { Projectile } from "../entities/Projectile";
import { explode, explodeOnPlayer, finishShot } from "./EndGame";
import type { GameScene } from "./GameScene";

export function progressGame(scene: GameScene, delta: number): void {
  if (!scene.cursors || !scene.spaceKey) {
    return;
  }

  if (scene.isGameOver) {
    return;
  }

  if (scene.projectile?.isActive()) {
    scene.projectile.update(delta);
    checkPlayerCollision(scene);
    checkProjectileCollision(scene);
  }

  if (!scene.isShotInProgress) {
    updateMovement(scene, delta);
    updateAngle(scene, delta);
    updatePower(scene, delta);
  }

  updateHud(scene);
}

function updateMovement(scene: GameScene, delta: number): void {
  const moveSpeed = 100;
  const baseEnergyConsumption = 100;

  let movement = 0;
  let facingDirection = scene.currentPlayer.getDirection();
  let attemptedMovement = 0;
  let isMoving = false;

  if (scene.cursors.left.isDown) {
    facingDirection = "left";
    attemptedMovement = -moveSpeed * (delta / 1000);

    if (scene.moveEnergy > 0 && scene.currentPlayer.canWalkDirection("left")) {
      movement = -moveSpeed * (delta / 1000);
      isMoving = true;
    }
  }

  if (scene.cursors.right.isDown) {
    facingDirection = "right";
    attemptedMovement = moveSpeed * (delta / 1000);

    if (scene.moveEnergy > 0 && scene.currentPlayer.canWalkDirection("right")) {
      movement = moveSpeed * (delta / 1000);
      isMoving = true;
    }
  }

  scene.currentPlayer.setDirection(facingDirection);

  if (attemptedMovement !== 0) {
    scene.currentPlayer.rollWheels(attemptedMovement);
  }

  if (movement !== 0) {
    scene.currentPlayer.moveX(movement);

    const terrainAngle = Math.abs(scene.currentPlayer.getTerrainAngle());
    const energyMultiplier = 1 + terrainAngle / 45;

    scene.moveEnergy -= baseEnergyConsumption * (delta / 1000) * energyMultiplier;

    if (scene.moveEnergy < 0) {
      scene.moveEnergy = 0;
    }
  }

  scene.currentPlayer.setMoveBarVisible(isMoving);

  const playerX = Phaser.Math.Clamp(scene.currentPlayer.getX(), 25, 1255);

  const terrainY = scene.getTerrainY(playerX);
  const terrainAngle = scene.getTerrainAngle(playerX);

  scene.currentPlayer.setGroundPosition(playerX, terrainY);
  scene.currentPlayer.setTerrainAngle(terrainAngle);
}

function updateAngle(scene: GameScene, delta: number): void {
  if (scene.cursors.up.isDown) {
    scene.currentPlayer.increaseAngle(delta);
  }

  if (scene.cursors.down.isDown) {
    scene.currentPlayer.decreaseAngle(delta);
  }
}

function updatePower(scene: GameScene, delta: number): void {
  if (scene.isGameOver) {
    return;
  }

  if (Phaser.Input.Keyboard.JustDown(scene.spaceKey)) {
    scene.power = 0;
    scene.isCharging = true;
  }

  if (scene.isCharging && scene.spaceKey.isDown) {
    scene.power += delta * 0.06;

    if (scene.power > scene.maxPower) {
      scene.power = scene.maxPower;
    }
  }

  const isPowerKeyHeld = scene.isCharging && scene.spaceKey.isDown;

  scene.currentPlayer.setPowerBarVisible(isPowerKeyHeld);
  scene.currentPlayer.setPowerPercent(
    isPowerKeyHeld ? (scene.power / scene.maxPower) * 100 : 0,
  );

  if (scene.isCharging && Phaser.Input.Keyboard.JustUp(scene.spaceKey)) {
    scene.isCharging = false;
    scene.currentPlayer.setPowerBarVisible(false);

    if (scene.power > 0) {
      shoot(scene);
    }
  }
}

function shoot(scene: GameScene): void {
  if (scene.isShotInProgress) {
    return;
  }

  scene.isShotInProgress = true;

  const angle = scene.currentPlayer.getAngle();

  const direction = scene.currentPlayer.getDirection() === "right" ? 1 : -1;

  const cannonTip = scene.currentPlayer.getCannonTip();

  const rad = Phaser.Math.DegToRad(angle);

  const speed = scene.power * 8;

  const velocityX = Math.cos(rad) * speed * direction;

  const velocityY = -Math.sin(rad) * speed;

  scene.projectile = new Projectile(
    scene,
    cannonTip.x,
    cannonTip.y,
    velocityX,
    velocityY,
    scene.wind * 15,
  );
}

function checkProjectileCollision(scene: GameScene): void {
  if (!scene.projectile?.isActive()) {
    return;
  }

  const projectileX = scene.projectile.getX();
  const projectileY = scene.projectile.getY();

  if (projectileX < 0 || projectileX > 1280 || projectileY > 720) {
    scene.projectile.destroy();
    scene.projectile = undefined;
    finishShot(scene);

    return;
  }

  const terrainY = scene.getTerrainY(projectileX);

  if (projectileY >= terrainY) {
    explode(scene, projectileX, terrainY);

    scene.projectile.destroy();
    scene.projectile = undefined;
    finishShot(scene);
  }
}

function checkPlayerCollision(scene: GameScene): void {
  if (!scene.projectile?.isActive()) {
    return;
  }

  const projectileX = scene.projectile.getX();
  const projectileY = scene.projectile.getY();

  // Only the opponent can be directly hit; the shooter's own cannon tip is too close to the spawn point.
  const target = scene.currentPlayer === scene.player1 ? scene.player2 : scene.player1;

  const distance = Phaser.Math.Distance.Between(
    projectileX,
    projectileY,
    target.getCenterX(),
    target.getCenterY(),
  );

  if (distance > target.getCollisionRadius() + 7) {
    return;
  }

  explodeOnPlayer(scene, target, projectileX, projectileY);

  scene.projectile.destroy();
  scene.projectile = undefined;
  finishShot(scene);
}

function updateHud(scene: GameScene): void {
  scene.windText.setText(scene.getWindText());

  scene.player1.setMovePercent(
    scene.currentPlayer === scene.player1 ? scene.moveEnergy : 100,
  );
  scene.player2.setMovePercent(
    scene.currentPlayer === scene.player2 ? scene.moveEnergy : 100,
  );

  updateBattleHud(scene);
}

function updateBattleHud(scene: GameScene): void {
  const barWidth = 400;

  const player1Percent = scene.player1.getHPPercent();
  const player2Percent = scene.player2.getHPPercent();

  scene.player1HpBar.width = barWidth * (player1Percent / 100);
  scene.player2HpBar.width = barWidth * (player2Percent / 100);

  scene.player1HpText.setText(`${Math.round(scene.player1.getHP())} HP`);
  scene.player2HpText.setText(`${Math.round(scene.player2.getHP())} HP`);
}