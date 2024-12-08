<script lang="ts">
  import Icon from '@iconify/svelte';
  import { SITE_DATA } from '$lib/constants';
</script>

<h2 class="subtitle">You can find me here</h2>
<div class="flex items-center justify-center space-x-2 py-4">
  <a class="transition-all hover:text-gray-500" href={SITE_DATA.socials.github} aria-label="github">
    <Icon icon="mdi:github" height="32" width="32" />
  </a>
  <a
    class="transition-all hover:text-blue-600"
    href={SITE_DATA.socials.linkedin}
    aria-label="linkedin"
  >
    <Icon icon="mdi:linkedin" height="32" width="32" />
  </a>
  <a
    class="transition-all hover:text-blue-400"
    href={SITE_DATA.socials.telergam}
    aria-label="telergam"
  >
    <Icon icon="mdi:telegram" height="32" width="32" />
  </a>
  <a
    class="transition-all hover:text-red-600"
    href="mailto:{SITE_DATA.socials.email}"
    aria-label="email"
  >
    <Icon icon="mdi:email" height="32" width="32" />
  </a>
</div>
