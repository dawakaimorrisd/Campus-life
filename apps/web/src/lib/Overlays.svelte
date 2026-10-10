<script lang="ts">
  import { onMount } from 'svelte';
  import { HELP_LABELS, PLACE_NAMES } from '@campus/shared';
  import { g, send } from './game/store.svelte';

  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => {
      now = Date.now();
      g.invites = g.invites.filter((i) => i.expiresAt > now);
    }, 500);
    return () => clearInterval(t);
  });

  function reply(id: string, accept: boolean) {
    send({ t: 'invite_reply', id, accept });
    g.invites = g.invites.filter((i) => i.id !== id);
  }
</script>

<div class="stack" aria-live="polite">
  {#each g.invites as inv (inv.id)}
    <div class="card invite">
      <p><strong>{inv.fromName}</strong> says come to <strong>{PLACE_NAMES[inv.place]}</strong>.</p>
      <div class="btns">
        <button class="yes" onclick={() => reply(inv.id, true)}>I'm coming</button>
        <button onclick={() => reply(inv.id, false)}>Not now</button>
      </div>
    </div>
  {/each}
  {#each g.toasts as t (t.id)}
    <div class="card toast {t.tone}">{t.text}</div>
  {/each}
</div>

{#if g.help}
  <div class="help" role="status">
    <span>{g.help.role === 'helper' ? `Helping ${g.help.withName} with ${HELP_LABELS[g.help.kind]}` : `${g.help.withName} is helping you`}</span>
    <div class="track"><i style:width={g.help.pct + '%'}></i></div>
    <button onclick={() => send({ t: 'cancel_help' })}>Stop</button>
  </div>
{/if}

<style>
  .stack {
    position: fixed; top: max(64px, calc(env(safe-area-inset-top) + 56px)); left: 50%; transform: translateX(-50%);
    width: min(420px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 8px; z-index: 30; pointer-events: none;
  }
  .card { padding: 10px 14px; border-radius: 12px; background: rgba(21, 26, 56, 0.92); color: #f3f1ea; font-size: 0.9375rem; line-height: 1.35; pointer-events: auto; }
  .toast.good { background: rgba(22, 100, 62, 0.94); }
  .toast.warn { background: rgba(120, 72, 18, 0.95); }
  .toast.fun { background: rgba(120, 30, 70, 0.94); }
  .invite { background: var(--concrete); color: var(--ink); }
  .invite p { margin: 0 0 8px; }
  .btns { display: flex; gap: 8px; }
  .btns button { padding: 8px 12px; border: 0; border-radius: 9px; background: #f7f5ee; color: var(--ink); font-weight: 600; cursor: pointer; }
  .btns .yes { background: var(--mango); }
  .help {
    position: fixed; left: 50%; transform: translateX(-50%); top: max(64px, calc(env(safe-area-inset-top) + 56px)); z-index: 25;
    display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(21, 26, 56, 0.94);
    color: #f3f1ea; font-size: 0.9375rem; width: min(460px, calc(100vw - 24px));
  }
  .help span { flex: 1; min-width: 0; }
  .track { width: 90px; height: 8px; border-radius: 99px; background: rgba(255, 255, 255, 0.2); overflow: hidden; flex: none; }
  .track i { display: block; height: 100%; background: var(--mango); transition: width 0.4s linear; }
  .help button { padding: 6px 10px; border: 0; border-radius: 8px; background: #f7f5ee; color: var(--ink); font-weight: 600; cursor: pointer; }
</style>
