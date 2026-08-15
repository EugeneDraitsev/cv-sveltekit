<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';
  import { formatPostDate, getBlogPost, serializeJsonLd } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const post = getBlogPost('mowfleet-dashboard');
  const canonicalUrl = new URL(`/blog/${post.slug}`, SITE_DATA.siteUrl).href;
  const socialImageUrl = new URL(post.image, SITE_DATA.siteUrl).href;
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
    'Designed and implemented the dashboard, backend services, data model and deployment architecture.',
    'Periodic contract engagement covering production support and targeted feature work.',
    'MowFleet Control Center is an operations dashboard for autonomous mower fleets.',
    'The product has no dedicated full-time engineer, so managed services and low operational overhead are explicit constraints.',
    'Next.js dashboard with React, Tailwind, daisyUI, SWR, Chart.js, Google Maps and react-pdf.',
    'Serverless Framework backend on AWS Lambda, API Gateway, DynamoDB and S3 in eu-central-1.',
    'Husqvarna OAuth and Fleet Services APIs are the source of users, access groups, mower state, utilization and errors.',
    'The integration includes undocumented and legacy Husqvarna web and Fleet Services surfaces.',
    'Scheduled sync lambdas collect activity every 5 minutes, access groups hourly, and utilization/errors every 2 hours.',
    'Most support work is triggered by vendor API changes or new operational requirements.',
    'The application covers fleet analytics, zones, maps, mower state, activity history, settings and PDF reports.',
  ];

  const productAreas = [
    {
      title: 'Fleet overview',
      text: 'Utilization summary, mower counts, error summaries, zone coverage and cumulative savings for energy, CO2 and labor.',
    },
    {
      title: 'Mowers and errors',
      text: 'A working view of individual machines, current issues and historical error details, grouped through Husqvarna access groups.',
    },
    {
      title: 'Activity and zones',
      text: 'Mowing sessions become heatmaps and zone coverage views, so customers can see where autonomous mowers actually worked.',
    },
    {
      title: 'Maps and reporting',
      text: 'Admins can manage GeoJSON map data and generate PDF reports from the same chart data used by the live dashboard.',
    },
  ];

  const operatingRhythm = [
    { value: '5 min', label: 'activity sync' },
    { value: '1 hour', label: 'access-group sync' },
    { value: '2 hours', label: 'utilization + errors' },
    { value: 'Low-touch', label: 'maintenance model' },
  ];

  const screenshots = [
    {
      src: '/blog/mowfleet-dashboard/dashboard-overview.png',
      alt: 'MowFleet Control Center dashboard overview with utilization, zone coverage, savings and stop-time charts',
      caption:
        'Dashboard overview: utilization against planned operating time, zone coverage, savings and the main error distribution.',
    },
    {
      src: '/blog/mowfleet-dashboard/zones-coverage.png',
      alt: 'MowFleet zones coverage map and weekly zone status table',
      caption:
        'Zones view: GeoJSON customer zones over Google Maps, weekly coverage status and detailed zone-by-zone history.',
    },
    {
      src: '/blog/mowfleet-dashboard/mowers-list.png',
      alt: 'MowFleet mowers list with mower status, battery, cutting height and recent error details',
      caption:
        'Mowers view: machine-level status, battery, cutting height, location history and translated operational errors.',
    },
  ];

  const deliverySignals = [
    'Requirements were derived from fleet operations, reporting obligations, access-group permissions and field-support workflows.',
    'Implementation covered the Next.js application, API surface, scheduled ingestion, storage, OAuth, maps, charts and report generation.',
    'Production support has included report discrepancies, missing utilization data, EPOS compatibility and data requirements for a future mobile client.',
    'Because no engineer operates MCC continuously, the system favors managed AWS services, explicit data boundaries and recoverable sync jobs.',
  ];

  const engineeringDecisions = [
    {
      title: 'Use access groups as the tenancy boundary',
      text: 'Dashboard queries and backend endpoints consistently filter by Husqvarna access group, separating root administration from customer-scoped views.',
    },
    {
      title: 'Normalize vendor data before reads',
      text: 'Historical metrics are not calculated from the vendor API on every request. Scheduled Lambdas transform responses into DynamoDB access patterns that the dashboard can query predictably.',
    },
    {
      title: 'Keep OAuth exchange server-side',
      text: 'Next.js API routes handle the OAuth redirect and refresh-token exchange, so application secrets do not move into browser code.',
    },
    {
      title: 'Treat maps as operational data',
      text: 'Zone maps are GeoJSON files in S3, not hardcoded frontend assets. That keeps customer map data updateable without rebuilding the dashboard.',
    },
    {
      title: 'Reuse dashboard data in reports',
      text: 'PDFs are generated client-side with react-pdf. Charts are rendered, captured as images and reused inside reports so exported documents match the dashboard view.',
    },
    {
      title: 'Isolate vendor API volatility',
      text: 'The undocumented Husqvarna integration surface is confined to the sync and API layer. Fleet Services changes therefore do not require every chart and page to understand upstream response shapes.',
    },
    {
      title: 'Design for unattended operation',
      text: 'Serverless deployment, managed storage and scheduled ingestion minimize the number of services that require continuous operator attention.',
    },
  ];

  const supportSignals = [
    'Investigating why Utilization Summary can stop showing activity while Zones Coverage still proves that robots were mowing.',
    'Explaining utilization calculations when customer reports reveal domain rules such as parts of a site being mowed twice per week.',
    'Checking support for Husqvarna 580 EPOS and 540 EPOS robots used in a MowFleet hybrid setup.',
    'Scoping whether MCC can replace operational visibility no longer exposed to customer staff in Automower Connect: charging, no loop signal and cutting-height warnings.',
    'Helping future app work align with the existing backend data flow and MCC data model.',
  ];

  const nextSteps = [
    'Make sync jobs more chunked and parallel so large fleets do not run into long Lambda execution windows.',
    'Redesign the oldest DynamoDB access patterns around accessGroupId where it would reduce query cost and filtering.',
    'Add first-class alerting for operational thresholds such as no loop signal, low cutting height and stalled activity.',
    'Build better contract tests around Husqvarna response shapes, because the external API is the riskiest moving part.',
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
  <meta property="og:image" content={socialImageUrl} />
  <meta property="article:published_time" content={post.datePublished} />
  <meta property="article:modified_time" content={post.dateModified} />
  <meta name="twitter:card" content="summary_large_image" />
  <svelte:element this={"script"} type="application/ld+json">
    {serializeJsonLd(postSchema)}
  </svelte:element>
</svelte:head>

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
          Production B2B system · Full-stack ownership
        </p>
        <p class="mb-3 text-xs text-identifier/60">
          Published <time datetime={post.datePublished}>{formatPostDate(post.datePublished)}</time>
          · Updated <time datetime={post.dateModified}>{formatPostDate(post.dateModified)}</time>
        </p>
        <h1 class="blog-title">MowFleet Control Center: operating an autonomous mower fleet</h1>
        <p class="blog-lead">
          MowFleet runs fleets of autonomous Husqvarna mowers, and somebody has to answer the
          customer's simplest question: did the robots actually mow my lawn? I designed and built
          MowFleet Control Center — a Next.js dashboard on top of scheduled AWS ingestion,
          normalized DynamoDB data and S3-managed maps — to turn raw fleet telemetry into coverage,
          utilization, errors and reports people can act on. I still support it today.
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
        <h2 class="subtitle">The constraint that shapes everything</h2>
        <p class="mb-4">
          Nobody works on MCC full-time — not me, not anyone at MowFleet. Every technical choice
          answers to that: managed services over clever infrastructure, boring failure modes over
          elegant abstractions, sync jobs that recover on their own. My part covered requirements
          discovery, architecture, implementation and rollout, plus the support calls whenever a
          vendor API shifts under the product.
        </p>
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each operatingRhythm as item (item.label)}
            <div class="rhythm-card">
              <strong class="text-xl text-number">{item.value}</strong>
              <span class="mt-1 text-xs text-identifier/70">{item.label}</span>
            </div>
          {/each}
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          {#each facts as fact (fact)}
            <div class="border-l-2 border-keyword pl-4 text-sm">{fact}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Architecture: keep the vendor at arm's length</h2>
        <p class="mb-5">
          Husqvarna OAuth and an undocumented Fleet Services surface feed scheduled Lambda jobs. The
          jobs normalize external responses into DynamoDB tables, while GeoJSON zone data is stored
          in S3. The dashboard reads MowFleet-owned contracts instead of vendor response objects,
          limiting the impact of upstream changes. The architecture diagram is generated from
          Mermaid source stored with the implementation.
        </p>
        <ZoomableImage
          src="/blog/mowfleet-dashboard/architecture-light.svg"
          darkSrc="/blog/mowfleet-dashboard/architecture-dark.svg"
          alt="MowFleet Control Center architecture diagram"
          aspect="flow"
          figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded bg-base-100"
          caption="Current high-level architecture, generated from Mermaid source checked into both MowFleet repos."
        />
      </section>

      <section class="mb-10">
        <h2 class="subtitle">What operators get</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each productAreas as area (area.title)}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{area.title}</h3>
              <p class="mt-2 text-sm">{area.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Operator workflows</h2>
        <p class="mb-5">
          Operators need to correlate mower state, zone-level activity and customer reporting data.
          The screens are intentionally information-dense and organized around investigations such
          as a missed coverage target, an inactive machine or a discrepancy between utilization and
          recorded mowing sessions.
        </p>
        <div class="grid gap-5">
          {#each screenshots as screenshot (screenshot.src)}
            <ZoomableImage
              src={screenshot.src}
              alt={screenshot.alt}
              figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
              imageClass="w-full rounded border border-base-300"
              caption={screenshot.caption}
            />
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Two kinds of reads</h2>
        <p class="mb-5">
          Interactive authentication and selected live reads go through Husqvarna directly.
          Historical activity, utilization and error data are collected by scheduled jobs and served
          from MowFleet-owned AWS stores. This separates user-facing query latency from the
          availability and response shape of the vendor API.
        </p>
        <figure class="rounded border border-base-300 bg-base-100 p-4">
          <figcaption class="mb-4 text-sm text-declaration">
            From external fleet data to customer-facing operations
          </figcaption>
          <ol class="data-flow">
            {#each ['Husqvarna OAuth', 'Fleet Services API', 'Scheduled Lambda sync', 'DynamoDB + S3', 'MCC API endpoints', 'Dashboard + reports'] as stage, index (stage)}
              <li class="flow-node">
                <span class="text-[10px] text-keyword">0{index + 1}</span>
                <span class="mt-1">{stage}</span>
              </li>
            {/each}
          </ol>
        </figure>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">One pair of hands, the whole path</h2>
        <p class="mb-4">
          There was no frontend team, backend team or ops team to split this across — the same
          delivery scope ran from product discovery through vendor ingestion to the PDF a customer
          receives. Concretely:
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each deliverySignals as signal (signal)}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Design decisions</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each engineeringDecisions as decision (decision.title)}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{decision.title}</h3>
              <p class="mt-2 text-sm">{decision.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Actual tickets from production</h2>
        <p class="mb-4">
          Support here is concrete: something observable stops matching reality and I go find out
          why. A sample of real cases — vendor API changes eating statistics, robot compatibility
          checks, and operational visibility no longer available in the upstream product:
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each supportSignals as signal (signal)}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section>
        <h2 class="subtitle">What I'd tackle next</h2>
        <p class="mb-4">
          Most of the remaining risk lives at the vendor boundary and inside the biggest sync jobs,
          so that's where the next effort goes:
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
  .rhythm-card {
    display: flex;
    min-height: 5.5rem;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
    padding: 0.9rem;
  }

  .data-flow {
    display: grid;
    gap: 0.75rem;
    list-style: none;
    padding: 0;
    font-size: 0.875rem;
  }

  .flow-node {
    border: 1px solid color-mix(in srgb, var(--color-base-300) 80%, var(--color-identifier));
    border-radius: 6px;
    padding: 0.75rem;
    min-height: 3.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: color-mix(in srgb, var(--color-base-200) 92%, var(--color-background));
  }

  @media (min-width: 768px) {
    .data-flow {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .flow-node {
      position: relative;
    }

    .flow-node:not(:last-child)::after {
      position: absolute;
      top: 50%;
      right: -0.65rem;
      z-index: 1;
      width: 1.25rem;
      border-top: 1px solid var(--color-keyword);
      content: '';
    }
  }
</style>
