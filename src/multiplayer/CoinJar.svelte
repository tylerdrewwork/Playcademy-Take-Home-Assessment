<script lang="ts">
  import coinJarScreen from '../assets/multiplayer/coinjar_screen.webp'

  let { text }: { text: string } = $props()

  // Natural (unscaled) size of the LED box and its text, in px. Svelte's
  // bind:clientWidth/clientHeight re-measure on resize, so these stay
  // current as the jar is resized or `text` grows/shrinks in digit count.
  let boxWidth = $state(0)
  let boxHeight = $state(0)
  let textWidth = $state(0)
  let textHeight = $state(0)

  // Shrinks the LED text just enough to fit inside the display box in both
  // dimensions — never scales up past 1, so short text isn't blown up
  // beyond its natural size. `.led-box`'s own overflow:hidden is the hard
  // guarantee against exceeding the bounds; this keeps it looking right.
  let scale = $derived(
    textWidth && textHeight ? Math.min(1, boxWidth / textWidth, boxHeight / textHeight) : 1,
  )
</script>

<div class="jar">
  <img src={coinJarScreen} alt="" aria-hidden="true" />

  <!--
    The LED panel's position/size below is a visual estimate of where the
    dot-matrix screen sits in coinjar_screen.webp (as % of the sprite's own
    box, so it holds regardless of how large the jar is rendered) — a
    placeholder until the jar's on-stage placement and exact screen bounds
    are chosen.
  -->
  <div class="led-box" bind:clientWidth={boxWidth} bind:clientHeight={boxHeight}>
    <span
      class="led-text"
      bind:clientWidth={textWidth}
      bind:clientHeight={textHeight}
      style:transform="scale({scale})">{text}</span
    >
  </div>
</div>

<style>
  /* aspect-ratio matches coinjar_screen.webp's native 1024x1536 pixels, so
     the percentages below map 1:1 onto the source art no matter how wide
     the jar is rendered. */
  .jar {
    position: relative;
    width: 100%;
    aspect-ratio: 1024 / 1536;
  }

  .jar img {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
    user-select: none;
  }

  .led-box {
    position: absolute;
    left: 9%;
    top: 43.5%;
    width: 53%;
    height: 7.5%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    container-type: size;
  }

  .led-text {
    display: inline-block;
    white-space: nowrap;
    font-family: 'Courier New', monospace;
    font-weight: 700;
    letter-spacing: 0.05em;
    /* Sized relative to the LED box's own rendered height (via container
       query units) rather than the viewport, so it tracks the box even
       though the box's pixel size depends on how large the jar itself is
       drawn on stage. The scale transform above still does the final
       fit-to-width/height clamp on top of this. */
    font-size: 60cqh;
    color: #5cff7a;
    text-shadow: 0 0 0.15em currentColor;
  }
</style>
