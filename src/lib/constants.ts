export const SITE_DATA = {
  siteTitle: 'Eugene Draitsev',
  siteDescription: 'Eugene Draitsev CV',
  githubUsername: 'EugeneDraitsev',
  authorDescription: `Hi, my name is Eugene and I'm a software engineer. I like math, science, cats, algorithms, good UX
  and other boring things. I started working as a developer in 2011 and received my system engineer diploma
  from BSUIR in 2013. Almost all my experience has been as a fullstack developer (Node/Java + Frontend). 
  I really like functional programming, serverless approach and cloud platforms. 
  Currently, I'm working as a fullstack developer, mainly with Svelte, React, TypeScript, k8s, and AWS/GCP`,
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
      description: `Redesign an e-commerce frontend solution from React to Sveltekit. Developing k8s infrastructure
       for frontend, CMS and e2e tests. Integrations with payment platforms, scalability and performance improvements.`,
    },
    {
      company: 'Daniel Wellington',
      logo: 'companies/dw.webp',
      period: 'June 2020 – Oct 2022',
      location: 'Stockholm, Sweden',
      position: 'Senior Fullstack Engineer',
      description: `Design and develop e-commerce frontend and serverless backend for the main store site.
      Integration of third-party services, scalability and performance improvements.`,
    },
    {
      company: 'eBuilder',
      logo: 'companies/ebuilder.webp',
      period: 'Aug 2016 –  June 2020',
      location: 'Stockholm, Sweden / Minsk, Belarus',
      position: 'Senior Software Engineer',
      description: `Architect and develop frontend applications, React Native app, 
      GraphQl services and AWS infrastructure for it (TypeScript/Node/React)`,
    },
    {
      company: 'ISSoft Solutions',
      logo: 'companies/issoft.webp',
      period: 'Sep 2013  –  Aug 2016',
      location: 'Minsk, Belarus',
      position: '(Senior) Software Engineer',
      description: `Develop and architect web applications (Java backend + Angular/React Fronted) for customers
       from USA and Norway. AWS and docker-based infrastructure`,
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
      label: 'About',
      href: '/about',
    },
  ],
} as const;
