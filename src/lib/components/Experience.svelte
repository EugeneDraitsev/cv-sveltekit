<script>
  import { SITE_DATA } from '$lib/constants';

  const { careers, educations } = SITE_DATA;
  const deliveryLabels = ['partner launch', 'authorization', 'AI agents', 'commerce systems'];
  const deliveryCards = SITE_DATA.deliveryHighlights.map((highlight, index) => ({
    ...highlight,
    label: deliveryLabels[index] ?? highlight.tags[0],
  }));
</script>

<div class="overflow-hidden sm:rounded-lg">
  <section class="mb-8">
    <div class="mb-7">
      <h2 class="subtitle">Selected recent delivery</h2>
      <p class="max-w-3xl text-sm leading-6 text-identifier/75">
        Production work across partner launches, authentication and AI systems. Recent examples of
        work involving external partners, identity/security flows, commerce delivery and agentic
        systems.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      {#each deliveryCards as highlight}
        <article class="delivery-card">
          <div class="mb-3 flex items-center gap-2">
            <span class="delivery-badge">{highlight.label}</span>
          </div>

          <h3 class="text-constant text-lg leading-snug">{highlight.title}</h3>

          <p class="mt-3 text-sm leading-6">
            {highlight.text}
            {#if 'href' in highlight}
              {' '}
              <a
                class="text-declaration cursor-pointer underline"
                href={highlight.href}
                target="_blank"
                rel="noreferrer"
              >
                ({highlight.linkLabel})
              </a>
            {/if}
          </p>

          <p class="mt-4 text-sm leading-6">
            <span class="text-keyword">Impact:</span>
            {highlight.result}
          </p>

          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            {#each highlight.tags as tag}
              <span class="delivery-tag">{tag}</span>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </section>

  <h2 class="subtitle">Careers</h2>
  <span>[</span>
  <div class="ml-2">
    {#each careers as career}
      <div class="px-2">
        <span>{'{'}</span>
        <div class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center">
          <div class="w-15 h-15 mx-auto md:mx-5 mb-4">
            <img
              alt="logo"
              loading="lazy"
              width="120"
              height="120"
              decoding="async"
              data-nimg="1"
              class="max-w-15 rounded-full object-contain md:m-0"
              style="color: transparent"
              srcset="{career.logo} 1x, {career.logo} 2x"
              src={career.logo}
            />
          </div>
          <div class="flex min-w-[250px] flex-col text-center text-sm md:text-left">
            <span class="text-constant text-[16px]">{career.company}</span>
            <span class="text-declaration">{career.location}</span>
            <div>{career.position}</div>
            <div>{career.period}</div>
          </div>
          <div class="pl-6 mt-4 md:mt-0 md:text-left">
            {career.description}
          </div>
        </div>
        <span>}</span>
        <span class="text-keyword -ml-2">,</span>
      </div>
    {/each}
  </div>
  <span>]</span>
  <div class="mt-2"></div>

  <h2 class="subtitle">Education</h2>
  <span>[</span>
  <div class="ml-2">
    {#each educations as education}
      <div class="px-2">
        <span>{'{'}</span>
        <div class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center gap-4">
          <div class="w-15 h-15 mx-auto md:mx-5">
            <img
              alt="logo"
              loading="lazy"
              width="120"
              height="120"
              decoding="async"
              data-nimg="1"
              class="mb-2 w-15 rounded-full object-contain md:m-0 text-transparent"
              srcset="{education.logo} 1x, {education.logo} 2x"
              src={education.logo}
            />
          </div>
          <div class="min-w-[250px] flex flex-col text-center text-sm md:text-left">
            <span class="text-constant text-lg">{education.name}</span>
            <span class="text-declaration">{education.location}</span>
            <div class="mt-2">
              <div>{education.degree}</div>
              <div>{education.major}</div>
              <div>{education.period}</div>
            </div>
          </div>
        </div>
        <span>}</span>
        <span class="text-keyword -ml-2">,</span>
      </div>
    {/each}
  </div>
  <span>]</span>
</div>

<style>
  .delivery-card {
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 34%, transparent);
    padding: 1.25rem;
  }

  .delivery-badge {
    border: 1px solid color-mix(in srgb, var(--color-keyword) 42%, var(--color-base-300));
    border-radius: 999px;
    padding: 0.22rem 0.5rem;
    color: var(--color-declaration);
    font-size: 0.75rem;
  }

  .delivery-tag {
    border: 1px solid var(--color-base-300);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
  }

  :global([data-theme='light']) .delivery-card {
    background: color-mix(in srgb, var(--color-base-200) 86%, transparent);
  }
</style>
