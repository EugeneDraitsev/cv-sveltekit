import fs from 'fs/promises';
import path from 'path';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const filePath = path.join(process.cwd(), 'static', 'lighthouse-report.html');
  const lighthouseData = await fs.readFile(filePath, 'utf-8');

  // Return data to the +page.svelte file
  return { lighthouseData };
};
