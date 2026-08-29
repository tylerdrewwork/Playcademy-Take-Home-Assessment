<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import gsap from 'gsap'
  import GroupsDisplay from './GroupsDisplay.svelte'
  import type { ScreenStep } from '../../lessonContent.js'
  import { playNumberAudio } from '../../../assets/general/numbers/numberAudio.js'

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

  const steps: ScreenStep[] = [
    {
      label: 'i-do-start',
      title: 'Counting one group',
      transcript: "Watch how I count these balloons.",
    },
    {
      label: 'group-1',
      title: 'Counting one group',
      transcript: "Here are some blue balloons. I'll count them: 1, 2.",
    },
    {
      label: 'both-groups',
      title: 'Counting the second group',
      transcript: "Over here are some yellow balloons. I'll count them: 1, 2, 3.",
    },
    {
      label: 'combine',
      title: 'How to Combine Groups',
      transcript: "Now let's put both groups together and count all the balloons: 1, 2, 3, 4, 5. There are 5 balloons in all.",
    },
    {
      label: 'we-do-start',
      title: '',
      transcript: "Now, let's do it together! Touch the balloons as we count them.",
    },
    {
      label: 'we-do-group-1',
      title: '',
      transcript: "Let's count the red balloons together. 1, 2, 3, 4. There are 4 red balloons.",
    },
    {
      label: 'we-do-group-2',
      title: '',
      transcript: "Now let's count the yellow balloons together. 1, 2, 3, 4, 5. There are 5 yellow balloons.",
    },
    {
      label: 'we-do-group-combined',
      title: '',
      transcript: "Now let's put both groups together and count all the balloons: 1, 2, 3, 4, 5, 6, 7, 8, 9. There are 9 balloons!",
    },
    {
      label: 'problems-pre-transition',
      title: '',
      transcript: "Now, you try.",
    },
  ]

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

  // 'counting' plays a clip-and-reveal sequence (started automatically,
  // with no "Count them!" gate — the student watches, they don't trigger
  // it); 'done' shows the Next/finish button; 'transitioning' (fade +
  // merge) shows no button while GSAP animates; 'narrating' shows no
  // button either — the step auto-advances on a timer.
  let phase = $state<'counting' | 'done' | 'transitioning' | 'narrating'>('narrating')
  let countAudio: HTMLAudioElement | undefined

  // The 'i-do-start' and 'we-do-start' steps are narration-only: the
  // student watches rather than acts, so they auto-advance once the
  // transcript has had time to be read instead of waiting for a click.
  const AUTO_ADVANCE_LABELS = new Set(['i-do-start', 'we-do-start'])

  // No voice-over audio exists yet for these full-sentence transcripts
  // (unlike the per-number clips used while counting), so approximate a
  // comfortable reading pace until real narration audio is recorded.
  function estimateNarrationMs(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length
    const WORDS_PER_MINUTE = 150
    return Math.max(1200, (words / WORDS_PER_MINUTE) * 60_000)
  }

  $effect(() => {
    if (!AUTO_ADVANCE_LABELS.has(current.label)) return
    const timer = setTimeout(next, estimateNarrationMs(current.transcript))
    return () => clearTimeout(timer)
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

  onMount(() => {
    ctx = gsap.context(() => {
      const groupsRow = containerEl.querySelector('.groups-row')
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

  async function next() {
    if (stepIndex >= steps.length - 1) {
      onComplete()
      return
    }

    const leavingLabel = current.label

    if (leavingLabel === 'i-do-start' || leavingLabel === 'we-do-start') {
      // Advance to the first group and start counting it right away —
      // the student watches, they don't trigger the count themselves.
      stepIndex++
      await countGroup()
      return
    }

    if (leavingLabel === 'group-1' || leavingLabel === 'we-do-group-1') {
      // Reveal group 2, then start counting it automatically.
      phase = 'transitioning'
      stepIndex++
      await tweenToLabel('both-groups')
      await countGroup()
      return
    }

    if (leavingLabel === 'both-groups' || leavingLabel === 'we-do-group-2') {
      // Fade both groups' numbers away, merge the boxes, then recount all
      // balloons in one continuous sequence.
      phase = 'transitioning'
      revealedCounts = [0, 0]
      await wait(NUMBER_FADE_MS)
      stepIndex++
      await tweenToLabel('combine')
      await recountCombined()
      return
    }

    if (leavingLabel === 'combine') {
      // Fade the merged numbers, unmerge the boxes back to the resting
      // state, then swap in the "we do" amounts for the guided-practice
      // pass through the same sequence.
      phase = 'transitioning'
      revealedCounts = [0, 0]
      await wait(NUMBER_FADE_MS)
      stepIndex++
      groups = weDoGroups
      continuousNumbering = false
      await tweenToLabel('group-1')
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

  <GroupsDisplay {groups} {revealedCounts} {continuousNumbering} />

  {#if phase === 'done'}
    <button onclick={next}>
      {stepIndex === steps.length - 1 && isLastScreen ? "Got it! Let's Practice!" : 'Next'}
    </button>
  {/if}
</div>

<style>
  h2 {
    margin-top: 0;
  }
</style>
