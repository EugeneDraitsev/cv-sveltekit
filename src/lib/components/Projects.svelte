<script>
	const repositories = [
		{
			name: 'telegram-bot-app',
			description: 'Telegram Bot App',
			url: 'https://github.com/EugeneDraitsev/telegram-bot-app',
			updated: 'Thu, 05 Dec 2024 20:08:30 GMT',
			stars: 7
		},
		{
			name: 'telegram-bot-ui',
			description: '',
			url: 'https://github.com/EugeneDraitsev/telegram-bot-ui',
			updated: 'Sun, 15 Sep 2024 20:32:36 GMT',
			stars: 9
		},
		{
			name: 'glsl-plugin-idea',
			description: "GLSL support for JetBrains IDE's",
			url: 'https://github.com/EugeneDraitsev/glsl-plugin-idea',
			updated: 'Tue, 16 Jul 2024 12:28:36 GMT',
			stars: 0
		},
		{
			name: 'swr-auth',
			description: '',
			url: 'https://github.com/EugeneDraitsev/swr-auth',
			updated: 'Tue, 14 May 2024 17:16:33 GMT',
			stars: 0
		},
		{
			name: 'jobs-progress-bar',
			description: '',
			url: 'https://github.com/EugeneDraitsev/jobs-progress-bar',
			updated: 'Thu, 09 May 2024 17:44:34 GMT',
			stars: 0
		}
	];
</script>

<div>
	<h2 class="mb-5 text-3xl font-normal text-declaration">Latest repositories on Github</h2>
	{#each repositories as repository}
		<div class="mb-3 flex items-center justify-between border-b border-gray-500 pb-3">
			<div class="flex-1">
				<a href={repository.url} class="cursor-pointer font-bold text-constant underline">
					{repository.name}
				</a>
				<p class="py-1.5">{repository.description}</p>
				<p class="text-xs">Updated: {repository.updated}</p>
			</div>
			<div class="ml-1.5 flex min-w-[30px] items-center space-x-2 text-white">
				<p class="mb-0.75 text-lg">★</p>
				<div>{repository.stars}</div>
			</div>
		</div>
	{/each}
</div>
