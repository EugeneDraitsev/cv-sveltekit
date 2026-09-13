# Eugene Draitsev — CV

My CV site. It is a normal prerendered SvelteKit page — work history, skills, blog — except
the header is a 3D galaxy you can fly into.

**Live: [eugene-draitsev.vercel.app](https://eugene-draitsev.vercel.app/)**

![Procedural spiral galaxy rendered above the About section](docs/galaxy.webp)

Click a marked star and the camera dives into its star system. Click a planet there and you
land on it, in a free camera, over terrain that is generated while you fly. The particle
field uses a fixed seed and each marked system, planet, biome and moon comes from its
particle index, so everyone gets the same galaxy — there is just a lot of it.

![Free flight over a procedurally generated gas giant](docs/planet.webp)

## Controls

| Action              | Desktop             | Touch       |
| ------------------- | ------------------- | ----------- |
| Open the galaxy     | hover or Explore    | Explore     |
| Enter a star system | click a star        | tap twice   |
| Land on a planet    | click it            | tap twice   |
| Look around         | drag                | drag        |
| Fly                 | `WASD` / arrows     | joystick    |
| Climb               | `Space`             | `⬆` button  |
| Descend             | `C`                 | `⬇` button  |
| Boost               | `Shift`             | `⚡` button |
| Go back             | `Esc` or top button | top button  |

The bottom dock provides Expand, Pause and Tune controls. Tune opens a Tweakpane panel for
spin, arm count, colors and particle parameters. On a planet, a flight instrument shows the
current biome, altitude above ground, speed and heading. Movement and drag look are damped;
the touch joystick supports simultaneous climb/descent and boost.

## How it works

**One seed per body.** `starSystem.ts` turns a galaxy particle index into a whole star
system: star class, planets, biomes, moons, names. Results are memoized, so the hover HUD,
the system scene and the planet surface all read the same data.

**Terrain height is written twice.** Once in GLSL for rendering, once in TypeScript for
placing plants and keeping the camera above ground. Both use the same constants, octave
counts and waterline math. CPU contract tests cover noise and terrain continuity; changes to
either implementation also need a GPU comparison. Climate blends dunes, ridges, terraces and
rolling ground, with vegetation density and palettes blending across biome boundaries.

**The ground is one grid that follows you.** It parks on whole grid cells under the camera
and samples world-anchored noise. The origin keeps the same base-cell snapping interval
while coverage changes, so changing altitude cannot suddenly shift the entire grid.

**Climbing zooms the grid out.** Altitude selects a power-of-two coverage level with
hysteresis; the grid and fog then morph toward it continuously, with the same vertex budget.
This hides the grid boundary without a sudden jump in the landscape or haze.

**Journeys follow camera completion.** Curved approaches, small banking turns and atmospheric
descent share the renderer's clock and ease to zero speed before navigation unlocks. The
next scene loads before departure and warms its shaders under the transition veil. Landing
follows a continuous path above the terrain, and outgoing flights bypass OrbitControls'
distance clamp. Return flights restore the previous viewpoint. Reduced-motion visits start
paused and skip the flights.

**Three.js is not in the initial load.** It loads on Explore or desktop hover inside the
hero. Scrolling, navigation and reading the CV leave it unloaded. The page is prerendered
HTML, icons are inline SVG, and sections below the fold use `content-visibility: auto`.

## Performance

Scores depend on the build, network and audit environment. The September 13, 2026 mobile
audit of the existing production deployment scored 98 for Performance. The original local
production build scored 99; the updated build scored 100 in the standard mobile preset,
with FCP 1.22 s, LCP 1.53 s and no blocking time. Accessibility, Best Practices and SEO also
scored 100. These are local lab measurements; the older report on the About page records
the June 19 deployment.

Blog and 3D styles load with their features, reducing the initial shared stylesheet from
47.41 to 26.26 KB. Selective module preloads discover the route and entry points early while
leaving connection capacity for the HTML. Star ratings use CSS clipping without measuring
offscreen elements during hydration.

The renderer starts at a capped DPR (1.25 on compact/constrained devices, 1.75 otherwise)
and adapts resolution from sustained frame times. Terrain uses 112 or 192 grid segments,
three height evaluations per vertex, and interpolated climate weights instead of repeating
climate noise per fragment. Flora generation is spread across frames and instance matrices
upload only when placement changes. Scene tasks stop while paused, off screen or in a
hidden tab; on-demand rendering can still paint a static view.

See [the performance notes](docs/performance.md) for measurements, validation and the
Three.js / TypeGPU decision. Lighthouse covers initial delivery; these scores do not measure
flight smoothness on a physical phone.

## Blog

[The blog](https://eugene-draitsev.vercel.app/blog) covers things I actually run: a Telegram
bot that has been in the same group chats since 2015, an operations dashboard for robot mower
fleets, and [Orb Knight](https://eugene-draitsev.vercel.app/blog/gamedevjs-2026) — a 3D
roguelite I built in 13 days with coding agents for Gamedev.js Jam 2026, which placed 6th in
Gameplay out of 495 entries. That post embeds live WebGL scenes straight from the game's
[Storybook](https://github.com/EugeneDraitsev/gamedevjs-2026), including the laser.

## Stack

- [SvelteKit](https://kit.svelte.dev/) with Svelte 5 runes, fully prerendered
- [Threlte](https://threlte.xyz/) / [Three.js](https://threejs.org/), with custom GLSL for the
  galaxy, star systems, terrain, sky, water and speed lines
- [Tailwind CSS v4](https://tailwindcss.com/), themed after a JetBrains syntax palette
- Vercel

## Develop

```bash
bun install
bun run dev
```

Other scripts: `bun run lint` (Oxlint), `bun run format` (Oxfmt), `bun run check`
(svelte-check), `bun run test:unit` (generation and CPU noise contracts), `bun run test:e2e`
(production build plus Playwright), `bun run build` and `bun run preview`. `bun run verify` runs
the whole set, and GitHub Actions runs the same thing plus Chromium smoke tests on pull requests
and pushes to `main`.

Two notes on that toolchain.

Oxlint and Oxfmt are the only linter and formatter here — ESLint and Prettier are gone. Oxlint
reads the `<script>` block of a `.svelte` file but not the template, so Svelte-specific template
rules are not enforced; `bun run check` still covers template types and the compiler's
accessibility warnings.

Type checking runs on **TypeScript 7**: `@typescript/native` is the 7.x compiler and `--tsgo`
tells svelte-check to use it. The `typescript@~6` devDependency next to it is not a leftover —
svelte-check refuses to start unless both are installed, so bumping `typescript` to 7 breaks
`bun run check` entirely. `bun update --latest` will try exactly that; re-pin it afterwards.

## Deploy

Pushing to `main` deploys to Vercel. Two things that will waste an afternoon if you do not
know them:

- **Use Bun everywhere.** `bun.lock` is committed and CI installs with
  `bun install --frozen-lockfile`. `package-lock.json` stays ignored — an npm lockfile
  generated on Windows misses the Linux native bindings for rolldown and breaks the build.
- **Keep `adapter-auto` in the config, but keep `adapter-vercel` installed.** Pointing the
  config straight at `@sveltejs/adapter-vercel` cannot finish a local build on Windows
  because of symlink permissions in the functions output, so the config uses `adapter-auto`,
  which does nothing locally and picks the Vercel adapter in CI. The Vercel adapter still has
  to be a devDependency though: without it, `adapter-auto` shells out to `bun add` in the
  middle of the build, that install re-resolves the whole tree, and a CJS consumer ends up on
  the ESM-only `estree-walker@3` — `No "exports" main defined`, build dead.
