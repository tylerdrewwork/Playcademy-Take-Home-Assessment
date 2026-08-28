<script lang="ts">
  import { onDestroy } from 'svelte'
  import introVoUrl from '../../../assets/lesson/addition-1/intro-1-vo.wav'
  import type { ScreenStep } from '../../lessonContent.js'

  let {
    onComplete,
    isLastScreen,
  }: { onComplete: () => void; isLastScreen: boolean } = $props()

  const steps: ScreenStep[] = [
    {
      label: 'begin',
      title: 'Meet the balloons',
      transcript:
        'Today we are going to combine two groups of balloons and count how many there are in all.',
    },
  ]

  let stepIndex = $state(0)
  let current = $derived(steps[stepIndex])

  // 'begin' -> 'playing' (voice-over) -> 'done' (Next button shown)
  let phase = $state<'begin' | 'playing' | 'done'>('begin')
  let audio: HTMLAudioElement | undefined

  function begin() {
    phase = 'playing'
    audio = new Audio(introVoUrl)
    audio.addEventListener('ended', () => {
      phase = 'done'
    })
    // If the clip fails to load or play, don't leave the student stuck
    // with no button — reveal Next anyway.
    audio.addEventListener('error', () => {
      phase = 'done'
    })
    audio.play().catch(() => {
      phase = 'done'
    })
  }

  onDestroy(() => {
    audio?.pause()
    audio = undefined
  })
</script>

<h2>{current.title}</h2>
<p>{current.transcript}</p>

{#if phase === 'begin'}
  <button class="primary" onclick={begin}>Begin</button>
{:else if phase === 'done'}
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
