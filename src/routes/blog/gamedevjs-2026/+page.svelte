<script lang="ts">
  import SocialImage from '$lib/components/SocialImage.svelte';
  import PostDates from '$lib/components/PostDates.svelte';
  import { dev } from '$app/environment';
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import WebGLSceneEmbed from '$lib/components/WebGLSceneEmbed.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';
  import { getBlogPost, serializeJsonLd } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const repoUrl = 'https://github.com/EugeneDraitsev/gamedevjs-2026';
  const liveUrl = 'https://gamedevjs-2026-orb-knight.vercel.app/';
  const winnersUrl = 'https://gamedevjs.com/competitions/gamedev-js-jam-2026-winners-announced/';
  const gameplayUrl = 'https://itch.io/jam/gamedevjs-2026/results/gameplay';
  const productionStorybookUrl = 'https://gamedevjs-2026-orb-knight.vercel.app/storybook/';

  const post = getBlogPost('gamedevjs-2026');
  const canonicalUrl = new URL(`/blog/${post.slug}`, SITE_DATA.siteUrl).href;
  const socialImageUrl = new URL(post.socialImage, SITE_DATA.siteUrl).href;
  const postSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: socialImageUrl,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    mainEntityOfPage: canonicalUrl,
    author: { '@type': 'Person', name: SITE_DATA.details.name, url: SITE_DATA.siteUrl },
  };

  let storybookUrl = $state(productionStorybookUrl);

  const sceneUrl = (id: string) => `${storybookUrl}iframe.html?id=${id}&viewMode=story`;

  const laserSceneUrl = $derived(sceneUrl('weapons-playground--laser'));
  const bossSceneUrl = $derived(sceneUrl('playgrounds-combat--boss-gate-keeper'));
  const finaleSceneUrl = $derived(sceneUrl('playgrounds-outside-finale--unlocked-entrance'));
  const loadoutSceneUrl = $derived(sceneUrl('playgrounds-loadout-modules--try-on-playground'));

  onMount(() => {
    if (dev) {
      storybookUrl = `${window.location.protocol}//${window.location.hostname}:6006/`;
    }
  });

  const highlights = [
    { value: '#6', label: 'Gameplay · 483 ranked' },
    { value: '#12', label: 'Overall' },
    { value: '13', label: 'days of jam' },
    { value: '104', label: 'commits by the deadline' },
  ];

  const scores = [
    { label: 'Gameplay', rank: '#6', score: 4.027 },
    { label: 'Graphics', rank: '#34', score: 3.811 },
    { label: 'Theme', rank: '#25', score: 3.784 },
    { label: 'Audio', rank: '#29', score: 3.486 },
    { label: 'Innovation', rank: '#79', score: 3.243 },
  ];

  const shipped = [
    {
      title: 'Combat that carries the game',
      text: 'Third-person movement, a sword, a gun and a chargeable laser against 9 enemy types and 3 bosses. The last of them, the Gate Keeper, fires triple shots and sweeps an arc laser you have to jump.',
    },
    {
      title: 'Seeded runs',
      text: '29 room templates across 7 kinds (combat, challenge, treasure, shop, secret, boss and a training polygon), validated with Zod and stitched into seeded dungeon layouts. Gears buy modules: 10 of them, across attack, body, melee and utility slots, reshape your build mid-run.',
    },
    {
      title: 'Synthesized sound effects',
      text: 'Every sound effect is synthesized in Web Audio at runtime: noise buffers and oscillators through a compressor. The laser windup, door grind and metal-shatter death are all code; the music tracks are separate recordings.',
    },
  ];

  const buildLog = [
    {
      date: 'Apr 15–16',
      title: 'First Threlte prototype',
      text: 'A capsule, some targets, projectile shooting and a crosshair. Not a game yet, but it renders and shoots.',
    },
    {
      date: 'Apr 17–21',
      title: 'Rooms move into data',
      text: 'Room templates move into JSON with a Zod schema, dungeon layout gets seeded generation, and the first real enemies start applying pressure.',
    },
    {
      date: 'Apr 22–23',
      title: 'The outside world',
      text: 'Overworld chunks derived from the dungeon seed, road and grass shaders, a vegetation registry. The foundry gets somewhere to break out to.',
    },
    {
      date: 'Apr 24',
      title: 'Loadout bay and adaptive music',
      text: 'The machine module bay lands — swap attack, body, utility and melee modules mid-run — and the soundtrack starts reacting to game state.',
    },
    {
      date: 'Apr 25',
      title: 'The 25-commit day',
      text: 'Laser beam with charge-up, the shop and its keeper NPC, the Gate Keeper boss, the core prison setpiece and a full pass of procedural sound effects. Late that night, the first performance work: a pixel-ratio cap, shadow-pass cuts and lights that mount only in the active room.',
    },
    {
      date: 'Apr 26',
      title: 'Submitted',
      text: 'Material pre-warming, the itch.io build and the submission, ahead of the 17:00 CEST deadline. Some players still saw lag on weaker machines.',
    },
    {
      date: 'Apr 26–27',
      title: 'After the deadline',
      text: 'Nine more commits for the hosted build: performance fixes, warm-ups, room transitions and run state that survives the menus.',
    },
  ];

  const ownership = [
    {
      title: 'What stayed mine',
      items: [
        'Scope: what the game is, and the growing list of what it is not',
        'System boundaries between combat, rooms, progression and UI',
        'Review of every change, plus integration and browser playtesting',
        'Game feel: timing, camera, feedback — tuned by hand, repeatedly',
        'The release call and the competition submission',
      ],
    },
    {
      title: 'What agents did',
      items: [
        'Implementation passes across Svelte, Threlte, Three.js and Rapier',
        'First drafts of combat behaviors, room templates, enemies and UI',
        'Mechanical refactors across many files',
        'Storybook fixtures that pin runtime state for review',
        'Codebase archaeology: "where does the damage number actually come from?"',
      ],
    },
  ];

  const lessons = [
    {
      title: 'One observable behavior per loop',
      text: 'The unit of work that survived: one behavior, one implementation pass, one browser check. Every time I batched more into a prompt, review cost grew faster than the code was worth.',
    },
    {
      title: 'Correct is not the same as good',
      text: 'Agents will happily ship combat that satisfies every stated rule and still feels like hitting cardboard. Feel only comes from playtesting and tuning, over and over.',
    },
    {
      title: 'Storybook was the highest-leverage tool',
      text: 'Deterministic fixtures turned "run to the boss and hope" into "mount the boss with fixed state". Most agent output got reviewed inside these scenes — the same ones embedded above.',
    },
    {
      title: 'Innovation cannot be patched in later',
      text: 'Gameplay ranked 6th; Innovation ranked 79th. Both are fair. A competent roguelite loop is buildable in 13 days — a distinctive mechanic has to be there from day one, and mine was not.',
    },
  ];
</script>

<svelte:head>
  <title>Orb Knight: a 3D roguelite in 13 days | Eugene Draitsev</title>
  <meta
    name="description"
    content="Building Orb Knight for Gamedev.js Jam 2026: a Svelte and Three.js action roguelite made in 13 days with AI coding agents, 6th in Gameplay. Build log and live WebGL scenes."
  />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content={post.title} />
  <meta property="og:description" content={post.description} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="article:published_time" content={post.datePublished} />
  <meta property="article:modified_time" content={post.dateModified} />
  <svelte:element this={"script"} type="application/ld+json">
    {serializeJsonLd(postSchema)}
  </svelte:element>
</svelte:head>

<SocialImage src={post.socialImage} alt={post.title} />

<main id="main-content" class="overlapped blog-page" tabindex="-1">
  <article class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <a
        class="inline-flex items-center gap-2 text-sm text-constant underline"
        href={resolve('/blog')}
      >
        <Icon icon="mdi:arrow-left" height="18" width="18" />
        Back to posts
      </a>

      <header class="mt-6 mb-8">
        <p class="mb-3 text-xs text-keyword uppercase sm:text-sm">
          Game jam · 13 days · built with AI agents
        </p>
        <h1 class="blog-title">Orb Knight: a 3D browser roguelite in 13 days</h1>
        <p class="post-meta">
          <PostDates added={post.datePublished} updated={post.dateModified} />
        </p>
        <p class="blog-lead">
          Gamedev.js Jam 2026 gave everyone the same theme, <em>Machines</em>, and the same 13 days.
          I had a decade of production web work behind me and no shipped games, so the plan was to
          build a real-time 3D action game in the browser, let coding agents write most of the code,
          and keep architecture, review and playtesting myself. A friend, Arseny Yankovski, added
          the laser charge-up and three enemies. The result is Orb Knight: a brass machine with a
          sword, a gun and a laser, cutting its way out of a foundry. It took
          <strong>6th in Gameplay</strong> and <strong>12th overall</strong> out of 483 ranked entries.
        </p>
        <div class="mt-5 flex flex-wrap gap-4 text-sm">
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            Source code
          </a>
          <a class="text-constant underline" href={liveUrl} target="_blank" rel="noreferrer"
            >Play the game</a
          >
          <a class="text-constant underline" href={winnersUrl} target="_blank" rel="noreferrer"
            >Jam results</a
          >
          <a class="text-constant underline" href={gameplayUrl} target="_blank" rel="noreferrer"
            >Gameplay ranking</a
          >
        </div>
      </header>

      <ZoomableImage
        src="/blog/gamedevjs-2026/orb-knight-splash.webp"
        alt="Orb Knight title screen with a lone knight facing a mechanical castle"
        figureClass="mb-10 overflow-hidden rounded border border-base-300 bg-base-100"
        imageClass="w-full"
        loading="eager"
      />

      <section class="mb-12" aria-labelledby="outcome-heading">
        <p class="section-kicker">01 · The result</p>
        <h2 id="outcome-heading" class="section-heading">6th in Gameplay, 79th in Innovation</h2>
        <p class="mb-6 max-w-3xl">
          The category I care about most is Gameplay: how the game feels in your hands. Orb Knight
          scored <strong>4.027/5</strong> there, 6th across the whole jam, and players mostly praised
          the controls and the feel. Innovation was the weak spot.
        </p>

        <div class="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each highlights as highlight (highlight)}
            <div class="metric-card">
              <strong class="text-2xl text-number sm:text-3xl">{highlight.value}</strong>
              <span class="mt-1 text-xs text-identifier/70 sm:text-sm">{highlight.label}</span>
            </div>
          {/each}
        </div>

        <ZoomableImage
          src="/blog/gamedevjs-2026/jam-results.webp"
          alt="Gamedev.js Jam results for Orb Knight showing 6th place in Gameplay and 12th overall"
          aspect="flow"
          figureClass="mb-6"
          triggerClass="rounded border border-base-300 bg-white p-2 sm:p-3"
          imageClass="w-full rounded"
          caption="The public itch.io result card: 37 ratings, 4.027 for Gameplay, 3.670 overall. Click to zoom."
        />

        <div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <figure class="rounded border border-base-300 bg-base-100 p-4">
            <figcaption class="mb-5 text-sm text-declaration">Category scores out of 5</figcaption>
            <div class="space-y-4">
              {#each scores as criterion (criterion)}
                <div>
                  <div class="mb-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <span
                      >{criterion.label}
                      <span class="text-identifier/75">{criterion.rank}</span></span
                    >
                    <span class="font-semibold text-number tabular-nums"
                      >{criterion.score.toFixed(3)}</span
                    >
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-base-300">
                    <div
                      class="score-bar h-full rounded-full"
                      style={`width: ${(criterion.score / 5) * 100}%`}
                      role="progressbar"
                      aria-label={`${criterion.label} score`}
                      aria-valuemin="0"
                      aria-valuemax="5"
                      aria-valuenow={criterion.score}
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </figure>
          <aside class="result-note">
            <p class="text-xs tracking-wide text-keyword uppercase">Reading the board</p>
            <h3 class="mt-2 text-xl text-constant">Strong loop, familiar idea</h3>
            <p class="mt-3 text-sm">
              Gameplay at 6th means the moment-to-moment feel of dodging, hitting and getting hit
              worked. Graphics, Theme and Audio all finished in the top 7%.
            </p>
            <p class="mt-3 text-sm">
              Innovation at 79th is fair: Orb Knight is a well-made roguelite, not a new idea.
              Players didn't mark it down on Gameplay for that; the cost showed up in Innovation.
            </p>
          </aside>
        </div>
      </section>

      <section class="mb-12" aria-labelledby="game-heading">
        <p class="section-kicker">02 · What shipped</p>
        <h2 id="game-heading" class="section-heading">
          A machine knight and the foundry it escapes
        </h2>
        <p class="mb-6">
          The submitted build is a complete run: fight through seeded foundry rooms, collect gears,
          rebuild your machine at the loadout bay, survive the shop keeper's prices, beat the Gate
          Keeper, and break out onto the castle road. Roughly 56k lines of TypeScript and Svelte and
          104 commits by the deadline, in one browser tab: SvelteKit and Svelte 5 runes for the
          shell, Threlte and Three.js for rendering, Rapier for physics, Bun for everything else.
        </p>
        <div class="mb-7 grid gap-4 md:grid-cols-3">
          {#each shipped as item (item)}
            <article class="detail-card">
              <h3 class="text-lg text-constant">{item.title}</h3>
              <p class="mt-2 text-sm">{item.text}</p>
            </article>
          {/each}
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-combat.webp"
            alt="Orb Knight fighting mechanical enemies in a foundry room"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
            caption="Mid-run combat pressure"
          />
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-loadout.webp"
            alt="Orb Knight loadout screen with upgrade modules"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
            caption="The loadout bay between rooms"
          />
          <ZoomableImage
            src="/blog/gamedevjs-2026/orb-knight-boss-arena.webp"
            alt="Orb Knight boss encounter in a circular arena"
            imageClass="aspect-[16/10] w-full rounded border border-base-300 object-cover"
            caption="Boss arena, moments before regret"
          />
        </div>
      </section>

      <section class="mb-12" aria-labelledby="log-heading">
        <p class="section-kicker">03 · Build log</p>
        <h2 id="log-heading" class="section-heading">13 days, compressed</h2>
        <p class="mb-6 max-w-3xl">
          From the commit history: 104 commits between April 15 and the April 26 deadline, and nine
          more after it.
        </p>
        <ol class="build-log">
          {#each buildLog as entry (entry)}
            <li class="build-log-entry">
              <span class="build-log-date">{entry.date}</span>
              <div class="build-log-body">
                <h3>{entry.title}</h3>
                <p>{entry.text}</p>
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <section class="mb-12" aria-labelledby="labs-heading">
        <p class="section-kicker">04 · Live scenes</p>
        <div class="mb-7 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 id="labs-heading" class="subtitle mb-0">Poke the actual game</h2>
          <p>
            These are the same Storybook fixtures I used to build Orb Knight, embedded live — real
            production renderer, physics and AI with pinned state, so you can play with one system
            without fighting through a run to reach it. They're full WebGL apps, so only one runs at
            a time; there's also the <a
              class="text-constant underline"
              href={storybookUrl}
              target="_blank"
              rel="noreferrer">complete Storybook</a
            > if you want everything.
          </p>
        </div>

        <div class="mb-7">
          <WebGLSceneEmbed
            label="Scene 01 · Laser"
            title="Charge-up laser, live"
            src={laserSceneUrl}
            poster="/blog/gamedevjs-2026/posters/laser.webp"
            desktopOverview
            tall
            description="The Laser Beam module in its weapon lab. Hold fire to charge, sweep the beam through targets, switch to the other five builds (default rivet, split arc, wave, lob and rockets) in the panel. The electric windup you hear is synthesized in Web Audio. Arseny Yankovski built the charge-up and this weapons playground."
          />
        </div>

        <div class="scene-pair">
          <article>
            <WebGLSceneEmbed
              label="Scene 02 · Final boss"
              title="Gate Keeper sandbox"
              src={bossSceneUrl}
              poster="/blog/gamedevjs-2026/posters/boss.webp"
              description="The final boss with its full moveset, without the run to reach it: triple shots, and a sweeping arc laser you jump over like the world's angriest skipping rope. This fixture is where its timings were tuned."
            />
          </article>

          <article>
            <WebGLSceneEmbed
              label="Scene 03 · The finale"
              title="Castle road, unlocked"
              src={finaleSceneUrl}
              poster="/blog/gamedevjs-2026/posters/finale.webp"
              description="What the whole run points at: the outside world past the broken dome. Seeded terrain chunks, road and grass shaders, and the gate that opens once the Gate Keeper is down."
            />
          </article>
        </div>

        <div>
          <WebGLSceneEmbed
            label="Scene 04 · Loadout"
            title="Try-on bay with live stats"
            src={loadoutSceneUrl}
            poster="/blog/gamedevjs-2026/posters/loadout.webp"
            desktopOverview
            tall
            description="The module try-on fixture: swap any of the 10 modules and watch the character model, damage, fire rate, health, magazine and reload react instantly. Seeing the numbers next to the model caught bugs in both."
          />
        </div>
      </section>

      <section class="mb-12" aria-labelledby="roles-heading">
        <p class="section-kicker">05 · The workflow</p>
        <h2 id="roles-heading" class="section-heading">How the agents and I split the work</h2>
        <p class="mb-6">
          Codex and Claude Code wrote most of this game; two of the merged branches are literally
          named <code>codex/*</code>. My job shifted to splitting systems into tasks small enough to
          review, keeping state boundaries clean so a bad implementation was cheap to throw away,
          and playtesting every change, because no agent can tell you the camera feels wrong. The
          split, roughly:
        </p>
        <div class="grid gap-5 md:grid-cols-2">
          {#each ownership as column (column)}
            <article class="detail-card">
              <h3 class="text-lg text-constant">{column.title}</h3>
              <ul class="mt-4 space-y-2">
                {#each column.items as item (item)}
                  <li class="flex gap-2 text-sm">
                    <span class="text-keyword" aria-hidden="true">→</span>
                    <span>{item}</span>
                  </li>
                {/each}
              </ul>
            </article>
          {/each}
        </div>
      </section>

      <section aria-labelledby="lessons-heading">
        <p class="section-kicker">06 · Notes to future me</p>
        <h2 id="lessons-heading" class="section-heading">What I'd keep, what I'd change</h2>
        <div class="rulelist">
          {#each lessons as lesson, index (index)}
            <article class="rule">
              <span class="rule-index">{String(index + 1).padStart(2, '0')}</span>
              <h3 class="rule-title">{lesson.title}</h3>
              <p class="rule-text">{lesson.text}</p>
            </article>
          {/each}
        </div>
      </section>
    </div>
  </article>
</main>

<style>
  .section-kicker {
    margin-bottom: 0.5rem;
    color: var(--color-keyword);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .metric-card,
  .detail-card {
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
  }

  .metric-card {
    display: flex;
    min-height: 6.5rem;
    flex-direction: column;
    justify-content: center;
    padding: 1rem;
  }

  .detail-card {
    padding: 1rem;
  }

  .result-note {
    border: 1px solid color-mix(in srgb, var(--color-keyword) 55%, var(--color-base-300));
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-keyword) 7%, var(--color-base-100));
    padding: 1.25rem;
  }

  .score-bar {
    background: linear-gradient(90deg, var(--color-keyword), var(--color-declaration));
  }

  /* Build log styled after the thing it describes: a git log. */
  .build-log {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--color-base-300);
  }

  .build-log-entry {
    position: relative;
    display: grid;
    grid-template-columns: 5.2rem 1fr;
    gap: 0.75rem;
    padding: 0.85rem 0 0.85rem 1.15rem;
  }

  .build-log-entry::before {
    content: '';
    position: absolute;
    top: 1.35rem;
    left: -4px;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-keyword);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-keyword) 22%, transparent);
  }

  .build-log-date {
    color: var(--color-number);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
    padding-top: 0.15rem;
  }

  .build-log-body h3 {
    color: var(--color-constant);
    font-size: 1.02rem;
    line-height: 1.3;
  }

  .build-log-body p {
    margin-top: 0.25rem;
    font-size: 0.88rem;
    color: color-mix(in srgb, var(--color-identifier) 88%, transparent);
  }

  @media (max-width: 560px) {
    .build-log-entry {
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }
  }

  .scene-pair {
    display: grid;
    gap: 1.75rem;
    margin-bottom: 1.75rem;
  }

  @media (min-width: 1024px) {
    .scene-pair {
      grid-template-columns: 1fr 1fr;
    }
  }

  code {
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    border: 1px solid var(--color-base-300);
    background: color-mix(in srgb, var(--color-base-100) 70%, transparent);
    color: var(--color-string);
    font-size: 0.85em;
  }
</style>
