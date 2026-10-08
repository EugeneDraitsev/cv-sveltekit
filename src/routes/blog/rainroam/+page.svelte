<script lang="ts">
  import SocialImage from '$lib/components/SocialImage.svelte';
  import PostDates from '$lib/components/PostDates.svelte';
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';
  import { getBlogPost, serializeJsonLd } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const playUrl = 'https://rainroam.pages.dev/';
  const galaxyUrl = 'https://galaxystore.samsung.com/detail/com.eugenedraitsev.rainroam';
  const appStoreUrl = 'https://apps.apple.com/app/id6813862126';
  const devpostUrl = 'https://devpost.com/software/rainroam';
  const trailerUrl = 'https://www.youtube.com/watch?v=VofgRBF6jP4';

  const post = getBlogPost('rainroam');
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

  const highlights = [
    { value: '13 days', label: 'first build to Galaxy Store' },
    { value: '2', label: 'renderers, one game state' },
    { value: '13', label: 'dungeons and caves' },
    { value: '3', label: 'languages' },
  ];

  const content = [
    '7 regions, from pink lakes to the snowy north, each with its own time of day and weather',
    '5 towns with residents and questlines, starting from Bellwether',
    '13 dungeons and caves with seeded layouts, secrets and a guardian at the end',
    '2 heroes: a cat knight who fights up close and a frog Rainkeeper who casts from range',
    '4 mini-games between fights: fishing, a paper-boat regatta, mushroom foraging and a concert',
    'an original synthesized soundtrack that tightens in fights and settles at lanterns',
  ];

  const problems = [
    {
      title: 'keep two renderers in step',
      text: 'Switching mid-fight only works if both renderers agree on everything that matters for play: hitboxes, the ground outline of every incoming attack, camera angle and timing. Neither renderer owns any of it. Both read the same simulation each frame, so a blow that starts in 3D lands exactly the same way in pixel art.',
    },
    {
      title: 'a driver bug only real hardware shows',
      text: 'On the Galaxy S25 an Adreno driver issue made skinned characters and their shadows disappear. It never showed in emulators; Samsung Remote Test Lab reproduced it. The fix was a different packing of the GPU buffers, and it reached the store build the same day through the app’s signed live-update channel.',
    },
    {
      title: 'pick the renderer per device by testing it',
      text: 'Phone models and chipsets say little about what the WebView actually supports, so the game probes graphics support inside the real WebView at start-up. Devices without WebGPU get the pixel-art renderer, which has the whole game; devices with it let the player choose.',
    },
    {
      title: 'Galaxy Store billing through RevenueCat',
      text: 'RevenueCat’s Capacitor plugin does not expose Galaxy Store billing. Its native Android SDK does, so that SDK is bridged into Capacitor by hand: Samsung IAP sells one non-consumable Full Game, and RevenueCat keeps the entitlement and handles restores. It was tested with real purchases on Galaxy hardware.',
    },
  ];

  const timeline = [
    {
      title: 'Mid-August: planning',
      text: 'The idea: something like a console action RPG that works on a phone held in one hand, on a train. A few throwaway prototypes followed by early September.',
    },
    {
      title: 'September 17: version 0.0.1 on the web',
      text: 'A cat knight in a voxel dungeon, deployed to Cloudflare Pages on day one. Everything after that shipped continuously from the same TypeScript codebase.',
    },
    {
      title: 'September 30: Galaxy Store and Shipaton',
      text: 'Galaxy Store approved version 1.0.1, and the game was entered in RevenueCat Shipaton 2026 for the Best Game, RevenueCat Design and Best App for Galaxy awards.',
    },
    {
      title: 'October: the Mac App Store and the Wishing Well',
      text: 'The Mac version went live on the App Store, and version 1.1 added the Wishing Well, a hardcore roguelike mode in beta. The iPhone and iPad version is in its third round of App Store review.',
    },
  ];

  const stack = [
    { key: 'language', value: 'TypeScript, one codebase for web, Android, iOS and Mac' },
    { key: '3D', value: 'WebGPU through TypeGPU: typed buffers, pipelines and WGSL shaders' },
    { key: 'pixel art', value: 'Phaser on WebGL, its own sprites, animation and effects' },
    { key: 'shells', value: 'Capacitor on Android and iOS, a native Mac app' },
    { key: 'web', value: 'Cloudflare Pages, with signed live updates for the store builds' },
    { key: 'purchases', value: 'RevenueCat, with Samsung IAP on Galaxy Store' },
    { key: 'languages', value: 'English, Russian and Ukrainian' },
  ];
</script>

<svelte:head>
  <title>Rainroam: one action RPG, two renderers | Eugene Draitsev</title>
  <meta
    name="description"
    content="How Rainroam was built: a one-thumb action RPG for phones with a WebGPU/TypeGPU 3D renderer and a Phaser pixel-art renderer drawing the same game state, shipped to the web, Galaxy Store and the Mac App Store."
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
          RevenueCat Shipaton 2026 · with Hanna Shcharbakova
        </p>
        <h1 class="blog-title">Rainroam: one action RPG, drawn by two renderers</h1>
        <p class="post-meta">
          <PostDates added={post.datePublished} updated={post.dateModified} />
        </p>
        <p class="blog-lead">
          Rainroam is a souls-lite action adventure on islands above the clouds. You play a cat
          knight or a frog Rainkeeper, take quests in towns, clear dungeons and fight the guardians
          at the end of them, all with one thumb on a phone held upright. The whole game can be
          drawn in soft-lit 3D or in pixel art, and you can switch between them at any moment, even
          in the middle of a fight. It went from a plan in August to the web, Galaxy Store and the
          Mac App Store in about six weeks; the iPhone version is in its third round of App Store
          review.
        </p>
        <div class="mt-5 flex flex-wrap gap-4 text-sm">
          <a class="text-constant underline" href={playUrl} target="_blank" rel="noreferrer"
            >Play in the browser</a
          >
          <a class="text-constant underline" href={galaxyUrl} target="_blank" rel="noreferrer"
            >Galaxy Store</a
          >
          <a class="text-constant underline" href={appStoreUrl} target="_blank" rel="noreferrer"
            >Mac App Store</a
          >
          <a class="text-constant underline" href={devpostUrl} target="_blank" rel="noreferrer"
            >Devpost submission</a
          >
          <a class="text-constant underline" href={trailerUrl} target="_blank" rel="noreferrer"
            >Trailer</a
          >
        </div>

        <dl class="stat-strip">
          {#each highlights as highlight (highlight.label)}
            <div class="stat">
              <dt class="stat-value">{highlight.value}</dt>
              <dd class="stat-label">{highlight.label}</dd>
            </div>
          {/each}
        </dl>
      </header>

      <ZoomableImage
        src="/blog/rainroam/hero-split.webp"
        alt="The same evening in Bellwether, drawn in 3D on the left and in pixel art on the right"
        figureClass="mb-12 overflow-hidden rounded border border-base-300 bg-base-100"
        imageClass="w-full"
        loading="eager"
        caption="The same evening in Bellwether, drawn twice: 3D on the left, pixel art on the right."
      />

      <section class="mb-12">
        <h2 class="section-heading">Played with one thumb</h2>
        <p class="mb-6">
          We like action RPGs on consoles and wanted one that works on a phone in one hand. Rainroam
          is played in portrait: drag to move, release to attack, tap to dash. A second finger can
          dash without letting go of the stick. Basic attacks are automatic, so the thumb is free
          for positioning, stamina and timing, and every enemy attack draws its exact shape on the
          ground before it lands. Landscape and keyboard play follow the same rules.
        </p>
        <div class="grid grid-cols-2 gap-4 sm:mx-auto sm:max-w-md">
          <ZoomableImage
            src="/blog/rainroam/phone-hero-3d.webp"
            alt="Rainroam in portrait on a phone, drawn in 3D"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="Portrait, 3D."
          />
          <ZoomableImage
            src="/blog/rainroam/phone-hero-pixel.webp"
            alt="The same Rainroam scene in portrait on a phone, drawn in pixel art"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="The same moment in pixel art."
          />
        </div>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Two renderers, one game state</h2>
        <p class="mb-6">
          The 3D view runs on WebGPU through TypeGPU; the pixel-art view runs on Phaser and WebGL.
          They share no drawing code: each has its own characters, animations, scenery and effects,
          and the HUD, map, fonts and menus change style with them. What they share is the
          simulation. Both read the same game state every frame, so switching restarts nothing: the
          hero, the enemies, the incoming attack and the save stay exactly where they were. It also
          covers older phones, where the full game runs in pixel art without WebGPU.
        </p>
        <ZoomableImage
          src="/blog/rainroam/battle-split.webp"
          alt="A fight with amber moths, split down the middle between 3D and pixel art"
          figureClass="mb-6 overflow-hidden rounded border border-base-300"
          imageClass="w-full"
          caption="Amber moths and a shard warden. The outline on the ground is the exact shape of the blow, in both styles."
        />
      </section>

      <section class="mb-12">
        <h2 class="section-heading">What there is to do</h2>
        <ul class="mb-6 list-disc space-y-1 pl-5">
          {#each content as item (item)}
            <li>{item}</li>
          {/each}
        </ul>
        <p class="mb-6">
          Enemies drop embers. You can push on, or walk back to a lantern to spend them on levels,
          attributes and oaths; die, and they wait where you fell until you fetch them. The Wishing
          Well, in beta, is a separate hardcore roguelike: six depths with a keeper at the end of
          each, 75 artifacts, synergies and one life.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <ZoomableImage
            src="/blog/rainroam/white-stair.webp"
            alt="The White Stair, a floating dungeon hall, with rings marking the Key Warden's slam"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="The White Stair. The rings show where the Key Warden will slam."
          />
          <ZoomableImage
            src="/blog/rainroam/prism-hollow.webp"
            alt="Prism Hollow, a crystal cave, and its guardian, split between 3D and pixel art"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="Prism Hollow and its guardian, 3D and pixel art."
          />
          <ZoomableImage
            src="/blog/rainroam/reedwake-storm.webp"
            alt="Reedwake at night in a storm, with the frog Rainkeeper"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="Reedwake at night, in a storm."
          />
          <ZoomableImage
            src="/blog/rainroam/amber-fight.webp"
            alt="A pixel-art fight in Amber Afterlight at dusk, with red lines marking incoming attacks"
            figureClass="overflow-hidden rounded border border-base-300"
            imageClass="w-full"
            caption="Pixel art: a fight in Amber Afterlight at dusk."
          />
        </div>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Problems worth writing down</h2>
        <div class="rulelist">
          {#each problems as problem, index (problem.title)}
            <article class="rule">
              <span class="rule-index">{String(index + 1).padStart(2, '0')}</span>
              <h3 class="rule-title">{problem.title}</h3>
              <p class="rule-text">{problem.text}</p>
            </article>
          {/each}
        </div>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Pricing</h2>
        <p>
          The first island and its first dungeon are free. At the South Bridge you can buy the Full
          Game once for $4.99, and the same save carries on through the rest of the story; the same
          purchase opens the deeper levels of the Wishing Well. There are no ads, subscriptions,
          energy timers or paid power. A free first chapter and one price is how adventure games are
          usually sold, and it lets people decide whether they like the game before paying.
        </p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">How it got here</h2>
        <ol class="timeline">
          {#each timeline as item, index (item.title)}
            <li class="timeline-item">
              <h3 class="timeline-title">
                <span class="timeline-index">{String(index + 1).padStart(2, '0')}</span>
                {item.title}
              </h3>
              <p class="timeline-text">{item.text}</p>
            </li>
          {/each}
        </ol>
        <p class="mt-6">
          Like Orb Knight, it was built with coding agents: Claude Code and Codex wrote most of the
          roughly 1,400 commits, while direction, review and a lot of playtesting stayed with us.
          Hanna Shcharbakova is the other half of the team.
        </p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">The trailer</h2>
        <a
          class="trailer block overflow-hidden rounded border border-base-300"
          href={trailerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Watch the Rainroam trailer on YouTube"
        >
          <img
            src="/blog/rainroam/trailer.webp"
            alt="The cat knight in 3D and as a pixel-art sprite, from the Rainroam trailer"
            class="w-full"
            loading="lazy"
          />
          <span class="trailer-play" aria-hidden="true">
            <Icon icon="mdi:play" height="34" width="34" />
          </span>
        </a>
        <p class="mt-3 text-sm text-identifier/70">Made from real gameplay. Opens on YouTube.</p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">What it runs on</h2>
        <dl class="spec">
          {#each stack as row (row.key)}
            <div class="spec-row">
              <dt class="spec-key">{row.key}</dt>
              <dd class="spec-value">{row.value}</dd>
            </div>
          {/each}
        </dl>
      </section>

      <section>
        <h2 class="section-heading">What's next</h2>
        <p>
          Tuning the Wishing Well while it is in beta, then full controller support, and after that
          consoles.
        </p>
      </section>
    </div>
  </article>
</main>

<style>
  .trailer {
    position: relative;
  }

  .trailer-play {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 4.5rem;
    height: 4.5rem;
    margin: -2.25rem 0 0 -2.25rem;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    transition:
      transform 160ms ease,
      background-color 160ms ease;
  }

  .trailer:hover .trailer-play,
  .trailer:focus-visible .trailer-play {
    transform: scale(1.08);
    background: rgb(204 120 50 / 0.85);
  }
</style>
