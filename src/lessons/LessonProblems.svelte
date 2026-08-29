<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import GroupsDisplay from './content/addition-1-screens/GroupsDisplay.svelte'

  let inputValue = $state('')

  // Presentation-only: problems store {count, object} with no color, so
  // alternate the same blue/yellow the lesson's balloons use.
  const GROUP_COLORS = ['blue', 'yellow']

  let problem = $derived(addition1LessonProgress.currentProblem)
  let displayGroups = $derived(
    (problem?.groups ?? []).map((group, i) => ({
      ...group,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }))
  )

  function handleSubmit(event) {
    event.preventDefault()
    addition1LessonProgress.submitProblemAnswer(inputValue)
    inputValue = ''
  }
</script>

<section class="problems">
  <p class="problem-counter">
    Problem {addition1LessonProgress.progress.problems.currentIndex + 1} of {addition1LessonProgress.progress.problems.sequence.length}
  </p>

  <div class="problem-card">
    <p class="prompt">{problem?.prompt}</p>

    <GroupsDisplay groups={displayGroups} />

    <button type="button" class="push-together">Push them together</button>

    {#if addition1LessonProgress.lastAttempt && !addition1LessonProgress.lastAttempt.correct}
      <p class="feedback">Not quite — try again.</p>
    {/if}

    <form class="answer-row" onsubmit={handleSubmit}>
      <input
        type="text"
        inputmode="numeric"
        required
        placeholder="?"
        aria-label="Your answer"
        bind:value={inputValue}
      />
      <button type="submit" class="submit">Submit</button>
    </form>
  </div>
</section>

<style>
  .problems {
    padding: 0 1rem;
  }

  .problem-counter {
    text-align: center;
    color: light-dark(#6b7280, #9ca3af);
    margin: 2rem 0 1rem;
  }

  /* Same card treatment as the lesson's .lesson-card, minus the fixed
     height — problem content varies with balloon count, so the card is
     allowed to size to its content. */
  .problem-card {
    box-sizing: border-box;
    max-width: 40rem;
    margin: 0 auto 2rem;
    padding: 2rem;
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  .prompt {
    font-size: clamp(1.2rem, 4vw, 1.5rem);
    font-weight: 700;
    line-height: 1.4;
    margin: 0 0 0.5rem;
  }

  .push-together {
    background-color: #3f9d46;
    color: #ffffff;
    font-weight: 600;
  }

  .push-together:hover {
    border-color: #2e7d33;
  }

  .feedback {
    color: light-dark(#c0392b, #ff8a80);
    margin: 1rem 0 0;
  }

  .answer-row {
    display: flex;
    justify-content: center;
    align-items: stretch;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .answer-row input {
    box-sizing: border-box;
    width: 4.5rem;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 700;
    font-family: inherit;
    border: 1px solid light-dark(#d1d5db, #4b5563);
    border-radius: 8px;
    background: light-dark(#ffffff, #2a2a2a);
    color: inherit;
  }

  .submit {
    background-color: #4a90d9;
    color: #ffffff;
    font-weight: 600;
    font-size: 1.1em;
    padding: 0.6em 1.6em;
  }

  .submit:hover {
    border-color: #2f6cb0;
  }
</style>
