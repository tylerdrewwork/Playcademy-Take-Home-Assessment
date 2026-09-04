<script lang="ts">
  // Inline speaker glyph for the volume controls. Drawn in markup (not an
  // emoji) so it renders identically on every OS and takes its color from
  // the surrounding text.
  let { level = 'high', size = '1.1em' }: { level?: 'muted' | 'low' | 'high'; size?: string } =
    $props()
</script>

<svg
  class="speaker-icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M4 9.5H7.2L12 5.5V18.5L7.2 14.5H4Z" fill="currentColor" stroke="none" />
  {#if level === 'muted'}
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  {:else}
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
    {#if level === 'high'}
      <path d="M18.3 6.4a8 8 0 0 1 0 11.2" />
    {/if}
  {/if}
</svg>

<style>
  .speaker-icon {
    display: block;
    flex-shrink: 0;
  }
</style>
