<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'

  let inputValue = $state('')

  function handleSubmit(event) {
    event.preventDefault()
    addition1LessonProgress.submitProblemAnswer(inputValue)
    inputValue = ''
  }
</script>

<section>
  <p>Problem {addition1LessonProgress.progress.problems.currentIndex + 1} of {addition1LessonProgress.progress.problems.sequence.length}</p>
  <p>{addition1LessonProgress.currentProblem?.prompt}</p>
  {#if addition1LessonProgress.lastAttempt && !addition1LessonProgress.lastAttempt.correct}
    <p>Not quite — try again.</p>
  {/if}
  <form onsubmit={handleSubmit}>
    <input type="text" inputmode="numeric" required bind:value={inputValue} />
    <button type="submit">Submit</button>
  </form>
</section>
