<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import gsap from 'gsap'
  import GroupsDisplay from './GroupsDisplay.svelte'
  import { playNumberAudio } from '../../../assets/general/numbers/numberAudio.js'
  import { playTranscriptAudio } from '../../../assets/lesson/addition-1/transcripts/transcriptAudio.js'
  import { countingCombiningSteps as steps } from './countingCombiningSteps.js'
  import { currentInstructionStep } from '../../currentInstructionStep.svelte.js'

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

  $effect(() => {
    currentInstructionStep.step = current
    return () => {
      currentInstructionStep.step = null
    }
  })

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

  // 'counting' is the count itself: on the "I do" steps a clip-and-reveal
  // sequence that plays automatically (the student watches), on the "we
  // do" steps a wait for the student to touch each balloon in order (each
  // touch reveals and speaks that balloon's number); 'transitioning' (fade
  // + merge) shows no button while GSAP animates; 'narrating' plays the
  // step's voice-over clip before any counting starts; 'done' is the pause
  // after a count finishes. Narration ending (or its fallback timer) and
  // the 'done' timer advance the flow, except on the last step, which
  // waits for the student to click through into practice.
  let phase = $state<'counting' | 'done' | 'transitioning' | 'narrating'>('narrating')
  let countAudio: HTMLAudioElement | undefined
  let narrationAudio: HTMLAudioElement | undefined

  // ----- "We do": the student touches the balloons in order -----

  type BalloonRef = { groupIndex: number; localIndex: number }
  type CountTarget = BalloonRef & { number: number }

  // The balloons still to be touched for the current "we do" count, in
  // order; the head is the one the student must touch next. Empty (and
  // `expected` null) whenever no touch is expected — including throughout
  // the "I do" pass, whose balloons aren't tappable at all.
  let clickQueue: CountTarget[] = []
  let expected = $state<CountTarget | null>(null)

  // Whether the next-balloon cue (a pointing hand + "Touch this balloon"
  // under the expected balloon) is showing. It's held back for a beat
  // after each correct touch so the student gets a first try at picking
  // the next balloon on their own; it appears if they stall or touch the
  // wrong balloon, and clears on the next correct touch.
  let hintVisible = $state(false)
  const HINT_IDLE_MS = 5000
  const HINT_TEXT = 'Touch this balloon to count it!'

  // The balloon most recently touched out of order, with a key that bumps
  // on every wrong touch so repeated taps on the same balloon each wiggle.
  let shakeBalloon = $state<(BalloonRef & { key: number }) | null>(null)

  let isWeDoCount = $derived(
    phase === 'counting' &&
      (current.label === 'we-do-group-1' || current.label === 'we-do-group-2' || current.label === 'we-do-group-combined')
  )

  $effect(() => {
    if (!expected) {
      hintVisible = false
      return
    }
    hintVisible = false
    const timer = setTimeout(() => {
      hintVisible = true
    }, HINT_IDLE_MS)
    return () => clearTimeout(timer)
  })

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

  // What a step does once its narration finishes: "I do" counting steps
  // play their count, "we do" counting steps hand the count to the
  // student, the combined steps do the same across both groups, and
  // pure-narration steps just move on.
  function afterNarration() {
    const label = current.label
    if (label === 'group-1' || label === 'both-groups') {
      countGroup()
    } else if (label === 'combine') {
      recountCombined()
    } else if (label === 'we-do-group-1' || label === 'we-do-group-2') {
      const groupIndex = groupIndexForStep(label)
      startStudentCount(groupTargets(groupIndex, 0))
    } else if (label === 'we-do-group-combined') {
      continuousNumbering = true
      revealedCounts = [0, 0]
      let offset = 0
      const targets: CountTarget[] = []
      for (let gi = 0; gi < groups.length; gi++) {
        targets.push(...groupTargets(gi, offset))
        offset += groups[gi].count
      }
      startStudentCount(targets)
    } else {
      next()
    }
  }

  // One touch target per balloon in a group, numbered from offset + 1.
  function groupTargets(groupIndex: number, offset: number): CountTarget[] {
    return Array.from({ length: groups[groupIndex].count }, (_, j) => ({
      groupIndex,
      localIndex: j,
      number: offset + j + 1,
    }))
  }

  function startStudentCount(targets: CountTarget[]) {
    shakeBalloon = null
    clickQueue = targets
    expected = targets[0] ?? null
    phase = 'counting'
  }

  // The number a balloon currently shows, or undefined if it's unnumbered.
  function shownNumber(groupIndex: number, localIndex: number): number | undefined {
    if (localIndex >= revealedCounts[groupIndex]) return undefined
    let offset = 0
    if (continuousNumbering) {
      for (let k = 0; k < groupIndex; k++) offset += groups[k].count
    }
    return offset + localIndex + 1
  }

  // Student touched a balloon during a "we do" count. The expected balloon
  // gets its number and clip, exactly as the automatic count would have
  // given it. Any other balloon is a miss: an already-numbered one
  // re-speaks its number (a harmless way to hear it again), an unnumbered
  // one wiggles "no", and either way the cue points out the balloon they
  // should touch — the point of the exercise is touching them in order.
  async function onBalloonClick(groupIndex: number, localIndex: number) {
    if (!isWeDoCount || !expected) return

    if (groupIndex === expected.groupIndex && localIndex === expected.localIndex) {
      const target = expected
      clickQueue = clickQueue.slice(1)
      expected = clickQueue[0] ?? null
      revealedCounts[groupIndex] = localIndex + 1
      countAudio?.pause()
      const { audio, played } = playNumberAudio(target.number)
      countAudio = audio
      if (expected) return
      // Last balloon: let its number finish before moving on.
      await played
      if (phase === 'counting') phase = 'done'
      return
    }

    hintVisible = true
    const already = shownNumber(groupIndex, localIndex)
    if (already !== undefined) {
      countAudio?.pause()
      countAudio = playNumberAudio(already).audio
      return
    }

    shakeBalloon = { groupIndex, localIndex, key: (shakeBalloon?.key ?? 0) + 1 }
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
        // The box needed overflow: hidden while collapsed so its balloons
        // didn't spill out of a zero-width box; once it's open that would
        // clip the "touch this balloon" callout hanging below the balloons,
        // so lift it just before the reveal lands. Being inside the
        // timeline, it's undone again when the "we do" handoff seeks back
        // to 'group-1' and re-collapses the box.
        .set(boxes[1], { overflow: 'visible' }, '-=0.05')
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
  <p class="lesson-transcript">{current.transcript}</p>

  <GroupsDisplay
    {groups}
    {revealedCounts}
    {continuousNumbering}
    instant={hideNumbersInstantly}
    onBalloonClick={isWeDoCount ? onBalloonClick : undefined}
    hintBalloon={hintVisible && expected ? { ...expected, text: HINT_TEXT } : null}
    {shakeBalloon}
  />

  {#if phase === 'done' && stepIndex === steps.length - 1}
    <button class="btn-primary" onclick={next}>
      {isLastScreen ? "Got it! Let's Practice!" : 'Next'}
    </button>
  {/if}
</div>
