import Phaser from 'phaser';
import { gameConfig } from './game/config';

async function startGame(): Promise<void> {
	await document.fonts.load('400 24px "Material Symbols Outlined"');
	await document.fonts.ready;

	(window as unknown as { __game: Phaser.Game }).__game = new Phaser.Game(gameConfig);
}

void startGame();