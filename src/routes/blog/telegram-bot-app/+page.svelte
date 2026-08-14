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
    { key: 'runtime', value: 'TypeScript monorepo · Bun workspaces · Serverless Framework' },
    { key: 'ingress', value: 'grammY webhook on AWS Lambda, routing only' },
    { key: 'transport', value: 'three FIFO SQS queues, one dead-letter queue each' },
    { key: 'durable', value: 'DynamoDB — chat events, per-user counters, authorization' },
    { key: 'ephemeral', value: 'Upstash Redis — memory, 24h history, metrics, leases' },
    { key: 'models', value: 'GPT-5.6 Luna primary, Gemini declared fallback' },
    { key: 'frontend', value: 'Next.js on Vercel, private live statistics' },
  ];

  const pipeline = [
    {
      name: 'enabled check',
      detail: 'chat-configuration · 5s cache · consistent read on a miss',
      exit: 'disabled',
    },
    {
      name: 'idempotency lease',
      detail: 'redis · six minutes · outlives the lambda timeout',
      exit: 'duplicate',
    },
    {
      name: 'reply gate',
      detail: 'one classification · engage or ignore · default ignore',
      exit: 'ignore',
    },
    { name: 'context', detail: '24h history and chat-scoped memory, loaded only now' },
    { name: 'model and tools', detail: 'GPT-5.6 Luna, Gemini fallback, typed tool registry' },
    { name: 'delivery', detail: 'reply sent, lease swapped for a three-hour marker' },
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
      title: 'order per chat, parallel across chats',
      text: 'Every queue is FIFO with the Telegram chat id as MessageGroupId, so one chat stays ordered while unrelated chats run concurrently. Workers use batchSize 1 and partial batch responses, so a poisoned message cannot take its neighbours down with it.',
    },
    {
      title: 'fail closed on authorization',
      text: 'Ingress reads one DynamoDB item before enqueuing agent work: an owner-level allow flag and an admin-level toggle, cached five seconds per warm instance with a strongly consistent read on a miss. If DynamoDB errors the message is skipped rather than let through, and the failure raises an alarm.',
    },
    {
      title: 'assume every message arrives twice',
      text: 'SQS delivery is at-least-once and a sent Telegram message cannot be recalled. Reply and agent jobs take a six-minute Redis lease before doing anything; it outlives the five-minute Lambda timeout, so it needs no heartbeat. Success swaps it for a three-hour completed marker, failure releases it for a clean retry.',
    },
    {
      title: 'let the data be its own idempotency key',
      text: 'The activity worker needs no lease at all. Its chat event is written in one transaction with the message counter, conditional on the event key being free, and that key is derived from the message id. Replaying a message cancels the whole transaction, so counters cannot drift.',
    },
    {
      title: 'treat routing signals as hints, not proof',
      text: 'A mention or a reply-to is evidence that someone might be talking to the bot, not that they are. Both are passed into the gate prompt and explicitly marked unreliable, so typing the bot name in a sentence about the bot does not earn an answer.',
    },
    {
      title: 'attribute failures to a stage',
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

      <header class="mt-6 mb-10">
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
        <div class="mt-5 flex flex-wrap gap-4 text-sm">
          <a class="repo-link" href={repoUrl} target="_blank" rel="noreferrer">
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-app
          </a>
          <a class="repo-link" href={uiUrl} target="_blank" rel="noreferrer">
            <Icon icon="mdi:github" height="18" width="18" />
            telegram-bot-ui
          </a>
        </div>

        <dl class="stat-strip">
          {#each highlights as highlight (highlight.label)}
            <div class="stat">
              <dt class="stat-value">{highlight.value}</dt>
              <dd class="stat-label">{highlight.label}</dd>
            </div>
          {/each}
        </dl>
      </header>

      <section class="mb-12">
        <h2 class="section-heading">The model call is the easy part</h2>
        <p class="mb-6">
          In an active group chat the hard questions sit upstream of any LLM. Should the bot answer
          at all? Telegram wants an acknowledgement in seconds, so what fits in that budget? The
          queue will hand you the same message twice — what happens the second time? Those questions
          shaped the architecture. The model call is one step near the end of it.
        </p>
        <ZoomableImage
          src="/blog/telegram-bot/architecture-overview-light.svg"
          darkSrc="/blog/telegram-bot/architecture-overview-dark.svg"
          alt="Telegram bot architecture overview"
          aspect="flow"
          figureClass="mt-2 overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded"
          caption="System overview: ingress, queues, workers and the stores behind them."
        />
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Webhook, queues, workers</h2>
        <p class="mb-6">
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
          figureClass="mt-2 overflow-hidden rounded border border-base-300 bg-base-100 p-3"
          imageClass="w-full rounded"
          caption="One update, three lanes: activity, registered commands, agent."
        />
        <p class="mt-6">
          Three separate queues mean a stuck agent turn cannot delay statistics, and a broken command
          cannot block agent replies. Each lane has its own dead-letter queue; more than three
          visible messages in any of them sends an email.
        </p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">What an admitted message walks through</h2>
        <p class="mb-6">
          Group chats default to ignoring, and most of this pipeline exists to drop work as early
          and as cheaply as possible. Three of the six stages can end the turn; only a message that
          survives all three is allowed to cost anything.
        </p>
        <ol class="pipeline">
          {#each pipeline as step, index (step.name)}
            <li class="pipeline-step">
              <span class="pipeline-index">{String(index + 1).padStart(2, '0')}</span>
              <span class="pipeline-name">{step.name}</span>
              <span class="pipeline-detail">{step.detail}</span>
              {#if step.exit}
                <span class="pipeline-exit">{step.exit} → stop</span>
              {/if}
            </li>
          {/each}
        </ol>
        <p class="pipeline-note">
          Registered agent commands skip the gate — an explicit command is already an explicit ask.
        </p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Reply gating and context assembly</h2>
        <p>
          The gate is one small model call returning engage or ignore, and it runs on every eligible
          message. Mention and reply-to flags are handed to it as context explicitly marked
          unreliable, rather than used as a shortcut — otherwise anyone could summon the bot by
          typing its name while talking about it. History, memory and tool definitions load only
          after admission, so an ignored message costs one cheap classification and nothing else.
          The typed tool registry covers web and image search, media generation, weather, code
          execution, history lookup and memory updates; execution order, timeouts and rate limits
          belong to the runtime, not to the model.
        </p>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">Decisions that keep it debuggable</h2>
        <div class="decisions">
          {#each decisions as decision (decision.title)}
            <article class="decision">
              <h3 class="decision-title">{decision.title}</h3>
              <p class="decision-text">{decision.text}</p>
            </article>
          {/each}
        </div>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">What it runs on</h2>
        <dl class="spec">
          {#each stack as row (row.key)}
            <div class="spec-row">
              <dt class="spec-key">{row.key}</dt>
              <dd class="spec-value">{row.value}</dd>
            </div>
          {/each}
        </dl>
      </section>

      <section class="mb-12">
        <h2 class="section-heading">How it got here</h2>
        <ol class="timeline">
          {#each timeline as item, index (item.title)}
            <li class="timeline-item">
              <span class="timeline-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3 class="timeline-title">{item.title}</h3>
                <p class="timeline-text">{item.text}</p>
              </div>
            </li>
          {/each}
        </ol>

        <details class="archive">
          <summary class="archive-summary">Earlier architecture diagrams</summary>
          <div class="mt-6 grid gap-8">
            <ZoomableImage
              src="/blog/telegram-bot/architecture-2026-06-light.svg"
              darkSrc="/blog/telegram-bot/architecture-2026-06-dark.svg"
              alt="Telegram bot architecture as of June 2026"
              aspect="flow"
              figureClass="mt-2 overflow-hidden rounded border border-base-300 bg-base-100 p-3"
              imageClass="w-full rounded"
              caption="June 2026, before the diagram was split into separate views."
            />
            <ZoomableImage
              src="/blog/telegram-bot/architecture-legacy.png"
              alt="Legacy Telegram bot architecture diagram"
              figureClass="mt-2 overflow-hidden rounded border border-base-300 bg-base-100 p-3"
              imageClass="w-full rounded"
              caption="The original diagram, from the single-process era."
            />
          </div>
        </details>
      </section>

      <section>
        <h2 class="section-heading">What's missing</h2>
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
  /* Headings read as code comments, matching the editor palette of the site. */
  .section-heading {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
    color: var(--color-declaration);
    font-size: 1.5rem;
    line-height: 1.25;
  }

  .section-heading::before {
    content: '//';
    color: color-mix(in srgb, var(--color-identifier) 38%, transparent);
    font-size: 1.1rem;
  }

  @media (min-width: 640px) {
    .section-heading {
      font-size: 1.875rem;
    }
  }

  .repo-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-constant) 45%, transparent);
    padding-bottom: 2px;
    color: var(--color-constant);
    transition:
      border-color 160ms ease,
      opacity 160ms ease;
  }

  .repo-link:hover {
    border-bottom-color: var(--color-constant);
  }

  /* Numbers, not boxes: hairlines carry the grouping. */
  .stat-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 2.5rem;
    border-top: 1px solid var(--color-base-300);
  }

  .stat {
    border-bottom: 1px solid var(--color-base-300);
    padding: 1rem 0.25rem;
  }

  .stat + .stat {
    border-left: 1px solid var(--color-base-300);
    padding-left: 1rem;
  }

  .stat-value {
    color: var(--color-number);
    font-size: 1.65rem;
    line-height: 1;
  }

  .stat-label {
    margin-top: 0.45rem;
    color: color-mix(in srgb, var(--color-identifier) 62%, transparent);
    font-size: 0.75rem;
  }

  @media (min-width: 640px) {
    .stat-strip {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .stat:nth-child(3) {
      border-left: 1px solid var(--color-base-300);
      padding-left: 1rem;
    }
  }

  @media (max-width: 639px) {
    .stat:nth-child(3) {
      border-left: 0;
      padding-left: 0.25rem;
    }
  }

  /* Execution trace: stages on a rail, with the exits that end a turn. */
  .pipeline {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--color-base-300);
  }

  .pipeline-step {
    display: grid;
    grid-template-columns: 2.25rem 1fr;
    align-items: baseline;
    gap: 0.15rem 0.75rem;
    border-bottom: 1px solid var(--color-base-300);
    padding: 0.85rem 0.5rem 0.85rem 0;
    transition: background-color 160ms ease;
  }

  .pipeline-step:hover {
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
  }

  .pipeline-index {
    color: var(--color-keyword);
    font-size: 0.7rem;
  }

  .pipeline-name {
    color: var(--color-identifier);
  }

  .pipeline-detail {
    grid-column: 2;
    color: color-mix(in srgb, var(--color-identifier) 62%, transparent);
    font-size: 0.85rem;
  }

  .pipeline-exit {
    grid-column: 2;
    margin-top: 0.35rem;
    color: var(--color-keyword);
    font-size: 0.75rem;
  }

  .pipeline-note {
    margin-top: 1rem;
    color: color-mix(in srgb, var(--color-identifier) 55%, transparent);
    font-size: 0.8rem;
  }

  @media (min-width: 768px) {
    .pipeline-step {
      grid-template-columns: 2.25rem 11rem 1fr auto;
      gap: 1rem;
    }

    .pipeline-detail,
    .pipeline-exit {
      grid-column: auto;
      margin-top: 0;
    }

    .pipeline-exit {
      text-align: right;
      white-space: nowrap;
    }
  }

  /* Decision titles as lowercase comments; the body carries the weight. */
  .decisions {
    display: grid;
    gap: 1.75rem;
  }

  .decision-title {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    color: var(--color-string);
    font-size: 1rem;
  }

  .decision-title::before {
    content: '//';
    color: color-mix(in srgb, var(--color-identifier) 38%, transparent);
  }

  .decision-text {
    margin-top: 0.6rem;
    font-size: 0.9rem;
  }

  @media (min-width: 768px) {
    .decisions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2rem 2.5rem;
    }
  }

  /* Aligned key/value block, like a config file. */
  .spec {
    border-top: 1px solid var(--color-base-300);
  }

  .spec-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.2rem;
    border-bottom: 1px solid var(--color-base-300);
    padding: 0.7rem 0;
  }

  .spec-key {
    color: var(--color-keyword);
    font-size: 0.85rem;
  }

  .spec-value {
    font-size: 0.9rem;
  }

  @media (min-width: 640px) {
    .spec-row {
      grid-template-columns: 8.5rem 1fr;
      gap: 1.5rem;
      align-items: baseline;
    }
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    gap: 1rem;
    border-left: 1px solid var(--color-base-300);
    padding: 0 0 1.75rem 1.25rem;
  }

  .timeline-item:last-child {
    border-left-color: transparent;
    padding-bottom: 0;
  }

  .timeline-index {
    position: relative;
    color: var(--color-number);
    font-size: 0.8rem;
  }

  .timeline-index::before {
    position: absolute;
    top: 0.45rem;
    left: -1.55rem;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-base-300);
    content: '';
  }

  .timeline-title {
    color: var(--color-constant);
    font-size: 1.05rem;
  }

  .timeline-text {
    margin-top: 0.4rem;
    font-size: 0.9rem;
  }

  .archive {
    margin-top: 2.5rem;
    border-top: 1px solid var(--color-base-300);
    padding-top: 1.25rem;
  }

  .archive-summary {
    cursor: pointer;
    color: color-mix(in srgb, var(--color-identifier) 70%, transparent);
    font-size: 0.85rem;
    list-style: none;
    transition: color 160ms ease;
  }

  .archive-summary::-webkit-details-marker {
    display: none;
  }

  .archive-summary::before {
    display: inline-block;
    width: 1.1rem;
    color: var(--color-keyword);
    content: '+';
  }

  .archive[open] .archive-summary::before {
    content: '−';
  }

  .archive-summary:hover {
    color: var(--color-identifier);
  }
</style>
