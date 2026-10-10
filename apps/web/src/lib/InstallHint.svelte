<script lang="ts">
  import { onMount } from 'svelte';

  let deferred = $state<any>(null);
  let ios = $state(false);
  let installed = $state(true);

  onMount(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    installed = standalone;
    ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e;
    };
    const onInstalled = () => (installed = true);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
    };
  });

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
  }
</script>

{#if !installed && deferred}
  <button type="button" class="install" onclick={install}>Install Campus Life on your phone</button>
{:else if ios}
  <p class="install-note">To install: tap Share, then Add to Home Screen.</p>
{/if}

<style>
  .install { margin: 12px auto 0; display: block; padding: 10px 16px; border: 0; border-radius: 999px; background: var(--concrete); color: var(--ink); font-weight: 600; cursor: pointer; }
  .install-note { margin: 12px 0 0; text-align: center; font-size: 0.875rem; opacity: 0.8; }
</style>
