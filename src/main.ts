import Phaser from 'phaser';
import { gameConfig } from './game/config';

(window as unknown as { __game: Phaser.Game }).__game = new Phaser.Game(gameConfig);