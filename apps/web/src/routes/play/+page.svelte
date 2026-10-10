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

  const statusText = $derived(
    g.status === 'online' ? (g.ping !== null ? `${g.ping} ms` : 'Connected') : g.status === 'replaced' ? 'Signed in on another tab' : 'Connecting to campus'
  );

  onMount(() => {
    const profile = loadProfile();
    if (!profile) {
      goto('/');
      return;
    }
    let cancelled = false;
    let stop: (() => void) | undefined;
    // Imported here (not at the top) so Phaser never loads on the server.
    import('$lib/game/start').then(({ startGame }) => {
      if (cancelled || !host) return;
      stop = startGame(host, profile);
    });
    const hintTimer = setTimeout(() => (hintVisible = false), 12000);
    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      stop?.();
    };
  });
</script>

<svelte:head><title>Campus Life</title></svelte:head>

<div class="stage" bind:this={host}></div>

<header class="hud">
  <a class="pill leave" href="/">Leave</a>
  <span class="pill zone">{g.zone}</span>
  <span class="pill info">
    <i class="dot" class:ok={g.status === 'online'} class:warn={g.status !== 'online'}></i>
    <span>{g.online} here</span>
    <span class="status">{statusText}</span>
  </span>
  <span class="pill money" title="Your money">{g.money} LD</span>
</header>

<div class="actions" role="group" aria-label="What you can do right now">
  {#if g.seated}
    <button onclick={() => send({ t: 'stand' })}>Stand up</button>
  {:else if g.nearSeat}
    <span class="tip">Tap a seat to sit</span>
  {/if}
  {#if g.doing}
    <button onclick={() => send({ t: 'cancel_activity' })}>{g.doing === 'work' ? 'Stop working' : g.doing === 'ride' ? 'Get off' : 'Stop'}</button>
  {:else if g.spot && !(g.spot.kind === 'food' && g.holding)}
    <button class="go" onclick={() => g.spot && send({ t: 'use_spot', spot: g.spot.id })}>
      {g.spot.label}{g.spot.price > 0 ? ` (${g.spot.price} LD)` : ''}
    </button>
  {/if}
  {#if g.inClass}
    <button class="soft" onclick={() => send({ t: 'escape' })}>Slip out</button>
  {/if}
  {#if g.holding && !g.seated}
    <span class="tip">Sit down to eat, or give it to someone</span>
  {/if}
  {#if g.eating}
    <span class="tip">Eating</span>
  {/if}
  {#if g.following}
    <button onclick={() => send({ t: 'unfollow' })}>Stop following</button>
  {/if}
  {#if g.asking}
    <button onclick={() => send({ t: 'cancel_help' })}>Cancel help request</button>
  {:else}
    <button class="soft" onclick={() => send({ t: 'ask_help', kind: 'assignment' })}>Ask for help</button>
  {/if}
  <button class="soft" aria-pressed={!g.mischief} onclick={() => send({ t: 'settings', mischief: !g.mischief })}>
    {g.mischief ? 'Mischief on' : 'Mischief off'}
  </button>
</div>

<PlayerPanel />
<Overlays />
<ChatBar />

<p class="hint" class:hidden={!hintVisible}>Tap to walk. Tap a seat to sit. Tap a person to talk, invite or follow.</p>

<style>
  .stage { position: fixed; inset: 0; background: #14171f; touch-action: none; user-select: none; -webkit-user-select: none; overflow: hidden; }
  .stage :global(canvas) { display: block; touch-action: none; }
  .hud {
    position: fixed; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right));
    display: flex; flex-wrap: wrap; gap: 8px; pointer-events: none; z-index: 10;
  }
  .pill {
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px;
    background: rgba(21, 26, 56, 0.82); color: #f3f1ea; font-size: 0.875rem; font-weight: 600; text-decoration: none; backdrop-filter: blur(6px);
  }
  .leave { pointer-events: auto; }
  .zone { background: var(--mango); color: var(--ink); }
  .info { margin-left: auto; }
  .money { background: var(--concrete); color: var(--ink); }
  .status { opacity: 0.75; font-weight: 400; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--mist); }
  .dot.ok { background: #4ade80; }
  .dot.warn { background: var(--mango); }

  .actions {
    position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom));
    display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: min(420px, calc(100vw - 24px)); z-index: 12;
  }
  .actions button, .tip {
    padding: 10px 14px; border: 0; border-radius: 999px; font-size: 0.9375rem; font-weight: 700; background: rgba(247, 245, 238, 0.95); color: var(--ink); cursor: pointer;
  }
  .actions .go { background: var(--mango); }
  .actions .soft { background: rgba(21, 26, 56, 0.82); color: #f3f1ea; font-weight: 600; }
  .actions .soft[aria-pressed='true'] { background: rgba(120, 30, 70, 0.9); }
  .tip { background: rgba(21, 26, 56, 0.82); color: #f3f1ea; font-weight: 500; cursor: default; }

  .hint {
    position: fixed; left: 50%; top: max(60px, calc(env(safe-area-inset-top) + 52px)); transform: translateX(-50%); margin: 0; padding: 10px 16px; border-radius: 999px;
    background: rgba(21, 26, 56, 0.82); color: #f3f1ea; font-size: 0.9375rem; pointer-events: none; transition: opacity 0.6s ease; z-index: 9; max-width: calc(100vw - 24px); text-align: center;
  }
  .hint.hidden { opacity: 0; }
  @media (max-width: 640px) { .info { margin-left: 0; } .actions { bottom: calc(max(12px, env(safe-area-inset-bottom)) + 52px); } }
</style>
