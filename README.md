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

| Action              | Desktop            | Touch       |
| ------------------- | ------------------ | ----------- |
| Enter a star system | click a star       | tap it      |
| Land on a planet    | click it           | tap it      |
| Look around         | drag               | drag        |
| Fly                 | `WASD` / arrows    | joystick    |
| Climb               | `Space`            | `⬆` button  |
| Boost               | `Shift`            | `⚡` button |
| Go back             | button, top center | same        |

The galaxy view has a Tweakpane panel (tune icon, bottom left) for spin, arm count, colors
and particle parameters.

## How it works

**One seed per body.** `starSystem.ts` turns a galaxy particle index into a whole star
system: star class, planets, biomes, moons, names. Results are memoized, so the hover HUD,
the system scene and the planet surface all read the same data.

**Terrain height is written twice.** Once in GLSL for rendering, once in TypeScript for
placing plants and keeping the camera above ground. Both use the same constants, octave
counts and waterline math. Unit tests compare CPU samples against recorded values so the two
cannot drift apart unnoticed.

**The ground is one grid that follows you.** It parks on whole grid cells under the camera
and the noise offset is snapped to the same cells, so vertices always sample the same world
positions. Feed it a continuous offset instead and the whole landscape shimmers.

**Climbing zooms the grid out.** The same vertex budget covers more ground in power-of-two
steps, and fog range grows with it. Without this you eventually see the edge of the grid
hanging in the air, which is what the fog is there to prevent.

**Transitions follow the camera, not a timer.** The veil that covers a scene swap gets its
opacity per frame from the outgoing camera move — diving into a star, dropping through
atmosphere — and the incoming scene dissolves it as it arrives.

**Three.js is not in the initial load.** It sits in a lazy chunk that loads after the first
interaction, so someone who just reads the page never pays for WebGL parsing or particle
generation. The page itself is prerendered HTML, icons are inline SVG instead of an icon
runtime, and sections below the fold use `content-visibility: auto`.

## Performance

Production scores 100 across all four Lighthouse categories on both the mobile and desktop
presets, with 0 ms total blocking time and no layout shift.

Worth knowing if you audit this locally: `vite preview` serves over HTTP/1.1, and
Lighthouse's simulator serializes the modulepreload chain per connection, so mobile sits at
99 there no matter what. Test against production or any HTTP/2 server over the build output.
Lighthouse only covers initial delivery — runtime WebGL profiling and manual accessibility
checks are separate.

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

Two notes on that toolchain. Oxlint and Oxfmt are the only linter and formatter here — ESLint and
Prettier are gone. Oxlint reads the `<script>` block of a `.svelte` file but not the template, so
Svelte-specific template rules are not enforced; `bun run check` still covers template types and
the compiler's accessibility warnings. And `check` runs svelte-check against the TypeScript 7
native compiler, which it only accepts with a 6.x install alongside it and the `--tsgo` flag —
that is why both `typescript` and `@typescript/native` are devDependencies.

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
