<script lang="ts">
  export const loadRepositories = async () => {
    const response = await fetch(`/api/github.json`);
    if (response.ok) {
      return await response.json();
    }
    throw new Error("Can't fetch Github repositories");
  };
</script>

<div>
  <h2 class="mb-5 text-3xl font-normal text-declaration">Latest repositories on Github</h2>

  {#await loadRepositories()}
    <div class="flex h-[380px] w-full items-center justify-center">
      <span class="loading loading-ring h-[75px] w-[75px]"></span>
    </div>
  {:then repositories}
    {#if repositories.length > 0}
      {#each repositories as repository}
        <div class="mb-3 flex items-center justify-between border-b border-gray-500 pb-3">
          <div class="flex-1">
            <a href={repository.html_url} class="cursor-pointer font-bold text-constant underline">
              {repository.name}
            </a>
            <p class="py-1 text-sm">{repository.description}</p>
            <p class="text-xs">
              Updated: {new Date(repository.updated_at).toUTCString()}
            </p>
          </div>
          <div class="ml-1.5 flex min-w-[30px] items-center space-x-2 text-white">
            <p class="mb-0.75 text-lg">★</p>
            <div>{repository.stargazers_count}</div>
          </div>
        </div>
      {/each}
    {:else}
      <p>No repositories found</p>
    {/if}
  {:catch error}
    <p>{error.message || "Can't fetch Github repositories"}</p>
  {/await}
</div>
