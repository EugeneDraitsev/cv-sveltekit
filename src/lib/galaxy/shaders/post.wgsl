// Bloom chain, filmic tone mapping and the light-theme "ink on paper" grade.
// Requires common.wgsl and the `post` uniforms.

fn bloomTap(uv: vec2f) -> vec3f {
  return textureSampleLevel(srcTex, linearSampler, uv, 0.0).rgb;
}

// One downsample-and-blur step; the first level also applies a soft threshold.
fn bloomDown(uv: vec2f) -> vec4f {
  let texel: vec2f = vec2f(1.0) / vec2f(textureDimensions(srcTex));
  var col: vec3f = bloomTap(uv) * 0.20;
  col = col + bloomTap(uv + texel * vec2f(1.4, 1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(-1.4, 1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(1.4, -1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(-1.4, -1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(3.0, 0.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(-3.0, 0.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(0.0, 3.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(0.0, -3.0)) * 0.08;
  if (f32(textureDimensions(srcTex).x) == post.viewport.x) {
    let bright: f32 = max(col.r, max(col.g, col.b));
    col = col * smoothstep(0.2, 1.0, bright);
  }
  return vec4f(min(col, vec3f(64.0)), 1.0);
}

fn acesFilm(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + vec3f(0.03))) / (x * (2.43 * x + vec3f(0.59)) + vec3f(0.14)), vec3f(0.0), vec3f(1.0));
}

/** The tone-mapped image (linear) at `uv`. */
fn toned(uv: vec2f, bloom: f32) -> vec3f {
  let hdr: vec3f = textureSampleLevel(srcTex, linearSampler, uv, 0.0).rgb;
  let glow: vec3f = textureSampleLevel(bloom0, linearSampler, uv, 0.0).rgb * 0.18
    + textureSampleLevel(bloom1, linearSampler, uv, 0.0).rgb * 0.24
    + textureSampleLevel(bloom2, linearSampler, uv, 0.0).rgb * 0.28
    + textureSampleLevel(bloom3, linearSampler, uv, 0.0).rgb * 0.30;
  return acesFilm((hdr + glow * bloom) * post.look.x);
}

// Light theme: the galaxy printed like a risograph, in three spot inks. Each
// ink has its own separation of the image (blue for the arms and stars,
// fluorescent pink for nebulae and star-forming knots, yellow for the warm
// core, which overprints with the pink to orange), laid down as a stochastic
// grain and multiplied onto the paper: clean colours, no grey wash.
fn separations(c: vec3f) -> vec3f {
  let l: f32 = max(c.r, max(c.g, c.b));
  let hue: vec3f = c / max(l, 0.0001);
  let neutral: f32 = 1.0 - (l - min(c.r, min(c.g, c.b))) / max(l, 0.0001);
  // The overexposed core is nearly white: it prints warm, not as a pale hole.
  let warm: f32 = max(clamp((hue.r - hue.b) * 2.2, 0.0, 1.0), smoothstep(0.8, 1.0, l) * neutral);
  let cool: f32 = clamp((hue.b - hue.r) * 2.0 + 0.35, 0.0, 1.0);
  let red: f32 = clamp((hue.r - hue.g) * 2.5, 0.0, 1.0);
  let amount: f32 = pow(smoothstep(0.02, 0.95, l), 0.6);
  // Faint red glows are the nebulae: they get a pink tint of their own. The
  // dim outer arms keep a light blue one, while the darkest specks of the far
  // sky stay clean paper.
  let faint: f32 = smoothstep(0.01, 0.06, l) * (1.0 - smoothstep(0.06, 0.2, l));
  let dim: f32 = smoothstep(0.03, 0.14, l) * (1.0 - smoothstep(0.14, 0.4, l));
  // No blue in the core itself: overprinted on its orange it reads as dirt.
  let blue: f32 = (amount + dim * 0.25) * cool * (1.0 - smoothstep(0.5, 0.9, warm));
  let pink: f32 = amount * max(red, warm * 0.5) + faint * red * red * 0.9;
  // Yellow is for the core: dim warm specks would only read as dirt.
  let yellow: f32 = amount * warm * 0.95 * smoothstep(0.04, 0.25, l);
  return clamp(vec3f(blue, pink, yellow), vec3f(0.0), vec3f(1.0));
}

fn grainNoise(cell: vec2f, layer: f32) -> f32 {
  return hash21(cell + vec2f(layer * 131.7, layer * 71.3));
}

fn composite(uv: vec2f, pixel: vec2f) -> vec4f {
  let lightMix: f32 = post.look.z;
  var col: vec3f = toned(uv, post.look.y * (1.0 - 0.3 * lightMix));
  if (lightMix > 0.001) {
    // About one grain per CSS pixel on every screen.
    let grain: f32 = max(1.0, floor(post.viewport.w * 0.9 + 0.5));
    let cell: vec2f = floor(pixel / grain);
    let sep: vec3f = separations(col);
    // The pink drum sits slightly out of register, as on a real riso.
    let shift: vec2f = vec2f(1.5, -1.0) * post.viewport.w / post.viewport.xy;
    let pink: f32 = separations(toned(uv + shift, post.look.y * 0.7)).y;
    let blueOn: f32 = step(grainNoise(cell, 0.0), sep.x);
    let pinkOn: f32 = step(grainNoise(cell, 1.0), pink);
    let yellowOn: f32 = step(grainNoise(cell, 2.0), sep.z);
    var printed: vec3f = pow(post.paper.rgb, vec3f(2.2));
    // Riso blue #0078bf, fluorescent pink #ff48b0, yellow #ffe800 (linear).
    printed = printed * mix(vec3f(1.0), vec3f(0.0, 0.188, 0.522), blueOn);
    printed = printed * mix(vec3f(1.0), vec3f(1.0, 0.065, 0.434), pinkOn);
    printed = printed * mix(vec3f(1.0), vec3f(1.0, 0.807, 0.0), yellowOn);
    col = mix(col, printed, lightMix);
  }
  let centered: vec2f = uv - vec2f(0.5);
  let vignette: f32 = 1.0 - dot(centered, centered) * post.paper.w * (1.0 - lightMix);
  col = col * vignette;
  // Dark theme: the deepest black is the page colour itself, so the hero has
  // no seam against the page around it (paper is sRGB, col is linear).
  let lifted: vec3f = pow(post.paper.rgb, vec3f(2.2)) * post.ink.w * (1.0 - lightMix);
  col = lifted + col * (vec3f(1.0) - lifted);
  var display: vec3f = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  // Triangular dither hides banding in the dark gradients.
  let n: f32 = hash21(pixel + vec2f(fract(post.viewport.z) * 61.0)) + hash21(pixel.yx + vec2f(17.3)) - 1.0;
  display = display + vec3f(n / 255.0);
  return vec4f(display, 1.0);
}
