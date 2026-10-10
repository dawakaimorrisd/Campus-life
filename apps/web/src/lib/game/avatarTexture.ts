import Phaser from 'phaser';
import { HAIR_COLORS, SHIRT_COLORS, SKIN_TONES, type Avatar, type Facing } from '@campus/shared';

export const AVATAR_W = 28;
export const AVATAR_H = 36;
export type Pose = 'stand' | 'sit';

/** Draws a little student for one avatar + facing + pose and caches it as a texture. */
export function avatarTexture(scene: Phaser.Scene, a: Avatar, facing: Facing, pose: Pose = 'stand'): string {
  const key = `av:${a.skin}:${a.shirt}:${a.hair}:${facing}:${pose}`;
  if (scene.textures.exists(key)) return key;

  const skin = SKIN_TONES[a.skin];
  const shirt = SHIRT_COLORS[a.shirt];
  const hair = HAIR_COLORS[a.hair];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const dy = pose === 'sit' ? 5 : 0;

  if (pose === 'stand') g.fillStyle(0x2b2f3a, 1).fillRoundedRect(8, 28, 5, 7, 2).fillRoundedRect(15, 28, 5, 7, 2);
  else g.fillStyle(0x2b2f3a, 1).fillRoundedRect(7, 29, 14, 5, 2); // knees
  g.fillStyle(shirt, 1).fillRoundedRect(6, 15 + dy, 16, pose === 'sit' ? 13 : 15, 5);
  g.fillStyle(skin, 1);
  if (pose === 'sit') g.fillCircle(9, 27, 2.4).fillCircle(19, 27, 2.4);
  else g.fillCircle(5.5, 24, 2.6).fillCircle(22.5, 24, 2.6);
  g.fillStyle(hair, 1).fillCircle(14, 11 + dy, 8.6);
  if (facing !== 'up') {
    const fx = facing === 'left' ? -1.8 : facing === 'right' ? 1.8 : 0;
    g.fillStyle(skin, 1).fillCircle(14 + fx, 12.6 + dy, 6.9);
    g.fillStyle(0x1a1a22, 1);
    if (facing === 'down') g.fillCircle(11.4, 13 + dy, 1).fillCircle(16.6, 13 + dy, 1);
    else g.fillCircle(14 + fx + (facing === 'left' ? -2.6 : 2.6), 13 + dy, 1);
  }
  g.generateTexture(key, AVATAR_W, AVATAR_H);
  g.destroy();
  return key;
}

/** A small plate of food (and a red-rimmed one for a plate that was just stolen). */
export function plateTexture(scene: Phaser.Scene, hot: boolean): string {
  const key = hot ? 'plate:hot' : 'plate';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(hot ? 0xe5484d : 0xf4f1ea, 1).fillEllipse(8, 5, 16, 9);
  g.fillStyle(0xd2691e, 1).fillCircle(6, 4, 2.6);
  g.fillStyle(0xe5b84b, 1).fillCircle(10, 5, 2.4);
  g.generateTexture(key, 16, 10);
  g.destroy();
  return key;
}
