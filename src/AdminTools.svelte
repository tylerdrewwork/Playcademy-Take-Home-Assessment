<script>
  import { addition1LessonProgress } from './lessons/content/addition-1-LessonProgress.js'
  import { addition1EvaluationRecorder } from './lessons/content/addition-1-EvaluationRecorder.js'
  import { adminSettings } from './adminSettings.svelte.js'

  let { onShowSection } = $props()

  let dialog = $state(null)
  let confirming = $state(false)
  let justReset = $state(false)
  let showEvaluationLog = $state(false)
  let evaluationFindings = $state([])

  // The recorder is deliberately not reactive, so the on-screen panel polls
  // it while visible — a rolling view that picks up findings as they land.
  $effect(() => {
    if (!showEvaluationLog) return
    const refresh = () => {
      evaluationFindings = [...addition1EvaluationRecorder.findings].reverse()
    }
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  })

  function open() {
    confirming = false
    justReset = false
    evaluationFindings = [...addition1EvaluationRecorder.findings].reverse()
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
    await addition1EvaluationRecorder.reset()
    evaluationFindings = []
    confirming = false
    justReset = true
    dialog.close()
    setTimeout(() => {
      justReset = false
    }, 3000)
  }

  async function jumpTo(section) {
    close()
    if (section === 'multiplayer') {
      onShowSection('multiplayer')
      return
    }
    await addition1LessonProgress.jumpToPhase(section === 'lesson' ? 'instruction' : 'problems')
    // Once every problem is answered, the problems phase is not re-enterable
    // (the jump lands on 'complete' instead) — go straight to multiplayer.
    const landedOnComplete = addition1LessonProgress.progress?.phase === 'complete'
    onShowSection(section === 'problems' && landedOnComplete ? 'multiplayer' : 'lesson')
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
    <div class="eval-log">
      <div class="eval-log-header">
        <span class="jump-label">Evaluation log ({evaluationFindings.length})</span>
        <button onclick={() => (showEvaluationLog = !showEvaluationLog)}>
          {showEvaluationLog ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>

    <label class="setting-row">
      <input type="checkbox" bind:checked={adminSettings.simpleMultiplayer} />
      <span>
        Simple Multiplayer
        <span class="setting-hint">— this player's coin problems cap at 10¢</span>
      </span>
    </label>

    <label class="setting-row">
      <input type="checkbox" bind:checked={adminSettings.showDebugOverlay} />
      <span>
        Debug Overlay
        <span class="setting-hint">— shows current lesson screen/step in the top right</span>
      </span>
    </label>

    <div class="actions">
      <button onclick={requestReset}>Reset Progress</button>
      <button onclick={close}>Close</button>
    </div>

    <div class="separated-actions">
      <button onclick={() => (window.location.href = '/knowledge-graph.html')}>
        View Knowledge Graph
      </button>
    </div>
  {/if}
</dialog>

{#if showEvaluationLog}
  <aside class="eval-panel" aria-label="Evaluation log">
    <p class="eval-panel-title">Evaluation log ({evaluationFindings.length})</p>
    <ul class="eval-findings">
      {#each evaluationFindings as finding}
        <li>
          <span class="polarity" class:concern={finding.polarity === 'concern'}>
            {finding.polarity === 'concern' ? '⚠' : '✓'}
          </span>
          <span class="signal">{finding.signal}</span>
          <span class="meta">
            {finding.problemId}
            {#if finding.attemptIndex != null}· attempt {finding.attemptIndex + 1}{/if}
            · set v{finding.problemSetVersion}
            · {new Date(finding.t).toLocaleTimeString()}
          </span>
          {#if finding.detail}
            <span class="detail">{JSON.stringify(finding.detail)}</span>
          {/if}
        </li>
      {:else}
        <li class="empty">No findings recorded yet.</li>
      {/each}
    </ul>
  </aside>
{/if}

{#if justReset}
  <p class="toast">Progress reset</p>
{/if}

<style>
  .admin-tools-trigger {
    display: block;
    width: 100%;
    background-color: transparent;
    border-color: transparent;
    border-radius: 0.5rem;
    white-space: nowrap;
    text-align: left;
    padding: 0.3em 0.6em;
    box-shadow: none;
  }

  .admin-tools-trigger:hover {
    background-color: rgba(128, 128, 128, 0.15);
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

  .separated-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(128, 128, 128, 0.25);
  }

  .jump-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .eval-log {
    margin-bottom: 1rem;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    cursor: pointer;
    text-align: left;
  }

  .setting-hint {
    opacity: 0.7;
    font-size: 0.85em;
  }

  .eval-log-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Rolling on-screen log. Pinned low enough on the left to clear the
     Options pill and its dropdown menu (Admin Tools trigger + volume
     slider) sitting above it in the top-left corner. */
  .eval-panel {
    position: fixed;
    top: 9rem;
    left: 1rem;
    z-index: 10;
    width: min(24rem, calc(100vw - 2rem));
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background-color: #1a1a1a;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    text-align: left;
  }

  .eval-panel-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .eval-findings {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    max-height: min(50vh, 18rem);
    overflow-y: auto;
    font-size: 0.8rem;
    text-align: left;
  }

  .eval-findings li {
    padding: 0.25rem 0;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
  }

  .eval-findings .polarity {
    color: #3f9d46;
  }

  .eval-findings .polarity.concern {
    color: #e0a030;
  }

  .eval-findings .signal {
    font-weight: 600;
  }

  .eval-findings .meta {
    opacity: 0.75;
  }

  .eval-findings .detail {
    display: block;
    opacity: 0.6;
    word-break: break-all;
  }

  .eval-findings .empty {
    opacity: 0.6;
  }

  .toast {
    position: fixed;
    top: 9.5rem;
    left: 1rem;
    background-color: #1a1a1a;
    padding: 0.5rem 1rem;
    border-radius: 8px;
  }

  @media (prefers-color-scheme: light) {
    dialog,
    .toast,
    .eval-panel {
      background-color: #f9f9f9;
    }
  }
</style>
