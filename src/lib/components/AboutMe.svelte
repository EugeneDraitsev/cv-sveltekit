<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  const getFullYearsSince = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();
    let years = currentYear - year;

    const anniversaryThisYear = new Date(currentYear, month - 1, day);
    if (today < anniversaryThisYear) {
      years--;
    }

    return years;
  };

  const formatDetails = (details: typeof SITE_DATA.details) => {
    const { birthDate, ...restDetails } = details;

    const age = getFullYearsSince(birthDate);

    return {
      ...restDetails,
      age,
    };
  };

  const details = formatDetails(SITE_DATA.details);
  const yearsOfExperience = getFullYearsSince(SITE_DATA.experienceStartDate);
  const profileHighlights = [
    `${yearsOfExperience}+ years building production web systems across frontend, backend, infrastructure and integrations.`,
    ...SITE_DATA.profileHighlights,
  ];
</script>

<div class="grid gap-5 md:mx-auto md:max-w-5xl md:grid-cols-2">
  <div>
    <h2 class="subtitle">About me</h2>
    <p class="my-8">
      {SITE_DATA.authorDescription}
    </p>
    <p class="my-6">
      You can find my
      <a class="text-declaration cursor-pointer underline" href={SITE_DATA.pdf} target="_blank">
        detailed CV in pdf here
      </a>
    </p>
  </div>

  <div class="flex flex-col">
    <h2 class="subtitle">Details</h2>
    <div class="flex flex-1 flex-col justify-start">
      <span>{'{'}</span>
      <div class="ml-4">
        {#each Object.entries(details) as [key, value]}
          <div class="my-1">
            <span class="text-constant">{key}</span>:
            {#if typeof value === 'number'}
              <span class="text-number">{value}</span>
            {:else}
              <span class="text-string">
                '{value}'
              </span>
            {/if}
            <span class="text-keyword -ml-2">,</span>
          </div>
        {/each}
      </div>
      <span>}</span>

      <div class="mt-8">
        <h2 class="subtitle">Focused on</h2>
        <div class="space-y-3">
          {#each profileHighlights as highlight}
            <p>{highlight}</p>
          {/each}
        </div>
      </div>

      <div class="mt-8">
        <h2 class="subtitle">Recent delivery</h2>
        <div class="space-y-3">
          {#each SITE_DATA.deliveryHighlights as highlight}
            <p>
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
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
