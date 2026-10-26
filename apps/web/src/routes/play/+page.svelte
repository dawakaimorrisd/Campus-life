<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  import { loadProfile } from '$lib/profile';
  import { g, send } from '$lib/game/store.svelte';

  import PlayerPanel from '$lib/PlayerPanel.svelte';
  import ChatBar from '$lib/ChatBar.svelte';
  import Overlays from '$lib/Overlays.svelte';

  let host = $state<HTMLDivElement>();
  let hintVisible = $state(true);
  let moreActionsOpen = $state(false);

  const statusText = $derived(
    g.status === 'online'
      ? g.ping !== null
        ? `${g.ping} ms`
        : 'Connected'
      : g.status === 'replaced'
        ? 'Signed in on another tab'
        : 'Connecting to campus'
  );

  const primaryActionLabel = $derived(
    g.doing
      ? g.doing === 'work'
        ? 'Stop working'
        : g.doing === 'ride'
          ? 'Get off'
          : 'Stop'
      : g.spot && !(g.spot.kind === 'food' && g.holding)
        ? `${g.spot.label}${g.spot.price > 0 ? ` · ${g.spot.price} LD` : ''}`
        : ''
  );

  onMount(() => {
    const profile = loadProfile();

    if (!profile) {
      goto('/');
      return;
    }

    let cancelled = false;
    let stop: (() => void) | undefined;

    // The 3D engine must only be loaded in the browser.
    import('$lib/game/start').then(({ startGame }) => {
      if (cancelled || !host) return;

      stop = startGame(host, profile);
    });

    const hintTimer = window.setTimeout(() => {
      hintVisible = false;
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(hintTimer);
      stop?.();
    };
  });

  function dismissHint() {
    hintVisible = false;
  }

  function toggleMischief() {
    send({
      t: 'settings',
      mischief: !g.mischief
    });
  }

  function toggleHelp() {
    if (g.asking) {
      send({ t: 'cancel_help' });
    } else {
      send({ t: 'ask_help', kind: 'assignment' });
    }
  }

  function useCurrentSpot() {
    if (!g.spot || g.doing) return;

    send({
      t: 'use_spot',
      spot: g.spot.id
    });
  }
</script>

<svelte:head>
  <title>Campus Life</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  />
  <meta name="theme-color" content="#14171f" />
</svelte:head>

<!--
  3D canvas container.
  The game remains full-screen and receives touch input.
-->
<div
  class="stage"
  bind:this={host}
  aria-label="Campus game. Tap the ground to walk and tap people or objects to interact."
></div>

<!-- =========================================
     TOP HUD
     ========================================= -->

<header class="hud" aria-label="Campus status">
  <a class="pill leave" href="/" aria-label="Leave campus">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 18L9 12L15 6M9 12H21"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span>Leave</span>
  </a>

  <div class="pill zone" aria-label={`Current location: ${g.zone}`}>
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 8.3C16 12.3 10 17 10 17S4 12.3 4 8.3a6 6 0 1 1 12 0Z"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <circle
        cx="10"
        cy="8"
        r="2"
        stroke="currentColor"
        stroke-width="1.7"
      />
    </svg>

    <span class="zone-name">{g.zone}</span>
  </div>

  <div class="pill money" aria-label={`Money: ${g.money} Liberian dollars`}>
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="4"
        width="15"
        height="12"
        rx="2.5"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <circle
        cx="10"
        cy="10"
        r="2.3"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M5.5 7H5.6M14.4 13H14.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>

    <span>{g.money} LD</span>
  </div>

  <div
    class="pill info"
    aria-label={`${g.online} players here. ${statusText}`}
    title={statusText}
  >
    <span
      class="dot"
      class:ok={g.status === 'online'}
      class:warn={g.status !== 'online'}
      aria-hidden="true"
    ></span>

    <span class="online-count">{g.online}</span>
    <span class="online-label">here</span>

    <span class="status-divider" aria-hidden="true"></span>

    <span class="status">{statusText}</span>
  </div>
</header>

<!-- =========================================
     INTRODUCTORY HINT
     ========================================= -->

{#if hintVisible}
  <button
    class="hint"
    onclick={dismissHint}
    aria-label="Dismiss gameplay instructions"
  >
    <span class="hint-icon" aria-hidden="true">✦</span>

    <span class="hint-copy">
      <strong>Explore your campus</strong>
      <span>Tap to walk · Tap people to interact</span>
    </span>

    <span class="hint-close" aria-hidden="true">×</span>
  </button>
{/if}

<!-- =========================================
     CONTEXTUAL ACTIONS
     ========================================= -->

<div class="action-area">
  <div class="actions" role="group" aria-label="Available actions">

    <!-- Sitting -->
    {#if g.seated}
      <button
        class="action-button primary"
        onclick={() => send({ t: 'stand' })}
      >
        <span class="action-icon" aria-hidden="true">↑</span>
        <span>Stand up</span>
      </button>
    {:else if g.nearSeat}
      <div class="action-tip">
        <span class="tip-icon" aria-hidden="true">↘</span>
        <span>Tap a seat to sit</span>
      </div>
    {/if}

    <!-- Current activity -->
    {#if g.doing}
      <button
        class="action-button primary"
        onclick={() => send({ t: 'cancel_activity' })}
      >
        <span class="action-icon" aria-hidden="true">■</span>
        <span>{primaryActionLabel}</span>
      </button>

    {:else if g.spot && !(g.spot.kind === 'food' && g.holding)}
      <button
        class="action-button primary"
        onclick={useCurrentSpot}
      >
        <span class="action-icon" aria-hidden="true">✦</span>
        <span>{primaryActionLabel}</span>
      </button>
    {/if}

    <!-- Classroom -->
    {#if g.inClass}
      <button
        class="action-button secondary"
        onclick={() => send({ t: 'escape' })}
      >
        Slip out
      </button>
    {/if}

    <!-- Carrying food -->
    {#if g.holding && !g.seated}
      <div class="action-tip">
        <span class="tip-icon" aria-hidden="true">♧</span>
        <span>Sit down to eat, or give it to someone</span>
      </div>
    {/if}

    {#if g.eating}
      <div class="action-tip">
        <span class="eating-dot" aria-hidden="true"></span>
        <span>Having a meal</span>
      </div>
    {/if}

    <!-- Following another player -->
    {#if g.following}
      <button
        class="action-button secondary"
        onclick={() => send({ t: 'unfollow' })}
      >
        <span class="action-icon" aria-hidden="true">↗</span>
        <span>Stop following</span>
      </button>
    {/if}

    <!-- More actions menu -->
    <details
      class="more-actions"
      open={moreActionsOpen}
      ontoggle={(event) => {
        moreActionsOpen = event.currentTarget.open;
      }}
    >
      <summary aria-label="More campus actions">
        <span class="more-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>

        <span class="more-label">More</span>
      </summary>

      <div class="more-menu">
        <div class="more-menu-heading">
          <span>Campus actions</span>
          <span class="menu-caption">Choose what to do</span>
        </div>

        <button
          class="menu-action"
          onclick={() => {
            toggleHelp();
            moreActionsOpen = false;
          }}
        >
          <span class="menu-icon help-icon" aria-hidden="true">?</span>

          <span class="menu-action-copy">
            <strong>{g.asking ? 'Cancel help request' : 'Ask for help'}</strong>
            <small>
              {g.asking
                ? 'Withdraw your request'
                : 'Let others know you need help'}
            </small>
          </span>

          <span class="menu-arrow" aria-hidden="true">›</span>
        </button>

        <button
          class="menu-action"
          aria-pressed={g.mischief}
          onclick={toggleMischief}
        >
          <span class="menu-icon mischief-icon" aria-hidden="true">✳</span>

          <span class="menu-action-copy">
            <strong>Mischief</strong>
            <small>
              {g.mischief
                ? 'Mischief is enabled'
                : 'Mischief is disabled'}
            </small>
          </span>

          <span
            class="toggle-indicator"
            class:enabled={g.mischief}
            aria-hidden="true"
          >
            <span></span>
          </span>
        </button>

        <p class="menu-footnote">
          Small actions can lead to unexpected stories.
        </p>
      </div>
    </details>
  </div>
</div>

<!-- =========================================
     EXISTING GAME COMPONENTS
     ========================================= -->

<PlayerPanel />
<Overlays />
<ChatBar />

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    overscroll-behavior: none;
  }

  :global(body) {
    background: #14171f;
  }

  :global(button),
  :global(a) {
    -webkit-tap-highlight-color: transparent;
  }

  /* =========================================
     GAME CANVAS
     ========================================= */

  .stage {
    position: fixed;
    inset: 0;
    z-index: 0;

    overflow: hidden;

    background: #14171f;

    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;

    touch-action: none;
  }

  /* =========================================
     TOP HUD
     ========================================= */

  .hud {
    position: fixed;

    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    right: max(12px, env(safe-area-inset-right));

    z-index: 10;

    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    pointer-events: none;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;

    min-width: 0;
    min-height: 42px;

    padding: 9px 13px;

    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;

    background: rgba(21, 26, 43, 0.91);
    color: #f3f1ea;

    font-size: 0.82rem;
    font-weight: 650;

    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .pill svg {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }

  .leave {
    flex: 0 0 auto;

    text-decoration: none;

    pointer-events: auto;

    transition:
      background 150ms ease,
      transform 150ms ease;
  }

  .leave:hover {
    background: rgba(51, 57, 79, 0.96);
  }

  .leave:active {
    transform: scale(0.97);
  }

  .leave:focus-visible,
  .actions button:focus-visible,
  .more-actions summary:focus-visible {
    outline: 3px solid #f5c86a;
    outline-offset: 3px;
  }

  .zone {
    flex: 0 1 auto;
    max-width: min(300px, 35vw);

    background: #f5c86a;
    color: #171a2b;

    border-color: transparent;
  }

  .zone-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .money {
    flex: 0 0 auto;

    background: rgba(247, 245, 238, 0.96);
    color: #171a2b;

    font-variant-numeric: tabular-nums;
  }

  .info {
    margin-left: auto;
    flex: 0 1 auto;
    white-space: nowrap;
  }

  .dot,
  .eating-dot {
    display: inline-block;

    width: 8px;
    height: 8px;
    flex: 0 0 8px;

    border-radius: 50%;
    background: #a8adba;
  }

  .dot.ok {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.35);
  }

  .dot.warn {
    background: #f5c86a;
  }

  .online-count {
    font-variant-numeric: tabular-nums;
  }

  .online-label {
    font-weight: 450;
  }

  .status-divider {
    width: 1px;
    height: 15px;
    flex: 0 0 1px;

    background: rgba(255, 255, 255, 0.19);
  }

  .status {
    overflow: hidden;
    max-width: 155px;

    color: #c1c5d2;

    font-size: 0.72rem;
    font-weight: 450;

    text-overflow: ellipsis;
  }

  /* =========================================
     INTRODUCTORY HINT
     ========================================= */

  .hint {
    position: fixed;

    top: calc(max(12px, env(safe-area-inset-top)) + 60px);
    left: 50%;
    transform: translateX(-50%);

    z-index: 8;

    display: flex;
    align-items: center;
    gap: 11px;

    width: max-content;
    max-width: calc(100vw - 28px);

    padding: 12px 15px;

    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 15px;

    background: rgba(21, 26, 43, 0.95);
    color: #f3f1ea;

    text-align: left;

    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);

    cursor: pointer;

    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

    animation: hint-enter 250ms ease both;
  }

  .hint-icon {
    display: grid;
    place-items: center;

    width: 34px;
    height: 34px;
    flex: 0 0 34px;

    border-radius: 10px;

    background: rgba(245, 200, 106, 0.13);
    color: #f5c86a;

    font-size: 1.15rem;
  }

  .hint-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .hint-copy strong {
    font-size: 0.82rem;
    font-weight: 750;
  }

  .hint-copy > span {
    color: #c1c5d2;
    font-size: 0.73rem;
    line-height: 1.4;
  }

  .hint-close {
    align-self: flex-start;

    margin-left: 5px;

    color: #aeb3c3;
    font-size: 1.15rem;
    line-height: 1;
  }

  @keyframes hint-enter {
    from {
      opacity: 0;
      translate: 0 -5px;
    }

    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  /* =========================================
     BOTTOM ACTION AREA
     ========================================= */

  .action-area {
    position: fixed;

    right: max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    left: max(12px, env(safe-area-inset-left));

    z-index: 12;

    display: flex;
    justify-content: flex-end;
    align-items: flex-end;

    pointer-events: none;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;

    width: fit-content;
    max-width: min(460px, 100%);

    pointer-events: auto;
  }

  .action-button,
  .action-tip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    min-height: 46px;

    padding: 11px 16px;

    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;

    background: rgba(247, 245, 238, 0.97);
    color: #171a2b;

    font-family: inherit;
    font-size: 0.87rem;
    font-weight: 750;
    line-height: 1.25;

    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.17);

    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .action-button {
    cursor: pointer;

    transition:
      transform 120ms ease,
      background 120ms ease;
  }

  .action-button:hover {
    background: #ffffff;
  }

  .action-button:active {
    transform: scale(0.97);
  }

  .action-button.primary {
    background: #f5c86a;
    border-color: transparent;
    color: #171a2b;
  }

  .action-button.primary:hover {
    background: #ffda86;
  }

  .action-button.secondary {
    background: rgba(21, 26, 43, 0.95);
    color: #f3f1ea;
  }

  .action-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 22px;
    height: 22px;
    flex: 0 0 22px;

    border-radius: 7px;

    background: rgba(23, 26, 43, 0.09);

    font-size: 1rem;
    font-weight: 850;
  }

  .action-button.secondary .action-icon {
    background: rgba(255, 255, 255, 0.1);
  }

  .action-tip {
    background: rgba(21, 26, 43, 0.95);
    color: #f3f1ea;

    font-weight: 550;

    pointer-events: none;
  }

  .tip-icon {
    color: #f5c86a;
    font-size: 1.05rem;
  }

  .eating-dot {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.35);
  }

  /* =========================================
     MORE ACTIONS
     ========================================= */

  .more-actions {
    position: relative;
    flex: 0 0 auto;
  }

  .more-actions summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    min-width: 88px;
    min-height: 46px;

    padding: 10px 14px;

    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;

    background: rgba(21, 26, 43, 0.96);
    color: #f3f1ea;

    font-size: 0.82rem;
    font-weight: 700;

    list-style: none;
    cursor: pointer;

    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.17);

    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

    transition: background 140ms ease;
  }

  .more-actions summary::-webkit-details-marker {
    display: none;
  }

  .more-actions summary:hover {
    background: #30364c;
  }

  .more-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
  }

  .more-dots span {
    width: 4px;
    height: 4px;

    border-radius: 50%;
    background: currentColor;
  }

  .more-menu {
    position: absolute;

    right: 0;
    bottom: calc(100% + 12px);

    width: min(310px, calc(100vw - 28px));

    padding: 12px;

    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;

    background: rgba(21, 26, 43, 0.98);
    color: #f3f1ea;

    box-shadow: 0 14px 45px rgba(0, 0, 0, 0.32);

    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);

    animation: menu-enter 150ms ease both;
  }

  @keyframes menu-enter {
    from {
      opacity: 0;
      transform: translateY(5px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .more-menu-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;

    padding: 8px 8px 13px;

    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    font-size: 0.87rem;
    font-weight: 800;
  }

  .menu-caption {
    color: #aeb3c3;
    font-size: 0.73rem;
    font-weight: 450;
  }

  .menu-action {
    display: flex;
    align-items: center;
    gap: 11px;

    width: 100%;
    min-height: 68px;

    padding: 11px 8px;

    border: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);

    background: transparent;
    color: inherit;

    text-align: left;
    font-family: inherit;

    cursor: pointer;
  }

  .menu-action:hover {
    background: rgba(255, 255, 255, 0.045);
    border-radius: 10px;
  }

  .menu-action:focus-visible {
    outline: 2px solid #f5c86a;
    outline-offset: -2px;
    border-radius: 10px;
  }

  .menu-icon {
    display: grid;
    place-items: center;

    width: 37px;
    height: 37px;
    flex: 0 0 37px;

    border-radius: 11px;

    font-size: 1.05rem;
    font-weight: 850;
  }

  .help-icon {
    background: rgba(128, 212, 194, 0.12);
    color: #80d4c2;
  }

  .mischief-icon {
    background: rgba(245, 200, 106, 0.12);
    color: #f5c86a;
  }

  .menu-action-copy {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 5px;

    min-width: 0;
  }

  .menu-action-copy strong {
    font-size: 0.81rem;
    font-weight: 750;
  }

  .menu-action-copy small {
    color: #aeb3c3;
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .menu-arrow {
    color: #aeb3c3;
    font-size: 1.4rem;
  }

  .toggle-indicator {
    display: flex;
    align-items: center;

    width: 38px;
    height: 23px;
    flex: 0 0 38px;

    padding: 3px;

    border-radius: 999px;

    background: #45495a;

    transition: background 150ms ease;
  }

  .toggle-indicator > span {
    width: 17px;
    height: 17px;

    border-radius: 50%;
    background: #ffffff;

    transition: transform 150ms ease;
  }

  .toggle-indicator.enabled {
    background: #438f7e;
  }

  .toggle-indicator.enabled > span {
    transform: translateX(15px);
  }

  .menu-footnote {
    margin: 11px 7px 4px;

    color: #aeb3c3;
    font-size: 0.7rem;
    line-height: 1.5;
  }

  /* =========================================
     TABLETS AND NARROW DESKTOP
     ========================================= */

  @media (max-width: 900px) {
    .status {
      display: none;
    }

    .status-divider {
      display: none;
    }

    .info {
      gap: 6px;
    }

    .actions {
      max-width: min(390px, 100%);
    }
  }

  /* =========================================
     MOBILE PORTRAIT
     ========================================= */

  @media (max-width: 600px) {
    .hud {
      top: max(8px, env(safe-area-inset-top));
      left: max(8px, env(safe-area-inset-left));
      right: max(8px, env(safe-area-inset-right));

      display: grid;

      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "leave zone money"
        ". info info";

      align-items: center;
      gap: 7px;
    }

    .pill {
      min-height: 39px;
      gap: 6px;

      padding: 8px 10px;
      border-radius: 12px;

      font-size: 0.75rem;
    }

    .pill svg {
      width: 16px;
      height: 16px;
      flex-basis: 16px;
    }

    .leave {
      grid-area: leave;
    }

    .zone {
      grid-area: zone;
      justify-self: stretch;

      max-width: none;
      min-width: 0;

      justify-content: flex-start;
    }

    .money {
      grid-area: money;
      justify-self: end;
    }

    .info {
      grid-area: info;

      justify-self: end;
      margin-left: 0;

      min-height: 30px;

      padding: 5px 10px;

      border-radius: 10px;

      background: rgba(21, 26, 43, 0.78);

      font-size: 0.71rem;
    }

    .online-count {
      font-weight: 800;
    }

    .status {
      display: none;
    }

    .status-divider {
      display: none;
    }

    .hint {
      top: calc(max(8px, env(safe-area-inset-top)) + 91px);

      gap: 9px;

      padding: 10px 12px;

      border-radius: 13px;
    }

    .hint-icon {
      width: 30px;
      height: 30px;
      flex-basis: 30px;
    }

    .hint-copy strong {
      font-size: 0.77rem;
    }

    .hint-copy > span {
      font-size: 0.69rem;
    }

    /*
      Leave room above the bottom edge for the existing chat UI.
      We'll fine-tune this after inspecting ChatBar.svelte.
    */
    .action-area {
      right: max(9px, env(safe-area-inset-right));
      bottom: calc(max(9px, env(safe-area-inset-bottom)) + 54px);
      left: max(9px, env(safe-area-inset-left));
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 7px;

      width: 100%;
      max-width: none;
    }

    .action-button,
    .action-tip {
      min-height: 45px;
      max-width: 100%;

      padding: 10px 12px;

      border-radius: 13px;

      font-size: 0.79rem;
    }

    .action-button {
      gap: 6px;
    }

    .action-icon {
      width: 20px;
      height: 20px;
      flex-basis: 20px;

      font-size: 0.9rem;
    }

    .action-tip {
      flex: 1 1 auto;
      justify-content: flex-start;

      min-width: 0;

      font-size: 0.74rem;
      line-height: 1.4;
    }

    .more-actions {
      flex: 0 0 auto;
    }

    .more-actions summary {
      min-width: 73px;
      min-height: 45px;

      gap: 7px;

      padding: 10px 12px;

      border-radius: 13px;

      font-size: 0.76rem;
    }

    .more-menu {
      width: min(300px, calc(100vw - 24px));
    }
  }

  /* =========================================
     SMALL PHONES
     ========================================= */

  @media (max-width: 380px) {
    .hud {
      gap: 5px;
    }

    .pill {
      padding: 7px 8px;
      gap: 5px;

      font-size: 0.69rem;
    }

    .pill svg {
      width: 15px;
      height: 15px;
      flex-basis: 15px;
    }

    .zone {
      min-width: 0;
    }

    .hint {
      max-width: calc(100vw - 20px);
    }

    .action-area {
      bottom: calc(max(8px, env(safe-area-inset-bottom)) + 50px);
    }

    .actions {
      gap: 5px;
    }

    .action-button,
    .action-tip {
      min-height: 43px;
      padding: 9px 10px;

      font-size: 0.72rem;
    }

    .action-icon {
      display: none;
    }

    .more-actions summary {
      min-width: 65px;
      min-height: 43px;

      padding: 9px;
      gap: 5px;

      font-size: 0.72rem;
    }
  }

  /* =========================================
     LANDSCAPE PHONES
     ========================================= */

  @media (max-width: 900px) and (orientation: landscape) {
    .hud {
      top: max(6px, env(safe-area-inset-top));
      left: max(8px, env(safe-area-inset-left));
      right: max(8px, env(safe-area-inset-right));

      flex-wrap: nowrap;
      gap: 6px;
    }

    .pill {
      min-height: 34px;
      padding: 6px 10px;

      border-radius: 10px;

      font-size: 0.72rem;
    }

    .info {
      margin-left: auto;
    }

    .status {
      display: none;
    }

    .status-divider {
      display: none;
    }

    .hint {
      top: calc(max(6px, env(safe-area-inset-top)) + 45px);

      padding: 8px 11px;
    }

    .hint-icon {
      width: 28px;
      height: 28px;
      flex-basis: 28px;
    }

    .action-area {
      right: max(8px, env(safe-area-inset-right));
      bottom: max(8px, env(safe-area-inset-bottom));
      left: max(8px, env(safe-area-inset-left));
    }

    .actions {
      max-width: min(65vw, 550px);
      gap: 6px;
    }

    .action-button,
    .action-tip {
      min-height: 40px;
      padding: 8px 11px;

      border-radius: 11px;

      font-size: 0.75rem;
    }

    .more-actions summary {
      min-height: 40px;
      min-width: 70px;

      padding: 8px 11px;
      border-radius: 11px;
    }
  }

  /* =========================================
     ACCESSIBILITY
     ========================================= */

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