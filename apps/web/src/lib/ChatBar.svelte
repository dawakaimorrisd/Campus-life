<script lang="ts">
  import { CHAT_MAX, EMOTES, EMOTE_ICONS, EMOTE_LABELS, QUICK_PHRASES } from '@campus/shared';
  import { g, send } from './game/store.svelte';

  let text = $state('');
  let open = $state<'none' | 'phrases' | 'emotes'>('none');
  let input: HTMLInputElement | undefined = $state();

  function submit(e: Event) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    send({ t: 'say', text: t });
    text = '';
  }
  function phrase(p: string) {
    send({ t: 'say', text: p, q: true });
    open = 'none';
  }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && document.activeElement !== input) {
      e.preventDefault();
      input?.focus();
    }
    if (e.key === 'Escape') {
      input?.blur();
      open = 'none';
      g.selected = null;
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="bar">
  {#if open === 'phrases'}
    <div class="pop" role="menu">
      {#each QUICK_PHRASES as p}<button role="menuitem" onclick={() => phrase(p)}>{p}</button>{/each}
    </div>
  {:else if open === 'emotes'}
    <div class="pop" role="menu">
      {#each EMOTES as e}
        <button role="menuitem" onclick={() => { send({ t: 'emote', kind: e }); open = 'none'; }}>{EMOTE_ICONS[e]} {EMOTE_LABELS[e]}</button>
      {/each}
    </div>
  {/if}
  <div class="row">
    <button class="chip" aria-expanded={open === 'phrases'} onclick={() => (open = open === 'phrases' ? 'none' : 'phrases')}>Say</button>
    <button class="chip" aria-expanded={open === 'emotes'} onclick={() => (open = open === 'emotes' ? 'none' : 'emotes')}>React</button>
    <form onsubmit={submit}>
      <input bind:this={input} bind:value={text} maxlength={CHAT_MAX} placeholder="Say something to people nearby (Enter)" autocomplete="off" enterkeyhint="send" />
    </form>
  </div>
</div>

<style>
  .bar {
    position: fixed; left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom));
    width: min(520px, calc(100vw - 24px)); z-index: 15;
  }
  .row { display: flex; gap: 8px; align-items: center; }
  form { flex: 1; min-width: 0; }
  input {
    width: 100%; padding: 11px 14px; border-radius: 999px; border: 0; background: rgba(247, 245, 238, 0.95); color: var(--ink); font-size: 1rem;
  }
  .chip {
    padding: 10px 14px; border: 0; border-radius: 999px; background: var(--mango); color: var(--ink); font-weight: 700; cursor: pointer; flex: none;
  }
  .chip[aria-expanded='true'] { background: #fff; }
  .pop {
    display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; padding: 10px; border-radius: 14px;
    background: rgba(21, 26, 56, 0.92); backdrop-filter: blur(6px);
  }
  .pop button { padding: 8px 12px; border: 0; border-radius: 999px; background: #f7f5ee; color: var(--ink); font-weight: 600; cursor: pointer; }
  .pop button:hover { background: #fff; }
</style>
