<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  const formatDetails = (details: typeof SITE_DATA.details) => {
    const { birthDate, ...restDetails } = details;

    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    const today = new Date();

    const currentYear = today.getFullYear();
    let age = currentYear - birthYear;

    // Check if this year's birthday hasn't come yet
    const birthdayThisYear = new Date(currentYear, birthMonth - 1, birthDay);
    if (today < birthdayThisYear) {
      age--;
    }

    return { ...restDetails, age };
  };

  const details = formatDetails(SITE_DATA.details);
</script>

<div class="grid gap-5 md:mx-auto md:max-w-5xl md:grid-cols-2">
  <div>
    <h2 class="subtitle">About me</h2>
    <p class="my-8">
      {SITE_DATA.authorDescription}
    </p>
    <p class="my-6">
      You can find my
      <a
        class="text-declaration cursor-pointer underline"
        href={SITE_DATA.pdf}
        target="_blank"
      >
        detailed CV in pdf here
      </a>
    </p>
  </div>

  <div class="flex flex-col">
    <h2 class="subtitle">Details</h2>
    <div class="flex flex-1 flex-col justify-center pb-20">
      <span>{'{'}</span>
      <div class="ml-4">
        {#each Object.entries(details) as [key, value]}
          <div>
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
    </div>
  </div>
</div>
