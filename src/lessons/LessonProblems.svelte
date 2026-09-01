<script>
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import { addition1EvaluationRecorder } from './content/addition-1-EvaluationRecorder.js'
  import { celebration } from './celebration.svelte.js'
  import { normalizeAnswer } from './progression.js'
  import GroupsDisplay from './content/addition-1-screens/GroupsDisplay.svelte'

  let inputValue = $state('')

  // Presentation-only: problems store {count, object} with no color, so
  // alternate the same blue/yellow the lesson's balloons use.
  const GROUP_COLORS = ['blue', 'yellow']

  let problem = $derived(addition1LessonProgress.currentProblem)
  // While a correct answer's celebration plays, progression has already
  // advanced — keep rendering the problem that was just answered until the
  // send-off animation finishes.
  let displayProblem = $derived(celebration.problem ?? problem)
  let displayIndex = $derived.by(() => {
    const problems = addition1LessonProgress.progress?.problems
    if (!problems) return 0
    const index = displayProblem ? problems.sequence.indexOf(displayProblem.id) : -1
    return index === -1 ? problems.currentIndex : index
  })
  let displayGroups = $derived(
    (displayProblem?.groups ?? []).map((group, i) => ({
      ...group,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }))
  )

  // Which problem's groups have been pushed together. Comparing against the
  // displayed problem id (rather than a plain boolean) means the button
  // comes back on its own when the student advances to the next question.
  let pushedProblemId = $state(null)
  let pushed = $derived(displayProblem != null && pushedProblemId === displayProblem.id)

  let groupsEl = $state()
  let ctx

  // ----- Answer evaluation (passive data collection; no UI behavior) -----

  // Start/rotate the evaluation episode alongside the visible problem. Held
  // back during a celebration so events keep landing on the just-answered
  // problem's episode, and the next problem's clock starts when the student
  // actually sees it.
  $effect(() => {
    if (problem && !celebration.active) addition1EvaluationRecorder.beginProblem(problem)
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
      recorder.recordEvent({
        type: 'pointer-down',
        x: event.clientX,
        y: event.clientY,
        target: evalId(event.target),
      })
    const onKeyDown = (event) => {
      // A held-down key auto-repeats; only genuine presses count, so a held
      // backspace doesn't read as keyboard mashing.
      if (event.repeat) return
      recorder.recordEvent({ type: 'key-down', key: event.key, target: evalId(event.target) })
    }
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

  let answerInputEl = $state()

  // Pressing a digit anywhere on the problem screen types it into the
  // answer field and focuses it, so the student can just type "5" + Enter
  // without clicking the box first.
  function handleGlobalDigit(event) {
    if (!problem || !answerInputEl || celebration.active) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!/^\d$/.test(event.key)) return
    const target = event.target
    if (target === answerInputEl) return // already typing in the field
    // Leave other editable elements and open dialogs (Admin Tools) alone.
    if (
      target instanceof Element &&
      (target.closest('dialog') || target.matches('input, textarea, select, [contenteditable]'))
    ) {
      return
    }
    event.preventDefault()
    answerInputEl.focus()
    if (inputValue.length >= 2) return // same 2-digit cap as the field itself
    inputValue += event.key
    // bind:value updates don't fire oninput, so mirror what typing into the
    // field would have recorded.
    addition1EvaluationRecorder.recordEvent({ type: 'input-change', value: inputValue })
  }

  function handleAnswerInput(event) {
    const value = event.currentTarget.value
    if (!/^\d*$/.test(value)) {
      addition1EvaluationRecorder.recordEvent({ type: 'nonnumeric-input', value })
      // Strip anything non-digit rather than rejecting the whole keystroke,
      // so e.g. pasting "5a2" still leaves the digits behind.
      inputValue = value.replace(/\D/g, '').slice(0, 2)
    }
    addition1EvaluationRecorder.recordEvent({ type: 'input-change', value: inputValue })
  }

  function pushTogether() {
    if (pushed || !groupsEl || celebration.active) return
    // Recorded from the click handler — the interaction source of truth —
    // never from GSAP's animation callbacks.
    addition1EvaluationRecorder.recordEvent({ type: 'action', name: 'push-together' })
    pushedProblemId = displayProblem.id
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

  // Kill any in-flight merge when the displayed question changes — the
  // keyed block below swaps out the DOM the timeline is animating.
  $effect(() => {
    displayProblem?.id
    return () => {
      ctx?.revert()
      ctx = undefined
    }
  })

  onDestroy(() => {
    ctx?.revert()
    addition1EvaluationRecorder.endProblem()
    // If the screen is torn down mid-celebration (e.g. an admin phase jump),
    // don't leave the shared flag stuck on.
    celebration.end()
  })

  function handleSubmit(event) {
    event.preventDefault()
    if (!problem || celebration.active) return
    const submitted = problem
    const { primaryEvaluationTag } = addition1EvaluationRecorder.recordSubmit(inputValue)
    const correct = normalizeAnswer(inputValue) === normalizeAnswer(submitted.answer)
    // Progression advances right away — progress stays the source of truth
    // (a reload mid-celebration lands on the next problem). The celebration
    // only masks it visually until the send-off finishes.
    addition1LessonProgress.submitProblemAnswer(inputValue, primaryEvaluationTag)
    inputValue = ''
    if (correct) celebration.start(submitted)
  }

  // ----- Correct-answer celebration -----

  const CELEBRATION_S = 1.6
  const SPARK_INTERVAL_MS = 70
  const SPARK_COLORS = ['#ffd166', '#ff9f43', '#f8d878', '#ffffff']

  let successOverlayEl = $state()
  let sparkLayerEl = $state()

  function spawnSpark(balloonEl, rad) {
    if (!sparkLayerEl) return
    const rect = balloonEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // "Behind" is opposite the direction of travel: just past the tail.
    const tailX = cx - Math.sin(rad) * rect.height * 0.6
    const tailY = cy + Math.cos(rad) * rect.height * 0.6
    const spark = document.createElement('span')
    spark.className = 'spark'
    spark.style.left = `${tailX}px`
    spark.style.top = `${tailY}px`
    spark.style.background = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]
    sparkLayerEl.appendChild(spark)
    gsap.to(spark, {
      x: -Math.sin(rad) * 30 + (Math.random() - 0.5) * 24,
      y: Math.cos(rad) * 30 + (Math.random() - 0.5) * 24,
      scale: 0,
      opacity: 0,
      duration: 0.45 + Math.random() * 0.25,
      ease: 'power1.out',
      onComplete: () => spark.remove(),
    })
  }

  $effect(() => {
    if (!celebration.active) return

    const cctx = gsap.context(() => {
      // The clock that ends the celebration lives here (not on any element
      // animation) so the next problem appears even if an element is missing.
      gsap.delayedCall(CELEBRATION_S, () => celebration.end())

      if (successOverlayEl) {
        gsap
          .timeline()
          .fromTo(
            successOverlayEl,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }
          )
          .to(
            successOverlayEl,
            { scale: 1.15, opacity: 0, duration: 0.3, ease: 'power1.in' },
            CELEBRATION_S - 0.3
          )
      }
    })

    // Fly-away physics: each balloon accelerates along its own up vector
    // while spinning, so the path curves as the balloon rotates. Integrated
    // per frame on the shared ticker (gsap.context can't track a ticker
    // callback, so it's removed by hand in the cleanup below).
    const flyers = [...(groupsEl?.querySelectorAll('.balloon') ?? [])].map((el) => ({
      el,
      x: 0,
      y: 0,
      angle: 0,
      spin: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 160), // deg/s
      speed: 320 + Math.random() * 220, // px/s
      sinceSparkMs: Math.random() * SPARK_INTERVAL_MS,
    }))

    const onTick = (_time, deltaMs) => {
      const dt = deltaMs / 1000
      for (const flyer of flyers) {
        flyer.angle += flyer.spin * dt
        const rad = (flyer.angle * Math.PI) / 180
        flyer.x += Math.sin(rad) * flyer.speed * dt
        flyer.y -= Math.cos(rad) * flyer.speed * dt
        gsap.set(flyer.el, { x: flyer.x, y: flyer.y, rotation: flyer.angle })
        flyer.sinceSparkMs += deltaMs
        if (flyer.sinceSparkMs >= SPARK_INTERVAL_MS) {
          flyer.sinceSparkMs = 0
          spawnSpark(flyer.el, rad)
        }
      }
    }
    gsap.ticker.add(onTick)

    return () => {
      gsap.ticker.remove(onTick)
      if (sparkLayerEl) {
        gsap.killTweensOf(sparkLayerEl.children)
        sparkLayerEl.replaceChildren()
      }
      cctx.revert()
      // No need to reset the balloon transforms: the keyed block swaps in
      // the next problem's DOM the moment the celebration ends.
    }
  })
</script>

<svelte:window onkeydown={handleGlobalDigit} />

<section class="problems" data-eval-id="problem-area">
  <p class="problem-counter">
    Problem {displayIndex + 1} of {addition1LessonProgress.progress.problems.sequence.length}
  </p>

  <div class="problem-card">
    <p class="prompt">{displayProblem?.prompt}</p>

    {#key displayProblem?.id}
      <div bind:this={groupsEl}>
        <GroupsDisplay groups={displayGroups} />
      </div>

      {#if !pushed && !celebration.active}
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
        maxlength="2"
        required
        placeholder="?"
        aria-label="Your answer"
        data-eval-id="answer-input"
        disabled={celebration.active}
        bind:this={answerInputEl}
        bind:value={inputValue}
        oninput={handleAnswerInput}
      />
      <button type="submit" class="submit" data-eval-id="submit" disabled={celebration.active}>Submit</button>
    </form>
  </div>
</section>

{#if celebration.active}
  <div class="spark-layer" bind:this={sparkLayerEl} aria-hidden="true"></div>
  <!-- Fixed overlay: floats above the problem area without shifting layout. -->
  <div class="success-overlay" bind:this={successOverlayEl} style="opacity: 0" role="status">
    <svg class="check" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#3f9d46" />
      <path
        d="M18 33 L28 43 L45 24"
        stroke="#ffffff"
        stroke-width="7"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <p>You got it!</p>
  </div>
{/if}

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

  .spark-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 15;
    overflow: hidden;
  }

  /* Sparks are created imperatively during the fly-away, so they need a
     global selector to escape Svelte's style scoping. */
  .spark-layer :global(.spark) {
    position: absolute;
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(255, 200, 80, 0.8);
  }

  .success-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    pointer-events: none;
    z-index: 20;
  }

  .success-overlay .check {
    width: clamp(5rem, 18vw, 8rem);
    height: auto;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
  }

  .success-overlay p {
    margin: 0;
    font-size: clamp(1.8rem, 6vw, 2.6rem);
    font-weight: 800;
    color: #3f9d46;
    text-shadow:
      0 0 2px light-dark(#ffffff, #000000),
      0 2px 8px rgba(0, 0, 0, 0.2);
  }
</style>
