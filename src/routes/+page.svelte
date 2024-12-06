<script lang="ts">
	import AboutMe from '$lib/components/AboutMe.svelte';
	import Details from '$lib/components/Details.svelte';
	import Experience from '$lib/components/Experience.svelte';
	import Abilities from '$lib/components/Abilities.svelte';
	import Projects from '$lib/components/Projects.svelte';
	import Contacts from '$lib/components/Contacts.svelte';
</script>

<main class="bg-base-100 text-identifier">
	{#await import('$lib/components/App.svelte')}
		<div class="min-h-[450px] w-full"></div>
	{:then { default: LazyComponent }}
		<LazyComponent />
	{:catch error}
		<p>{error.message}</p>
	{/await}

	<div class="relative mt-[-100px] flex flex-col items-center px-4 pb-[20px] max-w-full">
		<div class="card max-w-[900px] rounded bg-base-200 p-4 shadow-lg border">
			<div class="grid gap-5 md:mx-auto md:max-w-5xl md:grid-cols-2">
				<AboutMe />
				<Details />
			</div>
		</div>
		<h1 class="my-6 text-4xl font-normal text-identifier">Experience</h1>
		<div class="card max-w-[900px] rounded bg-base-200 p-6 shadow-lg border">
			<Experience />
		</div>
		<h1 class="my-6 text-4xl font-normal text-identifier">Abilities</h1>
		<div class="card w-full max-w-[900px] rounded bg-base-200 p-6 shadow-lg border">
			<Abilities />
		</div>
		<h1 class="my-6 text-4xl font-normal text-identifier">Projects</h1>
		<div class="card w-full max-w-[900px] rounded bg-base-200 p-6 shadow-lg border">
			<Projects />
		</div>
		<h1 class="my-6 text-4xl font-normal text-identifier">Contacts</h1>
		<div class="card w-full max-w-[900px] rounded bg-base-200 p-6 shadow-lg border">
			<Contacts />
		</div>
	</div>
</main>
