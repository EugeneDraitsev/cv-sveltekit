<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '@iconify/svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';

  const repoUrl = 'https://github.com/EugeneDraitsev/telegram-bot-app';
  const uiUrl = 'https://github.com/EugeneDraitsev/telegram-bot-ui';

  const projectFacts = [
    'First committed on July 16, 2015',
    'TypeScript monorepo running on Bun workspaces',
    'grammY Telegram bot with AWS Lambda and Serverless Framework',
    'Async workers for commands, agent replies, activity tracking and broadcasts',
    'DynamoDB for chat statistics, chat events and WebSocket connections',
    'Upstash Redis for AI chat history, memory and metrics',
    'Multiple LLM providers behind provider-aware model helpers',
    'Next.js/Vercel companion UI for search, rendered PNG images and live stats',
  ];

  const timeline = [
    {
      title: '2015: local chat utility',
      text: 'The repository started as a practical set of small features for local Telegram chats: helpers, jokes, commands, currency, weather and search-like utilities.',
    },
    {
      title: 'Command platform',
      text: 'The bot accumulated deterministic commands and integrations, then needed a cleaner command registry and shared helpers instead of one growing handler.',
    },
    {
      title: 'Production split',
      text: 'The webhook became a thin ingress lambda. Slow work moved into async workers so Telegram requests return quickly and each concern can scale independently.',
    },
    {
      title: 'Stats and UI',
      text: 'Chat events moved into DynamoDB. A WebSocket runtime, search endpoint and PNG renderer made statistics, activity charts and currency cards visible in Telegram and the companion UI.',
    },
    {
      title: 'Agentic layer',
      text: 'The bot gained a reply gate, model loop, tools, memory, recent history, multimodal context, dynamic commands and fallback behavior for model calls.',
    },
  ];

  const engineeringDecisions = [
    {
      title: 'Thin webhook ingress',
      text: 'The Telegram-facing lambda only routes and invokes workers. It does not wait for statistics, model calls, image generation or WebSocket fanout.',
    },
    {
      title: 'Reply gate before the agent',
      text: 'Group chats need a default-ignore policy. Deterministic address checks run first, then a structured model decision decides whether the bot should engage.',
    },
    {
      title: 'Tool loop with guardrails',
      text: 'Tools are exposed through a typed registry, rate-limited tools can run sequentially, content tools are deferred until data-gathering tools finish, and every tool call has a timeout.',
    },
    {
      title: 'Provider-aware model fallback',
      text: 'Model calls record success, timeout and error states. The main chat model can fall back to another provider/model when the primary path fails.',
    },
    {
      title: 'Memory and history as product primitives',
      text: 'Recent chat history, media attachments and scoped memory are loaded only after the reply gate confirms that a response is useful.',
    },
    {
      title: 'Metrics over guesses',
      text: 'Model calls and tool calls write time-series metrics with status, latency, model name and fallback source. That makes failure modes visible.',
    },
  ];

  const projectSignals = [
    'Takes a messy real-world workflow and separates it into deployable production boundaries.',
    'Balances user experience, cost, latency and reliability in an AI-heavy product surface.',
    'Turns model behavior into concrete routing, fallback, telemetry and tool-execution decisions.',
    'Keeps improving the system through operational feedback instead of treating the prototype as the finish line.',
  ];

  const nextSteps = [
    'Build a replay/evaluation harness from real conversations with redacted fixtures.',
    'Track answer quality, refusal quality, tool success and latency by chat and feature.',
    'Add admin review flows for dynamic tools and memory changes.',
    'Promote the strongest patterns into reusable templates for other bots or agent systems.',
  ];
</script>

<svelte:head>
  <title>Telegram bot project notes | Eugene Draitsev</title>
  <meta
    name="description"
    content="Project notes on a Telegram bot that evolved from local chat utilities into an agentic production system with AWS Lambda, tools, memory, metrics and live stats."
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
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">Long-running side project</p>
        <h1 class="blog-title">Telegram bot: from local chat utility to agentic system</h1>
        <p class="blog-lead">
          The first commit in this repository was on July 16, 2015. It started as a collection of
          practical features for local chats and turned into an agentic production system: async AWS
          workers, a reply gate, model fallback, tool execution, memory, metrics, live stats and a
          separate UI.
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
        <h2 class="subtitle">Why it matters</h2>
        <p class="mb-4">
          The interesting part is not that it calls an LLM. The useful part is the system around the
          model: routing, context construction, tool safety, memory, telemetry, UI feedback and
          production boundaries. Those are the patterns I keep running into when turning AI features
          into real product workflows.
        </p>
        <ul class="list-disc space-y-2 pl-5">
          {#each projectSignals as signal}
            <li>{signal}</li>
          {/each}
        </ul>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Architecture</h2>
        <p class="mb-5">
          The webhook is intentionally small. It classifies incoming Telegram updates and dispatches
          async Lambda invokes to workers that own the real work, including replies, stats fanout,
          search and PNG rendering.
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
        <h2 class="subtitle">Project facts</h2>
        <div class="grid gap-3 md:grid-cols-2">
          {#each projectFacts as fact}
            <div class="border-l-2 border-keyword pl-4 text-sm">{fact}</div>
          {/each}
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Agent loop</h2>
        <p class="mb-5">
          The agent path is built as a product workflow, not as one giant prompt. Each stage has a
          clear responsibility and observable failure mode.
        </p>
        <figure class="rounded border border-base-300 bg-base-100 p-4">
          <figcaption class="mb-4 text-sm text-declaration">
            Reply decision, context, tools and final delivery
          </figcaption>
          <div class="grid gap-3 text-sm md:grid-cols-6">
            <div class="diagram-node">Address checks</div>
            <div class="diagram-node">Reply gate</div>
            <div class="diagram-node">History + memory</div>
            <div class="diagram-node">Model routing</div>
            <div class="diagram-node">Tool execution</div>
            <div class="diagram-node">Telegram delivery</div>
          </div>
        </figure>
        <p class="mt-5">
          Available tools include web search, image search, image generation, voice generation,
          weather, code execution, history lookup, memory updates, randomization, GIF/video search
          and dynamic command creation.
        </p>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">How it evolved</h2>
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

      <section>
        <h2 class="subtitle">What I would improve next</h2>
        <p class="mb-4">
          The system already has tests and runtime metrics. The next useful step is stronger evals:
          replay known conversations, preserve the failure modes, and make model or prompt changes
          measurable before they reach users.
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
  .diagram-node {
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
