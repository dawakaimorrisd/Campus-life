import Phaser from 'phaser';
import {
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type Avatar,
  type Facing
} from '@campus/shared';

export const AVATAR_W = 36;
export const AVATAR_H = 46;

export type Pose = 'stand' | 'sit';

/**
 * Draws a detailed student avatar and caches the resulting texture.
 *
 * The artwork uses a larger canvas than the original 28 x 36 sprite.
 * Campus coordinates and server-side movement remain unchanged.
 */
export function avatarTexture(
  scene: Phaser.Scene,
  a: Avatar,
  facing: Facing,
  pose: Pose = 'stand'
): string {
  const key = `av:${a.skin}:${a.shirt}:${a.hair}:${facing}:${pose}`;

  if (scene.textures.exists(key)) return key;

  const skin = SKIN_TONES[a.skin];
  const shirt = SHIRT_COLORS[a.shirt];
  const hair = HAIR_COLORS[a.hair];

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const centerX = 18;
  const sitting = pose === 'sit';
  const dy = sitting ? 4 : 0;

  const shade = (color: number, amount: number): number => {
    const r = Math.max(0, ((color >> 16) & 0xff) - amount);
    const gr = Math.max(0, ((color >> 8) & 0xff) - amount);
    const b = Math.max(0, (color & 0xff) - amount);

    return (r << 16) | (gr << 8) | b;
  };

  const highlight = (color: number, amount: number): number => {
    const r = Math.min(255, ((color >> 16) & 0xff) + amount);
    const gr = Math.min(255, ((color >> 8) & 0xff) + amount);
    const b = Math.min(255, (color & 0xff) + amount);

    return (r << 16) | (gr << 8) | b;
  };

  const shirtShadow = shade(shirt, 32);
  const shirtHighlight = highlight(shirt, 28);
  const skinShadow = shade(skin, 24);
  const hairShadow = shade(hair, 28);
  const hairHighlight = highlight(hair, 24);

  // Shoes and legs.
  if (!sitting) {
    // Legs.
    g.fillStyle(0x303647, 1);
    g.fillRoundedRect(10, 34, 6, 8, 2);
    g.fillRoundedRect(20, 34, 6, 8, 2);

    // Trouser highlights.
    g.fillStyle(0x424a60, 1);
    g.fillRect(11, 35, 2, 5);
    g.fillRect(21, 35, 2, 5);

    // Shoes.
    g.fillStyle(0x25232b, 1);
    g.fillRoundedRect(8, 40, 9, 4, 2);
    g.fillRoundedRect(19, 40, 9, 4, 2);

    // Shoe highlights.
    g.fillStyle(0xb8becb, 0.75);
    g.fillRect(10, 41, 4, 1);
    g.fillRect(21, 41, 4, 1);
  } else {
    // Bent legs for the seated pose.
    g.fillStyle(0x303647, 1);
    g.fillRoundedRect(8, 34, 20, 7, 3);

    g.fillStyle(0x424a60, 1);
    g.fillRoundedRect(11, 35, 7, 4, 2);
    g.fillRoundedRect(20, 35, 6, 4, 2);

    // Shoes.
    g.fillStyle(0x25232b, 1);
    g.fillRoundedRect(7, 39, 9, 4, 2);
    g.fillRoundedRect(22, 39, 8, 4, 2);
  }

  // Neck, behind the shirt.
  g.fillStyle(skinShadow, 1);
  g.fillRoundedRect(14, 14 + dy, 8, 7, 3);

  g.fillStyle(skin, 1);
  g.fillRect(15, 14 + dy, 6, 5);

  // Shirt body.
  g.fillStyle(shirtShadow, 1);

  if (sitting) {
    g.fillRoundedRect(7, 19 + dy, 22, 17, 6);
  } else {
    g.fillRoundedRect(8, 18 + dy, 20, 18, 5);
  }

  // Main shirt color.
  g.fillStyle(shirt, 1);

  if (sitting) {
    g.fillRoundedRect(8, 19 + dy, 20, 14, 5);
  } else {
    g.fillRoundedRect(9, 18 + dy, 18, 16, 4);
  }

  // Shirt highlights.
  g.fillStyle(shirtHighlight, 0.75);
  g.fillRoundedRect(11, 20 + dy, 3, 10, 1);

  // Side shading gives the shirt a little volume.
  g.fillStyle(shirtShadow, 0.65);
  g.fillRoundedRect(23, 21 + dy, 3, 10, 1);

  // Collar.
  g.fillStyle(shirtShadow, 1);
  g.fillTriangle(
    centerX - 5, 18 + dy,
    centerX, 24 + dy,
    centerX + 5, 18 + dy
  );

  g.fillStyle(0xf1eee8, 0.95);
  g.fillTriangle(
    centerX - 3, 18 + dy,
    centerX, 22 + dy,
    centerX + 3, 18 + dy
  );

  // Arms.
  g.fillStyle(shirtShadow, 1);
  g.fillRoundedRect(5, 21 + dy, 6, 12, 3);
  g.fillRoundedRect(25, 21 + dy, 6, 12, 3);

  g.fillStyle(shirt, 1);
  g.fillRoundedRect(6, 21 + dy, 4, 9, 2);
  g.fillRoundedRect(26, 21 + dy, 4, 9, 2);

  // Hands.
  g.fillStyle(skinShadow, 1);
  g.fillCircle(8, 33 + dy, 3);
  g.fillCircle(28, 33 + dy, 3);

  g.fillStyle(skin, 1);
  g.fillCircle(8, 32 + dy, 2.5);
  g.fillCircle(28, 32 + dy, 2.5);

  // Head shadow.
  g.fillStyle(skinShadow, 1);
  g.fillEllipse(centerX, 12 + dy, 19, 21);

  // Hair behind the head.
  g.fillStyle(hairShadow, 1);
  g.fillEllipse(centerX, 10 + dy, 21, 20);

  g.fillStyle(hair, 1);
  g.fillEllipse(centerX, 9 + dy, 20, 19);

  // Face.
  if (facing === 'up') {
    // Back of head: hair remains visible, with no facial features.
    g.fillStyle(hair, 1);
    g.fillEllipse(centerX, 10 + dy, 19, 18);

    g.fillStyle(hairHighlight, 0.65);
    g.fillEllipse(centerX - 3, 6 + dy, 7, 4);

    // Small neck edge.
    g.fillStyle(skinShadow, 1);
    g.fillRect(15, 17 + dy, 6, 3);
  } else {
    g.fillStyle(skin, 1);
    g.fillEllipse(centerX, 12 + dy, 16, 18);

    // Ears.
    g.fillStyle(skinShadow, 1);
    g.fillCircle(10, 13 + dy, 2.5);
    g.fillCircle(26, 13 + dy, 2.5);

    g.fillStyle(skin, 1);
    g.fillCircle(10, 13 + dy, 1.8);
    g.fillCircle(26, 13 + dy, 1.8);

    // Soft cheek shading.
    g.fillStyle(0xd77f79, 0.20);
    g.fillEllipse(13, 16 + dy, 4, 2);
    g.fillEllipse(23, 16 + dy, 4, 2);

    // Eyes and eyebrows.
    if (facing === 'down') {
      g.fillStyle(hairShadow, 1);
      g.fillRoundedRect(12, 8 + dy, 4, 1.5, 1);
      g.fillRoundedRect(20, 8 + dy, 4, 1.5, 1);

      g.fillStyle(0x20202a, 1);
      g.fillCircle(14, 11 + dy, 1.2);
      g.fillCircle(22, 11 + dy, 1.2);

      // Tiny eye highlights.
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(14.3, 10.7 + dy, 0.35);
      g.fillCircle(22.3, 10.7 + dy, 0.35);

      // Nose.
      g.fillStyle(skinShadow, 0.8);
      g.fillCircle(18, 14 + dy, 0.8);

      // Friendly smile.
      g.lineStyle(1, shade(skin, 65), 1);
      g.beginPath();
      g.arc(18, 14 + dy, 3, 0.25, Math.PI - 0.25, false);
      g.strokePath();
    } else {
      // Side-facing eyes.
      const eyeX = facing === 'left' ? 13 : 23;

      g.fillStyle(hairShadow, 1);
      g.fillRoundedRect(eyeX - 2, 8 + dy, 4, 1.4, 1);

      g.fillStyle(0x20202a, 1);
      g.fillCircle(eyeX, 11 + dy, 1.2);

      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(eyeX + 0.2, 10.7 + dy, 0.35);

      // Small smile.
      g.lineStyle(1, shade(skin, 65), 1);
      g.beginPath();

      if (facing === 'left') {
        g.arc(15, 15 + dy, 2.2, 0.4, 1.9, false);
      } else {
        g.arc(21, 15 + dy, 2.2, 1.2, 2.7, false);
      }

      g.strokePath();
    }

    // Hairline and hairstyle.
    g.fillStyle(hair, 1);

    if (facing === 'down') {
      // Rounded fringe.
      g.fillEllipse(centerX, 5 + dy, 20, 9);

      g.fillRoundedRect(8, 5 + dy, 5, 7, 2);
      g.fillRoundedRect(23, 5 + dy, 5, 7, 2);

      // Hair texture highlights.
      g.fillStyle(hairHighlight, 0.8);
      g.fillEllipse(14, 3 + dy, 6, 3);
      g.fillEllipse(21, 5 + dy, 4, 2);
    } else if (facing === 'left') {
      g.fillEllipse(12, 6 + dy, 13, 9);
      g.fillRoundedRect(8, 5 + dy, 6, 10, 3);

      g.fillStyle(hairHighlight, 0.75);
      g.fillEllipse(11, 3 + dy, 5, 3);
    } else {
      g.fillEllipse(24, 6 + dy, 13, 9);
      g.fillRoundedRect(22, 5 + dy, 6, 10, 3);

      g.fillStyle(hairHighlight, 0.75);
      g.fillEllipse(24, 3 + dy, 5, 3);
    }

    // Hairline accents.
    g.lineStyle(1, hairHighlight, 0.7);

    if (facing === 'down') {
      g.beginPath();
      g.moveTo(11, 7 + dy);
      g.lineTo(14, 9 + dy);
      g.lineTo(17, 7 + dy);
      g.lineTo(20, 9 + dy);
      g.lineTo(24, 7 + dy);
      g.strokePath();
    }
  }

  // A subtle shirt seam makes the clothing look more intentional.
  g.lineStyle(1, shirtShadow, 0.8);
  g.beginPath();
  g.moveTo(centerX, 24 + dy);
  g.lineTo(centerX, sitting ? 30 + dy : 32 + dy);
  g.strokePath();

  g.generateTexture(key, AVATAR_W, AVATAR_H);
  g.destroy();

  return key;
}

/** A small plate of food and a red-rimmed plate for a stolen item. */
export function plateTexture(
  scene: Phaser.Scene,
  hot: boolean
): string {
  const key = hot ? 'plate:hot' : 'plate';

  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Plate shadow.
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(9, 7, 17, 8);

  // Plate rim.
  g.fillStyle(hot ? 0xe5484d : 0xc8cbd2, 1);
  g.fillEllipse(8, 5, 17, 10);

  // Plate surface.
  g.fillStyle(hot ? 0xffd8d8 : 0xf4f1ea, 1);
  g.fillEllipse(8, 4.5, 14, 7);

  // Food.
  g.fillStyle(0xd2691e, 1);
  g.fillCircle(5, 4, 2.3);

  g.fillStyle(0xe5b84b, 1);
  g.fillCircle(9, 5, 2.3);

  g.fillStyle(0x5a9a52, 1);
  g.fillCircle(12, 3.5, 1.4);

  g.generateTexture(key, 18, 11);
  g.destroy();

  return key;
}