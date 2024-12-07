<script lang="ts">
	import AboutMe from '$lib/components/AboutMe.svelte';
	import Details from '$lib/components/Details.svelte';
	import Experience from '$lib/components/Experience.svelte';
	import Abilities from '$lib/components/Abilities.svelte';
	import Projects from '$lib/components/Projects.svelte';
	import Contacts from '$lib/components/Contacts.svelte';
</script>

<main class="bg-base-100 text-identifier leading-[1.4]">
	{#await import('$lib/components/App.svelte')}
		<div class="min-h-[450px] w-full"></div>
	{:then { default: LazyComponent }}
		<LazyComponent />
	{:catch error}
		<p>{error.message}</p>
	{/await}

	<div class="relative mt-[-100px] flex max-w-full flex-col items-center px-4 pb-5">
		<div class="card bg-base-200 border-base-300 max-w-[900px] rounded border p-6 shadow-lg">
			<div class="grid gap-5 md:mx-auto md:max-w-5xl md:grid-cols-2">
				<AboutMe />
				<Details />
			</div>
		</div>

		<h1 class="text-identifier my-6 text-4xl font-normal">Experience</h1>
		<div class="card bg-base-200 border-base-300 max-w-[900px] rounded border p-6 shadow-lg">
			<Experience />
		</div>

		<h1 class="text-identifier my-6 text-4xl font-normal">Abilities</h1>
		<div class="card bg-base-200 border-base-300 w-full max-w-[900px] rounded border p-6 shadow-lg">
			<Abilities />
		</div>

		<h1 class="text-identifier my-6 text-4xl font-normal">Projects</h1>
		<div class="card bg-base-200 border-base-300 w-full max-w-[900px] rounded border p-6 shadow-lg">
			<Projects />
		</div>

		<h1 class="text-identifier my-6 text-4xl font-normal">Contacts</h1>
		<div class="card bg-base-200 border-base-300 w-full max-w-[900px] rounded border p-6 shadow-lg">
			<Contacts />
		</div>
	</div>
</main>
