import Phaser from 'phaser';
import type { Profile } from '$lib/profile';
import { CampusScene } from './CampusScene';

/** Mounts the Phaser game inside `parent` and returns a cleanup function. */
export function startGame(parent: HTMLElement, profile: Profile): () => void {
  const scene = new CampusScene(profile);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#14171f',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    render: { antialias: true, roundPixels: true },
    input: { activePointers: 2 },
    scene
  });
  return () => {
    scene.dispose();
    game.destroy(true);
  };
}
