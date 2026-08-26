<script>
  import heroImage from './assets/hero.svg'

  function handleClick(buttonName) {
    console.log(`${buttonName} clicked`)
  }
</script>

<main>
  <h1>Welcome</h1>

  <p class="intro">
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
    tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
    veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
    commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
    velit esse cillum dolore eu fugiat nulla pariatur.
  </p>

  <img class="hero" src={heroImage} alt="Hero" />

  <div class="button-row">
    <button on:click={() => handleClick('Button One')}>Button One</button>
    <button on:click={() => handleClick('Button Two')}>Button Two</button>
    <button on:click={() => handleClick('Button Three')}>Button Three</button>
  </div>

  <p class="outro">
    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
    deserunt mollit anim id est laborum.
  </p>
</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1rem;
    text-align: center;
  }

  .intro,
  .outro {
    line-height: 1.6;
    text-align: left;
  }

  .hero {
    width: 100%;
    height: auto;
    border-radius: 12px;
    margin: 1.5rem 0;
  }

  .button-row {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
</style>
