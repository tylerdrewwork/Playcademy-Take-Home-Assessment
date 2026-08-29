<script>
  import { addition1LessonProgress } from './lessons/content/addition-1-LessonProgress.js'

  let { onShowSection } = $props()

  let dialog = $state(null)
  let confirming = $state(false)
  let justReset = $state(false)

  function open() {
    confirming = false
    justReset = false
    dialog.showModal()
  }

  function close() {
    dialog.close()
  }

  function requestReset() {
    confirming = true
  }

  function cancelReset() {
    confirming = false
  }

  async function confirmReset() {
    await addition1LessonProgress.resetProgress()
    confirming = false
    justReset = true
    dialog.close()
    setTimeout(() => {
      justReset = false
    }, 3000)
  }

  async function jumpTo(section) {
    close()
    if (section !== 'multiplayer') {
      await addition1LessonProgress.jumpToPhase(section === 'lesson' ? 'instruction' : 'problems')
    }
    onShowSection(section === 'multiplayer' ? 'multiplayer' : 'lesson')
  }
</script>

<button class="admin-tools-trigger" onclick={open}>Admin Tools</button>

<dialog bind:this={dialog}>
  <h2>Admin Tools</h2>

  {#if confirming}
    <p>Are you sure? This will erase saved lesson progress.</p>
    <div class="actions">
      <button onclick={confirmReset}>Confirm</button>
      <button onclick={cancelReset}>Cancel</button>
    </div>
  {:else}
    <div class="jump-group">
      <span class="jump-label">Jump to:</span>
      <div class="actions">
        <button onclick={() => jumpTo('lesson')}>Lesson</button>
        <button onclick={() => jumpTo('problems')}>Problems</button>
        <button onclick={() => jumpTo('multiplayer')}>Multiplayer</button>
      </div>
    </div>
    <div class="actions">
      <button onclick={requestReset}>Reset Progress</button>
      <button onclick={close}>Close</button>
    </div>
  {/if}
</dialog>

{#if justReset}
  <p class="toast">Progress reset</p>
{/if}

<style>
  .admin-tools-trigger {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
  }

  dialog {
    border-radius: 8px;
    border: none;
    padding: 1.5rem;
    color: inherit;
    background-color: #1a1a1a;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .jump-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .toast {
    position: fixed;
    top: 4rem;
    right: 1rem;
    background-color: #1a1a1a;
    padding: 0.5rem 1rem;
    border-radius: 8px;
  }

  @media (prefers-color-scheme: light) {
    dialog,
    .toast {
      background-color: #f9f9f9;
    }
  }
</style>
