<script lang="ts">
  import { HAIR_COLORS, SHIRT_COLORS, SKIN_TONES, toCss } from '@campus/shared';

  // Mirrors the sprite the game draws (see avatar3d.ts), front-facing.
  let { skin, shirt, hair, gender = 0, height = 120 }: { skin: number; shirt: number; hair: number; gender?: 0 | 1; height?: number } = $props();

  const skinCss = $derived(toCss(SKIN_TONES[skin]));
  const shirtCss = $derived(toCss(SHIRT_COLORS[shirt]));
  const hairCss = $derived(toCss(HAIR_COLORS[hair]));
</script>

<svg viewBox="0 0 28 36" width={(height * 28) / 36} {height} role="img" aria-label="Avatar preview">
  {#if gender === 1}
    <rect x="3.5" y="12" width="21" height="22" rx="9" fill={hairCss} />
  {/if}
  <rect x="8" y="28" width="5" height="7" rx="2" fill="#2b2f3a" />
  <rect x="15" y="28" width="5" height="7" rx="2" fill="#2b2f3a" />
  {#if gender === 1}
    <path d="M8.5 15 H19.5 L23 30 H5 Z" fill={shirtCss} />
  {:else}
    <rect x="6" y="15" width="16" height="15" rx="5" fill={shirtCss} />
  {/if}
  <circle cx="5.5" cy="24" r="2.6" fill={skinCss} />
  <circle cx="22.5" cy="24" r="2.6" fill={skinCss} />
  <circle cx="14" cy="11" r="8.6" fill={hairCss} />
  <circle cx="14" cy="12.6" r="6.9" fill={skinCss} />
  {#if gender === 1}
    <path d="M8 9.5 Q14 3.5 20 9.5 Q14 8 8 9.5Z" fill={hairCss} />
    <circle cx="14" cy="12.6" r="6.9" fill={skinCss} opacity="0" />
  {/if}
  <circle cx="11.4" cy="13" r="1" fill="#1a1a22" />
  <circle cx="16.6" cy="13" r="1" fill="#1a1a22" />
</svg>
