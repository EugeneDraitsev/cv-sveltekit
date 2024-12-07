<script lang="ts">
	import StarRating from '$lib/components/StarRating.svelte';

	const skills = {
		Javascript: 10,
		Typescript: 10,
		HTML: 10,
		CSS: 10,
		Rust: 6,
		Java: 7,
		Swift: 6
	};

	const toolsAndTechnologies = {
		'React / Next': 10,
		'Svelte / Sveltekit': 10,
		ReactNative: 9,
		AWS: 8,
		K8s: 8,
		Node: 9,
		D3: 9,
		GraphQL: 9,
		Angular: 7,
		Vue: 7,
		'SQL Databases': 8,
		'NoSQL Databases': 9
	};

	const languages = {
		Russian: 10,
		English: 9
	};
</script>

<div>
	<h2 class="text-declaration mb-5 text-3xl font-normal">Skills</h2>
	<div class="grid grid-cols-1 sm:grid-cols-[300px_300px]">
		<div>
			<div>Programming Languages:</div>
			<div class="mt-2"></div>

			<span>{'{'}</span>
			<div class="ml-4">
				{#each Object.entries(skills) as [skill, rating]}
					<div class="flex items-center">
						<span class="text-constant">{skill}: </span>
						<div class="ml-2 flex">
							<StarRating {rating} />
						</div>
						<span class="text-keyword">,</span>
					</div>
				{/each}
			</div>
			<span>}</span>
		</div>

		<div>
			<div>Tools & Technologies:</div>
			<div class="mt-2"></div>

			<span>{'{'}</span>
			<div class="ml-4">
				{#each Object.entries(toolsAndTechnologies) as [tool, rating]}
					<div class="flex items-center">
						<span class="text-constant">{tool}: </span>
						<div class="flex ml-2">
							<StarRating {rating} />
						</div>
						<span class="text-keyword">,</span>
					</div>
				{/each}
			</div>
			<span>}</span>
		</div>
	</div>

	<h2 class="text-declaration mb-5 text-3xl font-normal">Languages</h2>
	<span>{'{'}</span>
	<div class="ml-4">
		{#each Object.entries(languages) as [language, rating]}
			<div class="flex items-center">
				<span class="text-constant">{language}: </span>
				<div class="flex ml-2">
					<StarRating {rating} />
				</div>
				<span class="text-keyword">,</span>
			</div>
		{/each}
	</div>
	<span>}</span>
</div>
