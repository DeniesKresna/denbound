import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 1280,
  height: 720,

  parent: 'game-container',

  backgroundColor: '#87CEEB',

  pixelArt: true,

  scene: [
    GameScene
  ]
};