<script>
  import { SITE_DATA } from '$lib/constants';

  const { careers, educations } = SITE_DATA;
</script>

<div class="overflow-hidden sm:rounded-lg">
  <h2 class="subtitle">Careers</h2>
  <span>[</span>
  <div class="ml-2">
    {#each careers as career}
      <div class="px-2">
        <span>{'{'}</span>
        <div
          class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center"
        >
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
          <div
            class="mr-4 flex min-w-[250px] flex-col text-center text-sm md:text-left"
          >
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

  <h2 class="subtitle">Education</h2>
  <span>[</span>
  <div class="ml-2">
    {#each educations as education}
      <div class="px-2">
        <span>{'{'}</span>
        <div
          class="flex flex-col items-stretch justify-stretch md:flex-row md:items-center"
        >
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
          <div
            class="min-w-250px mr-4 flex flex-col text-center text-sm md:text-left"
          >
            <span class="text-constant text-lg">{education.name}</span>
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
