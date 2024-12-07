<script lang="ts">
  import StarRating from '$lib/components/StarRating.svelte';
  import { SITE_DATA } from '$lib/constants';
</script>

<div>
  <h2 class="subtitle">Skills</h2>
  <div class="grid grid-cols-1 sm:grid-cols-[300px_300px]">
    {#each SITE_DATA.skills as skillSection}
      <div>
        <div>{skillSection.name}:</div>
        <div class="mt-2"></div>

        <span>{'{'}</span>
        <div class="ml-4">
          {#each skillSection.data as skill}
            <div class="flex items-center">
              <span class="text-constant">{skill.name}: </span>
              <div class="flex ml-2">
                <StarRating rating={skill.value * 2} />
              </div>
              <span class="text-keyword">,</span>
            </div>
          {/each}
        </div>
        <span>}</span>
      </div>
    {/each}
  </div>

  <h2 class="subtitle">Languages</h2>
  <span>{'{'}</span>
  <div class="ml-4">
    {#each SITE_DATA.languages as language}
      <div class="flex items-center">
        <span class="text-constant">{language.name}: </span>
        <div class="flex ml-2">
          <StarRating rating={language.value * 2} />
        </div>
        <span class="text-keyword">,</span>
      </div>
    {/each}
  </div>
  <span>}</span>
</div>
