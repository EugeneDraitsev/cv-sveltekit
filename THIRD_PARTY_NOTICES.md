# Third-party notices

## Noise

Earlier versions of the terrain shaders adapted simplex-noise code from the Ashima Arts /
Stefan Gustavson `webgl-noise` implementations (MIT License). The current renderer no longer
uses it: its gradient, fractal, ridged and cellular noise in
`src/lib/galaxy/shaders/noise.wgsl` and the CPU twin in `src/lib/galaxy/world/noise.ts` hash
integer lattice coordinates with the PCG3D hash described by Jarzynski and Olano, "Hash
Functions for GPU Rendering" (JCGT, 2020).

Source of the earlier code: <https://github.com/ashima/webgl-noise>

## Atmosphere

The atmosphere shaders use the analytic Chapman-function approximation for optical depth
popularised by Christian Schüler ("An Approximation to the Chapman Grazing-Incidence
Function for Atmospheric Scattering", GPU Pro 3, 2012).

## Galaxy study

The original galaxy study was inspired by Bruno Simon's Three.js Journey animated-galaxy
lesson. The current implementation is a separate TypeGPU renderer with its own procedural
system generation, navigation, terrain, flight and loading architecture.

Reference: <https://threejs-journey.com/lessons/animated-galaxy>

This notice documents provenance and does not grant a license for the rest of this
repository.
