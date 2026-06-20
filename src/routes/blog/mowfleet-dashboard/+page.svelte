<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '@iconify/svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';

  const facts = [
    'I designed and built the MCC architecture from scratch across dashboard, backend, data model and deployment shape.',
    'Hobby-freelance project where I periodically help MowFleet maintain and extend MCC.',
    'MCC stands for MowFleet Control Center: an operations dashboard for autonomous mower fleets.',
    'MowFleet does not have a full-time software engineer on staff for this product, so the system has to be self-explanatory and low-maintenance.',
    'Next.js dashboard with React, Tailwind, daisyUI, SWR, Chart.js, Google Maps and react-pdf.',
    'Serverless Framework backend on AWS Lambda, API Gateway, DynamoDB and S3 in eu-central-1.',
    'Husqvarna OAuth and Fleet Services APIs are the source of users, access groups, mower state, utilization and errors.',
    'The backend still works on top of a partly reverse-engineered Husqvarna web/Fleet Services surface.',
    'Scheduled sync lambdas collect activity every 5 minutes, access groups hourly, and utilization/errors every 2 hours.',
    'Most maintenance is small and occasional: I usually only need to step in when the vendor API or MowFleet operations change.',
    'The app supports dashboard analytics, zones, maps, mower lists, activity history, settings and PDF reports.',
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
    'Discovery was domain-heavy: autonomous mowing operations, customer reporting, access-group permissions, field staff workflows and vendor API constraints had to be understood before the system shape was obvious.',
    'The work covered the full path from technical scoping and system design to production rollout: frontend, backend, storage, scheduled sync, auth, maps, charts and reports.',
    'The product is adopted enough that later requests come from real operational gaps, not hypothetical roadmap ideas: report correctness, mobile app data access, EPOS robots, monitoring and missing Automower Connect signals.',
    'The system had to be maintainable by a non-engineering company between support windows, which forced boring infrastructure, clear data boundaries and pragmatic trade-offs over cleverness.',
  ];

  const engineeringDecisions = [
    {
      title: 'Treat access groups as the product boundary',
      text: 'The dashboard and backend consistently filter by Husqvarna access groups, which lets MowFleet separate root-admin workflows from customer-facing views.',
    },
    {
      title: 'Normalize external API data before showing it',
      text: 'Historical metrics are not read directly from the vendor API on every page load. Scheduled lambdas collect and shape data into DynamoDB tables that the dashboard can query predictably.',
    },
    {
      title: 'Keep secrets and token exchange server-side',
      text: 'Next.js API routes handle the OAuth redirect and refresh-token exchange, so application secrets do not move into browser code.',
    },
    {
      title: 'Store maps as operational content',
      text: 'Zone maps are GeoJSON files in S3, not hardcoded frontend assets. That keeps customer map data updateable without rebuilding the dashboard.',
    },
    {
      title: 'Use pragmatic reporting',
      text: 'PDFs are generated client-side with react-pdf. Charts are rendered, captured as images and reused inside reports so exported documents match the dashboard view.',
    },
    {
      title: 'Accept vendor API volatility as a maintenance reality',
      text: 'The backend deliberately isolates the slightly reverse-engineered Husqvarna integration from the UI. When Fleet Services changes, the failure surface is mostly the sync/API layer, not every chart and page.',
    },
    {
      title: 'Design for rare maintenance',
      text: 'Because MowFleet does not have a dedicated engineer for MCC, the architecture favors simple Serverless deployment, durable managed storage and small support interventions over an always-attended system.',
    },
  ];

  const supportSignals = [
    'Investigating why Utilization Summary can stop showing activity while Zones Coverage still proves that robots were mowing.',
    'Explaining utilization calculations when customer reports reveal domain rules such as parts of a site being mowed twice per week.',
    'Checking support for Husqvarna 580 EPOS and 540 EPOS robots used in a MowFleet hybrid setup.',
    'Scoping whether MCC can replace visibility that Husqvarna removed from Automower Connect for customer staff: charging, no loop signal and cutting-height warnings.',
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
  <title>MowFleet Control Center project notes | Eugene Draitsev</title>
  <meta
    name="description"
    content="Project notes on MowFleet Control Center, a hobby-freelance dashboard and serverless backend for autonomous mower fleet operations, analytics, zone coverage and reports."
  />
</svelte:head>

<main class="overlapped blog-page">
  <article class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <a
        class="inline-flex items-center gap-2 text-sm text-constant underline"
        href={resolve('/blog')}
      >
        <Icon icon="mdi:arrow-left" height="18" width="18" />
        Back to blog
      </a>

      <div class="mt-6 mb-8">
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">Hobby-freelance project</p>
        <h1 class="blog-title">MowFleet Control Center: dashboard for autonomous mower fleets</h1>
        <p class="blog-lead">
          MCC is a production dashboard I designed and built from scratch for MowFleet and their
          customers. It turns Husqvarna Fleet Services data into operational views for autonomous
          mower fleets: utilization, zone coverage, mower activity, errors, maps, savings and PDF
          reports.
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
        <h2 class="subtitle">Why it matters</h2>
        <p class="mb-4">
          This is not a portfolio demo. It is a long-lived, practical B2B tool that still works
          even though MowFleet does not have an engineer on staff continuously maintaining it. The
          interesting part is the ownership shape: understand the customer workflow, design the
          system, ship it, leave it stable enough to run, then come back for small changes when the
          vendor API or the field operation changes.
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          {#each facts as fact}
            <div class="border-l-2 border-keyword pl-4 text-sm">{fact}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Architecture</h2>
        <p class="mb-5">
          The dashboard is a Next.js app, but the real architecture is the whole operational data
          loop. MCC depends on Husqvarna OAuth, a partly reverse-engineered Fleet Services/web API
          surface, scheduled AWS Lambda sync jobs, DynamoDB query models and S3-backed map/report
          data. I added the Mermaid source and SVG generation to the MowFleet repos so the diagram
          can be updated with the system instead of living only in this blog post.
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
        <h2 class="subtitle">What the dashboard does</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each productAreas as area}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{area.title}</h3>
              <p class="mt-2 text-sm">{area.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Product surface</h2>
        <p class="mb-5">
          The UI is intentionally operational: dense charts, concrete mower state, zone-level
          evidence and reports that MowFleet can use with customers. Most screens exist because
          somebody needed to answer a field question, not because the dashboard needed another
          widget.
        </p>
        <div class="grid gap-5">
          {#each screenshots as screenshot}
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
        <h2 class="subtitle">Data flow</h2>
        <p class="mb-5">
          MCC has two data paths. Interactive auth and some live data go through Husqvarna directly.
          Historical operational data is collected by backend sync jobs and served from MowFleet's
          AWS data stores.
        </p>
        <figure class="rounded border border-base-300 bg-base-100 p-4">
          <figcaption class="mb-4 text-sm text-declaration">
            From external fleet data to customer-facing operations
          </figcaption>
          <div class="grid gap-3 text-sm md:grid-cols-6">
            <div class="flow-node">Husqvarna OAuth</div>
            <div class="flow-node">Fleet Services API</div>
            <div class="flow-node">Scheduled Lambda sync</div>
            <div class="flow-node">DynamoDB + S3</div>
            <div class="flow-node">MCC API endpoints</div>
            <div class="flow-node">Dashboard + reports</div>
          </div>
        </figure>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Delivery signal</h2>
        <p class="mb-4">
          The useful signal here is not the stack by itself. It is the end-to-end delivery pattern:
          ambiguous external systems, direct customer context, production rollout, measurable
          workflow value and enough judgment to keep a small company moving without turning every
          request into a large engineering program.
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each deliverySignals as signal}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Engineering decisions</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each engineeringDecisions as decision}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{decision.title}</h3>
              <p class="mt-2 text-sm">{decision.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Ongoing support</h2>
        <p class="mb-4">
          The project stays interesting because the operational questions are not static. Recent
          mail threads are about concrete production problems: broken statistics after Fleet
          Services changes, EPOS robot support, monitoring gaps, and making the backend data model
          understandable enough for a future mobile app collaboration.
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each supportSignals as signal}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section>
        <h2 class="subtitle">What I would improve next</h2>
        <p class="mb-4">
          The current architecture works, but the next useful improvements are mostly about
          resilience: cheaper queries, smaller sync units, stronger vendor API contracts and
          clearer alerting for customer operations.
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each nextSteps as step}
            <li>{step}</li>
          {/each}
        </ul>
      </section>
    </div>
  </article>
</main>

<style>
  .flow-node {
    border: 1px solid color-mix(in srgb, var(--color-base-300) 80%, var(--color-identifier));
    border-radius: 6px;
    padding: 0.75rem;
    min-height: 3.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: color-mix(in srgb, var(--color-base-200) 92%, var(--color-background));
  }
</style>
