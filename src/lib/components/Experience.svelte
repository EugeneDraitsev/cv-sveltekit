<script>
	import { base } from '$app/paths'; // Assuming you're using SvelteKit
	const careers = [
		{
			logo: `${base}/companies/yubico.png`,
			company: 'Yubico',
			location: 'Stockholm, Sweden',
			position: 'Senior Frontend Engineer',
			period: 'Oct 2022 - Now',
			description:
				'Redesign an e-commerce frontend solution from React to Sveltekit. Developing k8s infrastructure for frontend, CMS and e2e tests. Integrations with payment platforms, scalability and performance improvements.'
		},
		{
			logo: `${base}/companies/dw.png`,
			company: 'Daniel Wellington',
			location: 'Stockholm, Sweden',
			position: 'Senior Fullstack Engineer',
			period: 'June 2020 - Oct 2022',
			description:
				'Design and develop e-commerce frontend and serverless backend for the main store site. Integration of third-party services, scalability and performance improvements.'
		},
		{
			logo: `${base}/companies/ebuilder.png`,
			company: 'eBuilder',
			location: 'Stockholm, Sweden / Minsk, Belarus',
			position: 'Senior Software Engineer',
			period: 'Aug 2016 - June 2020',
			description:
				'Architect and develop frontend applications, React Native app, GraphQl services and AWS infrastructure for it (TypeScript/Node/React)'
		},
		{
			logo: `${base}/companies/issoft.png`,
			company: 'ISSoft Solutions',
			location: 'Minsk, Belarus',
			position: 'Senior Software Engineer',
			period: 'Sep 2013 - Aug 2016',
			description:
				'Develop and architect web applications (Java backend + Angular/React Fronted) for customers from USA and Norway. AWS and docker-based infrastructure'
		},
		{
			logo: `${base}/companies/qulix.png`,
			company: 'Qulix Systems',
			location: 'Minsk, Belarus',
			position: 'Software Engineer',
			period: 'Nov 2012 - Sep 2013',
			description: 'Support and develop web applications for bank systems (Java + Js/Jquery)'
		},
		{
			logo: `${base}/companies/epam.png`,
			company: 'Epam Systems',
			location: 'Minsk, Belarus',
			position: 'Junior Software Engineer',
			period: 'Dec 2011 - Nov 2012',
			description:
				'Work with some test project, small bugfixes in web-Java applications. Minor frontend tasks (Java/JQuery/Js)'
		}
	];

	const educations = [
		{
			logo: `${base}/companies/bsuir.png`,
			university: 'Belarusian State University of Informatics and Radioelectronics',
			location: 'Minsk, Belarus',
			degree: 'Specialist/Master in Computer Science',
			major: 'System Engineer',
			period: '2008 — 2013'
		}
	];
</script>

<div class="overflow-hidden sm:rounded-lg">
	<h2 class="mb-5 text-3xl font-normal text-declaration">Careers</h2>
	<span>[</span>
	<div class="ml-2">
		{#each careers as career}
			<div class="px-2">
				<span>{'{'}</span>
				<div class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center">
					<div class="w-15 h-15 mx-auto md:mx-5">
						<img
							alt="logo"
							loading="lazy"
							width="120"
							height="120"
							decoding="async"
							data-nimg="1"
							class="mb-2 ml-[-15px] max-w-[60px] rounded-full object-contain md:m-0"
							style="color: transparent"
							srcset="{career.logo} 1x, {career.logo} 2x"
							src={career.logo}
						/>
					</div>
					<div class="mr-4 flex min-w-[250px] flex-col text-center text-sm md:text-left">
						<span class="text-constant text-[16px]">{career.company}</span>
						<span class="text-declaration">{career.location}</span>
						<div>{career.position}</div>
						<div>{career.period}</div>
					</div>
					<div class="mt-4 text-center md:ml-4 md:mt-0 md:text-left">
						{career.description}
					</div>
				</div>
				<span>}</span>
				<span class="text-keyword">,</span>
			</div>
		{/each}
	</div>
	<span>]</span>
	<div class="mt-2"></div>
	<h2 class="mb-5 text-3xl font-normal text-declaration">Education</h2>
	<span>[</span>
	<div class="ml-2">
		{#each educations as education}
			<div class="px-2">
				<span>{'{'}</span>
				<div class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center">
					<div class="w-15 h-15 mx-auto md:mx-5">
						<img
							alt="logo"
							loading="lazy"
							width="120"
							height="120"
							decoding="async"
							data-nimg="1"
							class="mb-2 ml-[-15px] max-w-[60px] rounded-full object-contain md:m-0"
							style="color: transparent"
							srcset="{education.logo} 1x, {education.logo} 2x"
							src={education.logo}
						/>
					</div>
					<div class="min-w-250px mr-4 flex flex-col text-center text-sm md:text-left">
						<span class="text-constant text-lg">{education.university}</span>
						<span class="text-declaration">{education.location}</span>
						<div>{education.degree}</div>
						<div>{education.major}</div>
						<div>{education.period}</div>
					</div>
				</div>
				<span>}</span>
				<span class="text-keyword">,</span>
			</div>
		{/each}
	</div>
	<span>]</span>
</div>
