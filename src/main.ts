import './style.css';
import { Game } from './game/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas #renderCanvas not found in DOM.');
    return;
  }

  // Initialize Astro-Smash Arena Game Engine
  const game = new Game(canvas);
  (window as any).__ASTRO_GAME__ = game;
  console.log('[Astro-Smash] Engine initialized successfully. Ready for kickoff!');
});
