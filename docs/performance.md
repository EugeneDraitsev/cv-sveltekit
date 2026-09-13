# Performance and flight update — September 13, 2026

## Initial delivery

Lighthouse 12.8.2, mobile preset, simulated Slow 4G / 4× CPU throttling. Local
measurements use production builds served by `vite preview` over HTTP/1.1. These
are individual lab runs, not field data or a statistically significant speedup.

| Build / endpoint              | Performance | Accessibility / Best Practices / SEO | FCP    | LCP    | TBT   |
| ----------------------------- | ----------- | ------------------------------------ | ------ | ------ | ----- |
| Existing live deployment      | 98          | 100 / 100 / 100                      | 1.52 s | 1.63 s | 10 ms |
| Original local build          | 99          | 100 / 100 / 100                      | 1.57 s | 1.91 s | 3 ms  |
| Updated local build           | 99          | 100 / 100 / 100                      | 1.66 s | 1.90 s | 36 ms |
| Smoothed flights / split CSS  | 100         | 100 / 100 / 100                      | 1.22 s | 1.53 s | 0 ms  |
| Follow-up, independent repeat | 100         | 100 / 100 / 100                      | 1.22 s | 1.62 s | 0 ms  |
| Final build, tuning panel fix | 100         | 100 / 100 / 100                      | 1.22 s | 1.54 s | 0 ms  |
| PR build, original favicon    | 100         | 100 / 100 / 100                      | 1.21 s | 1.61 s | 0 ms  |

The final local desktop-preset run scored 100 in all four categories, with FCP
0.33 s, LCP 0.44 s and TBT 0 ms. Mobile and desktop presets use different
throttling and scoring curves.

Do not compare the live endpoint directly to localhost to attribute a gain.
The first update's local LCP difference was small enough to be measurement noise.
The follow-up reduces both first paint and LCP through CSS delivery and module
discovery. The existing deployment's Speed Index was 3.27 s; its waterfall warrants
checking again after deployment. The June 19 all-100 report remains a historical
snapshot on the About page.

The shared stylesheet had grown past the previous 40 KB inlining threshold,
putting it back on the critical request path. The 64 KB threshold covers it; CSS is
also split into shared/CV, article and interactive-3D entries. The initial shared
asset drops from 47.41 to 26.26 KB (gzip 9.24 to 5.89 KB). Articles keep their own
typography and utilities, including direct About visits.

The prerender hook preloads the route and entry modules instead of every shared
dependency (four initial hints instead of fourteen). This avoids competing with
HTML delivery while still discovering hydration code early. Disabling all hints
improved FCP but delayed LCP, so that variant was discarded. No artificial startup
delay, audit detection or disabled hydration is used. Star-rating clipping is now
CSS-only, removing geometry reads from offscreen components during hydration.

Three.js now loads only after Explore or desktop hover inside the hero; ordinary
scrolling and CV navigation do not initialize WebGL. Destination scenes and the
debug panel remain separate lazy imports.

## Rendering and responsiveness

- Compact screens or devices with at most four logical cores start with a 1.25
  DPR ceiling; other devices use 1.75. Sustained slow frames reduce DPR down to
  0.75, while sustained headroom restores it gradually. This is a conservative
  heuristic, not GPU detection. Resolution changes pause during guided travel to
  avoid reallocating the drawing buffer in the middle of a flight.
- Terrain grids use 112 or 192 segments. Vertex normals use three height samples
  including the center, and the fragment shader reuses interpolated climate
  weights. CPU and GPU still share the same underlying height/climate equations.
- Flora placement is generated in bounded batches. Instance transforms and colors
  upload only when placement changes. Paused, hidden and offscreen scene tasks
  stop; on-demand rendering still handles the first static frame.
- Camera completion drives scene changes and unlocks controls. Each scene owns
  its camera reference, preventing the outgoing camera from capturing an incoming
  flight. Camera position, orientation and veil use the scene's frame clock.
- Quintic easing gives zero endpoint velocity and acceleration. Flights last
  2.6–3.2 seconds per scene, with restrained banking; orbital motion freezes during
  guided approaches. OrbitControls are suspended, and departures release them
  without reapplying their distance limits. Previously that clamp snapped a system
  departure back inward in its final frame.
- Planet entry starts at the exact animated pose and follows a continuous curve
  lifted above intermediate ridges. It no longer jumps from one initial altitude
  to another or follows every bump under the camera. Grid coverage and fog morph
  together rather than switching abruptly at an altitude threshold.
- Incoming scenes compile their shader programs before their flight clock starts.
  Vegetation allocates its instance-color attribute before this warmup.

Desktop Chromium and touch emulation at 390 × 844 / DPR 3 completed
galaxy → system → planet → system → galaxy without page errors. Touch tests used
simultaneous joystick and boost input, verified release, and measured a canvas DPR
of approximately 1.25. CPU/GPU transform-feedback checks across 42 samples on seven
planet archetypes found maximum height error 0.00079 and climate-weight error
0.00032. All 15 unit tests and seven Chromium smoke tests passed. Reduced-motion
navigation completed the same round trip with a static planet; an interrupted
initial import recovered through the reload action.

The follow-up repeated the desktop and touch round trips. A WebGL view-matrix
capture verified the departure endpoint no longer snaps inward; the regression
test also exercises real OrbitControls with a restrictive `maxDistance`. Landing
tests sample terrain clearance along the full curve across four system seeds.
The lazy tuning panel uses explicit inline placement: its default draggable child
previously left the overflow container with zero height. Browser verification
checked the visible panel, regeneration and Escape dismissal after the fix.

Touch emulation on an RTX 4070 Ti does not establish real phone frame rates.
Profile a physical midrange Android phone and iPhone before raising render budgets.
Check frame-time percentiles during landing, flight through vegetation, and return
travel; repeat after a few minutes to include thermal throttling. Initial-load
Lighthouse scores do not include these interactive workloads.

## Three.js and TypeGPU

Keep Three.js for this update, but do not rule out
[TypeGPU](https://docs.swmansion.com/TypeGPU/why-typegpu/). It provides typed GPU
programming and can work **with** Three.js through
[`@typegpu/three`](https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-three/).
Potential useful work includes computing and caching terrain height, normals and
biome weights once, then reusing them instead of evaluating procedural noise at
every vertex on every frame. A renderer replacement by itself does not remove
pixel overdraw, geometry cost or CPU placement work.

The current scenes use custom GLSL ShaderMaterial programs. Three.js's
[WebGPU renderer migration guide](https://threejs.org/manual/en/webgpurenderer)
requires moving these to node materials / TSL. That is a shader migration plus
cross-backend visual validation. TypeGPU's
[WebGL compatibility layer](https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-gl/)
is experimental and supports a subset of WebGPU capabilities.

A useful next experiment is one isolated terrain renderer using the same seed,
camera path, resolution and geometry budget, compared on physical devices. A
measured frame-time win with acceptable fallback coverage would justify a wider
migration. This update does not claim or assume one.

The camera bugs fixed here are independent of the GPU API. Initial-load
Lighthouse also runs before Three.js is loaded, so a GPU migration cannot explain
or improve those current first-load scores.

## SvelteKit 3 prerelease

On September 13, the registry reports stable Kit `2.70.3` and next
`3.0.0-next.27`. The project uses the stable release. The official
[migration guide](https://next.svelte.dev/docs/kit/migrating-to-sveltekit-3)
requires Node 22.17+ (the local Node runtime is 22.13.1), changes configuration
placement and migrates `$lib` aliases and application imports. This is a separate
compatibility migration, with no demonstrated benefit to the current WebGL frame
loop or first paint. The mobile 100 result above uses Kit 2.

## Reproduce

```sh
bun install --frozen-lockfile
bun run verify
bun run test:e2e
bun run preview -- --host 127.0.0.1 --port 4173
npx --yes lighthouse@12.8.2 http://127.0.0.1:4173 --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless --no-sandbox" --output=json --output-path=output/playwright/lighthouse-mobile.json
```

In PowerShell, quote the entire `--only-categories=...` argument so the commas are
not interpreted as an array. Local screenshots and audit JSON are in the ignored
`output/playwright/` directory. Restart `vite preview` after rebuilding so its
manifest and hashed assets belong to the same build.
