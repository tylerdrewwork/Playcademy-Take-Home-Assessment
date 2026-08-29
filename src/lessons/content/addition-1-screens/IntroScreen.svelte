<script lang="ts">
  import { onDestroy } from 'svelte'
  import introVoUrl from '../../../assets/lesson/addition-1/intro-1-vo.wav'
  import type { ScreenStep } from '../../lessonContent.js'

  let { onComplete }: { onComplete: () => void } = $props()

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

  // 'begin' -> 'playing' (voice-over), then straight through to onComplete —
  // no Next button in between, the narration itself gates progression.
  let phase = $state<'begin' | 'playing'>('begin')
  let audio: HTMLAudioElement | undefined

  function begin() {
    phase = 'playing'
    audio = new Audio(introVoUrl)
    audio.addEventListener('ended', onComplete)
    // If the clip fails to load or play, don't leave the student stuck —
    // move on anyway.
    audio.addEventListener('error', onComplete)
    audio.play().catch(onComplete)
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
