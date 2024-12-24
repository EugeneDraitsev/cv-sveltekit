import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request }) => {
  const headers = request.headers;
  const userAgent = headers.get('user-agent');

  /*
    We want to delay animation until user interaction for some specific user agents.
   */
  return {
    interactiveAnimation: userAgent?.includes('Chrome-'),
  };
};
