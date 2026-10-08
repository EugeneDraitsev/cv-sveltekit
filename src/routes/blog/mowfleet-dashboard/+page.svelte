<script lang="ts">
  import SocialImage from '$lib/components/SocialImage.svelte';
  import PostDates from '$lib/components/PostDates.svelte';
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';
  import { getBlogPost, serializeJsonLd } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const post = getBlogPost('mowfleet-dashboard');
  const canonicalUrl = new URL(`/blog/${post.slug}`, SITE_DATA.siteUrl).href;
  const socialImageUrl = new URL(post.socialImage, SITE_DATA.siteUrl).href;
  const postSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: socialImageUrl,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    mainEntityOfPage: canonicalUrl,
    author: { '@type': 'Person', name: SITE_DATA.details.name, url: SITE_DATA.siteUrl },
  };

  const facts = [
    'Designed and built the dashboard, backend services, data model and deployment, starting in 2023.',
    'Periodic contract engagement covering production support and targeted feature work.',
    'MowFleet Control Center is an operations dashboard for autonomous mower fleets.',
    'Next.js 16 dashboard with React 19, Tailwind 4, daisyUI 5, SWR, Chart.js, Google Maps and react-pdf, hosted on Vercel.',
    'Serverless Framework v4 backend on AWS Lambda (Node 24, arm64), API Gateway, DynamoDB and S3 in eu-central-1.',
    'Husqvarna OAuth and Fleet Services APIs are the source of users, access groups, mower state, utilization and errors.',
    'The integration includes a partly reverse-engineered Husqvarna web and Fleet Services surface.',
    'Scheduled Lambdas sync activity and live snapshots every 5 minutes, access groups hourly, utilization and errors every 2 hours, and season summaries daily.',
    'Most support work is triggered by vendor API changes or new operational requirements.',
    'The application covers fleet analytics, zones, maps, mower state, live warnings, activity history, settings and PDF reports.',
  ];

  const productAreas = [
    {
      title: 'Fleet overview',
      text: 'Utilization summary, mower counts, error summaries, zone coverage, cumulative energy and CO2 savings, and monthly labor savings.',
    },
    {
      title: 'Live warnings',
      text: 'A live panel, refreshed every minute, flags mowers with no loop signal, a cutting height under 45 mm, mowers that stopped reporting and charging that did not verify: visibility Husqvarna removed from Automower Connect.',
    },
    {
      title: 'Mowers and errors',
      text: 'Individual machines, their current issues and historical error details, grouped through Husqvarna access groups.',
    },
    {
      title: 'Activity and zones',
      text: 'Mowing sessions become heatmaps and zone coverage views, so customers can see where the mowers worked.',
    },
    {
      title: 'Maps and reporting',
      text: 'Admins manage GeoJSON map data and generate PDF reports from the same chart data the dashboard shows.',
    },
  ];

  const operatingRhythm = [
    { value: '5 min', label: 'activity and live sync' },
    { value: '1 hour', label: 'access-group sync' },
    { value: '2 hours', label: 'utilization + errors' },
    { value: '24 hours', label: 'season summary' },
  ];

  const dataPath = [
    {
      name: 'Husqvarna OAuth',
      detail: 'per-user sign-in; a server route exchanges the code',
      owner: 'vendor',
    },
    {
      name: 'Fleet Services web API',
      detail: 'live mower inventory and status, read in the browser',
      owner: 'vendor',
    },
    {
      name: 'Scheduled Lambda sync',
      detail: 'activity, live snapshots, utilization and errors on timers',
      owner: 'MowFleet',
    },
    {
      name: 'DynamoDB + S3',
      detail: 'normalized history, GeoJSON zones and season summaries',
      owner: 'MowFleet',
    },
    {
      name: 'MCC API endpoints',
      detail: 'the query shapes the dashboard asks for',
      owner: 'MowFleet',
    },
    {
      name: 'Dashboard + reports',
      detail: 'operator screens and the customer-facing PDF',
      owner: 'MowFleet',
    },
  ];

  const screenshots = [
    {
      src: '/blog/mowfleet-dashboard/dashboard-overview.webp',
      alt: 'MowFleet Control Center dashboard overview with utilization, zone coverage, savings and stop-time charts',
      caption:
        'Dashboard overview: utilization against planned operating time, zone coverage, savings and the main error distribution.',
    },
    {
      src: '/blog/mowfleet-dashboard/zones-coverage.webp',
      alt: 'MowFleet zones coverage map and weekly zone status table',
      caption:
        'Zones view: GeoJSON customer zones over Google Maps, weekly coverage status and zone-by-zone history.',
    },
    {
      src: '/blog/mowfleet-dashboard/mowers-list.webp',
      alt: 'MowFleet mowers list with mower status, battery, cutting height and recent error details',
      caption:
        'Mowers view: status, battery, cutting height, last known location, daily utilization and translated error descriptions.',
    },
  ];

  const deliverySignals = [
    'Requirements came from fleet operations, reporting obligations, access-group permissions and field-support workflows.',
    'Implementation covered the Next.js application, API surface, scheduled ingestion, storage, OAuth, maps, charts and report generation.',
    'Production support has included report discrepancies, missing utilization data, EPOS compatibility, live warnings and data requirements for a future mobile client.',
  ];

  const engineeringDecisions = [
    {
      title: 'Use access groups as the tenancy boundary',
      text: 'Dashboard queries and backend endpoints filter by Husqvarna access group, separating root administration from customer-scoped views.',
    },
    {
      title: 'Normalize vendor data before reads',
      text: 'Scheduled Lambdas copy vendor data into DynamoDB tables shaped for the dashboard’s queries, so historical charts never call Husqvarna per request.',
    },
    {
      title: 'Keep the OAuth exchange server-side',
      text: 'A Next.js API route exchanges the OAuth code on the server, so the app secret never reaches the browser.',
    },
    {
      title: 'Treat maps as operational data',
      text: 'Zone maps are GeoJSON files in S3, not frontend assets, so customer maps change without rebuilding the dashboard.',
    },
    {
      title: 'Reuse dashboard data in reports',
      text: 'PDFs are generated client-side with react-pdf. Charts are rendered, captured as images and reused inside reports, so exported documents match the dashboard.',
    },
    {
      title: 'Know where the vendor still leaks in',
      text: 'Live mower status is still read straight from Husqvarna’s Fleet Services web API in the browser, and every backend request checks the user against Husqvarna, cached for five minutes. Those are the two places an upstream change can still reach the screen.',
    },
    {
      title: 'Design for unattended operation',
      text: 'Serverless deployment, managed storage and scheduled ingestion keep the number of things that need watching small. A failed sync is retried on the next schedule.',
    },
  ];

  const supportSignals = [
    'Investigating why Utilization Summary can stop showing activity while Zones Coverage still proves that robots were mowing.',
    'Explaining utilization calculations when customer reports reveal domain rules such as zones mowed only every other week.',
    'Checking support for Husqvarna 580 EPOS and 540 EPOS robots used in a MowFleet hybrid setup.',
    'Building live warnings to replace visibility Husqvarna removed from Automower Connect for customer staff: charging, no loop signal and cutting height.',
    'Helping future app work align with the existing backend data flow and MCC data model.',
  ];

  const nextSteps = [
    'Chunk and parallelize the sync jobs so large fleets stay well inside Lambda limits, and isolate accounts so one failing account does not abort a run.',
    'Redesign the oldest DynamoDB access patterns around accessGroupId where it would reduce query cost and filtering.',
    'Push alerts by email or SMS on top of the live warnings.',
    'Move the remaining live Husqvarna reads behind the backend, so the browser only talks to MowFleet’s API.',
    'Add contract tests around Husqvarna response shapes, because the external API is the riskiest moving part.',
  ];
</script>

<svelte:head>
  <title>MowFleet Control Center case study | Eugene Draitsev</title>
  <meta
    name="description"
    content="Architecture and implementation of MowFleet Control Center: a Next.js operations dashboard and serverless AWS pipeline for autonomous mower fleet data."
  />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content={post.title} />
  <meta property="og:description" content={post.description} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="article:published_time" content={post.datePublished} />
  <meta property="article:modified_time" content={post.dateModified} />
  <svelte:element this={"script"} type="application/ld+json">
    {serializeJsonLd(postSchema)}
  </svelte:element>
</svelte:head>

<SocialImage src={post.socialImage} alt={post.title} />

<main id="main-content" class="overlapped blog-page" tabindex="-1">
  <article class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <a
        class="inline-flex items-center gap-2 text-sm text-constant underline"
        href={resolve('/blog')}
      >
        <Icon icon="mdi:arrow-left" height="18" width="18" />
        Back to posts
      </a>

      <div class="mt-6 mb-8">
        <p class="mb-3 text-xs text-keyword uppercase sm:text-sm">
          Hobby-freelance project · since 2023
        </p>
        <h1 class="blog-title">MowFleet Control Center: operating an autonomous mower fleet</h1>
        <p class="post-meta">
          <PostDates added={post.datePublished} updated={post.dateModified} />
        </p>
        <p class="blog-lead">
          MowFleet runs fleets of autonomous Husqvarna mowers, and its customers ask a simple
          question: did the robots mow the site? I designed and built MowFleet Control Center (MCC),
          a Next.js dashboard backed by a serverless AWS pipeline. It turns Husqvarna fleet data
          into coverage, utilization, errors, live warnings and PDF reports. I started it in 2023
          and still maintain it.
        </p>
        <div class="mt-5 flex flex-wrap gap-3 text-sm">
          <span class="inline-flex items-center gap-2 text-constant">
            <Icon icon="mdi:view-dashboard-outline" height="18" width="18" />
            mowfleet-dashboard
          </span>
          <span class="inline-flex items-center gap-2 text-constant">
            <Icon icon="mdi:aws" height="18" width="18" />
            mowfleet-backend
          </span>
        </div>
      </div>

      <section class="mb-10">
        <h2 class="section-heading">Built to run unattended</h2>
        <p class="mb-4">
          Nobody works on MCC full-time, me included. That drove most choices: managed AWS services,
          few moving parts, and sync jobs that simply retry on the next schedule. My part covered
          requirements, architecture, implementation and rollout, plus support when the vendor API
          changes.
        </p>
        <dl class="stat-strip mb-8">
          {#each operatingRhythm as item (item)}
            <div class="stat">
              <dt class="stat-value">{item.value}</dt>
              <dd class="stat-label">{item.label}</dd>
            </div>
          {/each}
        </dl>
        <ul class="factlist">
          {#each facts as fact (fact)}
            <li>{fact}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Architecture</h2>
        <p class="mb-5">
          Husqvarna OAuth and a partly reverse-engineered Fleet Services API feed scheduled Lambda
          jobs, which normalize the responses into DynamoDB; GeoJSON zones and season summaries live
          in S3. Historical charts read MowFleet's own API. Live mower status is still read straight
          from Husqvarna in the browser.
        </p>
        <ZoomableImage
          src="/blog/mowfleet-dashboard/architecture-light.svg"
          darkSrc="/blog/mowfleet-dashboard/architecture-dark.svg"
          alt="MowFleet Control Center architecture diagram"
          aspect="flow"
          figureClass="diagram"
          imageClass="w-full rounded bg-base-100"
          caption="High-level architecture from June 2026, generated from Mermaid source in both MowFleet repos. It predates the live snapshots."
        />
      </section>

      <section class="mb-10">
        <h2 class="section-heading">What operators get</h2>
        <div class="rulelist">
          {#each productAreas as area, index (index)}
            <article class="rule">
              <span class="rule-index">{String(index + 1).padStart(2, '0')}</span>
              <h3 class="rule-title">{area.title}</h3>
              <p class="rule-text">{area.text}</p>
            </article>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Operator workflows</h2>
        <p class="mb-5">
          Operators need to correlate mower state, zone-level activity and customer reporting data.
          The screens are dense on purpose and organized around investigations such as a missed
          coverage target, an inactive machine or a gap between utilization and recorded mowing
          sessions.
        </p>
        <div class="grid gap-5">
          {#each screenshots as screenshot (screenshot)}
            <ZoomableImage
              src={screenshot.src}
              alt={screenshot.alt}
              figureClass="diagram"
              imageClass="w-full rounded border border-base-300"
              caption={screenshot.caption}
            />
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Two kinds of reads</h2>
        <p class="mb-5">
          Sign-in and live mower status go through Husqvarna directly. Historical activity,
          utilization and error data come from scheduled jobs and MowFleet's own AWS stores, so the
          historical charts make no per-mower vendor calls. Sign-in checks, cached for five minutes,
          and live status still depend on Husqvarna.
        </p>
        <p class="mb-4 text-sm text-declaration">
          From external fleet data to customer-facing operations
        </p>
        <ol class="trace">
          {#each dataPath as step, index (index)}
            <li class="trace-step">
              <span class="trace-index">{String(index + 1).padStart(2, '0')}</span>
              <span class="trace-name">{step.name}</span>
              <span class="trace-detail">{step.detail}</span>
              <span class="trace-exit">{step.owner}</span>
            </li>
          {/each}
        </ol>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Scope</h2>
        <p class="mb-4">
          I built every layer myself, from requirements to vendor ingestion to the PDF the customer
          receives:
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each deliverySignals as signal (signal)}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Design decisions</h2>
        <div class="rulelist">
          {#each engineeringDecisions as decision, index (index)}
            <article class="rule">
              <span class="rule-index">{String(index + 1).padStart(2, '0')}</span>
              <h3 class="rule-title">{decision.title}</h3>
              <p class="rule-text">{decision.text}</p>
            </article>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="section-heading">Support cases</h2>
        <p class="mb-4">
          Most support starts when something on screen stops matching what happened in the field.
          Typical cases:
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each supportSignals as signal (signal)}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section>
        <h2 class="section-heading">What I'd tackle next</h2>
        <p class="mb-4">
          Most of the remaining risk sits at the vendor boundary and in the largest sync jobs:
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each nextSteps as step (step)}
            <li>{step}</li>
          {/each}
        </ul>
      </section>
    </div>
  </article>
</main>

<style>
  .factlist {
    display: grid;
    gap: 0.55rem;
    list-style: none;
    padding: 0;
    font-size: 0.875rem;
  }

  .factlist li {
    border-left: 1px solid var(--color-base-300);
    padding-left: 0.9rem;
    color: color-mix(in srgb, var(--color-identifier) 82%, transparent);
  }

  @media (min-width: 768px) {
    .factlist {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem 2rem;
    }
  }
</style>
