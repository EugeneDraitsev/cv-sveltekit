export const SITE_DATA = {
  siteTitle: 'Eugene Draitsev',
  siteDescription: 'Eugene Draitsev — Senior Full-Stack Engineer in Stockholm',
  githubUsername: 'EugeneDraitsev',
  keyWords: [
    'Eugene Draitsev',
    'software-engineer',
    'fullstack-engineer',
    'security',
    'kubernetes',
    'ai-agents',
    'webgl',
  ],
  authorDescription: `Hi, I'm Eugene—a full-stack engineer who enjoys the awkward middle between a promising idea
  and a system people can trust. I have been building production software since 2011, from commerce and
  authentication flows to cloud platforms, AI agents and WebGL experiments. I am happiest when the problem
  is still a little messy: shape the first useful version, make the trade-offs visible, ship it, then harden
  what survives contact with real users. My current toolkit is centered on Svelte, React, TypeScript,
  Kubernetes and AWS/GCP, with a growing amount of security, agentic systems and Three.js work.`,
  profileHighlights: [
    'I work across the full delivery loop: discovery, scoping, architecture, implementation, rollout and the unglamorous fixes after launch.',
    'Current rabbit holes: security and passkeys, Kubernetes, AI agent reliability, tool execution, observability and real-time graphics.',
  ],
  deliveryHighlights: [
    {
      title: 'Yubico x OpenAI partner launch',
      text: 'Helped deliver Yubico’s side of the public OpenAI Advanced Account Security / YubiKey bundle in spring 2026.',
      result:
        'Shipped partner API integration, a custom product page, checkout flow and authorization handoff across Yubico ecommerce and account systems.',
      href: 'https://openai.com/index/advanced-account-security/',
      linkLabel: 'public launch',
      tags: ['Partner launch', 'Checkout', 'Auth handoff'],
    },
    {
      title: 'Customer Accounts / FIDO2 authorization',
      text: 'I work directly with Yubico’s authentication and security teams on an organization-wide authorization flow for future products.',
      result:
        'Helped scope service details and integrate the flow across product surfaces, ecommerce, account systems and multiple internal teams.',
      tags: ['FIDO2', 'Security', 'Multi-team'],
    },
    {
      title: 'LLM-powered agentic system',
      text: 'Evolved a long-running Telegram bot from local chat utilities into a production-like LLM-powered agent system.',
      result:
        'Built async workers, reply gating, model routing and fallbacks, tool execution, memory, metrics and feedback loops around real group-chat behavior.',
      tags: ['AI agents', 'Tools', 'Observability'],
    },
    {
      title: 'Commerce launches and operational readiness',
      text: 'Delivered customer-facing third-party commerce work across Yubico and Daniel Wellington.',
      result:
        'Supported local payment methods, regional store launches, campaign delivery and Black Friday readiness under production launch constraints.',
      tags: ['Payments', 'Regional rollout', 'Launch support'],
    },
  ],
  experienceStartDate: '2011-12-01',
  details: {
    name: 'Eugene Draitsev',
    birthDate: '1990-10-02',
    position: 'Senior Full-Stack Engineer',
    location: 'Stockholm, Sweden',
  },
  skills: [
    {
      name: 'Programming Languages',
      data: [
        { name: 'JavaScript', value: 5 },
        { name: 'TypeScript', value: 5 },
        { name: 'HTML', value: 5 },
        { name: 'CSS', value: 5 },
        { name: 'Rust', value: 3 },
        { name: 'Java', value: 3.5 },
        { name: 'Swift', value: 3 },
      ],
    },
    {
      name: 'Tools & Technologies',
      data: [
        { name: 'React / Next', value: 5 },
        { name: 'Svelte / SvelteKit', value: 5 },
        { name: 'React Native', value: 4.5 },
        { name: 'AWS', value: 4 },
        { name: 'Kubernetes', value: 4 },
        { name: 'Node', value: 4.5 },
        { name: 'AI Agents', value: 4 },
        { name: 'Three.js / WebGL', value: 4.5 },
        { name: 'Security/Auth', value: 4 },
        { name: 'Observability', value: 4 },
        { name: 'D3', value: 4.5 },
        { name: 'GraphQL', value: 4.5 },
        { name: 'Angular', value: 3.5 },
        { name: 'Vue', value: 3.5 },
        { name: 'SQL Databases', value: 3.5 },
        { name: 'NoSQL Databases', value: 4.5 },
      ],
    },
  ],
  languages: [
    { name: 'Russian', value: 5 },
    { name: 'English', value: 4.5 },
    { name: 'Belarusian', value: 5 },
  ],
  careers: [
    {
      company: 'Yubico',
      logo: 'companies/yubico.webp',
      period: 'Oct 2022 – now',
      location: 'Stockholm, Sweden',
      position: 'Senior Frontend Engineer',
      description: `Building Customer Accounts and ecommerce flows for Yubico, including passkeys/WebAuthn,
       custom authentication and recovery, cross-service authorization and payment integrations. Helped ship
       Yubico’s side of the public OpenAI Advanced Account Security launch—from the partner API and product page
       to checkout and authorization handoff. I also work on organization-wide FIDO2 authorization,
       React-to-SvelteKit migration and Kubernetes infrastructure for the frontend, CMS and end-to-end testing.`,
    },
    {
      company: 'Daniel Wellington',
      logo: 'companies/dw.webp',
      period: 'Jun 2020 – Oct 2022',
      location: 'Stockholm, Sweden',
      position: 'Senior Fullstack Engineer',
      description: `Designed and built frontend experiences and backend services for the main ecommerce site.
      Delivered third-party integrations, local payment methods and regional store launches, then helped the platform
      stay fast and reliable through campaigns and Black Friday traffic.`,
    },
    {
      company: 'eBuilder',
      logo: 'companies/ebuilder.webp',
      period: 'Aug 2016 – Jun 2020',
      location: 'Stockholm, Sweden / Minsk, Belarus',
      position: 'Senior Software Engineer',
      description: `Architected and delivered customer-facing web applications, a React Native app,
      GraphQL services and AWS infrastructure with TypeScript, Node.js and React.`,
    },
    {
      company: 'ISSoft Solutions',
      logo: 'companies/issoft.webp',
      period: 'Sep 2013 – Aug 2016',
      location: 'Minsk, Belarus',
      position: '(Senior) Software Engineer',
      description: `Developed and architected web products for customers in the US and Norway,
       combining Java backends, Angular and React frontends, AWS and Docker-based infrastructure.`,
    },
    {
      company: 'Qulix Systems',
      logo: 'companies/qulix.webp',
      period: 'Nov 2012 – Sep 2013',
      location: 'Minsk, Belarus',
      position: 'Software Engineer',
      description:
        'Supported and developed Java web applications and JavaScript/jQuery interfaces for banking systems.',
    },
    {
      company: 'Epam Systems',
      logo: 'companies/epam.webp',
      period: 'Dec 2011 – Nov 2012',
      location: 'Minsk, Belarus',
      position: 'Junior Software Engineer',
      description:
        'Started with internal training projects, then shipped bug fixes and small frontend features for Java web applications.',
    },
  ],
  educations: [
    {
      name: 'Belarusian State University of Informatics and Radioelectronics',
      logo: 'companies/bsuir.webp',
      period: '2008 - 2013',
      major: 'System Engineer',
      degree: 'Specialist/Master in Computer Science',
      location: 'Minsk, Belarus',
    },
  ],
  socials: {
    telergam: 'https://t.me/drrrrrrrr',
    linkedin: 'https://www.linkedin.com/in/eugenedraitsev/',
    github: 'https://github.com/EugeneDraitsev',
    email: 'ddrrai@gmail.com',
  },
  siteUrl: 'https://eugene-draitsev.vercel.app/',
  pdf: '/eugene-draitsev.pdf',
  headerLinks: [
    {
      label: 'Home',
      href: '/',
    },
    {
      label: 'Blog',
      href: '/blog',
    },
    {
      label: 'About',
      href: '/about',
    },
  ],
} as const;
