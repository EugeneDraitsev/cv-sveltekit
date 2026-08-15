<script lang="ts">
  import AboutMe from '$lib/components/AboutMe.svelte';
  import Experience from '$lib/components/Experience.svelte';
  import Abilities from '$lib/components/Abilities.svelte';
  import Projects from '$lib/components/Projects.svelte';
  import { SITE_DATA } from '$lib/constants';

  const canonicalUrl = SITE_DATA.siteUrl;
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE_DATA.details.name,
    jobTitle: SITE_DATA.details.position,
    url: SITE_DATA.siteUrl,
    email: `mailto:${SITE_DATA.socials.email}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Stockholm',
      addressCountry: 'SE',
    },
    sameAs: [SITE_DATA.socials.github, SITE_DATA.socials.linkedin],
    knowsAbout: SITE_DATA.keyWords,
  };
</script>

<svelte:head>
  <title>{SITE_DATA.details.name} | {SITE_DATA.details.position}</title>
  <meta name="description" content={SITE_DATA.siteDescription} />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content={`${SITE_DATA.details.name} | ${SITE_DATA.details.position}`} />
  <meta property="og:description" content={SITE_DATA.siteDescription} />
  <meta property="og:type" content="profile" />
  <meta property="og:url" content={canonicalUrl} />
  <meta name="twitter:card" content="summary" />
  <svelte:element this={"script"} type="application/ld+json">
    {JSON.stringify(personSchema).replace(/</g, '\\u003c')}
  </svelte:element>
</svelte:head>

<main id="main-content" class="overlapped" tabindex="-1">
  <div class="relative mx-auto mt-[-72px] flex max-w-[900px] flex-col items-center px-4 pb-5">
    <div class="card">
      <AboutMe />
    </div>

    <h2 id="experience" class="title">Experience</h2>
    <div class="card cv-auto">
      <Experience />
    </div>

    <h2 id="abilities" class="title">Abilities</h2>
    <div class="card cv-auto">
      <Abilities />
    </div>

    <h2 id="projects" class="title">Projects</h2>
    <div class="card cv-auto">
      <Projects />
    </div>
  </div>
</main>
