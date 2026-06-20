export const SITE_DATA = {
  siteTitle: 'Eugene Draitsev',
  siteDescription: 'Eugene Draitsev CV - Senior Fullstack Engineer in Stockholm',
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
  authorDescription: `Hi, my name is Eugene and I'm a software engineer. I like math, science, algorithms, good UX
  and other boring things. I started working as a developer in 2011 and received my system engineer diploma
  from BSUIR in 2013. Most of my experience has been as a fullstack developer (Node/Java + Frontend).
  I'm especially into functional programming, security engineering, k8s, cloud platforms and graphics work
  with Three.js/WebGL. Currently, I'm working as a fullstack developer, mainly with Svelte, React,
  TypeScript, k8s, and AWS/GCP. I enjoy taking messy product and platform problems, building the first
  useful version, then hardening it into production software that teams can operate and improve.`,
  profileHighlights: [
    'Hands-on with product delivery: scoping, trade-offs, technical communication and production rollout.',
    'Strong current focus on security, auth/passkeys, k8s, AI agents, Three.js/WebGL, tool execution and observability.',
  ],
  deliveryHighlights: [
    {
      title: 'Yubico x OpenAI partner launch',
      text: 'Helped deliver the Yubico side of the public OpenAI Advanced Account Security / YubiKey bundle in spring 2026.',
      result:
        'Shipped partner API integration, a custom product page, checkout flow and authorization handoff across Yubico ecommerce and account systems.',
      href: 'https://openai.com/index/advanced-account-security/',
      linkLabel: 'public launch',
      tags: ['Partner launch', 'Checkout', 'Auth handoff'],
    },
    {
      title: 'Customer Accounts / FIDO2 authorization',
      text: 'Work directly with Yubico auth and security teams on an organization-wide authorization flow for future products.',
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
    position: 'Senior Fullstack Engineer',
    location: 'Stockholm, Sweden',
  },
  skills: [
    {
      name: 'Programming Languages',
      data: [
        { name: 'Javascript', value: 5 },
        { name: 'Typescript', value: 5 },
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
        { name: 'Svelte / Sveltekit', value: 5 },
        { name: 'ReactNative', value: 4.5 },
        { name: 'AWS', value: 4 },
        { name: 'K8s', value: 4 },
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
      period: 'Oct 2022 –  Now',
      location: 'Stockholm, Sweden',
      position: 'Senior Frontend Engineer',
      description: `Building Customer Accounts and ecommerce flows for Yubico: passkeys/WebAuthn,
       custom auth and recovery, cross-service authorization and payment integrations. Supported the public
       OpenAI Advanced Account Security / YubiKey launch from the Yubico side, including partner integration,
       product page, checkout and authorization handoff. Also working on organization-wide FIDO2 authorization,
       React-to-SvelteKit migration and k8s infrastructure for frontend, CMS and e2e testing.`,
    },
    {
      company: 'Daniel Wellington',
      logo: 'companies/dw.webp',
      period: 'June 2020 – Oct 2022',
      location: 'Stockholm, Sweden',
      position: 'Senior Fullstack Engineer',
      description: `Designed and developed the e-commerce frontend and backend services for the main store site.
      Delivered third-party integrations and customer-facing workflows across local payment methods, regional store
      launches, campaign support, Black Friday readiness, scalability and performance improvements.`,
    },
    {
      company: 'eBuilder',
      logo: 'companies/ebuilder.webp',
      period: 'Aug 2016 –  June 2020',
      location: 'Stockholm, Sweden / Minsk, Belarus',
      position: 'Senior Software Engineer',
      description: `Architected and delivered frontend applications, a React Native app,
      GraphQL services and AWS infrastructure for customer-facing products (TypeScript/Node/React).`,
    },
    {
      company: 'ISSoft Solutions',
      logo: 'companies/issoft.webp',
      period: 'Sep 2013  –  Aug 2016',
      location: 'Minsk, Belarus',
      position: '(Senior) Software Engineer',
      description: `Developed and architected web applications for customers from the USA and Norway
       with Java backends, Angular/React frontends, AWS and Docker-based infrastructure.`,
    },
    {
      company: 'Qulix Systems',
      logo: 'companies/qulix.webp',
      period: 'Nov 2012 –  Sep 2013',
      location: 'Minsk, Belarus',
      position: 'Software Engineer',
      description: 'Support and develop web applications for bank systems (Java + Js/Jquery)',
    },
    {
      company: 'Epam Systems',
      logo: 'companies/epam.webp',
      period: 'Dec 2011 – Nov 2012',
      location: 'Minsk, Belarus',
      position: 'Junior Software Engineer',
      description:
        'Work with some test project, small bugfixes in web-Java applications. Minor frontend tasks (Java/JQuery/Js)',
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
