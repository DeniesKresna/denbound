import Phaser from "phaser";
import { Player } from "../entities/Player";
import type { GameScene } from "./GameScene";
import { showSettingsPopup } from "./EndGame";

export function initializeGame(scene: GameScene): void {
  scene.resetGameState();
  scene.playGameMusic();

  createBackground(scene);
  createTerrain(scene);

  const player1X = 200;
  const player2X = 1080;

  scene.player1 = new Player(
    scene,
    player1X,
    scene.getTerrainY(player1X),
    "Player 1",
    0x3498db,
    "right",
  );

  scene.player2 = new Player(
    scene,
    player2X,
    scene.getTerrainY(player2X),
    "Player 2",
    0xe74c3c,
    "left",
  );

  createBattleHud(scene);

  scene.player1.setTerrainAngle(scene.getTerrainAngle(player1X));
  scene.player2.setTerrainAngle(scene.getTerrainAngle(player2X));

  scene.currentPlayer = scene.player1;

  scene.generateWind();

  scene.player1.setTurnIndicatorVisible(true);
  scene.player2.setTurnIndicatorVisible(false);

  setupInput(scene);

  scene.windText = scene.add.text(640, 35, scene.getWindText(), {
    fontSize: "22px",
    color: "#ffffff",
    align: "center",
  });

  scene.windText.setOrigin(0.5);
}

function createBackground(scene: GameScene): void {
  const background = scene.add.image(640, 360, "green-lake-background");
  background.setDisplaySize(1280, 720);
  background.setDepth(-100);
  background.setScrollFactor(0);
}

function createTerrain(scene: GameScene): void {
  scene.drawTerrain();
}

function createBattleHud(scene: GameScene): void {
  const barWidth = 400;
  const barHeight = 24;

  scene.add.text(30, 15, "PLAYER 1", {
    fontSize: "16px",
    color: "#ffffff",
  });

  scene.add.rectangle(30, 42, barWidth, barHeight, 0x222222).setOrigin(0, 0.5);

  scene.player1HpBar = scene.add.rectangle(30, 42, barWidth, barHeight, 0x2ecc71);

  scene.player1HpBar.setOrigin(0, 0.5);

  scene.player1HpText = scene.add.text(
    30 + barWidth / 2,
    42,
    `${Math.round(scene.player1.getHP())} HP`,
    {
      fontSize: "14px",
      color: "#ffffff",
    },
  );

  scene.player1HpText.setOrigin(0.5);

  scene
    .add.text(1250, 15, "PLAYER 2", {
      fontSize: "16px",
      color: "#ffffff",
    })
    .setOrigin(1, 0);

  scene.add.rectangle(1250, 42, barWidth, barHeight, 0x222222).setOrigin(1, 0.5);

  scene.player2HpBar = scene.add.rectangle(1250, 42, barWidth, barHeight, 0x2ecc71);

  scene.player2HpBar.setOrigin(1, 0.5);

  scene.player2HpText = scene.add.text(
    1250 - barWidth / 2,
    42,
    `${Math.round(scene.player2.getHP())} HP`,
    {
      fontSize: "14px",
      color: "#ffffff",
    },
  );

  scene.player2HpText.setOrigin(0.5);

  createSettingsButton(scene);
}

function createSettingsButton(scene: GameScene): void {
  const buttonSize = 28;
  const buttonX = 1256;
  const buttonY = 19;

  const button = scene.add.rectangle(buttonX, buttonY, buttonSize, buttonSize, 0x16324f, 0.96);
  button.setStrokeStyle(2, 0xffffff, 0.3);
  button.setDepth(9);
  button.setInteractive({ useHandCursor: true });

  const icon = scene.add.text(buttonX, buttonY + 0.5, "settings", {
    fontFamily: "Material Symbols Outlined",
    fontSize: "18px",
    color: "#ffffff",
  });
  icon.setOrigin(0.5);
  icon.setDepth(10);

  button.on("pointerover", () => {
    button.setFillStyle(0x23405f, 1);
  });

  button.on("pointerout", () => {
    button.setFillStyle(0x16324f, 0.96);
  });

  button.on("pointerup", () => {
    if (scene.isGameOver || scene.isSettingsPopupOpen) {
      return;
    }

    showSettingsPopup(scene);
  });
}

function setupInput(scene: GameScene): void {
  if (!scene.input.keyboard) {
    return;
  }

  scene.cursors = scene.input.keyboard.createCursorKeys();

  scene.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}