<script lang="ts">
  import AboutMe from '$lib/components/AboutMe.svelte';
  import Experience from '$lib/components/Experience.svelte';
  import Abilities from '$lib/components/Abilities.svelte';
  import Projects from '$lib/components/Projects.svelte';
  import Contacts from '$lib/components/Contacts.svelte';
</script>

<main class="overlapped">
  <div class="relative mt-[-100px] flex flex-col items-center px-4 pb-5 max-w-[900px] mx-auto">
    <div class="card">
      <AboutMe />
    </div>

    <h1 class="title">Experience</h1>
    <div class="card">
      <Experience />
    </div>

    <h1 class="title">Abilities</h1>
    <div class="card">
      <Abilities />
    </div>

    <h1 class="title">Projects</h1>
    <div class="card">
      <Projects />
    </div>

    <h1 class="title">Contacts</h1>
    <div class="card">
      <Contacts />
    </div>
  </div>
</main>
