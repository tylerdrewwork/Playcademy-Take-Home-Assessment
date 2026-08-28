<script>
  import { fade } from 'svelte/transition'

  let { color = 'blue', number = undefined } = $props()

  const fills = {
    blue: { body: '#4a90d9', highlight: '#8fc1f0' },
    yellow: { body: '#f0b429', highlight: '#f8d878' },
  }

  let fill = $derived(fills[color] ?? fills.blue)
</script>

<svg class="balloon" viewBox="0 0 40 56" aria-hidden="true">
  <ellipse cx="20" cy="22" rx="18" ry="20" fill={fill.body} />
  <ellipse cx="14" cy="14" rx="6" ry="8" fill={fill.highlight} opacity="0.7" />
  <path d="M17 41 L20 47 L23 41 Z" fill={fill.body} />
  <line x1="20" y1="47" x2="20" y2="56" stroke="#999" stroke-width="1" />
  {#if number !== undefined}
    <text x="20" y="27" text-anchor="middle" class="number" out:fade={{ duration: 400 }}>{number}</text>
  {/if}
</svg>

<style>
  .balloon {
    width: 2.5rem;
    height: 3.5rem;
    display: block;
  }

  .number {
    font-size: 1.1rem;
    font-weight: bold;
    fill: #ffffff;
    stroke: #00000055;
    stroke-width: 0.5px;
  }
</style>
