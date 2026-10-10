<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import InstallHint from '$lib/InstallHint.svelte';
  import { HAIR_COLORS, MAX_NAME_LENGTH, SHIRT_COLORS, SKIN_TONES, sanitizeName, toCss } from '@campus/shared';
  import { loadProfile, newPlayerId, saveProfile } from '$lib/profile';
  import AvatarPreview from '$lib/AvatarPreview.svelte';

  let name = $state('');
  let skin = $state(2);
  let shirt = $state(5);
  let hair = $state(1);
  let playerId = $state('');
  let showError = $state(false);

  // The crowd standing around the player. Fixed so the page looks the same every visit.
  const crowd = [
    { skin: 0, shirt: 0, hair: 3, h: 96 },
    { skin: 3, shirt: 3, hair: 0, h: 112 },
    { skin: 1, shirt: 8, hair: 5, h: 100 },
    // the player's own avatar goes here (index 3)
    { skin: 4, shirt: 1, hair: 0, h: 108 },
    { skin: 2, shirt: 7, hair: 2, h: 92 },
    { skin: 5, shirt: 4, hair: 4, h: 104 }
  ];

  onMount(() => {
    const saved = loadProfile();
    if (saved) {
      name = saved.name;
      skin = saved.avatar.skin;
      shirt = saved.avatar.shirt;
      hair = saved.avatar.hair;
      playerId = saved.playerId;
    } else {
      playerId = newPlayerId();
    }
  });

  function enter(e: Event) {
    e.preventDefault();
    const clean = sanitizeName(name);
    if (!clean) {
      showError = true;
      return;
    }
    saveProfile({ playerId, name: clean, avatar: { skin, shirt, hair } });
    goto('/play');
  }
</script>

<svelte:head>
  <title>Campus Life</title>
</svelte:head>

<main>
  <section class="hero">
    <h1>Nowhere to be. Something's always happening.</h1>
    <p class="lede">
      Campus Life is a shared campus for the people you know. Walk up to someone, sit on the concrete chairs, follow a
      crowd to the Back Hut, and see what happens next.
    </p>

    <div class="crowd" aria-hidden="true">
      {#each crowd.slice(0, 3) as c}
        <div class="slot"><AvatarPreview skin={c.skin} shirt={c.shirt} hair={c.hair} height={c.h} /></div>
      {/each}
      <div class="slot me">
        <span class="tag">{sanitizeName(name) || 'You'}</span>
        <AvatarPreview {skin} {shirt} {hair} height={124} />
      </div>
      {#each crowd.slice(3) as c}
        <div class="slot"><AvatarPreview skin={c.skin} shirt={c.shirt} hair={c.hair} height={c.h} /></div>
      {/each}
    </div>
    <div class="bench" aria-hidden="true"></div>
  </section>

  <form class="card" onsubmit={enter} novalidate>
    <label class="field">
      <span>Your name</span>
      <input
        bind:value={name}
        maxlength={MAX_NAME_LENGTH}
        autocomplete="nickname"
        placeholder="What do people call you?"
        oninput={() => (showError = false)}
        aria-invalid={showError}
        aria-describedby={showError ? 'name-error' : undefined}
      />
      {#if showError}
        <small id="name-error">Pick a name so people know who is walking up to them.</small>
      {/if}
    </label>

    <fieldset>
      <legend>Skin</legend>
      <div class="swatches">
        {#each SKIN_TONES as c, i}
          <button type="button" class="sw" style:background={toCss(c)} aria-label={`Skin tone ${i + 1}`} aria-pressed={skin === i} onclick={() => (skin = i)}></button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Shirt</legend>
      <div class="swatches">
        {#each SHIRT_COLORS as c, i}
          <button type="button" class="sw" style:background={toCss(c)} aria-label={`Shirt colour ${i + 1}`} aria-pressed={shirt === i} onclick={() => (shirt = i)}></button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Hair</legend>
      <div class="swatches">
        {#each HAIR_COLORS as c, i}
          <button type="button" class="sw" style:background={toCss(c)} aria-label={`Hair colour ${i + 1}`} aria-pressed={hair === i} onclick={() => (hair = i)}></button>
        {/each}
      </div>
    </fieldset>

    <button class="go" type="submit">Enter campus</button>
    <p class="note">No account yet. Your name and look are saved on this device.</p>
  </form>
<InstallHint />
</main>

<style>
  main {
    min-height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(300px, 420px);
    gap: clamp(24px, 5vw, 72px);
    align-items: center;
    padding: clamp(20px, 5vw, 64px);
    padding-bottom: max(clamp(20px, 5vw, 64px), env(safe-area-inset-bottom));
    background:
      radial-gradient(120% 80% at 15% 0%, #28306a 0%, transparent 60%),
      var(--ink);
  }

  h1 {
    margin: 0 0 20px;
    font-size: clamp(2.5rem, 6.4vw, 5.2rem);
    line-height: 0.98;
    font-weight: 800;
    letter-spacing: -0.035em;
    max-width: 13ch;
    text-wrap: balance;
  }

  .lede {
    margin: 0 0 40px;
    max-width: 46ch;
    font-size: 1.125rem;
    line-height: 1.55;
    color: var(--mist);
  }

  .crowd {
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    gap: clamp(2px, 1.2vw, 14px);
    padding-left: 4px;
  }

  .slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
  }
  .slot :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .me .tag {
    position: absolute;
    top: -30px;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--mango);
    color: var(--ink);
    font-weight: 600;
    font-size: 0.8125rem;
    white-space: nowrap;
    max-width: 14ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bench {
    height: 16px;
    margin-top: -3px;
    border-radius: 4px;
    background: repeating-linear-gradient(90deg, var(--concrete) 0 64px, var(--concrete-deep) 64px 66px);
    box-shadow: 0 10px 0 -4px rgba(0, 0, 0, 0.25);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 28px;
    border-radius: 14px;
    background: var(--concrete);
    color: var(--ink);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span,
  legend {
    font-weight: 600;
    font-size: 0.9375rem;
  }
  input {
    padding: 12px 14px;
    border-radius: 8px;
    border: 2px solid var(--concrete-deep);
    background: #f7f5ee;
    color: var(--ink);
    font-size: 1.0625rem;
  }
  input[aria-invalid='true'] {
    border-color: var(--hibiscus);
  }
  small {
    color: #a3213f;
    font-size: 0.875rem;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 8px;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sw {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid transparent;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    padding: 0;
  }
  .sw[aria-pressed='true'] {
    border-color: var(--ink);
    outline: 2px solid var(--concrete);
    outline-offset: -5px;
  }

  .go {
    margin-top: 4px;
    padding: 15px 20px;
    border: 0;
    border-radius: 10px;
    background: var(--mango);
    color: var(--ink);
    font-weight: 800;
    font-size: 1.125rem;
    cursor: pointer;
  }
  .go:hover {
    background: var(--mango-deep);
  }

  .note {
    margin: -6px 0 0;
    font-size: 0.875rem;
    color: #55524a;
  }

  @media (max-width: 820px) {
    main {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    .lede {
      margin-bottom: 44px;
    }
  }
</style>
