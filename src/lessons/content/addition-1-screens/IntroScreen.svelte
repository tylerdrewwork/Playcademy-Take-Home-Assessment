<script lang="ts">
  import { onDestroy } from 'svelte'
  import introVoUrl from '../../../assets/lesson/addition-1/intro-1-vo.wav'
  import { playTranscriptAudio } from '../../../assets/lesson/addition-1/transcripts/transcriptAudio.js'
  import { voiceVolume } from '../../../voiceVolumeSingleton.js'
  import { introSteps as steps } from './introSteps.js'
  import { currentInstructionStep } from '../../currentInstructionStep.svelte.js'

  let { onComplete }: { onComplete: () => void } = $props()

  let stepIndex = $state(0)
  let current = $derived(steps[stepIndex])

  $effect(() => {
    currentInstructionStep.step = current
    return () => {
      currentInstructionStep.step = null
    }
  })

  // 'begin' -> 'playing' (voice-over), then straight through to onComplete —
  // no Next button in between, the narration itself gates progression.
  let phase = $state<'begin' | 'playing'>('begin')
  let audio: HTMLAudioElement | undefined

  function begin() {
    phase = 'playing'
    // Prefer the generated narration clip for this step; fall back to the
    // original hand-recorded intro VO until `begin.wav` has been generated.
    // Either way a load/playback failure still moves the student on rather
    // than leaving them stuck (playTranscriptAudio resolves `played` on
    // error too).
    const handle = playTranscriptAudio(current.label)
    if (handle) {
      audio = handle.audio
      handle.played.then(onComplete)
      return
    }
    audio = new Audio(introVoUrl)
    voiceVolume.registerAudio(audio)
    audio.addEventListener('ended', onComplete)
    audio.addEventListener('error', onComplete)
    audio.play().catch(onComplete)
  }

  onDestroy(() => {
    audio?.pause()
    audio = undefined
  })
</script>

{#if phase === 'begin'}
  <button class="btn-primary btn-hero" onclick={begin}>Begin</button>
{:else}
  <p class="lesson-transcript">{current.transcript}</p>
{/if}
