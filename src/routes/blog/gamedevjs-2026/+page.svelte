<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '@iconify/svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';

  const repoUrl = 'https://github.com/EugeneDraitsev/gamedevjs-2026';
  const liveUrl = 'https://gamedevjs-2026-orb-knight.vercel.app/';
  const winnersUrl = 'https://gamedevjs.com/competitions/gamedev-js-jam-2026-winners-announced/';
  const gameplayUrl = 'https://itch.io/jam/gamedevjs-2026/results/gameplay';

  const facts = [
    '12th overall in Gamedev.js Jam 2026',
    '6th in Gameplay on itch.io',
    'Built with SvelteKit, Svelte 5, Threlte, Three.js and Rapier',
    'Game systems, graphics direction, music, UI and gameplay were built through LLM-agent workflows',
    'Used Codex and Claude Code as implementation agents under a fixed jam deadline',
    'Storybook playgrounds supported focused iteration on combat, rooms, UI, player and models',
  ];

  const lessons = [
    {
      title: 'Agents are strongest with tight feedback loops',
      text: 'The useful pattern was not one giant prompt. It was short implementation loops, browser checks, screenshots, playable states and quick corrections.',
    },
    {
      title: 'Unknown domains force better decomposition',
      text: 'Without game development experience, the work had to be split into clear systems: movement, combat, rooms, loadout, physics, camera, UI, audio and progression.',
    },
    {
      title: 'Visual quality needs verification, not vibes',
      text: 'Screenshots, Storybook scenes and repeated playtests mattered because visual regressions and game feel problems are hard to catch from code alone.',
    },
    {
      title: 'The best result was learning velocity',
      text: 'The ranking was nice, but the real result was proving how far a small team can get in a new domain with strong agent workflows and fast taste-driven iteration.',
    },
  ];
</script>

<svelte:head>
  <title>Orb Knight AI-assisted game jam | Eugene Draitsev</title>
  <meta
    name="description"
    content="Project notes on Orb Knight, a Gamedev.js Jam 2026 game built with LLM agents, SvelteKit, Threlte, Three.js and Rapier."
  />
</svelte:head>

<main class="overlapped blog-page">
  <article class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <a
        class="inline-flex items-center gap-2 text-sm text-constant underline"
        href={resolve('/blog')}
      >
        <Icon icon="mdi:arrow-left" height="18" width="18" />
        Back to blog
      </a>

      <div class="mt-6 mb-8">
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">Game jam experiment</p>
        <h1 class="blog-title">Orb Knight: how far can AI agents take a first-time game jam?</h1>
        <p class="blog-lead">
          This is an experiment log: how far can I get in a large game jam, with almost no game
          development background, if I treat Codex and Claude Code as implementation agents and keep
          the feedback loop tight?
        </p>
        <div class="mt-5 flex flex-wrap gap-4 text-sm">
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={repoUrl}
            target="_blank"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            Source
          </a>
          <a class="text-constant underline" href={liveUrl} target="_blank">Live game</a>
          <a class="text-constant underline" href={winnersUrl} target="_blank">Overall results</a>
          <a class="text-constant underline" href={gameplayUrl} target="_blank">Gameplay results</a>
        </div>
      </div>

      <ZoomableImage
        src="/blog/gamedevjs-2026/orb-knight-splash.webp"
        alt="Orb Knight game splash screen"
        figureClass="mb-10 overflow-hidden rounded border border-base-300 bg-base-100"
        imageClass="w-full"
        loading="eager"
      />

      <section class="mb-10">
        <h2 class="subtitle">Result</h2>
        <p class="mb-4">
          Orb Knight placed 12th overall in Gamedev.js Jam 2026 and 6th in the Gameplay category.
          The public winners post lists the overall ranking, and the itch.io results page lists the
          Gameplay ranking. The game itself is a browser-only 3D action game about escaping a
          machine dungeon and pushing toward the castle road.
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          {#each facts as fact}
            <div class="border-l-2 border-keyword pl-4 text-sm">{fact}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">What was built</h2>
        <p class="mb-5">
          The final demo has third-person combat, shooting, melee, procedural foundry rooms, room
          transitions, pickups, shops, treasure rooms, boss encounters, loadout modules, audio,
          settings, Storybook playgrounds and persistent run progress.
        </p>
        <div class="grid gap-4 md:grid-cols-3">
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-combat.webp"
            alt="Orb Knight combat screenshot"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
          />
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-loadout.webp"
            alt="Orb Knight loadout screenshot"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
          />
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-boss-arena.webp"
            alt="Orb Knight boss arena screenshot"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
          />
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Why include it here?</h2>
        <p>
          It is not a normal portfolio project and it is not trying to pretend I became a game
          developer overnight. The useful signal is different: I took an unfamiliar domain, used AI
          agents as a serious engineering tool, decomposed the work into systems, and shipped a
          playable result that ranked well in a competitive public setting.
        </p>
      </section>

      <section>
        <h2 class="subtitle">Lessons</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each lessons as lesson}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{lesson.title}</h3>
              <p class="mt-2 text-sm">{lesson.text}</p>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </article>
</main>
