<script>
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'
  import { addition1Content } from './content/addition-1-Content.js'
  import Balloon from './Balloon.svelte'

  let step = $derived(
    addition1Content.instruction.steps[lessonProgress.progress.instruction.currentStepIndex]
  )
  let isLastStep = $derived(
    lessonProgress.progress.instruction.currentStepIndex ===
      addition1Content.instruction.steps.length - 1
  )

  let ctx

  function animateCombine(node) {
    ctx = gsap.context(() => {
      if (!step.showCombined) return

      const groupsRow = node.querySelector('.groups-row')
      const operator = node.querySelector('.operator')
      const boxes = node.querySelectorAll('.group-box')
      if (!groupsRow || boxes.length < 2) return

      const operatorWidth = operator.offsetWidth
      gsap.set(operator, { width: operatorWidth, overflow: 'hidden' })

      const headers = node.querySelectorAll('.group-box h3')

      const tl = gsap.timeline({ delay: 0.4 })
      tl.to(operator, {
        width: 0,
        opacity: 0,
        marginLeft: 0,
        marginRight: 0,
        duration: 0.4,
        ease: 'power1.in',
      }).to(
        groupsRow,
        {
          gap: '0px',
          duration: 0.5,
          ease: 'power2.inOut',
        },
        '<'
      ).to(
        boxes[0],
        { paddingRight: '0.25rem', duration: 0.5, ease: 'power2.inOut' },
        '<'
      ).to(
        boxes[1],
        { paddingLeft: '0.25rem', duration: 0.5, ease: 'power2.inOut' },
        '<'
      ).to(
        headers,
        { opacity: 0, height: 0, marginBottom: 0, duration: 0.3, ease: 'power1.in' },
        '<'
      ).set(boxes[0], {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderRight: 'none',
      }).set(boxes[1], {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderLeft: 'none',
      })
    }, node)
  }

  onDestroy(() => {
    ctx?.revert()
  })
</script>

{#if step}
  {#key step.id}
    <div class="lesson-card" use:animateCombine>
      <h2>{step.title}</h2>
      <p>{step.body}</p>

      {#if step.groups}
        <div class="groups-row">
          {#each step.groups as group, i}
            {#if i > 0}<span class="operator">+</span>{/if}
            <div class="group-box">
              <h3>Group {i + 1}</h3>
              <div class="balloon-row">
                {#each Array.from({ length: group.count }) as _}
                  <Balloon color={group.color} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <button onclick={() => lessonProgress.advanceInstructionStep()}>
        {isLastStep ? "Got it! Let's Practice!" : 'Next'}
      </button>
    </div>
  {/key}
{/if}

<style>
  .lesson-card {
    max-width: 40rem;
    margin: 2rem auto;
    padding: 2rem;
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  h2 {
    margin-top: 0;
  }

  .groups-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin: 1.5rem 0;
    flex-wrap: wrap;
  }

  .operator {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .group-box {
    border: 2px dashed #a9c9e8;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    background: light-dark(#eaf3fc, #16233a);
  }

  .group-box h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .balloon-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
</style>
