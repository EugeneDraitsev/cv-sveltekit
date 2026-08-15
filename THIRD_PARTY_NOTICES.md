# Third-party notices

## Simplex noise

The terrain shaders include simplex-noise code derived from the Ashima Arts / Stefan
Gustavson `webgl-noise` implementations. Those implementations are distributed under the
MIT License. The adapted shader chunks are identified in
`src/lib/components/three/chunks/` and mirrored by the CPU implementation in
`src/lib/components/three/noise.ts`.

Source: <https://github.com/ashima/webgl-noise>

## Galaxy study

The original galaxy study was inspired by Bruno Simon's Three.js Journey animated-galaxy
lesson. The current implementation adds its own procedural system generation, navigation,
terrain, flight and performance-loading architecture.

Reference: <https://threejs-journey.com/lessons/animated-galaxy>

This notice documents provenance and does not grant a license for the rest of this
repository.
