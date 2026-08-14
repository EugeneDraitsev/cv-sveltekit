<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';

  const repoUrl = 'https://github.com/EugeneDraitsev/telegram-bot-app';
  const uiUrl = 'https://github.com/EugeneDraitsev/telegram-bot-ui';

  const highlights = [
    { value: '2015', label: 'first commit' },
    { value: '9.6M', label: 'chat events stored' },
    { value: '3', label: 'queues and workers' },
    { value: '10s', label: 'webhook budget' },
  ];

  const stack = [
    'TypeScript monorepo on Bun workspaces, deployed with Serverless Framework',
    'grammY webhook on AWS Lambda, ingress does routing only',
    'Three FIFO SQS queues with dead-letter queues and CloudWatch alarms',
    'DynamoDB for chat events, per-user counters and chat authorization',
    'Upstash Redis for scoped memory, 24h history, metrics and worker leases',
    'GPT-5.6 Luna as the primary model, Gemini as the declared fallback',
    'Next.js companion app on Vercel for private live statistics',
  ];

  const timeline = [
    {
      title: 'Single-process command bot',
      text: 'Currency, weather and search handled inline in one Telegram process. Fine while everything was fast and state was local.',
    },
    {
      title: 'Command registry',
      text: 'Handlers moved behind a registry with shared validation and integration helpers, which decoupled Telegram routing from feature code.',
    },
    {
      title: 'Thin ingress, async workers',
      text: 'The webhook became a routing Lambda. Model calls, statistics and media moved out, so Telegram acknowledgement stopped depending on downstream latency.',
    },
    {
      title: 'Durable queues between them',
      text: 'Direct invocations became FIFO SQS queues with dead-letter queues and idempotency markers. A worker crash now costs a retry instead of a dropped message.',
    },
    {
      title: 'Gated agent execution',
      text: 'The agent path added reply gating, provider routing, tools and scoped memory behind a fail-closed authorization check in DynamoDB.',
    },
  ];

  const decisions = [
    {
      title: 'Order per chat, parallel across chats',
      text: 'Every queue is FIFO with the Telegram chat id as MessageGroupId, so one chat stays ordered while unrelated chats run concurrently. Workers use batchSize 1 and partial batch responses, so a poisoned message cannot take its neighbours down with it.',
    },
    {
      title: 'Fail closed on authorization',
      text: 'Ingress reads one DynamoDB item before enqueuing agent work: an owner-level allow flag and an admin-level toggle, cached five seconds per warm instance with a strongly consistent read on a miss. If DynamoDB errors the message is skipped rather than let through, and the failure raises an alarm.',
    },
    {
      title: 'Assume every message arrives twice',
      text: 'SQS delivery is at-least-once and a sent Telegram message cannot be recalled. Reply and agent jobs take a six-minute Redis lease before doing anything; it outlives the five-minute Lambda timeout, so it needs no heartbeat. Success swaps it for a three-hour completed marker, failure releases it for a clean retry.',
    },
    {
      title: 'Let the data be its own idempotency key',
      text: 'The activity worker needs no lease at all. Its chat event is written in one transaction with the message counter, conditional on the event key being free, and that key is derived from the message id. Replaying a message cancels the whole transaction, so counters cannot drift.',
    },
    {
      title: 'Admit first, then spend',
      text: 'Group chats use a default-ignore policy. Deterministic address checks run before the model-based reply gate, and history, memory and tool definitions load only after a message is admitted. Rejected messages never allocate context.',
    },
    {
      title: 'Attribute failures to a stage',
      text: 'Model and tool calls record status, latency, provider and fallback source. When something breaks at 2am the question is which stage failed, not whether the bot feels broken.',
    },
  ];
</script>

<svelte:head>
  <title>Telegram agent architecture | Eugene Draitsev</title>
  <meta
    name="description"
    content="Architecture of a Telegram bot running since 2015: Lambda ingress, FIFO queues, idempotent workers, a fail-closed authorization gate, reply gating and provider failover."
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
          This bot has lived in the same group chats since 2015. It started as one command handler
          and is now a TypeScript monorepo with a routing-only webhook, three queue-backed workers,
          a fail-closed authorization gate and an agent loop with tools and scoped memory. Almost
          every boundary in it exists to protect the webhook or to survive a redelivery — not to
          make the model smarter.
        </p>
        <div class="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-app
          </a>
          <a
            class="inline-flex items-center gap-2 text-constant underline"
            href={uiUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-ui
          </a>
        </div>
      </div>

      <section class="mb-10">
        <h2 class="subtitle">The model call is the easy part</h2>
        <p class="mb-6">
          In an active group chat the hard questions sit upstream of any LLM. Should the bot answer
          at all? Telegram wants an acknowledgement in seconds, so what fits in that budget? The
          queue will hand you the same message twice — what happens the second time? Those questions
          shaped the architecture. The model call is one step near the end of it.
        </p>
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each highlights as highlight (highlight.label)}
            <div class="highlight-card">
              <strong class="text-xl text-number">{highlight.value}</strong>
              <span class="mt-1 text-xs text-identifier/70">{highlight.label}</span>
            </div>
          {/each}
        </div>
        <ZoomableImage
          src="/blog/telegram-bot/architecture-overview-light.svg"
          darkSrc="/blog/telegram-bot/architecture-overview-dark.svg"
          alt="Telegram bot architecture overview"
          aspect="flow"
          figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded bg-base-100"
          caption="System overview: ingress, queues, workers and the stores behind them."
        />
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Webhook, queues, workers</h2>
        <p class="mb-5">
          The Telegram-facing Lambda does two things: one cached authorization read, and routing.
          Every update is enqueued for the activity worker, registered commands go to the reply
          worker, and anything that could reach the agent goes to the agent worker. Then it returns.
          It never waits for a model, a render or a database write, which is what keeps the webhook
          inside its budget no matter how slow a provider is that day.
        </p>
        <ZoomableImage
          src="/blog/telegram-bot/architecture-message-path-light.svg"
          darkSrc="/blog/telegram-bot/architecture-message-path-dark.svg"
          alt="Message path from Telegram update to reply"
          aspect="flow"
          figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded bg-base-100"
          caption="One update, three lanes: activity, registered commands, agent."
        />
        <p class="mt-5">
          Three separate queues mean a stuck agent turn cannot delay statistics, and a broken command
          cannot block agent replies. Each lane has its own dead-letter queue; more than three
          visible messages in any of them sends an email.
        </p>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Decisions that keep it debuggable</h2>
        <div class="grid gap-5 md:grid-cols-2">
          {#each decisions as decision (decision.title)}
            <div class="border-t border-base-300 pt-4">
              <h3 class="text-lg text-constant">{decision.title}</h3>
              <p class="mt-2 text-sm">{decision.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Reply gating and context assembly</h2>
        <p class="mb-5">
          Direct mentions and deterministic address checks run first and cost nothing. Only genuinely
          ambiguous messages reach the model-based reply gate, and only admitted messages get
          history, memory and tool definitions loaded. The typed tool registry covers web and image
          search, media generation, weather, code execution, history lookup and memory updates;
          execution order, timeouts and rate limits belong to the runtime, not to the model.
        </p>
        <figure class="rounded border border-base-300 bg-base-100 p-4">
          <figcaption class="mb-4 text-sm text-declaration">
            Reply decision, context, tools and final delivery
          </figcaption>
          <ol class="agent-flow">
            {#each ['Address checks', 'Reply gate', 'History + memory', 'Model routing', 'Tool execution', 'Telegram delivery'] as stage, index (stage)}
              <li class="diagram-node">
                <span class="text-[10px] text-keyword">0{index + 1}</span>
                <span class="mt-1">{stage}</span>
              </li>
            {/each}
          </ol>
        </figure>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">What it runs on</h2>
        <div class="grid gap-3 md:grid-cols-2">
          {#each stack as item (item)}
            <div class="border-l-2 border-keyword pl-4 text-sm">{item}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">How it got here</h2>
        <div class="grid gap-5">
          {#each timeline as item, index (item.title)}
            <div class="grid gap-2 border-b border-base-300 pb-5 md:grid-cols-[80px_1fr]">
              <div class="text-number">0{index + 1}</div>
              <div>
                <h3 class="text-xl text-constant">{item.title}</h3>
                <p class="mt-1">{item.text}</p>
              </div>
            </div>
          {/each}
        </div>

        <details class="archive">
          <summary>Earlier architecture diagrams</summary>
          <div class="mt-5 grid gap-6">
            <ZoomableImage
              src="/blog/telegram-bot/architecture-2026-06-light.svg"
              darkSrc="/blog/telegram-bot/architecture-2026-06-dark.svg"
              alt="Telegram bot architecture as of June 2026"
              aspect="flow"
              figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
              imageClass="w-full rounded bg-base-100"
              caption="Architecture as of June 2026, before the diagram was split into separate views."
            />
            <ZoomableImage
              src="/blog/telegram-bot/architecture-legacy.png"
              alt="Legacy Telegram bot architecture diagram"
              figureClass="overflow-hidden rounded border border-base-300 bg-base-100 p-3"
              imageClass="w-full rounded bg-base-100"
              caption="The original diagram, from the single-process era."
            />
          </div>
        </details>
      </section>

      <section>
        <h2 class="subtitle">What's missing</h2>
        <p>
          Repeatable evaluation. Metrics say which stage failed, not whether an answer got better
          after a prompt or model change. A replay corpus built from redacted production
          conversations would turn "feels smarter" into something measurable before deploying. That
          is the next piece of work.
        </p>
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

  .archive {
    margin-top: 2rem;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
    padding: 1rem;
  }

  .archive summary {
    cursor: pointer;
    color: var(--color-constant);
    font-size: 0.95rem;
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
