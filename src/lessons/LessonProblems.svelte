<script>
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import { addition1EvaluationRecorder } from './content/addition-1-EvaluationRecorder.js'
  import GroupsDisplay from './content/addition-1-screens/GroupsDisplay.svelte'

  let inputValue = $state('')

  // Presentation-only: problems store {count, object} with no color, so
  // alternate the same blue/yellow the lesson's balloons use.
  const GROUP_COLORS = ['blue', 'yellow']

  let problem = $derived(addition1LessonProgress.currentProblem)
  let displayGroups = $derived(
    (problem?.groups ?? []).map((group, i) => ({
      ...group,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }))
  )

  // Which problem's groups have been pushed together. Comparing against the
  // current problem id (rather than a plain boolean) means the button comes
  // back on its own when the student advances to the next question.
  let pushedProblemId = $state(null)
  let pushed = $derived(problem != null && pushedProblemId === problem.id)

  let groupsEl = $state()
  let ctx

  // ----- Answer evaluation (passive data collection; no UI behavior) -----

  // Start/rotate the evaluation episode alongside the visible problem.
  $effect(() => {
    if (problem) addition1EvaluationRecorder.beginProblem(problem)
  })

  // Window-level capture (the "distracted" signal is about wandering
  // anywhere on the screen, not just over the card) plus a heartbeat so
  // behavioral episodes get recorded even if the student never submits.
  $effect(() => {
    const recorder = addition1EvaluationRecorder
    let lastMoveAt = 0

    const evalId = (target) =>
      target instanceof Element
        ? (target.closest('[data-eval-id]')?.dataset.evalId ?? null)
        : null
    const onPointerMove = (event) => {
      const now = Date.now()
      if (now - lastMoveAt < recorder.config.pointerMoveSampleMs) return
      lastMoveAt = now
      recorder.recordEvent({ type: 'pointer-move', x: event.clientX, y: event.clientY })
    }
    const onPointerDown = (event) =>
      recorder.recordEvent({ type: 'pointer-down', target: evalId(event.target) })
    const onKeyDown = (event) =>
      recorder.recordEvent({ type: 'key-down', key: event.key, target: evalId(event.target) })
    const onVisibilityChange = () => {
      recorder.recordEvent({ type: 'visibility', hidden: document.hidden })
      // setInterval is throttled in background tabs, so persist anything
      // pending now rather than waiting for a heartbeat that may not come.
      if (document.hidden) recorder.tick()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const heartbeat = setInterval(() => recorder.tick(), recorder.config.heartbeatMs)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(heartbeat)
    }
  })

  function handleAnswerInput(event) {
    const value = event.currentTarget.value
    addition1EvaluationRecorder.recordEvent({ type: 'input-change', value })
    if (!/^\d*$/.test(value)) {
      addition1EvaluationRecorder.recordEvent({ type: 'nonnumeric-input', value })
    }
  }

  function pushTogether() {
    if (pushed || !groupsEl) return
    // Recorded from the click handler — the interaction source of truth —
    // never from GSAP's animation callbacks.
    addition1EvaluationRecorder.recordEvent({ type: 'action', name: 'push-together' })
    pushedProblemId = problem.id
    ctx = gsap.context(() => {
      const groupsRow = groupsEl.querySelector('.groups-row')
      const operator = groupsEl.querySelector('.operator')
      const boxes = groupsEl.querySelectorAll('.group-box')
      const headers = groupsEl.querySelectorAll('.group-box h3')
      if (!groupsRow || boxes.length < 2) return

      // Same targets and values as the lesson's 'combine' step, so pushing
      // the groups together here reads identically to the demo the student
      // just watched.
      gsap.set(operator, { overflow: 'hidden' })
      gsap.timeline()
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
    }, groupsEl)
  }

  // Kill any in-flight merge when the question changes — the keyed block
  // below swaps out the DOM the timeline is animating.
  $effect(() => {
    problem?.id
    return () => {
      ctx?.revert()
      ctx = undefined
    }
  })

  onDestroy(() => {
    ctx?.revert()
    addition1EvaluationRecorder.endProblem()
  })

  function handleSubmit(event) {
    event.preventDefault()
    const { primaryEvaluationTag } = addition1EvaluationRecorder.recordSubmit(inputValue)
    addition1LessonProgress.submitProblemAnswer(inputValue, primaryEvaluationTag)
    inputValue = ''
  }
</script>

<section class="problems" data-eval-id="problem-area">
  <p class="problem-counter">
    Problem {addition1LessonProgress.progress.problems.currentIndex + 1} of {addition1LessonProgress.progress.problems.sequence.length}
  </p>

  <div class="problem-card">
    <p class="prompt">{problem?.prompt}</p>

    {#key problem?.id}
      <div bind:this={groupsEl}>
        <GroupsDisplay groups={displayGroups} />
      </div>

      {#if !pushed}
        <button type="button" class="push-together" data-eval-id="push-together" onclick={pushTogether}>Push them together</button>
      {/if}
    {/key}

    {#if addition1LessonProgress.lastAttempt && !addition1LessonProgress.lastAttempt.correct}
      <p class="feedback">Not quite — try again.</p>
    {/if}

    <form class="answer-row" onsubmit={handleSubmit}>
      <input
        type="text"
        inputmode="numeric"
        required
        placeholder="?"
        aria-label="Your answer"
        data-eval-id="answer-input"
        bind:value={inputValue}
        oninput={handleAnswerInput}
      />
      <button type="submit" class="submit" data-eval-id="submit">Submit</button>
    </form>
  </div>
</section>

<style>
  .problems {
    padding: 0 1rem;
  }

  .problem-counter {
    text-align: center;
    color: light-dark(#6b7280, #9ca3af);
    margin: 2rem 0 1rem;
  }

  /* Same card treatment as the lesson's .lesson-card, minus the fixed
     height — problem content varies with balloon count, so the card is
     allowed to size to its content. */
  .problem-card {
    box-sizing: border-box;
    max-width: 40rem;
    margin: 0 auto 2rem;
    padding: 2rem;
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  .prompt {
    font-size: clamp(1.2rem, 4vw, 1.5rem);
    font-weight: 700;
    line-height: 1.4;
    margin: 0 0 0.5rem;
  }

  .push-together {
    background-color: #3f9d46;
    color: #ffffff;
    font-weight: 600;
  }

  .push-together:hover {
    border-color: #2e7d33;
  }

  .feedback {
    color: light-dark(#c0392b, #ff8a80);
    margin: 1rem 0 0;
  }

  .answer-row {
    display: flex;
    justify-content: center;
    align-items: stretch;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .answer-row input {
    box-sizing: border-box;
    width: 4.5rem;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 700;
    font-family: inherit;
    border: 1px solid light-dark(#d1d5db, #4b5563);
    border-radius: 8px;
    background: light-dark(#ffffff, #2a2a2a);
    color: inherit;
  }

  .submit {
    background-color: #4a90d9;
    color: #ffffff;
    font-weight: 600;
    font-size: 1.1em;
    padding: 0.6em 1.6em;
  }

  .submit:hover {
    border-color: #2f6cb0;
  }
</style>
