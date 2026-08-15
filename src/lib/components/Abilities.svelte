<script lang="ts">
  import { SITE_DATA } from '$lib/constants';
</script>

<div>
  <h2 class="subtitle">Skills</h2>
  <p class="mb-6 max-w-3xl text-sm leading-6 text-identifier/75">
    Grouped by how I use the technology rather than by subjective star ratings. Project stories
    below show the evidence behind the labels.
  </p>
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    {#each SITE_DATA.skills as skillSection (skillSection.name)}
      <section class="rounded border border-base-300 p-4">
        <h3 class="text-lg text-constant">{skillSection.name}</h3>
        <p class="mt-2 text-sm text-identifier/70">{skillSection.description}</p>
        <ul class="mt-4 flex flex-wrap gap-2" aria-label={skillSection.name}>
          {#each skillSection.data as skill (skill)}
            <li class="rounded border border-base-300 px-2 py-1 text-sm">{skill}</li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <h2 class="subtitle mt-6">Languages</h2>
  <dl class="grid gap-2 sm:max-w-xl">
    {#each SITE_DATA.languages as language (language.name)}
      <div class="flex flex-wrap justify-between gap-2 border-b border-base-300 py-2">
        <dt class="text-constant">{language.name}</dt>
        <dd class="text-sm text-identifier/75">{language.proficiency}</dd>
      </div>
    {/each}
  </dl>
</div>
