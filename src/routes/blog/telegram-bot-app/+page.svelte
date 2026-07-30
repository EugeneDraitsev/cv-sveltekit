<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';

  const repoUrl = 'https://github.com/EugeneDraitsev/telegram-bot-app';
  const uiUrl = 'https://github.com/EugeneDraitsev/telegram-bot-ui';

  const projectFacts = [
    'In continuous use since the first commit on July 16, 2015',
    'TypeScript monorepo organized with Bun workspaces',
    'grammY webhook ingress deployed with AWS Lambda and Serverless Framework',
    'Independent workers for commands, agent replies, activity tracking and broadcasts',
    'DynamoDB for durable chat events, statistics and WebSocket connection state',
    'Upstash Redis for short-lived model context, scoped memory and time-series metrics',
    'Provider-specific adapters and explicit fallback routes across multiple LLM vendors',
    'Next.js companion application for search, live statistics and rendered Telegram images',
  ];

  const timeline = [
    {
      title: 'Single-process command bot',
      text: 'The first implementation handled utility commands such as currency, weather and search in one Telegram process. This was sufficient while execution was fast and state was local.',
    },
    {
      title: 'Command registry and shared integrations',
      text: 'As the command surface expanded, handlers moved behind a registry with common validation, response and integration helpers. This reduced coupling between Telegram routing and feature code.',
    },
    {
      title: 'Asynchronous workload isolation',
      text: 'The webhook became a thin ingress Lambda. Model calls, statistics, broadcasts and media work moved to separate workers so Telegram acknowledgement time no longer depended on downstream latency.',
    },
    {
      title: 'Durable events and observable output',
      text: 'Chat events moved into DynamoDB, while WebSockets, search and a PNG renderer exposed operational data through Telegram and the companion application.',
    },
    {
      title: 'Controlled agent execution',
      text: 'The agent path added reply gating, provider routing, tool execution, memory and multimodal context without replacing deterministic ingress, timeout handling or failure telemetry.',
    },
  ];

  const highlights = [
    { value: '2015', label: 'first commit' },
    { value: '2', label: 'connected apps' },
    { value: 'Async', label: 'worker model' },
    { value: 'Live', label: 'stats + metrics' },
  ];

  const engineeringDecisions = [
    {
      title: 'Isolate Telegram ingress',
      text: 'The Telegram-facing Lambda validates and routes an update, then invokes the relevant worker. It does not block on statistics, model calls, image generation or WebSocket fanout.',
    },
    {
      title: 'Apply a default-ignore reply policy',
      text: 'Direct mentions and deterministic address checks run first. Ambiguous messages reach a structured reply classifier; rejected messages never allocate model context or tools.',
    },
    {
      title: 'Schedule tools deterministically',
      text: 'A typed registry defines tool contracts. Rate-limited tools run sequentially, content generation waits for data-gathering tools, and every call has an explicit timeout.',
    },
    {
      title: 'Make provider failover explicit',
      text: 'Every model call records success, timeout or error state. The chat path can route to a configured secondary provider when the primary model fails.',
    },
    {
      title: 'Assemble context after admission',
      text: 'Recent history, media attachments and chat-scoped memory are loaded only after the reply policy accepts the message, reducing latency and unnecessary token use.',
    },
    {
      title: 'Record model and tool telemetry',
      text: 'Model and tool calls emit status, latency, model, provider and fallback source. Production failures can therefore be attributed to a specific execution stage.',
    },
  ];

  const projectSignals = [
    'Group-chat messages use a default-ignore policy; the bot must earn each response.',
    'Telegram ingress acknowledges updates without waiting for model or media execution.',
    'History and memory are scoped by chat and loaded only for admitted agent turns.',
    'Provider, tool and delivery failures are recorded as separate operational events.',
  ];

  const nextSteps = [
    'Build a replay harness from redacted production conversations.',
    'Track response quality, reply-gate precision, tool success and latency by feature.',
    'Add review and audit flows for dynamic tools and memory mutations.',
    'Extract the ingress, provider and tool-runtime boundaries into reusable packages.',
  ];
</script>

<svelte:head>
  <title>Telegram agent architecture | Eugene Draitsev</title>
  <meta
    name="description"
    content="Architecture of a long-running Telegram agent system with Lambda ingress, asynchronous workers, reply gating, scoped context, tools, failover and runtime metrics."
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
        Back to posts
      </a>

      <div class="mt-6 mb-8">
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">
          Long-running production side project · 2015–present
        </p>
        <h1 class="blog-title">
          Telegram agent architecture: from commands to asynchronous workers
        </h1>
        <p class="blog-lead">
          This bot has lived in the same group chats since 2015. It started as a single command
          handler; today it's a TypeScript monorepo with Lambda ingress, asynchronous workers,
          provider-routed model calls, tools, scoped memory and metrics. This post walks through the
          boundaries that appeared as load, latency and failures stopped being theoretical — and why
          most of them exist to protect the webhook, not the model.
        </p>
        <div class="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={repoUrl}
            target="_blank"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-app
          </a>
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={uiUrl}
            target="_blank"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-ui
          </a>
        </div>
      </div>

      <section class="mb-10">
        <h2 class="subtitle">The model call is the easy part</h2>
        <p class="mb-4">
          In an active group chat the hard questions sit upstream of any LLM: should the bot answer
          at all, how fast can the webhook acknowledge, how much context is actually worth loading,
          and when a provider fails at 2am — which stage do you blame? The architecture is shaped by
          those questions, not by the model.
        </p>
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each highlights as highlight}
            <div class="highlight-card">
              <strong class="text-xl text-number">{highlight.value}</strong>
              <span class="mt-1 text-xs text-identifier/70">{highlight.label}</span>
            </div>
          {/each}
        </div>
        <ul class="list-disc space-y-2 pl-5">
          {#each projectSignals as signal}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Webhook and worker boundaries</h2>
        <p class="mb-5">
          The Telegram-facing Lambda accepts an update, performs inexpensive routing and invokes a
          worker. Agent replies, activity aggregation, broadcasts, search and PNG rendering run in
          separate execution paths. A slow provider or failed render therefore does not extend the
          webhook request or block unrelated features.
        </p>
        <ZoomableImage
          src="/blog/telegram-bot/architecture-light.svg"
          darkSrc="/blog/telegram-bot/architecture-dark.svg"
          alt="Telegram bot architecture diagram"
          aspect="flow"
          figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded bg-base-100"
          caption="Current async worker architecture, including the sharp-renderer lambda for Telegram PNG images."
        />
      </section>

      <section class="mb-10">
        <h2 class="subtitle">What it runs on today</h2>
        <div class="grid gap-3 md:grid-cols-2">
          {#each projectFacts as fact}
            <div class="border-l-2 border-keyword pl-4 text-sm">{fact}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Reply gating and context assembly</h2>
        <p class="mb-5">
          Group-chat traffic uses a default-ignore policy. Direct mentions and deterministic address
          checks run before the model-based reply classifier. History, memory and tool definitions
          are loaded only after the message is admitted to the agent path.
        </p>
        <figure class="rounded border border-base-300 bg-base-100 p-4">
          <figcaption class="mb-4 text-sm text-declaration">
            Reply decision, context, tools and final delivery
          </figcaption>
          <ol class="agent-flow">
            {#each ['Address checks', 'Reply gate', 'History + memory', 'Model routing', 'Tool execution', 'Telegram delivery'] as stage, index}
              <li class="diagram-node">
                <span class="text-[10px] text-keyword">0{index + 1}</span>
                <span class="mt-1">{stage}</span>
              </li>
            {/each}
          </ol>
        </figure>
        <p class="mt-5">
          The typed tool registry covers web and image search, media generation, weather, code
          execution, history lookup, memory updates and dynamic commands. Execution order, timeout
          and rate-limit behavior are defined by the runtime rather than left to the model.
        </p>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">How it got here</h2>
        <div class="grid gap-5">
          {#each timeline as item, index}
            <div class="grid gap-2 border-b border-base-300 pb-5 md:grid-cols-[80px_1fr]">
              <div class="text-number">0{index + 1}</div>
              <div>
                <h3 class="text-xl text-constant">{item.title}</h3>
                <p class="mt-1">{item.text}</p>
              </div>
            </div>
          {/each}
        </div>
        <ZoomableImage
          src="/blog/telegram-bot/architecture-legacy.png"
          alt="Legacy Telegram bot architecture diagram"
          figureClass="mt-8 overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded bg-base-100"
          caption="Legacy architecture diagram from an earlier version of the bot."
        />
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Decisions that keep it debuggable</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each engineeringDecisions as decision}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{decision.title}</h3>
              <p class="mt-2 text-sm">{decision.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section>
        <h2 class="subtitle">What's next</h2>
        <p class="mb-4">
          The missing piece is repeatable evaluation. Metrics tell me where execution failed, but
          not whether an answer got better or worse after a prompt or model change. A replay corpus
          built from redacted production conversations would turn "feels smarter" into something I
          can actually measure before deploying.
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
  .highlight-card {
    display: flex;
    min-height: 5.5rem;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
    padding: 0.9rem;
  }

  .agent-flow {
    display: grid;
    gap: 0.75rem;
    list-style: none;
    padding: 0;
  }

  .diagram-node {
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
    .agent-flow {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .diagram-node {
      position: relative;
    }

    .diagram-node:not(:last-child)::after {
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
