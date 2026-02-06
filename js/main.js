// ============================================================
// main.js - 게임 진입점
// ============================================================
import { GameEngine } from './game.js';
import { GameUI } from './ui.js';

// 게임 초기화
const engine = new GameEngine();
const ui = new GameUI(engine);

engine.init();

// 디버그용 콘솔 접근
window._game = engine;
window._ui = ui;

console.log('🎮 생존의 별 - 게임 로드 완료!');
