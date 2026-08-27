<script>
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'

  let inputValue = $state('')

  function handleSubmit(event) {
    event.preventDefault()
    lessonProgress.submitProblemAnswer(inputValue)
    inputValue = ''
  }
</script>

<section>
  <p>Problem {lessonProgress.progress.problems.currentIndex + 1} of {lessonProgress.progress.problems.sequence.length}</p>
  <p>{lessonProgress.currentProblem?.prompt}</p>
  <form onsubmit={handleSubmit}>
    <input type="text" inputmode="numeric" bind:value={inputValue} />
    <button type="submit">Submit</button>
  </form>
</section>
