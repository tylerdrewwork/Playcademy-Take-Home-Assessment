<script>
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'
</script>

<section>
  <h2>Lesson complete!</h2>
  <p>Multiplayer unlocked: {lessonProgress.isMultiplayerUnlocked}</p>
  <button onclick={() => lessonProgress.resetProgress()}>Reset progress</button>
</section>
