<script>
  import { addition1LessonProgress } from './lessons/content/addition-1-LessonProgress.js'
  import { addition1EvaluationRecorder } from './lessons/content/addition-1-EvaluationRecorder.js'

  let { onShowSection } = $props()

  let dialog = $state(null)
  let confirming = $state(false)
  let justReset = $state(false)
  let showEvaluationLog = $state(false)
  // Snapshot taken when the dialog opens — a dev tool doesn't need live
  // updates, and the recorder is deliberately not reactive.
  let evaluationFindings = $state([])

  function open() {
    confirming = false
    justReset = false
    showEvaluationLog = false
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
    <div class="eval-log">
      <div class="eval-log-header">
        <span class="jump-label">Evaluation log ({evaluationFindings.length})</span>
        <button onclick={() => (showEvaluationLog = !showEvaluationLog)}>
          {showEvaluationLog ? 'Hide' : 'Show'}
        </button>
      </div>
      {#if showEvaluationLog}
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
      {/if}
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

  .eval-log {
    margin-bottom: 1rem;
  }

  .eval-log-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .eval-findings {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    max-height: 14rem;
    max-width: 28rem;
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
