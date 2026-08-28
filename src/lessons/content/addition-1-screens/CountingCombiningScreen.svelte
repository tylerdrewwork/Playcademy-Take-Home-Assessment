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

  const groups: { count: number; color: string }[] = [
    { count: 2, color: 'blue' },
    { count: 3, color: 'yellow' },
  ]

  const steps: ScreenStep[] = [
    {
      label: 'group-1',
      title: 'Counting one group',
      transcript: "Here are 2 balloons. Let's count them: 1, 2.",
    },
    {
      label: 'both-groups',
      title: 'Counting the second group',
      transcript: "Here are 3 more balloons. Let's count them: 1, 2, 3.",
    },
    {
      label: 'combine',
      title: 'How to Combine Groups',
      transcript: "Now let's put both groups together and count all the balloons: 1, 2, 3, 4, 5. There are 5 balloons in all.",
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
  // for the final recount of the merged set it runs 1-5 across both
  // groups (continuousNumbering: true).
  let revealedCounts = $state([0, 0])
  let continuousNumbering = $state(false)

  // 'ready' shows the step's "Count them!" gate; 'counting' plays a
  // clip-and-reveal sequence; 'done' shows the Next/finish button;
  // 'transitioning' (fade + merge) shows no button at all.
  let phase = $state<'ready' | 'counting' | 'done' | 'transitioning'>('ready')
  let countAudio: HTMLAudioElement | undefined

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
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
    await revealAndSpeak(stepIndex, groups[stepIndex].count, (j) => j + 1)
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

    if (stepIndex === 0) {
      // Reveal group 2 before letting the student count it.
      phase = 'transitioning'
      stepIndex = 1
      await tweenToLabel(steps[stepIndex].label)
      phase = 'ready'
      return
    }

    // stepIndex === 1: fade both groups' numbers away, merge the boxes,
    // then recount all 5 balloons in one continuous sequence.
    phase = 'transitioning'
    revealedCounts = [0, 0]
    await wait(NUMBER_FADE_MS)
    stepIndex = 2
    await tweenToLabel(steps[stepIndex].label)
    await recountCombined()
  }
</script>

<div bind:this={containerEl}>
  <h2>{current.title}</h2>
  <p>{current.transcript}</p>

  <GroupsDisplay {groups} {revealedCounts} {continuousNumbering} />

  {#if phase === 'ready'}
    <button class="primary" onclick={countGroup}>Count them!</button>
  {:else if phase === 'done'}
    <button onclick={next}>
      {stepIndex === steps.length - 1 && isLastScreen ? "Got it! Let's Practice!" : 'Next'}
    </button>
  {/if}
</div>

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
