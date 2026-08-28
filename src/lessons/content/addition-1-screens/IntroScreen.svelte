<script>
  import { onDestroy } from 'svelte'
  import introVoUrl from '../../../assets/lesson/addition-1/intro-1-vo.wav'

  let { onComplete, isLastScreen } = $props()

  // 'begin' -> 'playing' (voice-over) -> 'done' (Next button shown)
  let step = $state('begin')
  let audio

  function begin() {
    step = 'playing'
    audio = new Audio(introVoUrl)
    audio.addEventListener('ended', () => {
      step = 'done'
    })
    // If the clip fails to load or play, don't leave the student stuck
    // with no button — reveal Next anyway.
    audio.addEventListener('error', () => {
      step = 'done'
    })
    audio.play().catch(() => {
      step = 'done'
    })
  }

  onDestroy(() => {
    audio?.pause()
    audio = undefined
  })
</script>

<h2>Meet the balloons</h2>
<p>Today we are going to combine two groups of balloons and count how many there are in all.</p>

{#if step === 'begin'}
  <button class="primary" onclick={begin}>Begin</button>
{:else if step === 'done'}
  <button class="primary" onclick={onComplete}>
    {isLastScreen ? "Got it! Let's Practice!" : 'Next'}
  </button>
{/if}

<style>
  h2 {
    margin-top: 0;
  }

  button.primary {
    background-color: #1f9d4d;
    color: #ffffff;
  }

  button.primary:hover {
    border-color: transparent;
    background-color: #178a41;
  }
</style>
