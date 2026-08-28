<script>
  import { onMount, onDestroy } from 'svelte'
  import gsap from 'gsap'
  import GroupsDisplay from './GroupsDisplay.svelte'

  let { onComplete, isLastScreen } = $props()

  const groups = [
    { count: 2, color: 'blue' },
    { count: 3, color: 'yellow' },
  ]

  const steps = [
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

  let containerEl
  let tl
  let ctx

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
  })

  function next() {
    if (stepIndex >= steps.length - 1) {
      onComplete()
      return
    }
    stepIndex += 1
    tl?.tweenTo(steps[stepIndex].label)
  }
</script>

<div bind:this={containerEl}>
  <h2>{current.title}</h2>
  <p>{current.transcript}</p>

  <GroupsDisplay {groups} />

  <button onclick={next}>
    {stepIndex === steps.length - 1 && isLastScreen ? "Got it! Let's Practice!" : 'Next'}
  </button>
</div>

<style>
  h2 {
    margin-top: 0;
  }
</style>
