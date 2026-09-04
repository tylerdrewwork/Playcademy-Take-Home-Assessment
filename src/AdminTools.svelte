<script>
  import { fade } from 'svelte/transition'
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
  <p class="toast" transition:fade={{ duration: 200 }}>Progress reset</p>
{/if}

<style>
  /* Everything in this file is dev tooling, so it uses the --color-dev-*
     slate palette and a monospace label style: deliberately distinct from
     the student-facing lesson chrome. */

  /* Low-key trigger: it's always on screen next to the lesson, so it should
     read as a utility, not a call to action. */
  .admin-tools-trigger {
    padding: 0.5em 0.95em;
    border-color: transparent;
    border-radius: var(--radius-pill);
    background-color: rgba(31, 41, 55, 0.82);
    color: var(--color-dev-fg);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .admin-tools-trigger:hover {
    background-color: var(--color-dev-bg);
  }

  dialog {
    min-width: min(26rem, calc(100vw - 2rem));
    padding: var(--space-5);
    border: 1px solid var(--color-dev-border);
    border-radius: var(--radius-md);
    background-color: var(--color-dev-bg);
    color: var(--color-dev-fg);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-lg);
  }

  dialog[open] {
    animation: dialog-in var(--duration-base) var(--ease-out);
  }

  dialog::backdrop {
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  dialog[open]::backdrop {
    animation: backdrop-in var(--duration-base) var(--ease-out);
  }

  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  dialog h2 {
    margin: 0 0 var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-dev-fg-muted);
  }

  dialog p {
    margin: 0 0 var(--space-4);
  }

  /* Buttons inside the dialog take the slate treatment too, instead of the
     default white lesson button. */
  dialog button {
    padding: 0.5em 0.9em;
    border-color: var(--color-dev-border);
    background-color: var(--color-dev-bg-soft);
    color: var(--color-dev-fg);
    font-size: var(--text-sm);
    box-shadow: none;
  }

  dialog button:hover {
    background-color: var(--color-dev-bg-raised);
    box-shadow: none;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .separated-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-dev-border);
  }

  .jump-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .jump-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-dev-fg-muted);
  }

  .eval-log {
    margin-bottom: var(--space-4);
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    cursor: pointer;
    text-align: left;
  }

  .setting-hint {
    color: var(--color-dev-fg-muted);
    font-size: 0.9em;
  }

  .eval-log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  /* Rolling on-screen log, pinned directly under the Admin Tools trigger. */
  .eval-panel {
    position: fixed;
    top: 3.75rem;
    left: var(--space-4);
    z-index: 10;
    width: min(24rem, calc(100vw - 2rem));
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-dev-border);
    border-radius: var(--radius-md);
    background-color: var(--color-dev-bg);
    color: var(--color-dev-fg);
    box-shadow: var(--shadow-lg);
    text-align: left;
  }

  .eval-panel-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-dev-fg-muted);
  }

  .eval-findings {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    max-height: min(50vh, 18rem);
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.45;
    text-align: left;
  }

  .eval-findings li {
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--color-dev-border);
  }

  .eval-findings .polarity {
    color: var(--color-success-on-dark);
  }

  .eval-findings .polarity.concern {
    color: var(--color-warning);
  }

  .eval-findings .signal {
    font-weight: 700;
  }

  .eval-findings .meta {
    color: var(--color-dev-fg-muted);
  }

  .eval-findings .detail {
    display: block;
    color: var(--color-dev-fg-muted);
    word-break: break-all;
  }

  .eval-findings .empty {
    color: var(--color-dev-fg-muted);
  }

  .toast {
    position: fixed;
    top: 3.75rem;
    left: var(--space-4);
    z-index: 10;
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-dev-border);
    border-radius: var(--radius-pill);
    background-color: var(--color-dev-bg);
    color: var(--color-dev-fg);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-md);
  }
</style>
