<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
</script>

<section>
  <h2>Lesson complete!</h2>
  <p>Multiplayer unlocked: {addition1LessonProgress.isMultiplayerUnlocked}</p>
  <button onclick={() => addition1LessonProgress.resetProgress()}>Reset progress</button>
</section>
