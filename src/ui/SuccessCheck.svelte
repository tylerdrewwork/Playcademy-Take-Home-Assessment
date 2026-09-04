<!--
  The green circle-and-checkmark shown for a correct answer and on the lesson
  complete screen. Size it from the parent with the --check-size custom
  property (defaults to 6rem) rather than a class, since Svelte's scoped
  styles can't reach into a child component.
-->
<svg class="success-check" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="var(--color-success)" />
  <path
    d="M18 33 L28 43 L45 24"
    stroke="#ffffff"
    stroke-width="7"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

<style>
  .success-check {
    width: var(--check-size, 6rem);
    height: auto;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
  }
</style>
