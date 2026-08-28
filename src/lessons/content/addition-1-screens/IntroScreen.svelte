<script>
  let { onComplete, isLastScreen } = $props()
</script>

<h2>Meet the balloons</h2>
<p>Today we are going to combine two groups of balloons and count how many there are in all.</p>

<button onclick={onComplete}>
  {isLastScreen ? "Got it! Let's Practice!" : 'Next'}
</button>

<style>
  h2 {
    margin-top: 0;
  }
</style>
