<script lang="ts">
  import {
    EMOTE_LABELS, FOLLOW_RANGE, GIVE_AMOUNTS, HELP_LABELS, INTERACT_RANGE, INVITE_PLACES, INVITE_RANGE, MISCHIEF_RANGE, PLACE_NAMES,
    toCss, SKIN_TONES, SHIRT_COLORS, HAIR_COLORS, type InvitePlace
  } from '@campus/shared';
  import { g, send } from './game/store.svelte';

  const s = $derived(g.selected);
  let mode = $state<'main' | 'invite' | 'inviteAll' | 'give' | 'whisper'>('main');
  let whisperText = $state('');
  let lastId = '';
  $effect(() => {
    const id = s?.state.id ?? '';
    if (id !== lastId) {
      lastId = id;
      mode = 'main';
      whisperText = '';
    }
  });

  const close = () => (g.selected = null);
  const near = $derived(!!s && s.sameLevel && s.dist <= INTERACT_RANGE);
  const inviteRange = $derived(!!s && s.sameLevel && s.dist <= INVITE_RANGE);
  const followRange = $derived(!!s && s.sameLevel && s.dist <= FOLLOW_RANGE);
  const adjacent = $derived(!!s && s.sameLevel && s.dist <= MISCHIEF_RANGE);
  const canAsk = $derived(!!s?.state.asking && !!s && s.sameLevel && s.dist <= INTERACT_RANGE * 1.5);

  function doInvite(place: InvitePlace) {
    if (!s) return;
    send({ t: 'invite', to: s.state.id, place });
    close();
  }
  function doWhisper(e: Event) {
    e.preventDefault();
    if (!s || !whisperText.trim()) return;
    send({ t: 'whisper', to: s.state.id, text: whisperText });
    whisperText = '';
    close();
  }
</script>

{#if s}
  <aside class="panel" aria-label={`Actions for ${s.state.name}`}>
    <header>
      <svg viewBox="0 0 28 36" width="30" height="38" aria-hidden="true">
        <rect x="8" y="28" width="5" height="7" rx="2" fill="#2b2f3a" /><rect x="15" y="28" width="5" height="7" rx="2" fill="#2b2f3a" />
        <rect x="6" y="15" width="16" height="15" rx="5" fill={toCss(SHIRT_COLORS[s.state.avatar.shirt])} />
        <circle cx="14" cy="11" r="8.6" fill={toCss(HAIR_COLORS[s.state.avatar.hair])} />
        <circle cx="14" cy="12.6" r="6.9" fill={toCss(SKIN_TONES[s.state.avatar.skin])} />
        <circle cx="11.4" cy="13" r="1" fill="#1a1a22" /><circle cx="16.6" cy="13" r="1" fill="#1a1a22" />
      </svg>
      <div class="who">
        <strong>{s.state.name}</strong>
        {#if g.history?.id === s.state.id && g.history.known}<em class="known">{g.history.known}</em>{/if}
        <span>
          {#if !s.sameLevel}On another floor
          {:else if s.state.eating}Eating
          {:else if s.state.seat}Sitting
          {:else if s.state.asking}Needs a hand with {HELP_LABELS[s.state.asking]}
          {:else if s.state.moving}Walking
          {:else}Standing here{/if}
        </span>
      </div>
      <button class="x" onclick={close} aria-label="Close">×</button>
    </header>

    {#if mode === 'main'}
      {#if g.history?.id === s.state.id && g.history.line}<p class="memory">{g.history.line}</p>{/if}
      <div class="grid">
        {#if s.state.asking}
          <button class="hl" disabled={!canAsk} onclick={() => { send({ t: 'offer_help', to: s.state.id }); close(); }}>Help them</button>
        {/if}
        <button disabled={!inviteRange} onclick={() => (mode = 'invite')}>Invite</button>
        {#if g.following}
          <button onclick={() => send({ t: 'unfollow' })}>Stop following</button>
        {:else}
          <button disabled={!followRange} onclick={() => { send({ t: 'follow', to: s.state.id }); close(); }}>Follow</button>
        {/if}
        <button disabled={!inviteRange || !(s.state.seat || s.state.eating || s.state.moving || s.state.following)} onclick={() => { send({ t: 'join_in', to: s.state.id }); close(); }}>Join them</button>
        <button onclick={() => (mode = 'whisper')}>Whisper</button>
        <button disabled={!inviteRange} onclick={() => (mode = 'inviteAll')}>Invite all nearby</button>
        <button disabled={!near} onclick={() => (mode = 'give')}>Give</button>
        {#if s.state.hotFor === g.selfId}
          <button class="hl" disabled={!adjacent} onclick={() => { send({ t: 'reclaim', from: s.state.id }); close(); }}>Take plate back</button>
        {/if}
      </div>
      {#if g.mischief}
        <div class="row mischief">
          <button disabled={!adjacent || s.state.held !== 'plate' || g.holding} onclick={() => { send({ t: 'steal', to: s.state.id }); close(); }}>Take their food</button>
          <button disabled={!adjacent} onclick={() => { send({ t: 'prank', to: s.state.id }); close(); }}>Prank</button>
        </div>
      {/if}
      {#if !s.sameLevel}<p class="hint">They are upstairs or downstairs. Go to the staircase in the Student Hall.</p>
      {:else if !near}<p class="hint">Walk closer to give or help. Take food and pranks need you right beside them.</p>{/if}

    {:else if mode === 'invite'}
      <p class="sub">Ask {s.state.name} to come to</p>
      <div class="grid">
        {#each INVITE_PLACES as p}
          <button onclick={() => doInvite(p)}>{p === 'here' ? 'Come to me' : PLACE_NAMES[p].replace(/^the /, '')}</button>
        {/each}
      </div>
      <button class="back" onclick={() => (mode = 'main')}>Back</button>

    {:else if mode === 'inviteAll'}
      <p class="sub">Ask everyone close by to come to</p>
      <div class="grid">
        {#each INVITE_PLACES as p}
          <button onclick={() => { send({ t: 'invite_all', place: p }); close(); }}>{p === 'here' ? 'Come to me' : PLACE_NAMES[p].replace(/^the /, '')}</button>
        {/each}
      </div>
      <button class="back" onclick={() => (mode = 'main')}>Back</button>

    {:else if mode === 'give'}
      <p class="sub">Give {s.state.name}</p>
      <div class="grid">
        {#each GIVE_AMOUNTS as n}
          <button disabled={g.money < n} onclick={() => { send({ t: 'give', to: s.state.id, item: 'money', amount: n }); close(); }}>{n} LD</button>
        {/each}
        <button disabled={!g.holding || !!s.state.held} onclick={() => { send({ t: 'give', to: s.state.id, item: 'plate' }); close(); }}>Your plate</button>
      </div>
      <button class="back" onclick={() => (mode = 'main')}>Back</button>

    {:else}
      <form class="whisper" onsubmit={doWhisper}>
        <input bind:value={whisperText} maxlength="120" placeholder={`Private message to ${s.state.name}`} />
        <button type="submit" class="hl">Send</button>
      </form>
      <button class="back" onclick={() => (mode = 'main')}>Back</button>
    {/if}
  </aside>
{/if}

<style>
  .panel {
    position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: max(76px, calc(env(safe-area-inset-bottom) + 68px));
    width: min(320px, calc(100vw - 24px)); padding: 14px; border-radius: 14px;
    background: var(--concrete); color: var(--ink); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); z-index: 20;
  }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .who strong { font-size: 1.0625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who span { font-size: 0.8125rem; color: #55524a; }
  .x { width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; font-size: 1.5rem; line-height: 1; cursor: pointer; color: var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  button { padding: 10px 8px; border: 0; border-radius: 9px; background: #f7f5ee; color: var(--ink); font-weight: 600; font-size: 0.9375rem; cursor: pointer; }
  button:hover:not(:disabled) { background: #fff; }
  button:disabled { opacity: 0.42; cursor: not-allowed; }
  .hl { background: var(--mango); }
  .hl:hover:not(:disabled) { background: var(--mango-deep); }
  .mischief button { background: #f1d9d9; }
  .back { margin-top: 8px; width: 100%; background: transparent; text-decoration: underline; font-weight: 500; }
  .sub { margin: 0 0 8px; font-size: 0.875rem; color: #55524a; }
  .known { font-size: 0.75rem; font-style: normal; color: #8a5a00; }
  .memory { margin: 0 0 10px; font-size: 0.875rem; line-height: 1.4; color: #3d3a33; }
  .hint { margin: 10px 0 0; font-size: 0.8125rem; color: #55524a; line-height: 1.4; }
  .whisper { display: flex; gap: 8px; }
  .whisper input { flex: 1; min-width: 0; padding: 10px; border-radius: 9px; border: 2px solid var(--concrete-deep); background: #f7f5ee; color: var(--ink); }
</style>
