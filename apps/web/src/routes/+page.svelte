<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  import InstallHint from '$lib/InstallHint.svelte';
  import AvatarPreview from '$lib/AvatarPreview.svelte';

  import {
    HAIR_COLORS,
    MAX_NAME_LENGTH,
    SHIRT_COLORS,
    SKIN_TONES,
    sanitizeName,
    toCss
  } from '@campus/shared';

  import { loadProfile, newPlayerId, saveProfile } from '$lib/profile';

  let name = $state('');
  let skin = $state(2);
  let shirt = $state(5);
  let hair = $state(1);
  let playerId = $state('');
  let showError = $state(false);

  // The crowd is deliberately fixed so the welcome screen
  // has a consistent appearance between visits.
  const crowd = [
    { skin: 0, shirt: 0, hair: 3, h: 96 },
    { skin: 3, shirt: 3, hair: 0, h: 112 },
    { skin: 1, shirt: 8, hair: 5, h: 100 },
    // The player's own avatar goes here (index 3).
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

  function enter(e: SubmitEvent) {
    e.preventDefault();

    const clean = sanitizeName(name);

    if (!clean) {
      showError = true;
      return;
    }

    saveProfile({
      playerId,
      name: clean,
      avatar: { skin, shirt, hair }
    });

    goto('/play');
  }

  function updateName() {
    showError = false;
  }
</script>

<svelte:head>
  <title>Campus Life — Your campus, your people</title>
  <meta
    name="description"
    content="Step into Campus Life. Meet people, explore the campus, and see what happens next."
  />
  <meta name="theme-color" content="#171a2b" />
</svelte:head>

<main>
  <div class="page-shell">
    <!-- LEFT: Welcome and campus preview -->
    <section class="welcome" aria-labelledby="welcome-title">
      <header class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="2" width="36" height="36" rx="12" fill="currentColor" />
            <path
              d="M10 17.5L20 11L30 17.5V28H10V17.5Z"
              stroke="#171A2B"
              stroke-width="2.2"
              stroke-linejoin="round"
            />
            <path
              d="M16 28V21H24V28M8 17.5L20 9L32 17.5"
              stroke="#171A2B"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <span class="brand-name">CAMPUS LIFE</span>
        <span class="brand-divider" aria-hidden="true"></span>
        <span class="brand-caption">Your campus, your people.</span>
      </header>

      <div class="welcome-copy">
        <p class="eyebrow">
          <span class="status-dot" aria-hidden="true"></span>
          YOUR STORY STARTS HERE
        </p>

        <h1 id="welcome-title">
          Nowhere to be.<br />
          <span>Something's always happening.</span>
        </h1>

        <p class="lede">
          A familiar campus. People to meet. Places to discover.
          Walk up to someone, find a seat, follow a crowd to the
          Back Palaver, and see what happens next.
        </p>

        <div class="feature-list" aria-label="Things to do">
          <span class="feature">
            <span aria-hidden="true">✳</span>
            Meet people
          </span>

          <span class="feature">
            <span aria-hidden="true">↗</span>
            Explore campus
          </span>

          <span class="feature">
            <span aria-hidden="true">♡</span>
            Make memories
          </span>
        </div>
      </div>

      <!-- Campus-inspired avatar scene -->
      <div class="scene" aria-label="Meet the campus crowd">
        <div class="scene-top">
          <div class="scene-location">
            <span class="location-icon" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 8.3C16 12.3 10 17 10 17S4 12.3 4 8.3a6 6 0 1 1 12 0Z"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
                <circle
                  cx="10"
                  cy="8"
                  r="2"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
              </svg>
            </span>

            <div>
              <strong>Somewhere on campus</strong>
              <span>There's always room for one more.</span>
            </div>
          </div>

          <div class="people-count">
            <span class="people-dot" aria-hidden="true"></span>
            <span>YOUR PEOPLE</span>
          </div>
        </div>

        <div class="crowd">
          {#each crowd.slice(0, 3) as c, i}
            <div class="slot" class:background-avatar={i === 0}>
              <AvatarPreview
                skin={c.skin}
                shirt={c.shirt}
                hair={c.hair}
                height={c.h}
              />
            </div>
          {/each}

          <div class="slot me">
            <span class="avatar-name">
              {sanitizeName(name) || 'YOU'}
            </span>

            <div class="avatar-glow" aria-hidden="true"></div>

            <AvatarPreview {skin} {shirt} {hair} height={124} />
          </div>

          {#each crowd.slice(3) as c}
            <div class="slot">
              <AvatarPreview
                skin={c.skin}
                shirt={c.shirt}
                hair={c.hair}
                height={c.h}
              />
            </div>
          {/each}
        </div>

        <div class="bench" aria-hidden="true"></div>

        <div class="scene-bottom">
          <span>YOUR CAMPUS. YOUR MOMENTS.</span>
          <span class="scene-decoration" aria-hidden="true">✳</span>
        </div>
      </div>

      <footer class="welcome-footer">
        <span>Made for the moments in between.</span>
        <span class="footer-separator" aria-hidden="true">·</span>
        <span>Come as you are.</span>
      </footer>
    </section>

    <!-- RIGHT: Player profile and avatar customization -->
    <section class="setup" aria-labelledby="setup-title">
      <div class="setup-card">
        <div class="setup-heading">
          <div class="step-label">
            <span class="step-number">01</span>
            <span>BEFORE YOU ARRIVE</span>
          </div>

          <h2 id="setup-title">Make yourself at home.</h2>

          <p>
            Pick a name, choose your look, and step into campus.
          </p>
        </div>

        <form onsubmit={enter} novalidate>
          <!-- Player name -->
          <div class="form-section name-section">
            <label for="player-name" class="section-label">
              <span class="label-icon" aria-hidden="true">✎</span>
              What should people call you?
            </label>

            <div class="input-wrap" class:invalid={showError}>
              <input
                id="player-name"
                bind:value={name}
                maxlength={MAX_NAME_LENGTH}
                autocomplete="nickname"
                placeholder="Enter your campus name"
                oninput={updateName}
                aria-invalid={showError}
                aria-describedby={showError ? 'name-error' : 'name-hint'}
              />

              <span class="input-count">
                {name.length}/{MAX_NAME_LENGTH}
              </span>
            </div>

            {#if showError}
              <small id="name-error" class="error-message" role="alert">
                Please enter a name so other players know who you are.
              </small>
            {:else}
              <small id="name-hint" class="field-hint">
                This is how other players will see you.
              </small>
            {/if}
          </div>

          <div class="section-divider"></div>

          <!-- Character customization -->
          <div class="form-section appearance-section">
            <div class="appearance-heading">
              <div>
                <span class="section-label">Your look</span>
                <p>Make it yours. Change it up anytime you want.</p>
              </div>

              <span class="customize-icon" aria-hidden="true">✳</span>
            </div>

            <!-- Skin tones -->
            <fieldset class="color-group">
              <legend>
                <span class="legend-title">Skin tone</span>
                <span class="legend-value">Option {skin + 1}</span>
              </legend>

              <div class="swatches">
                {#each SKIN_TONES as c, i}
                  <button
                    type="button"
                    class="sw"
                    class:selected={skin === i}
                    style:--swatch-color={toCss(c)}
                    aria-label={`Skin tone ${i + 1}`}
                    aria-pressed={skin === i}
                    onclick={() => (skin = i)}
                  >
                    <span class="swatch-check" aria-hidden="true">✓</span>
                  </button>
                {/each}
              </div>
            </fieldset>

            <!-- Shirt colors -->
            <fieldset class="color-group">
              <legend>
                <span class="legend-title">Shirt</span>
                <span class="legend-value">Option {shirt + 1}</span>
              </legend>

              <div class="swatches">
                {#each SHIRT_COLORS as c, i}
                  <button
                    type="button"
                    class="sw"
                    class:selected={shirt === i}
                    style:--swatch-color={toCss(c)}
                    aria-label={`Shirt colour ${i + 1}`}
                    aria-pressed={shirt === i}
                    onclick={() => (shirt = i)}
                  >
                    <span class="swatch-check" aria-hidden="true">✓</span>
                  </button>
                {/each}
              </div>
            </fieldset>

            <!-- Hair colors -->
            <fieldset class="color-group">
              <legend>
                <span class="legend-title">Hair colour</span>
                <span class="legend-value">Option {hair + 1}</span>
              </legend>

              <div class="swatches">
                {#each HAIR_COLORS as c, i}
                  <button
                    type="button"
                    class="sw"
                    class:selected={hair === i}
                    style:--swatch-color={toCss(c)}
                    aria-label={`Hair colour ${i + 1}`}
                    aria-pressed={hair === i}
                    onclick={() => (hair = i)}
                  >
                    <span class="swatch-check" aria-hidden="true">✓</span>
                  </button>
                {/each}
              </div>
            </fieldset>
          </div>

          <!-- Enter campus -->
          <div class="form-actions">
            <button class="go" type="submit">
              <span>Enter campus</span>

              <span class="go-arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 12H19M12 5L19 12L12 19"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>

            <div class="privacy-note">
              <span class="privacy-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="4"
                    y="8"
                    width="12"
                    height="9"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M7 8V5.5a3 3 0 0 1 6 0V8"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>

              <p>
                No account needed. Your name and appearance are saved
                on this device.
              </p>
            </div>
          </div>
        </form>
      </div>

      <div class="side-note">
        <span class="side-note-icon" aria-hidden="true">✳</span>
        <p>
          <strong>Nothing to prove. Nowhere to rush.</strong>
          <span>Just show up and see what happens.</span>
        </p>
      </div>
    </section>
  </div>

  <InstallHint />
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    background: var(--ink, #171a2b);
  }

  main {
    --page-bg: var(--ink, #171a2b);
    --panel-bg: var(--concrete, #f1eee5);
    --panel-border: var(--concrete-deep, #d6d0c3);
    --accent: var(--mango, #f5c86a);
    --accent-hover: var(--mango-deep, #e9b94f);
    --muted: var(--mist, #b9bdcf);
    --teal: #80d4c2;

    min-height: 100vh;
    min-height: 100dvh;
    padding: clamp(20px, 4vw, 56px);
    padding-bottom: max(24px, env(safe-area-inset-bottom));

    color: #f7f5ee;

    background:
      radial-gradient(
        ellipse at 12% 5%,
        rgba(74, 85, 155, 0.3),
        transparent 42%
      ),
      radial-gradient(
        ellipse at 85% 80%,
        rgba(30, 105, 103, 0.12),
        transparent 40%
      ),
      var(--page-bg);
  }

  .page-shell {
    width: 100%;
    max-width: 1440px;
    min-height: calc(100vh - 112px);
    min-height: calc(100dvh - 112px);
    margin: 0 auto;

    display: grid;
    grid-template-columns:
      minmax(0, 1.15fr)
      minmax(340px, 440px);
    align-items: center;
    gap: clamp(36px, 6vw, 96px);
  }

  /* =====================================
     WELCOME SECTION
     ===================================== */

  .welcome {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: clamp(38px, 5vw, 66px);
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    color: var(--accent);
  }

  .brand-mark svg {
    width: 100%;
    height: 100%;
  }

  .brand-name {
    font-size: 0.85rem;
    font-weight: 850;
    letter-spacing: 0.12em;
  }

  .brand-divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.2);
  }

  .brand-caption {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .welcome-copy {
    max-width: 760px;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 0 22px;

    color: var(--teal);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  .status-dot,
  .people-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: var(--teal);
  }

  h1 {
    max-width: 720px;
    margin: 0;

    font-size: clamp(2.6rem, 5.3vw, 5rem);
    line-height: 1.04;
    font-weight: 850;
    letter-spacing: -0.065em;
    text-wrap: balance;
  }

  h1 span {
    color: var(--accent);
  }

  .lede {
    max-width: 490px;
    margin: 24px 0 22px;

    color: var(--muted);
    font-size: clamp(0.98rem, 1.2vw, 1.08rem);
    line-height: 1.8;
  }

  .feature-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 20px;
    margin-bottom: 40px;
  }

  .feature {
    display: inline-flex;
    align-items: center;
    gap: 7px;

    color: #e1e2ea;
    font-size: 0.82rem;
    font-weight: 550;
  }

  .feature > span {
    color: var(--accent);
    font-size: 1rem;
  }

  /* =====================================
     AVATAR SCENE
     ===================================== */

  .scene {
    position: relative;
    min-width: 0;
    overflow: hidden;

    padding: 19px 20px 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;

    background:
      radial-gradient(
        ellipse at 50% 65%,
        rgba(101, 132, 146, 0.2),
        transparent 65%
      ),
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.045),
        rgba(255, 255, 255, 0.015)
      );
  }

  .scene-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .scene-location {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .location-icon {
    display: grid;
    place-items: center;

    width: 38px;
    height: 38px;
    flex: 0 0 38px;

    color: var(--teal);
    border: 1px solid rgba(128, 212, 194, 0.18);
    border-radius: 11px;
    background: rgba(128, 212, 194, 0.08);
  }

  .location-icon svg {
    width: 20px;
    height: 20px;
  }

  .scene-location > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .scene-location strong {
    overflow: hidden;
    color: #f7f5ee;
    font-size: 0.82rem;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scene-location > div > span {
    color: var(--muted);
    font-size: 0.7rem;
  }

  .people-count {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;

    color: #c8cbd7;
    font-size: 0.62rem;
    font-weight: 750;
    letter-spacing: 0.07em;
  }

  .people-dot {
    width: 6px;
    height: 6px;
    flex-basis: 6px;
  }

  .crowd {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: clamp(0px, 1.4vw, 16px);

    padding: 34px 0 0;
  }

  .slot {
    position: relative;

    display: flex;
    flex: 1 1 0;
    justify-content: center;
    align-items: flex-end;

    min-width: 0;
    max-width: 140px;
  }

  .slot :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .slot.me {
    z-index: 1;
  }

  .avatar-name {
    position: absolute;
    z-index: 2;
    top: -21px;
    left: 50%;
    transform: translateX(-50%);

    max-width: 100%;
    overflow: hidden;
    padding: 6px 11px;

    border-radius: 999px;
    background: var(--accent);
    color: var(--page-bg);

    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.025em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .avatar-glow {
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;

    height: 36%;
    z-index: -1;

    border-radius: 50%;
    background: rgba(245, 200, 106, 0.13);
    filter: blur(18px);
  }

  .bench {
    position: relative;
    z-index: 2;

    height: 13px;
    margin: -2px -20px 0;

    border-top: 2px solid rgba(255, 255, 255, 0.2);
    background: repeating-linear-gradient(
      90deg,
      #777e8b 0 66px,
      #656c7b 66px 69px
    );

    box-shadow: 0 8px 0 -3px rgba(0, 0, 0, 0.25);
  }

  .scene-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;

    min-height: 42px;
    color: #9298ad;

    font-size: 0.61rem;
    font-weight: 750;
    letter-spacing: 0.1em;
  }

  .scene-decoration {
    color: var(--accent);
    font-size: 1rem;
  }

  .welcome-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px;

    margin-top: 24px;

    color: #8f94a9;
    font-size: 0.75rem;
  }

  .footer-separator {
    color: var(--accent);
  }

  /* =====================================
     SETUP CARD
     ===================================== */

  .setup {
    width: 100%;
    min-width: 0;
  }

  .setup-card {
    padding: clamp(22px, 3vw, 34px);

    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 20px;

    background: var(--panel-bg);
    color: var(--page-bg);

    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.17),
      0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .setup-heading {
    margin-bottom: 25px;
  }

  .step-label {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 17px;

    color: #666359;
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.11em;
  }

  .step-number {
    display: grid;
    place-items: center;

    width: 28px;
    height: 28px;

    border: 1px solid var(--panel-border);
    border-radius: 9px;

    background: #e6e1d6;
    color: var(--page-bg);

    font-size: 0.72rem;
    letter-spacing: 0;
  }

  h2 {
    margin: 0;

    font-size: clamp(1.65rem, 2.4vw, 2.05rem);
    line-height: 1.15;
    font-weight: 850;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .setup-heading > p {
    margin: 10px 0 0;

    color: #69665e;
    font-size: 0.88rem;
    line-height: 1.65;
  }

  form {
    display: flex;
    flex-direction: column;
  }

  .form-section {
    min-width: 0;
  }

  .name-section {
    margin-bottom: 23px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;

    margin-bottom: 10px;

    color: #34332f;
    font-size: 0.85rem;
    font-weight: 800;
  }

  .label-icon {
    color: #777165;
    font-size: 1rem;
  }

  .input-wrap {
    position: relative;
  }

  input {
    display: block;
    width: 100%;
    min-height: 50px;

    padding: 13px 75px 13px 14px;

    border: 1.5px solid #d4cec1;
    border-radius: 10px;

    outline: none;
    background: #faf8f2;
    color: var(--page-bg);

    font: inherit;
    font-size: 0.9rem;

    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  input::placeholder {
    color: #918d83;
  }

  input:hover {
    border-color: #b8b09f;
  }

  input:focus-visible {
    border-color: #82714b;
    background: #fffdf8;
    box-shadow: 0 0 0 3px rgba(130, 113, 75, 0.16);
  }

  input[aria-invalid='true'] {
    border-color: #b52e49;
  }

  input[aria-invalid='true']:focus-visible {
    box-shadow: 0 0 0 3px rgba(181, 46, 73, 0.13);
  }

  .input-count {
    position: absolute;
    top: 50%;
    right: 13px;
    transform: translateY(-50%);

    color: #898477;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;

    pointer-events: none;
  }

  .field-hint,
  .error-message {
    display: block;
    margin-top: 8px;

    font-size: 0.75rem;
    line-height: 1.5;
  }

  .field-hint {
    color: #777268;
  }

  .error-message {
    color: #a3213f;
  }

  .section-divider {
    height: 1px;
    margin-bottom: 23px;
    background: #dcd6ca;
  }

  /* =====================================
     AVATAR CUSTOMIZATION
     ===================================== */

  .appearance-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;

    margin-bottom: 21px;
  }

  .appearance-heading .section-label {
    margin-bottom: 5px;
    font-size: 0.94rem;
  }

  .appearance-heading p {
    margin: 0;

    color: #777268;
    font-size: 0.76rem;
    line-height: 1.55;
  }

  .customize-icon {
    display: grid;
    place-items: center;

    width: 32px;
    height: 32px;
    flex: 0 0 32px;

    border: 1px solid #d9d1c1;
    border-radius: 10px;

    background: #e8e1d3;
    color: #71664e;
  }

  .color-group {
    min-width: 0;
    margin: 0 0 19px;
    padding: 0;
    border: 0;
  }

  .color-group:last-child {
    margin-bottom: 0;
  }

  .color-group legend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    width: 100%;
    margin-bottom: 11px;
    padding: 0;
  }

  .legend-title {
    color: #3e3b35;
    font-size: 0.79rem;
    font-weight: 800;
  }

  .legend-value {
    color: #817b6e;
    font-size: 0.7rem;
    font-weight: 550;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .sw {
    position: relative;

    display: grid;
    place-items: center;

    width: 35px;
    height: 35px;
    flex: 0 0 35px;

    padding: 0;

    border: 2px solid transparent;
    border-radius: 50%;

    background: var(--swatch-color, #ffffff);

    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);

    cursor: pointer;

    transition:
      transform 140ms ease,
      box-shadow 140ms ease,
      border-color 140ms ease;
  }

  .sw:hover {
    transform: translateY(-2px);
  }

  .sw:focus-visible {
    outline: 3px solid #7d714e;
    outline-offset: 3px;
  }

  .sw.selected {
    border-color: var(--page-bg);
    box-shadow:
      0 0 0 2px var(--panel-bg),
      0 0 0 3.5px var(--page-bg);
  }

  .swatch-check {
    display: grid;
    place-items: center;

    width: 17px;
    height: 17px;

    border-radius: 50%;
    background: var(--page-bg);
    color: #ffffff;

    font-size: 0.67rem;
    font-weight: 900;

    opacity: 0;
    transform: scale(0.7);

    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .sw.selected .swatch-check {
    opacity: 1;
    transform: scale(1);
  }

  /* =====================================
     ENTER CAMPUS
     ===================================== */

  .form-actions {
    margin-top: 28px;
  }

  .go {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    width: 100%;
    min-height: 56px;

    padding: 8px 9px 8px 19px;

    border: 0;
    border-radius: 12px;

    background: var(--accent);
    color: var(--page-bg);

    font: inherit;
    font-size: 0.96rem;
    font-weight: 850;

    cursor: pointer;

    box-shadow: 0 3px 0 rgba(116, 83, 25, 0.13);

    transition:
      background 160ms ease,
      transform 160ms ease,
      box-shadow 160ms ease;
  }

  .go:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 5px 0 rgba(116, 83, 25, 0.1);
  }

  .go:active {
    transform: translateY(1px);
    box-shadow: none;
  }

  .go:focus-visible {
    outline: 3px solid #796a45;
    outline-offset: 4px;
  }

  .go-arrow {
    display: grid;
    place-items: center;

    width: 38px;
    height: 38px;
    flex: 0 0 38px;

    border-radius: 9px;

    background: rgba(23, 26, 43, 0.09);

    transition:
      background 160ms ease,
      transform 160ms ease;
  }

  .go-arrow svg {
    width: 21px;
    height: 21px;
  }

  .go:hover .go-arrow {
    background: rgba(23, 26, 43, 0.14);
    transform: translateX(2px);
  }

  .privacy-note {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 8px;

    margin-top: 15px;
  }

  .privacy-icon {
    display: flex;
    flex: 0 0 16px;
    margin-top: 1px;

    color: #777268;
  }

  .privacy-icon svg {
    width: 16px;
    height: 16px;
  }

  .privacy-note p {
    max-width: 300px;
    margin: 0;

    color: #777268;
    font-size: 0.72rem;
    line-height: 1.6;
    text-align: center;
  }

  /* =====================================
     SMALL NOTE UNDER SETUP CARD
     ===================================== */

  .side-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    margin-top: 21px;
    padding: 0 8px;
  }

  .side-note-icon {
    display: grid;
    place-items: center;

    width: 30px;
    height: 30px;
    flex: 0 0 30px;

    border: 1px solid rgba(245, 200, 106, 0.2);
    border-radius: 9px;

    color: var(--accent);
    background: rgba(245, 200, 106, 0.07);
  }

  .side-note p {
    display: flex;
    flex-direction: column;
    gap: 4px;

    margin: 0;

    font-size: 0.78rem;
    line-height: 1.5;
  }

  .side-note strong {
    color: #e7e7ed;
    font-weight: 750;
  }

  .side-note p span {
    color: #999eb1;
  }

  /* =====================================
     TABLETS
     ===================================== */

  @media (max-width: 1050px) {
    main {
      padding: clamp(20px, 4vw, 36px);
    }

    .page-shell {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(310px, 390px);
      gap: clamp(25px, 4vw, 48px);
    }

    h1 {
      font-size: clamp(2.6rem, 5.1vw, 3.8rem);
    }

    .scene {
      padding-right: 14px;
      padding-left: 14px;
    }

    .bench {
      margin-right: -14px;
      margin-left: -14px;
    }

    .crowd {
      gap: 2px;
    }

    .people-count {
      font-size: 0.57rem;
    }

    .scene-location strong {
      font-size: 0.76rem;
    }

    .scene-location > div > span {
      font-size: 0.66rem;
    }
  }

  /* =====================================
     MOBILE AND NARROW SCREENS
     ===================================== */

  @media (max-width: 820px) {
    main {
      padding: 18px 20px;
      padding-bottom: max(24px, env(safe-area-inset-bottom));
    }

    /*
     * On phones, show the brand first and the profile form immediately after
     * it. The longer welcome copy and avatar scene remain available below.
     * display: contents lets the existing markup be reordered without changing
     * profile creation or avatar-selection behavior.
     */
    .page-shell {
      min-height: auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: 24px;
    }

    .welcome {
      display: contents;
    }

    .brand {
      order: 0;
      margin-bottom: 0;
    }

    .setup {
      order: 1;
    }

    .welcome-copy {
      order: 2;
    }

    .scene {
      order: 3;
    }

    .welcome-footer {
      order: 4;
    }


    .welcome-copy {
      max-width: 650px;
    }

    h1 {
      font-size: clamp(2.7rem, 7.5vw, 4.3rem);
    }

    .lede {
      max-width: 560px;
      margin-top: 20px;
      font-size: 1rem;
    }

    .feature-list {
      margin-bottom: 29px;
    }

    .scene {
      max-width: 620px;
      padding: 18px 18px 0;
    }

    .bench {
      margin-right: -18px;
      margin-left: -18px;
    }

    .crowd {
      gap: clamp(2px, 2vw, 14px);
      padding-top: 36px;
    }

    .slot {
      max-width: 110px;
    }

    .setup {
      max-width: 620px;
      margin: 0 auto;
    }

    .setup-card {
      padding: clamp(24px, 5vw, 36px);
    }

    .side-note {
      margin-bottom: 6px;
    }
  }

  /* =====================================
     SMALL PHONES
     ===================================== */

  @media (max-width: 480px) {
    main {
      padding: 14px 13px;
      padding-bottom: max(22px, env(safe-area-inset-bottom));
    }

    .page-shell {
      gap: 20px;
    }

    .brand {
      gap: 9px;
    }

    .brand-mark {
      width: 35px;
      height: 35px;
      flex-basis: 35px;
    }

    .brand-name {
      font-size: 0.76rem;
    }

    .brand-caption {
      font-size: 0.7rem;
    }

    .brand-divider {
      height: 15px;
    }

    .eyebrow {
      margin-bottom: 17px;
      font-size: 0.64rem;
    }

    h1 {
      font-size: clamp(2.45rem, 10.2vw, 3.2rem);
      line-height: 1.06;
    }

    .lede {
      margin: 18px 0;
      font-size: 0.92rem;
      line-height: 1.75;
    }

    .feature-list {
      gap: 10px 15px;
      margin-bottom: 25px;
    }

    .feature {
      gap: 5px;
      font-size: 0.74rem;
    }

    .scene {
      padding: 14px 10px 0;
      border-radius: 14px;
    }

    .scene-top {
      align-items: flex-start;
      gap: 8px;
    }

    .scene-location {
      gap: 7px;
    }

    .location-icon {
      width: 32px;
      height: 32px;
      flex-basis: 32px;
      border-radius: 9px;
    }

    .location-icon svg {
      width: 17px;
      height: 17px;
    }

    .scene-location strong {
      font-size: 0.68rem;
    }

    .scene-location > div > span {
      max-width: 175px;
      font-size: 0.59rem;
    }

    .people-count {
      gap: 5px;
      padding-top: 5px;
      font-size: 0.5rem;
      letter-spacing: 0.03em;
    }

    .people-dot {
      width: 5px;
      height: 5px;
      flex-basis: 5px;
    }

    .crowd {
      gap: 0;
      padding-top: 32px;
    }

    .slot {
      max-width: none;
    }

    .slot :global(svg) {
      width: 100%;
    }

    .avatar-name {
      top: -19px;
      max-width: 100%;
      padding: 5px 8px;
      font-size: 0.62rem;
    }

    .bench {
      margin-right: -10px;
      margin-left: -10px;
    }

    .scene-bottom {
      min-height: 37px;
      font-size: 0.51rem;
      letter-spacing: 0.06em;
    }

    .welcome-footer {
      margin-top: 19px;
      font-size: 0.69rem;
    }

    .setup-card {
      padding: 23px 19px;
      border-radius: 16px;
    }

    .setup-heading {
      margin-bottom: 23px;
    }

    .step-label {
      margin-bottom: 15px;
      font-size: 0.61rem;
    }

    h2 {
      font-size: 1.75rem;
    }

    .setup-heading > p {
      font-size: 0.83rem;
    }

    .section-label {
      font-size: 0.81rem;
    }

    input {
      min-height: 49px;
      font-size: 0.86rem;
    }

    .swatches {
      gap: 9px;
    }

    /* Larger tap targets are easier to use on touch screens. */
    .sw {
      width: 40px;
      height: 40px;
      flex-basis: 40px;
    }

    .form-actions {
      margin-top: 25px;
    }

    .go {
      min-height: 54px;
    }

    .privacy-note p {
      font-size: 0.69rem;
    }

    .side-note {
      padding: 0 3px;
    }
  }

  /* =====================================
     ACCESSIBILITY: REDUCED MOTION
     ===================================== */

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>