<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import gsap from 'gsap'
  import GroupsDisplay from './GroupsDisplay.svelte'
  import { playNumberAudio } from '../../../assets/general/numbers/numberAudio.js'
  import { playTranscriptAudio } from '../../../assets/lesson/addition-1/transcripts/transcriptAudio.js'
  import { countingCombiningSteps as steps } from './countingCombiningSteps.js'

  let {
    onComplete,
    isLastScreen,
  }: { onComplete: () => void; isLastScreen: boolean } = $props()

  const iDoGroups: { count: number; color: string }[] = [
    { count: 2, color: 'blue' },
    { count: 3, color: 'yellow' },
  ]

  // "We do" mirrors the "I do" sequence with new amounts so the student
  // sees the same counting/combining process modeled a second time before
  // trying it solo.
  const weDoGroups: { count: number; color: string }[] = [
    { count: 4, color: 'blue' },
    { count: 5, color: 'yellow' },
  ]

  // The active pair of groups shown in the boxes. Swapped from iDoGroups to
  // weDoGroups when the "combine" step hands off to the "we do" stage — the
  // GSAP timeline's boxes are reused as-is for both passes.
  let groups = $state(iDoGroups)

  // Which internal step the student is on. GSAP only reacts to this via
  // tweenTo() in next() — the timeline is never the source of truth.
  let stepIndex = $state(0)
  let current = $derived(steps[stepIndex])

  // Must match Balloon.svelte's out:fade duration so the merge animation
  // doesn't start until the faded numbers have actually finished fading.
  const NUMBER_FADE_MS = 400

  // Numbers revealed per group as each one is counted. While counting a
  // single group, numbering restarts at 1 (continuousNumbering: false);
  // for the final recount of the merged set it runs 1-5 (or 1-9 for the
  // "we do" pass) across both groups (continuousNumbering: true).
  let revealedCounts = $state([0, 0])
  let continuousNumbering = $state(false)

  // True only while a whole group is being faded/reset as a unit (the
  // combine -> we-do-start handoff) — the numbers should vanish with the
  // group, not fade on their own on top of it.
  let hideNumbersInstantly = $state(false)

  // 'counting' plays a clip-and-reveal sequence (started automatically,
  // with no "Count them!" gate — the student watches, they don't trigger
  // it); 'transitioning' (fade + merge) shows no button while GSAP
  // animates; 'narrating' plays the step's voice-over clip before any
  // counting starts; 'done' is the pause after a count finishes. The whole
  // demo plays itself — narration ending (or its fallback timer) and the
  // 'done' timer advance the flow, except on the last step, which waits
  // for the student to click through into practice.
  let phase = $state<'counting' | 'done' | 'transitioning' | 'narrating'>('narrating')
  let countAudio: HTMLAudioElement | undefined
  let narrationAudio: HTMLAudioElement | undefined

  // Fallback pacing for steps whose voice-over clip hasn't been generated
  // yet: approximate a comfortable reading pace so the lesson still works
  // without audio.
  function estimateNarrationMs(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length
    const WORDS_PER_MINUTE = 150
    return Math.max(1200, (words / WORDS_PER_MINUTE) * 60_000)
  }

  // A short beat after a count finishes, before moving on — the audio and
  // revealed numbers already conveyed the count, so this doesn't need to
  // be as long as the pre-count narration pause.
  const POST_COUNT_PAUSE_MS = 1200

  // A beat of nothing between a group fading out and the next one fading
  // in, so the two never visually overlap.
  const TRANSITION_PAUSE_MS = 300

  // What a step does once its narration finishes: counting steps start
  // their count, the combined steps recount everything, pure-narration
  // steps just move on.
  function afterNarration() {
    const label = current.label
    if (label === 'group-1' || label === 'both-groups' || label === 'we-do-group-1' || label === 'we-do-group-2') {
      countGroup()
    } else if (label === 'combine' || label === 'we-do-group-combined') {
      recountCombined()
    } else {
      next()
    }
  }

  $effect(() => {
    if (stepIndex === steps.length - 1) {
      // Last step: voice the prompt, but only the button advances.
      const handle = playTranscriptAudio(current.label)
      if (!handle) return
      narrationAudio = handle.audio
      return () => handle.audio.pause()
    }
    if (phase === 'narrating') {
      const handle = playTranscriptAudio(current.label)
      if (handle) {
        narrationAudio = handle.audio
        // `played` resolves on 'ended' and on failure, so the flow always
        // advances; the cancelled flag keeps a superseded narration (step
        // changed, component unmounted) from advancing the flow twice.
        let cancelled = false
        handle.played.then(() => {
          if (!cancelled) afterNarration()
        })
        return () => {
          cancelled = true
          handle.audio.pause()
        }
      }
      const timer = setTimeout(afterNarration, estimateNarrationMs(current.transcript))
      return () => clearTimeout(timer)
    }
    if (phase === 'done') {
      const timer = setTimeout(next, POST_COUNT_PAUSE_MS)
      return () => clearTimeout(timer)
    }
  })

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Both the "I do" and "we do" passes share the same two boxes: box 0 is
  // always counted on the 'group-1'/'we-do-group-1' step, box 1 on
  // 'both-groups'/'we-do-group-2'.
  function groupIndexForStep(label: string): number {
    return label === 'both-groups' || label === 'we-do-group-2' ? 1 : 0
  }

  // Reveals each balloon's number before playing its clip, so the student
  // sees the digit land and then hears it named.
  async function revealAndSpeak(groupIndex: number, count: number, numberAt: (localIndex: number) => number) {
    for (let j = 0; j < count; j++) {
      revealedCounts[groupIndex] = j + 1
      const { audio, played } = playNumberAudio(numberAt(j))
      countAudio = audio
      await played
    }
  }

  async function countGroup() {
    phase = 'counting'
    const groupIndex = groupIndexForStep(current.label)
    await revealAndSpeak(groupIndex, groups[groupIndex].count, (j) => j + 1)
    phase = 'done'
  }

  async function recountCombined() {
    continuousNumbering = true
    revealedCounts = [0, 0]
    phase = 'counting'
    let offset = 0
    for (let gi = 0; gi < groups.length; gi++) {
      const base = offset
      await revealAndSpeak(gi, groups[gi].count, (j) => base + j + 1)
      offset += groups[gi].count
    }
    phase = 'done'
  }

  let containerEl: HTMLDivElement
  let tl: gsap.core.Timeline | undefined
  let ctx: gsap.Context | undefined
  let groupsRow: Element | null = null

  onMount(() => {
    ctx = gsap.context(() => {
      groupsRow = containerEl.querySelector('.groups-row')
      const operator = containerEl.querySelector('.operator')
      const boxes = containerEl.querySelectorAll('.group-box')
      const headers = containerEl.querySelectorAll('.group-box h3')
      if (!groupsRow || boxes.length < 2) return

      // Resting state for the first step: only group 1 is visible. The
      // second group and operator must exist in the DOM from mount so the
      // timeline can target them, so they are hidden rather than unrendered.
      gsap.set(groupsRow, { gap: 0 })
      gsap.set(operator, { width: 0, opacity: 0, overflow: 'hidden' })
      gsap.set(boxes[1], {
        width: 0,
        opacity: 0,
        paddingLeft: 0,
        paddingRight: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        overflow: 'hidden',
      })

      tl = gsap.timeline({ paused: true })
        .addLabel('group-1')
        // Reveal the operator and second group.
        .to(groupsRow, { gap: '1rem', duration: 0.5, ease: 'power2.out' })
        .to(operator, { width: 'auto', opacity: 1, duration: 0.4, ease: 'power1.out' }, '<')
        .to(
          boxes[1],
          {
            width: 'auto',
            opacity: 1,
            paddingLeft: '1.25rem',
            paddingRight: '1.25rem',
            borderLeftWidth: '2px',
            borderRightWidth: '2px',
            duration: 0.5,
            ease: 'power2.out',
          },
          '<'
        )
        .addLabel('both-groups')
        // Merge the two groups into one combined box.
        .to(operator, { width: 0, opacity: 0, duration: 0.4, ease: 'power1.in' })
        .to(groupsRow, { gap: '0px', duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(boxes[0], { paddingRight: '0.25rem', duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(boxes[1], { paddingLeft: '0.25rem', duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(headers, { opacity: 0, height: 0, marginBottom: 0, duration: 0.3, ease: 'power1.in' }, '<')
        .set(boxes[0], {
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          borderRight: 'none',
        })
        .set(boxes[1], {
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: 'none',
        })
        .addLabel('combine')
    }, containerEl)
  })

  onDestroy(() => {
    ctx?.revert()
    countAudio?.pause()
    countAudio = undefined
    narrationAudio?.pause()
    narrationAudio = undefined
  })

  function tweenToLabel(label: string): Promise<void> {
    return new Promise((resolve) => {
      if (!tl) {
        resolve()
        return
      }
      tl.tweenTo(label, { onComplete: resolve })
    })
  }

  function fadeTo(opacity: number): Promise<void> {
    return new Promise((resolve) => {
      if (!groupsRow) {
        resolve()
        return
      }
      gsap.to(groupsRow, { opacity, duration: 0.4, ease: opacity === 0 ? 'power1.in' : 'power1.out', onComplete: resolve })
    })
  }

  async function next() {
    if (stepIndex >= steps.length - 1) {
      onComplete()
      return
    }

    const leavingLabel = current.label

    if (leavingLabel === 'i-do-start' || leavingLabel === 'we-do-start') {
      // Advance to the first group; its narration plays, then counting
      // starts on its own — the student watches, they don't trigger it.
      stepIndex++
      phase = 'narrating'
      return
    }

    if (leavingLabel === 'group-1' || leavingLabel === 'we-do-group-1') {
      // Reveal group 2, narrate it, then counting starts automatically.
      phase = 'transitioning'
      stepIndex++
      await tweenToLabel('both-groups')
      phase = 'narrating'
      return
    }

    if (leavingLabel === 'both-groups' || leavingLabel === 'we-do-group-2') {
      // Fade both groups' numbers away, merge the boxes, narrate, then
      // recount all balloons in one continuous sequence.
      phase = 'transitioning'
      revealedCounts = [0, 0]
      await wait(NUMBER_FADE_MS)
      stepIndex++
      await tweenToLabel('combine')
      phase = 'narrating'
      return
    }

    if (leavingLabel === 'combine') {
      // Drop the numbers immediately (no fade of their own — they leave
      // with the group, not on top of it), fade the whole merged group
      // out, pause on nothing, then fade back in on an empty slate — the
      // new "we do" amounts, nothing revealed yet — rather than
      // reverse-playing the merge animation with the old group's sizing.
      phase = 'transitioning'
      hideNumbersInstantly = true
      revealedCounts = [0, 0]
      await fadeTo(0)
      await wait(TRANSITION_PAUSE_MS)
      stepIndex++
      continuousNumbering = false
      groups = weDoGroups
      tl?.seek('group-1')
      hideNumbersInstantly = false
      await fadeTo(1)
      phase = 'narrating'
      return
    }

    // we-do-group-combined -> problems-pre-transition: no further animation.
    stepIndex++
    phase = 'done'
  }
</script>

<div bind:this={containerEl}>
  <h2>{current.title}</h2>
  <p>{current.transcript}</p>

  <GroupsDisplay {groups} {revealedCounts} {continuousNumbering} instant={hideNumbersInstantly} />

  {#if phase === 'done' && stepIndex === steps.length - 1}
    <button onclick={next}>
      {isLastScreen ? "Got it! Let's Practice!" : 'Next'}
    </button>
  {/if}
</div>

<style>
  h2 {
    margin: 0;
  }

  p {
    /* 4rem on a typically-tall screen, but scaled down on a short viewport
       so a long, wrapped transcript can't push the card past 100dvh — the
       page has no scrollbar to fall back on. Browser default margins on
       both this and h2 are zeroed out; the .lesson-card's own flex `gap`
       handles spacing instead. */
    font-size: clamp(1.5rem, 8vh, 4rem);
    margin: 0;
  }
</style>
